import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  effect,
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
import { ConfirmDialogComponent, ConfirmDialogData } from 'src/app/util/components/confirm-dialog/confirm-dialog.component';
import { Family, FamilyMemberRole } from 'src/app/util/models/family.model';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import * as FamilyActions from '../../store/family.actions';
import { selectUserFamilies, selectUserFamiliesLoading, selectFamilyError } from '../../store/family.selectors';
import * as ProfileSelectors from 'src/app/store/profile/profile.selectors';
import { QuickActionsFabComponent, QuickAction, QuickActionsFabConfig } from 'src/app/util/components/floating-action-buttons/quick-actions-fab/quick-actions-fab.component';

// ─── View Model ──────────────────────────────────────────────────────────────

export type GroupType = 'family' | 'trip' | 'work' | 'other';

export interface UserGroup {
  id: string;
  name: string;
  type: GroupType;
  mode: 'common' | 'split';
  memberCount: number;
  role: FamilyMemberRole;
  balance?: number;
  totalSpend?: number;
  lastActivityAt?: Date;
  isActive: boolean;
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

const GROUP_MODE_ICON: Record<'common' | 'split', string> = {
  common: 'account_balance_wallet',
  split: 'call_split',
};

const GROUP_MODE_LABEL: Record<'common' | 'split', string> = {
  common: 'Common',
  split: 'Split',
};


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
    QuickActionsFabComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './group-selection.component.html',
  styleUrls: ['./group-selection.component.scss'],
})
export class GroupSelectionComponent implements OnInit {
  private familyService = inject(FamilyService);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private store = inject(Store<AppState>);

  // ─── State ─────────────────────────────────────────────────────────────────

  groupSpends = signal<Record<string, number>>({});

  constructor() {
    effect(() => {
      const families = this.rawFamilies() || [];
      families.forEach(f => {
        if (f.id && this.groupSpends()[f.id] === undefined) {
          // Initialize to 0 so we only fetch once per group
          this.groupSpends.update(spends => ({ ...spends, [f.id as string]: 0 }));
          this.familyService.getTransactions(f.id).subscribe(txs => {
            const expense = txs.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
            this.groupSpends.update(spends => ({ ...spends, [f.id as string]: expense }));
          });
        }
      });
    }, { allowSignalWrites: true });
  }

  rawFamilies = this.store.selectSignal(selectUserFamilies);
  userFamiliesLoading = this.store.selectSignal(selectUserFamiliesLoading);
  familyError = this.store.selectSignal(selectFamilyError);

  readonly activeGroupId = this.familyService.activeFamilyId;

  groups = computed<UserGroup[]>(() => {
    const families = this.rawFamilies() || [];
    const activeId = this.activeGroupId();

    return families.map(f => ({
      id: f.id!,
      name: f.name,
      type: inferGroupType(f.name),
      mode: f.mode ?? 'common',
      memberCount: f.memberIds?.length ?? 1,
      // Role: admin if ownerUserId matches current user, otherwise member
      role: f.ownerUserId === this.currentUserId ? 'admin' : 'member',
      inviteCode: f.inviteCode,
      ownerUserId: f.ownerUserId,
      isActive: f.id === activeId,
      totalSpend: this.groupSpends()[f.id!] || 0,
      lastActivityAt: f.updatedAt
        ? ((f.updatedAt as any)?.seconds
          ? new Date((f.updatedAt as any).seconds * 1000)
          : new Date(f.updatedAt as any))
        : undefined,
    }));
  });

  loadState = computed<LoadState>(() => {
    if (this.userFamiliesLoading()) return 'loading';
    if (this.familyError()) return 'error';
    return this.groups().length === 0 ? 'empty' : 'loaded';
  });

  errorMessage = computed(() => this.familyError() ?? 'Failed to load groups. Please try again.');

  // ─── Fab Config ─────────────────────────────────────────────────────────────

  fabConfig: QuickActionsFabConfig = {
    mainButtonIcon: 'groups',
    mainButtonColor: 'accent',
    mainButtonTooltip: 'Group Actions',
    showLabels: true,
    animations: true,
    autoHide: false,
    theme: 'auto',
    actions: [
      {
        id: 'add-group',
        label: 'Create Group',
        icon: 'add_circle',
        color: 'primary',
        tooltip: 'Create group'
      },
      {
        id: 'join-group',
        label: 'Join Group',
        icon: 'link',
        color: 'accent',
        tooltip: 'Join group'
      }
    ]
  };

