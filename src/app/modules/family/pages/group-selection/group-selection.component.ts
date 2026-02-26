import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  DestroyRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';

import { FamilyService } from '../../services/family.service';
import { FamilyCreateDialogComponent } from '../../dialogs/family-create-dialog/family-create-dialog.component';
import { FamilyJoinDialogComponent } from '../../dialogs/family-join-dialog/family-join-dialog.component';
import { Family, FamilyMemberRole } from 'src/app/util/models/family.model';
import { Auth } from '@angular/fire/auth';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import * as FamilyActions from '../../store/family.actions';

// ─── View Model ──────────────────────────────────────────────────────────────

export type GroupType = 'family' | 'trip' | 'work' | 'other';

export interface UserGroup {
  id: string;
  name: string;
  type: GroupType;
  memberCount: number;
  role: FamilyMemberRole;
  balance?: number;
  monthlySpend?: number;
  lastActivityAt?: Date;
  pinned: boolean;
  isActive: boolean;
  currency: string;
  inviteCode: string;
  ownerUserId: string;
}

// ─── Helper: detect group type from name ─────────────────────────────────────

function inferGroupType(name: string): GroupType {
  const lower = name.toLowerCase();
  if (lower.includes('trip') || lower.includes('travel') || lower.includes('holiday')) return 'trip';
  if (lower.includes('work') || lower.includes('office') || lower.includes('team')) return 'work';
  if (lower.includes('room') || lower.includes('flat') || lower.includes('house')) return 'other';
  return 'family';
}

const GROUP_TYPE_ICON: Record<GroupType, string> = {
  family: 'family_restroom',
  trip: 'flight_takeoff',
  work: 'work',
  other: 'groups',
};

const GROUP_TYPE_LABEL: Record<GroupType, string> = {
  family: 'Family',
  trip: 'Trip',
  work: 'Work',
  other: 'Group',
};

const PINNED_KEY = 'pinned_family_ids';

// ─── Component ───────────────────────────────────────────────────────────────

type LoadState = 'loading' | 'loaded' | 'empty' | 'error';

@Component({
  selector: 'app-group-selection',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatRippleModule,
    MatChipsModule,
    MatMenuModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatListModule,
    MatTooltipModule,
  ],
  templateUrl: './group-selection.component.html',
  styleUrls: ['./group-selection.component.scss'],
})
export class GroupSelectionComponent implements OnInit {
  private familyService = inject(FamilyService);
  private auth = inject(Auth);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private store = inject(Store<AppState>);

  // ─── State ─────────────────────────────────────────────────────────────────

  loadState = signal<LoadState>('loading');
  groups = signal<UserGroup[]>([]);
  errorMessage = signal<string>('');
  confirmPending = signal<{ action: 'leave' | 'delete'; group: UserGroup } | null>(null);

  readonly activeGroupId = this.familyService.activeFamilyId;

  // ─── Derived ───────────────────────────────────────────────────────────────

  activeGroup = computed(() =>
    this.groups().find(g => g.id === this.activeGroupId()) ?? null
  );

  pinnedGroups = computed(() =>
    this.groups().filter(g => g.pinned && g.id !== this.activeGroupId())
  );

  quickSwitchGroups = computed(() => {
    const active = this.activeGroupId();
    return this.groups()
      .filter(g => g.id !== active)
      .slice(0, 6);
  });

  // ─── Helpers (exposed to template) ─────────────────────────────────────────

  groupTypeIcon = GROUP_TYPE_ICON;
  groupTypeLabel = GROUP_TYPE_LABEL;

