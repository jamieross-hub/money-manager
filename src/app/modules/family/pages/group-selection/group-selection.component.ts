import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  effect,
  DestroyRef,
  ChangeDetectionStrategy,
  Injector,
} from '@angular/core';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';

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
import { MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { ImageFallbackDirective } from 'src/app/util/directives/image-fallback.directive';

import { FamilyService } from '../../services/family.service';
import { FamilyTransactionsService } from 'src/app/util/service/db/family-transactions.service';
import { UserService } from 'src/app/util/service/db/user.service';
import { Transaction } from 'src/app/util/models/transaction.model';
import { FamilyCreateDialogComponent } from '../../dialogs/family-create-dialog/family-create-dialog.component';
import { FamilyJoinDialogComponent } from '../../dialogs/family-join-dialog/family-join-dialog.component';
import { FamilyModeInfoSheet } from '../../dialogs/family-mode-info-sheet/family-mode-info-sheet';
import { ConfirmDialogComponent, ConfirmDialogData } from 'src/app/util/components/confirm-dialog/confirm-dialog.component';
import { Family, FamilyMemberRole } from 'src/app/util/models/family.model';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import * as FamilyActions from '../../store/family.actions';
import * as FamilySelectors from '../../store/family.selectors';
import { selectUserFamilies, selectUserFamiliesLoading, selectUserFamiliesLoaded, selectFamilyError } from '../../store/family.selectors';
import * as ProfileSelectors from 'src/app/store/profile/profile.selectors';
import { QuickAction, QuickActionsFabConfig } from 'src/app/util/components/floating-action-buttons/quick-actions-fab/quick-actions-fab.component';
import { LocalIndexDBStorageService } from 'src/app/util/service/indexdb-storage.service';
import { LoaderService } from 'src/app/util/service/loader.service';
import { TransactionStatus } from 'src/app/util/config/enums';
import { CurrencyPipe, AppDatePipe } from 'src/app/util/pipes';
import { FooterService } from 'src/app/component/dashboard/footer/footer.service';

// ─── View Model ──────────────────────────────────────────────────────────────

export type GroupType = 'family' | 'trip' | 'work' | 'other';

export interface UserGroup {
  id: string;
  name: string;
  type: GroupType;
  mode: 'common' | 'split';
  icon?: string;
  memberCount: number;
  role: FamilyMemberRole;
  balance?: number;
  totalSpend?: number;
  lastActivityAt?: Date;
  createdAt: Date;
  isActive: boolean;
  isDeleted: boolean;
  inviteCode: string;
  ownerUserId: string;
  banner?: string;
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
    ImageFallbackDirective,
    CurrencyPipe,
    CurrencyPipe,
    AppDatePipe,
    MatBottomSheetModule
],
  templateUrl: './group-selection.component.html',
  styleUrls: ['./group-selection.component.scss'],
})
export class GroupSelectionComponent implements OnInit {
  private familyService = inject(FamilyService);
  private readonly footerService = inject(FooterService);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private store = inject(Store<AppState>);
  private loaderService = inject(LoaderService);
  public selectedGroup = signal<UserGroup | null>(null);
  public showDeleted = signal<boolean>(false);
  private autoOpened = false;
  groupSpends = signal<Record<string, number>>({});
  private isInstanceLoading = false;

  /** Current user UID from AppState.profile */
  private readonly profile = this.store.selectSignal(ProfileSelectors.selectProfile);
  get currentUserId(): string { return this.profile()?.uid ?? ''; }

  /** User's preferred currency */
  userCurrency = computed(() => this.profile()?.preferences?.defaultCurrency || 'INR');

  private deletedFamiliesSubscription?: Subscription;

  // Signal holding raw deleted (isActive=false) families
  deletedRawFamilies = signal<Family[]>([]);

  private storageService = inject(LocalIndexDBStorageService);
  private familyTransactionsService = inject(FamilyTransactionsService);
  private userService = inject(UserService);
  private injector = inject(Injector);
  private destroyRef = inject(DestroyRef);

  constructor() {}

  async ngOnInit(): Promise<void> {
    this.destroyRef.onDestroy(() => {
      this.footerService.resetConfig();
    });
    this.initializeEffects();

    // 🚀 OPTIMIZATION: Seed the store from cache immediately
    // This removes the 'blank' period while waiting for the effect to fire.
    const cached = this.familyService.getCachedFamiliesSync();
    if (cached.length > 0) {
      this.store.dispatch(FamilyActions.loadUserFamiliesSuccess({ families: cached }));
    }

    this.loadGroups();
    this.loadDeletedGroups();
    this.setupFooter();
  }