  handleQuickAction(action: QuickAction): void {
    if (action.id === 'add-group') {
      this.openCreateDialog();
    } else if (action.id === 'join-group') {
      this.openJoinDialog();
    }
  }

  // ─── Derived ───────────────────────────────────────────────────────────────

  activeGroup = computed(() =>
    this.groups().find(g => g.id === this.activeGroupId()) ?? null
  );

  quickSwitchGroups = computed(() => {
    const active = this.activeGroupId();
    return this.groups()
      .filter(g => g.id !== active)
      .slice(0, 6);
  });

  otherGroups = computed(() => {
    const active = this.activeGroupId();
    return this.groups().filter(g => g.id !== active);
  });

  // ─── Helpers (exposed to template) ─────────────────────────────────────────

  groupTypeIcon = GROUP_TYPE_ICON;
  groupTypeLabel = GROUP_TYPE_LABEL;
  groupModeIcon = GROUP_MODE_ICON;
  groupModeLabel = GROUP_MODE_LABEL;

  /** Current user UID from AppState.profile */
  private readonly profile = this.store.selectSignal(ProfileSelectors.selectProfile);
  get currentUserId(): string { return this.profile()?.uid ?? ''; }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    this.loadGroups();
  }

  loadGroups(): void {
    this.store.dispatch(FamilyActions.loadUserFamilies());
  }

  // ─── Group Actions ─────────────────────────────────────────────────────────

  selectGroup(group: UserGroup): void {
    const data: ConfirmDialogData = {
      title: 'Switch Group',
      message: `Are you sure you want to switch to "${group.name}"?`,
      confirmText: 'Switch',
      cancelText: 'Cancel',
      type: 'warning'
    };

    const ref = this.dialog.open(ConfirmDialogComponent, { width: '400px', data });
    ref.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.familyService.setActiveFamily(group.id);
        this.store.dispatch(FamilyActions.loadMyFamily());
      }
    });
  }

  openGroup(group: UserGroup){
    this.router.navigate(['/dashboard/family/dashboard', group.id]);
  }

  requestLeave(group: UserGroup): void {
    const data: ConfirmDialogData = {
      title: 'Leave Group',
      message: `Are you sure you want to leave "${group.name}"?`,
      confirmText: 'Leave',
      cancelText: 'Cancel',
      type: 'warning'
    };

    const ref = this.dialog.open(ConfirmDialogComponent, { width: '400px', data });
    ref.afterClosed().subscribe(async confirmed => {
      if (confirmed) {
        try {
          await this.familyService.leaveFamily(group.id);
          this.snackBar.open(`Left "${group.name}"`, 'OK', { duration: 3000 });
          if (this.activeGroupId() === group.id) {
            this.familyService.setActiveFamily(null);
          }
          this.loadGroups();
        } catch (err: any) {
          this.snackBar.open(err?.message ?? 'Action failed. Please try again.', 'Dismiss', { duration: 4000 });
        }
      }
    });
  }

  requestDelete(group: UserGroup): void {
    const data: ConfirmDialogData = {
      title: 'Delete Group',
      message: `Are you sure you want to permanently delete "${group.name}"? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'delete'
    };

    const ref = this.dialog.open(ConfirmDialogComponent, { width: '400px', data });
    ref.afterClosed().subscribe(async confirmed => {
      if (confirmed) {
        try {
          await this.familyService.deleteFamily(group.id);
          this.snackBar.open(`Deleted "${group.name}"`, 'OK', { duration: 3000 });
          if (this.activeGroupId() === group.id) {
            this.familyService.setActiveFamily(null);
          }
          this.loadGroups();
        } catch (err: any) {
          this.snackBar.open(err?.message ?? 'Action failed. Please try again.', 'Dismiss', { duration: 4000 });
        }
      }
    });
  }

  // ─── Dialogs ───────────────────────────────────────────────────────────────

  openCreateDialog(): void {
    const ref = this.dialog.open(FamilyCreateDialogComponent, { disableClose: true });
    ref.afterClosed().subscribe(async result => {
      if (result) {
        this.store.dispatch(FamilyActions.createFamily({ request: result }));
        this.loadGroups();
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