  currentUserId = this.auth.currentUser?.uid ?? '';

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    await this.loadGroups();
  }

  private getPinnedIds(): Set<string> {
    try {
      const raw = localStorage.getItem(PINNED_KEY);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  }

  private savePinnedIds(ids: Set<string>): void {
    try {
      localStorage.setItem(PINNED_KEY, JSON.stringify(Array.from(ids)));
    } catch { /* ignore */ }
  }

  async loadGroups(): Promise<void> {
    this.loadState.set('loading');
    try {
      const families: Family[] = await this.familyService.getMyFamilies();
      const pinnedIds = this.getPinnedIds();
      const activeId = this.activeGroupId();

      const mapped: UserGroup[] = families.map(f => ({
        id: f.id!,
        name: f.name,
        type: inferGroupType(f.name),
        memberCount: f.memberIds?.length ?? 1,
        // Role: admin if ownerUserId matches current user, otherwise member
        role: f.ownerUserId === this.currentUserId ? 'admin' : 'member',
        currency: f.currency,
        inviteCode: f.inviteCode,
        ownerUserId: f.ownerUserId,
        pinned: pinnedIds.has(f.id!),
        isActive: f.id === activeId,
        lastActivityAt: f.updatedAt
          ? ((f.updatedAt as any)?.seconds
            ? new Date((f.updatedAt as any).seconds * 1000)
            : new Date(f.updatedAt as any))
          : undefined,
      }));

      this.groups.set(mapped);
      this.loadState.set(mapped.length === 0 ? 'empty' : 'loaded');
    } catch (err: any) {
      this.errorMessage.set(err?.message ?? 'Failed to load groups. Please try again.');
      this.loadState.set('error');
    }
  }

  // ─── Group Actions ─────────────────────────────────────────────────────────

  selectGroup(group: UserGroup): void {
    this.familyService.setActiveFamily(group.id);
    // Reload family in NgRx store so dashboard picks it up immediately
    this.store.dispatch(FamilyActions.loadMyFamily());
    this.router.navigate(['/dashboard/family/dashboard']);
  }

  pinGroup(group: UserGroup): void {
    const pinnedIds = this.getPinnedIds();
    if (group.pinned) {
      pinnedIds.delete(group.id);
    } else {
      pinnedIds.add(group.id);
    }
    this.savePinnedIds(pinnedIds);

    this.groups.update(gs =>
      gs.map(g => g.id === group.id ? { ...g, pinned: !g.pinned } : g)
    );
  }

  requestLeave(group: UserGroup): void {
    this.confirmPending.set({ action: 'leave', group });
  }

  requestDelete(group: UserGroup): void {
    this.confirmPending.set({ action: 'delete', group });
  }

  cancelConfirm(): void {
    this.confirmPending.set(null);
  }

  async executeConfirm(): Promise<void> {
    const pending = this.confirmPending();
    if (!pending) return;
    this.confirmPending.set(null);

    try {
      if (pending.action === 'leave') {
        await this.familyService.leaveFamily(pending.group.id);
        this.snackBar.open(`Left "${pending.group.name}"`, 'OK', { duration: 3000 });
        // If leaving the active group, clear it
        if (this.activeGroupId() === pending.group.id) {
          this.familyService.setActiveFamily(null);
        }
      } else {
        await this.familyService.deleteFamily(pending.group.id);
        this.snackBar.open(`Deleted "${pending.group.name}"`, 'OK', { duration: 3000 });
        if (this.activeGroupId() === pending.group.id) {
          this.familyService.setActiveFamily(null);
        }
      }
      await this.loadGroups();
    } catch (err: any) {
      this.snackBar.open(err?.message ?? 'Action failed. Please try again.', 'Dismiss', { duration: 4000 });
    }
  }

  // ─── Dialogs ───────────────────────────────────────────────────────────────

  openCreateDialog(): void {
    const ref = this.dialog.open(FamilyCreateDialogComponent, { disableClose: true });
    ref.afterClosed().subscribe(async result => {
      if (result) {
        this.store.dispatch(FamilyActions.createFamily({ request: result }));
        await this.loadGroups();
      }
    });
  }

  openJoinDialog(): void {
    const ref = this.dialog.open(FamilyJoinDialogComponent, { disableClose: true });
    ref.afterClosed().subscribe(async code => {
      if (code) {
        this.store.dispatch(FamilyActions.joinFamily({ inviteCode: code }));
        await this.loadGroups();
      }
    });
  }

  // ─── Formatting Helpers ────────────────────────────────────────────────────

  formatRelative(date?: Date): string {
    if (!date) return '';
    const now = Date.now();
    const diff = now - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return mins <= 1 ? 'Just now' : `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  avatarInitials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map(w => w[0])
      .join('')
      .toUpperCase();
  }

  avatarColor(id: string): string {
    const COLORS = [
      '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
      '#10b981', '#3b82f6', '#ef4444', '#14b8a6',
    ];
    let hash = 0;
    for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
    return COLORS[hash % COLORS.length];
  }

  trackById(_: number, g: UserGroup): string { return g.id; }
}