  private setupFooter(): void {
    this.footerService.patchConfig({
      items: [
        {
          id: 'home',
          icon: 'home',
          label: 'Home',
          priority: 1,
          action: () => this.router.navigate(['/dashboard/home'])
        },
        {
          id: 'create-group',
          icon: 'add_circle',
          label: 'Create Group',
          priority: 2,
          action: () => this.openCreateDialog()
        },
        {
          id: 'join-group',
          icon: 'link',
          label: 'Join Group',
          priority: 3,
          action: () => this.openJoinDialog()
        }
      ],
      hideFab: true
    });
  }

  private subscriptionsMap = new Map<string, Subscription>();

  private initializeEffects(): void {
    // Cleanup on destroy
    this.destroyRef.onDestroy(() => {
      this.subscriptionsMap.forEach(sub => sub.unsubscribe());
      this.subscriptionsMap.clear();
      if (this.isInstanceLoading) {
        //this.loaderService.hide();
       }
    });

    effect(() => {
      const families = (this.rawFamilies() || []) as Family[];
      const userId = this.currentUserId;
      if (!userId) return;

      families.forEach((f: Family) => {
        if (f.id && !this.subscriptionsMap.has(f.id)) {
          console.log(`[GroupSelection] Setting up spend listener for family: ${f.name} (${f.id})`);
          
          // Seed from cache immediately if available
          const cacheKey = `groupSpends_${f.id}`;
          const cachedSpend = this.storageService.getItem<number>(cacheKey);
          if (cachedSpend !== null) {
            this.groupSpends.update(spends => ({ ...spends, [f.id as string]: cachedSpend }));
          }

          const subscription = this.familyTransactionsService.getTransactions(userId, f.id)
            .subscribe((txs: Transaction[]) => {
              const expense = txs
                .filter((t: Transaction) =>
                  t.familyId === f.id &&
                  t.type === 'expense' &&
                  t.status !== TransactionStatus.DELETED &&
                  t.category !== 'Settlement'
                )
                .reduce((sum: number, t: Transaction) => sum + t.amount, 0);
              
              this.groupSpends.update(spends => ({ ...spends, [f.id as string]: expense }));
              this.storageService.setItem(cacheKey, expense);
            });
          
          this.subscriptionsMap.set(f.id, subscription);
        }
      });
      
      // Optional: Cleanup subscriptions for families that no longer exist in the rawFamilies list
      const currentIds = new Set(families.map(f => f.id));
      this.subscriptionsMap.forEach((sub, id) => {
        if (!currentIds.has(id)) {
          sub.unsubscribe();
          this.subscriptionsMap.delete(id);
        }
      });
    }, { injector: this.injector });

    effect(() => {
      const isLoading = this.loadState() === 'loading';
                       
      if (isLoading && !this.isInstanceLoading) {
        this.isInstanceLoading = true;
      } else if (!isLoading && this.isInstanceLoading) {
        this.isInstanceLoading = false;
      }
    }, { injector: this.injector });
  }

  rawFamilies = this.store.selectSignal(FamilySelectors.selectUserFamiliesWithMembers);
  userFamiliesLoading = this.store.selectSignal(selectUserFamiliesLoading);
  userFamiliesLoaded = this.store.selectSignal(selectUserFamiliesLoaded);
  familyError = this.store.selectSignal(selectFamilyError);

  readonly activeGroupId = this.familyService.activeFamilyId;

  groups = computed<UserGroup[]>(() => {
    const families = (this.rawFamilies() || []) as Family[];
    const activeId = this.activeGroupId();

    return families.map((f: Family) => ({
      id: f.id!,
      name: f.name,
      type: inferGroupType(f.name),
      mode: f.mode ?? 'common',
      icon: f.icon,
      memberCount: f.memberIds?.length ?? 1,
      // Role: admin if ownerUserId matches current user, otherwise member
      role: f.ownerUserId === this.currentUserId ? 'admin' : 'member',
      inviteCode: f.inviteCode,
      ownerUserId: f.ownerUserId,
      isActive: f.id === activeId,
      isDeleted: false,
      totalSpend: this.groupSpends()[f.id!] || 0,
      lastActivityAt: f.updatedAt
        ? ((f.updatedAt as any)?.seconds
          ? new Date((f.updatedAt as any).seconds * 1000)
          : new Date(f.updatedAt as any))
        : undefined,
      createdAt: f.createdAt
        ? ((f.createdAt as any)?.seconds
          ? new Date((f.createdAt as any).seconds * 1000)
          : new Date(f.createdAt as any))
        : new Date(),
      banner: f.banner,
    }));
  });

