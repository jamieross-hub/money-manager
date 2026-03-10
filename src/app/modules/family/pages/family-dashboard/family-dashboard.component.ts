import {
  Component,
  inject,
  OnInit,
  ChangeDetectionStrategy,
  computed,
  effect,
  DestroyRef,
  Input,
  Output,
  EventEmitter,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { distinctUntilChanged, debounceTime } from 'rxjs/operators';

// Angular animations
import { trigger, transition, style, animate } from '@angular/animations';

// Angular Fire
import { Auth } from '@angular/fire/auth';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRippleModule } from '@angular/material/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBottomSheet, MatBottomSheetModule } from '@angular/material/bottom-sheet';

// NgRx
import { Store } from '@ngrx/store';
import { toSignal } from '@angular/core/rxjs-interop';
import { AppState } from 'src/app/store/app.state';
import * as FamilyActions from '../../store/family.actions';
import * as FamilySelectors from '../../store/family.selectors';
import * as TransactionsSelectors from 'src/app/store/transactions/transactions.selectors';
import * as ProfileSelectors from 'src/app/store/profile/profile.selectors';
import * as ProfileActions from 'src/app/store/profile/profile.actions';

// Models
import { Family, FamilyMember, Settlement } from 'src/app/util/models/family.model';
import { Transaction } from 'src/app/util/models/transaction.model';

// Enums & Config
import { TransactionStatus } from 'src/app/util/config/enums';

// Services
import { BreakpointService } from 'src/app/util/service/breakpoint.service';
import { FamilyProcessorService } from 'src/app/util/service/family-processor.service';
import { FamilyService } from '../../services/family.service';
import { FamilyTransactionsService } from 'src/app/util/service/db/family-transactions.service';
import { LoaderService } from 'src/app/util/service/loader.service';
import { LocalIndexDBStorageService } from 'src/app/util/service/indexdb-storage.service';
import { ReportService } from 'src/app/util/service/db/report.service';
import { UserService } from 'src/app/util/service/db/user.service';

// Dialogs & Components
import { ConfirmDialogComponent } from 'src/app/util/components/confirm-dialog/confirm-dialog.component';
import { FamilyCreateDialogComponent } from '../../dialogs/family-create-dialog/family-create-dialog.component';
import { FamilyJoinDialogComponent } from '../../dialogs/family-join-dialog/family-join-dialog.component';
import { FamilyMembersComponent } from '../family-members/family-members.component';

// Pipes & Directives
import { CurrencyPipe, AppDatePipe } from 'src/app/util/pipes';
import { ImageFallbackDirective } from 'src/app/util/directives/image-fallback.directive';

@Component({
  selector: 'app-family-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    // Angular
    CommonModule,
    RouterModule,
    // Material
    MatButtonModule,
    MatDialogModule,
    MatDividerModule,
    MatIconModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatRippleModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatBottomSheetModule,
    // App
    CurrencyPipe,
    AppDatePipe,
    ImageFallbackDirective,
  ],
  templateUrl: './family-dashboard.component.html',
  styleUrls: ['./family-dashboard.component.scss']
})
export class FamilyDashboardComponent implements OnInit {

  // ─── Inputs / Outputs ────────────────────────────────────────────────────────
  @Input() group: any;
  @Output() close = new EventEmitter<void>();

  // ─── Injected Services ───────────────────────────────────────────────────────
  // Angular / Router
  private readonly destroyRef               = inject(DestroyRef);
  private readonly router                   = inject(Router);
  private readonly route                    = inject(ActivatedRoute);

  // Firebase
  private readonly auth                     = inject(Auth);

  // NgRx Store
  private readonly store                    = inject(Store<AppState>);

  // Material
  private readonly dialog                   = inject(MatDialog);
  private readonly snackBar                 = inject(MatSnackBar);
  private readonly bottomSheet              = inject(MatBottomSheet);

  // App Services
  readonly         breakpointService        = inject(BreakpointService);
  private readonly familyProcessor          = inject(FamilyProcessorService);
  private readonly familyService            = inject(FamilyService);
  private readonly familyTransactionsService= inject(FamilyTransactionsService);
  private readonly loaderService            = inject(LoaderService);
  private readonly reportService            = inject(ReportService);
  private readonly storageService           = inject(LocalIndexDBStorageService);
  private readonly userService              = inject(UserService);

  // ─── Private State ───────────────────────────────────────────────────────────
  private isInstanceLoading = false;

  // ─── Store Signals (raw) ─────────────────────────────────────────────────────
  private readonly storeFamily  = toSignal(this.store.select(FamilySelectors.selectFamily).pipe(distinctUntilChanged((a, b) => a?.id === b?.id && (a as any)?.updatedAt === (b as any)?.updatedAt)), { initialValue: null });
  private readonly allFamilies  = toSignal(this.store.select(FamilySelectors.selectUserFamilies).pipe(distinctUntilChanged((a, b) => a.length === b.length && a[0]?.id === b[0]?.id)), { initialValue: [] });