  loadState = computed<LoadState>(() => {
    const families = this.rawFamilies() || [];
    const hasGroups = families.length > 0;
    const isLoading = this.userFamiliesLoading();
    const isLoaded = this.userFamiliesLoaded();
    const hasError = !!this.familyError();

    // 1. DATA PRESENT: If we have groups, we are loaded. 
    // This is the highest priority so cache shows up immediately.
    if (hasGroups) return 'loaded';

    // 2. ERROR STATE: If there's a stored error and no data.
    if (hasError) return 'error';

    // 3. LOADING STATE: If we are actively fetching, or haven't successfully 
    // completed the first load yet.
    if (!this.currentUserId || isLoading || !isLoaded) {
      return 'loading';
    }

    // 4. EMPTY STATE: We finished loading (isLoaded: true) and have no data.
    return 'empty';
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

  deletedGroups = computed<UserGroup[]>(() => {
    const currentUserId = this.currentUserId;
    const families = (this.deletedRawFamilies() || []) as Family[];
    return families.map((f: Family) => ({
      id: f.id!,
      name: f.name,
      type: inferGroupType(f.name),
      mode: f.mode ?? 'common',
      icon: f.icon,
      memberCount: f.memberIds?.length ?? 1,
      role: f.ownerUserId === currentUserId ? 'admin' : 'member' as FamilyMemberRole,
      inviteCode: f.inviteCode,
      ownerUserId: f.ownerUserId,
      isActive: false,
      isDeleted: true,
      totalSpend: 0,
      lastActivityAt: f.updatedAt
        ? ((f.updatedAt as any)?.seconds
          ? new Date((f.updatedAt as any).seconds * 1000)
          : new Date(f.updatedAt as any))
        : undefined,
      createdAt: f.createdAt
        ? ((f.createdAt as any)?.seconds
          ? new Date((f.createdAt as any).seconds * 1000)
          : new Date(f.createdAt as any))
        : new Date(),
      banner: f.banner,
    }));
  });

  // ─── Helpers (exposed to template) ─────────────────────────────────────────

  groupTypeIcon = GROUP_TYPE_ICON;
  groupTypeLabel = GROUP_TYPE_LABEL;
  groupModeIcon = GROUP_MODE_ICON;
  groupModeLabel = GROUP_MODE_LABEL;



  loadGroups(): void {
    this.store.dispatch(FamilyActions.loadUserFamilies());
  }

  loadDeletedGroups(): void {
    this.deletedFamiliesSubscription?.unsubscribe();
    this.deletedFamiliesSubscription = this.familyService
      .getDeletedFamilies()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(families => this.deletedRawFamilies.set(families));
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
    this.familyService.setActiveFamily(group.id);
    this.familyService.sharedSelectedGroup.set(group);
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
    const existingNames = this.groups().map(g => g.name);
    const ref = this.dialog.open(FamilyCreateDialogComponent, { 
      disableClose: true,
      data: { existingNames }
    });
    ref.afterClosed().subscribe(async result => {
      if (result) {
        try {
          this.loaderService.show();
          const family = await this.familyService.createFamily(result);
          if (family.id) {
            this.familyService.setActiveFamily(family.id);
            this.store.dispatch(FamilyActions.loadMyFamily());
          }
          this.loadGroups();
          this.snackBar.open(`Created "${family.name}" family!`, 'OK', { duration: 3000 });
        } catch (error: any) {
          this.snackBar.open(error?.message || 'Failed to create group', 'Dismiss', { duration: 4000 });
        } finally {
          this.loaderService.hide();
        }
      }
    });
  }

  openJoinDialog(): void {
    const ref = this.dialog.open(FamilyJoinDialogComponent, { disableClose: true });
    ref.afterClosed().subscribe(async code => {
      if (code) {
        try {
          this.loaderService.show();
          const family = await this.familyService.joinByCode(code);
          if (family.id) {
            this.familyService.setActiveFamily(family.id);
            this.store.dispatch(FamilyActions.loadMyFamily());
          }
          this.loadGroups();
          this.snackBar.open(`Joined "${family.name}" family!`, 'OK', { duration: 3000 });
        } catch (error: any) {
          this.snackBar.open(error?.message || 'Failed to join group', 'Dismiss', { duration: 4000 });
        } finally {
          this.loaderService.hide();
        }
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

 

  avatarInitials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map(w => w[0])
      .join('')
      .toUpperCase();
  }

  // avatarColor(id: string): string {
  //   const COLORS = [
  //     '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
  //     '#10b981', '#3b82f6', '#ef4444', '#14b8a6',
  //   ];
  //   let hash = 0;
  //   for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  //   return COLORS[hash % COLORS.length];
  // }

  trackById(_: number, g: UserGroup): string { return g.id; }
}