  // ─── Public Signals (from store) ─────────────────────────────────────────────
  readonly currentUserId     = toSignal(this.store.select(ProfileSelectors.selectUserId), { initialValue: undefined });
  readonly members           = toSignal(this.store.select(FamilySelectors.selectFamilyMembers).pipe(distinctUntilChanged((a, b) => a.length === b.length && a[0]?.userId === b[0]?.userId && (a[0] as any)?.isActive === (b[0] as any)?.isActive)), { initialValue: [] as FamilyMember[] });
  readonly transactions      = toSignal(this.store.select(TransactionsSelectors.selectAllTransactions).pipe(distinctUntilChanged((a, b) => a.length === b.length && a[0]?.id === b[0]?.id && (a[0] as any)?.updatedAt === (b[0] as any)?.updatedAt && a[0]?.familyId === b[0]?.familyId)), { initialValue: [] as Transaction[] });
  readonly recentTxns        = toSignal(this.store.select(TransactionsSelectors.selectRecentTransactions(5)).pipe(distinctUntilChanged((a, b) => a.length === b.length && a[0]?.id === b[0]?.id && (a[0] as any)?.updatedAt === (b[0] as any)?.updatedAt)), { initialValue: [] as Transaction[] });
  readonly settlements       = toSignal(this.store.select(FamilySelectors.selectSettlements).pipe(distinctUntilChanged((a, b) => a.length === b.length && a[0]?.id === b[0]?.id && (a[0] as any)?.createdAt === (b[0] as any)?.createdAt)), { initialValue: [] as Settlement[] });
  readonly loading           = toSignal(this.store.select(TransactionsSelectors.selectTransactionsLoading).pipe(distinctUntilChanged()), { initialValue: true });
  private readonly settlementsLoading = toSignal(this.store.select(FamilySelectors.selectSettlementsLoading).pipe(distinctUntilChanged()), { initialValue: false });

  // ─── Processor Signals ───────────────────────────────────────────────────────
  readonly recentActivities = this.familyProcessor.activities;
  readonly settleBalances   = this.familyProcessor.balances;
  readonly stats            = computed(() => this.familyProcessor.stats());

  // ─── Pagination Signals ──────────────────────────────────────────────────────
  readonly activityLimit = signal(5);
  readonly displayedActivities = computed(() => this.recentActivities().slice(0, this.activityLimit()));


  // ─── Derived / Computed Signals ──────────────────────────────────────────────
  readonly family = computed(() => {
    const fromStore = this.storeFamily();
    // Priority: 1. Input group  2. Shared service group  3. Active family from list
    let skeleton = this.group ?? this.familyService.sharedSelectedGroup();

    if (!skeleton) {
      const activeId = this.familyService.activeFamilyId();
      if (activeId) skeleton = this.allFamilies().find(f => f.id === activeId);
    }

    if (skeleton && (!fromStore || (skeleton.id && fromStore.id === skeleton.id))) {
      return { ...fromStore, ...skeleton } as Family;
    }
    return fromStore;
  });

  readonly currentUserExpense = computed(() => {
    const s = this.stats();
    const uid = this.currentUserId();
    if (!s || !uid) return 0;
    return s.memberBreakdown.find(m => m.userId === uid)?.totalExpense ?? 0;
  });

  readonly currentUserSharePercentage = computed(() => {
    const total = this.stats()?.totalExpense ?? 0;
    if (total <= 0) return 0;
    return (this.currentUserExpense() / total) * 100;
  });

  readonly myNetSettleBalance = computed(() => {
    const uid = this.currentUserId();
    if (!uid) return 0;
    const balances = this.settleBalances();
    
    let owedByMe = 0;
    let owedToMe = 0;

    for (const b of balances) {
      if (b.fromUserId === uid) owedByMe += b.amount;
      if (b.toUserId === uid) owedToMe += b.amount;
    }
    
    return owedToMe - owedByMe;
  });

  readonly currentUserPaid = computed(() => {
    const s = this.stats();
    const uid = this.currentUserId();
    if (!s || !uid) return 0;
    return s.memberBreakdown.find(m => m.userId === uid)?.totalPaid ?? 0;
  });

  // ─── Getters ─────────────────────────────────────────────────────────────────
  // No longer needed: using signal currentUserId instead

  // ─── Lifecycle ───────────────────────────────────────────────────────────────
  constructor() {
    // Effect 1: Load settlements when family resolves + manage global loader
    effect(() => {
      const fam = this.family();
      const isLoading = this.loading() && !fam;

      if (fam?.id) {
        untracked(() => {
          this.store.dispatch(FamilyActions.loadSettlements({ familyId: fam.id! }));
        });
      }

      if (isLoading && !this.isInstanceLoading) {
        untracked(() => {
          this.isInstanceLoading = true;
          this.loaderService.show();
        });
      } else if (!isLoading && this.isInstanceLoading) {
        untracked(() => {
          this.isInstanceLoading = false;
          this.loaderService.hide();
        });
      }
    });


    this.destroyRef.onDestroy(() => {
      if (this.isInstanceLoading) this.loaderService.hide();
    });
  }

  ngOnInit(): void {
    // When used as an inline child, the parent handles store dispatches — just warm the cache
    if (this.group) {
      return;
    }

    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.store.dispatch(FamilyActions.loadFamily({ familyId: id }));
      } else {
        const activeId = this.familyService.activeFamilyId();
        this.store.dispatch(FamilyActions.loadMyFamily());
      }
    });
  }

  // ─── Public Methods ──────────────────────────────────────────────────────────

  goBack(): void {
    if (this.close.observed) {
      this.close.emit();
    } else {
      this.router.navigate(['/dashboard/family/groups']);
    }
  }

  addTransaction(): void {
    // TODO: implement transaction addition logic
  }

  openMembersSheet(): void {
    this.bottomSheet.open(FamilyMembersComponent, {
      panelClass: ['bg-transparent', 'auto-height-sheet']
    });
  }

  loadMoreActivities(): void {
    this.activityLimit.update(l => l + 5);
  }

  copyCode(code: string): void {
    navigator.clipboard.writeText(code);
  }

  memberColor(userId: string | undefined): string {
    if (!userId) return '#94a3b8';
    let hash = 0;
    for (const c of userId) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
    return this.memberColors[hash % this.memberColors.length];
  }

  onBannerSelected(event: any): void {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 1.5 * 1024 * 1024) {
      this.snackBar.open('Image size should be less than 1.5MB', 'Close', { duration: 3000 });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const famId  = this.family()?.id;
      if (famId) {
        this.store.dispatch(FamilyActions.updateFamilyBanner({ familyId: famId, banner: base64 }));
      }
    };
    reader.readAsDataURL(file);
  }

  generateReport(): void {
    const fam       = this.family();
    const userEmail = this.auth.currentUser?.email;

    if (!fam?.id || !userEmail) {
      this.snackBar.open('Unable to generate report: Missing data', 'Close', { duration: 3000 });
      return;
    }

    this.reportService.getPendingReport(fam.id).subscribe({
      next: pendingReport => {
        if (pendingReport) {
          this.snackBar.open('A report is already being prepared. Please check your email shortly.', 'Close', { duration: 5000 });
          return;
        }

        this.reportService.requestReport({
          email:    userEmail,
          familyId: fam.id,
          type:     'family_overview',
        }).subscribe({
          next: () => this.snackBar.open('Report requested! You will receive it via email soon.', 'Close', {
            duration:   5000,
            panelClass: ['success-snackbar'],
          }),
          error: err => {
            console.error('Report request failed:', err);
            this.snackBar.open('Failed to request report. Please try again later.', 'Close', { duration: 3000 });
          },
        });
      },
      error: err => console.error('Error checking pending reports:', err),
    });
  }

  // ─── Family CRUD Dialog Actions ──────────────────────────────────────────────

  createFamily(): void {
    const existingNames = this.store.selectSignal(FamilySelectors.selectUserFamilies)()?.map(f => f.name) ?? [];
    this.dialog.open(FamilyCreateDialogComponent, {
      disableClose: true,
      data: { existingNames },
    }).afterClosed().subscribe(result => {
      if (result) this.store.dispatch(FamilyActions.createFamily({ request: result }));
    });
  }

  joinFamily(): void {
    this.dialog.open(FamilyJoinDialogComponent, { disableClose: true })
      .afterClosed().subscribe(code => {
        if (code) this.store.dispatch(FamilyActions.joinFamily({ inviteCode: code }));
      });
  }

  editFamily(): void {
    const fam = this.family();
    if (!fam) return;

    const existingNames = this.store.selectSignal(FamilySelectors.selectUserFamilies)()?.map(f => f.name) ?? [];
    this.dialog.open(FamilyCreateDialogComponent, {
      disableClose: true,
      data: { existingNames, family: fam },
    }).afterClosed().subscribe(result => {
      if (result && fam.id) {
        this.store.dispatch(FamilyActions.updateFamily({ familyId: fam.id, request: result }));
        this.store.dispatch(FamilyActions.loadFamily({ familyId: fam.id }));
      }
    });
  }

  deleteFamily(): void {
    const fam      = this.family();
    const familyId = fam?.id;
    if (!familyId || !this.currentUserId()) return;


    const isOwner = fam.ownerUserId === this.currentUserId();
    const title   = isOwner ? 'Delete Family' : 'Leave Family';
    const message = isOwner
      ? 'Are you sure you want to delete this family? This action cannot be undone and all data will be lost for all members.'
      : 'Are you sure you want to leave this family?';

    this.dialog.open(ConfirmDialogComponent, {
      data: { title, message, confirmText: isOwner ? 'Delete' : 'Leave', confirmColor: 'warn' },
    }).afterClosed().subscribe(async ok => {
      if (!ok) return;
      try {
        if (isOwner) {
          await this.familyService.deleteFamily(familyId);
        } else {
          await this.familyService.leaveFamily(familyId);
          this.store.dispatch(ProfileActions.updatePreferences({
            userId:      this.currentUserId()!,
            preferences: { activeFamilyId: null, isFamilyMode: false },
          }));
        }
        this.router.navigate(['/dashboard/family/groups']);
      } catch (error: any) {
        alert(error.message ?? 'An error occurred');
      }
    });
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private readonly memberColors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];

}
