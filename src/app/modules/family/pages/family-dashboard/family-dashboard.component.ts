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
} from '@angular/core';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';

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

// NgRx
import { Store } from '@ngrx/store';
import { toSignal } from '@angular/core/rxjs-interop';
import { AppState } from 'src/app/store/app.state';
import * as FamilyActions from '../../store/family.actions';
import * as FamilySelectors from '../../store/family.selectors';
import * as TransactionsSelectors from 'src/app/store/transactions/transactions.selectors';
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

// Pipes & Directives
import { CurrencyPipe, AppDatePipe } from 'src/app/util/pipes';
import { ImageFallbackDirective } from 'src/app/util/directives/image-fallback.directive';

@Component({
  selector: 'app-family-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('popIn', [
      transition('void => new', [
        style({
          opacity: 0,
          height: 0,
          marginBottom: 0,
          transform: 'scale(0.92) translateY(15px)',
          overflow: 'hidden'
        }),
        animate('350ms cubic-bezier(0.4, 0, 0.2, 1)', style({
          height: '*',
          marginBottom: '8px'
        })),
        animate('650ms cubic-bezier(0.175, 0.885, 0.32, 1.275)', style({
          opacity: 1,
          transform: 'scale(1) translateY(0)'
        }))
      ])
    ])
  ],
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
  private readonly sessionStartTime = Date.now();
  private isInstanceLoading = false;

  // ─── Store Signals (raw) ─────────────────────────────────────────────────────
  private readonly storeFamily  = toSignal(this.store.select(FamilySelectors.selectFamily),           { initialValue: null });
  private readonly allFamilies  = toSignal(this.store.select(FamilySelectors.selectUserFamilies),     { initialValue: [] });

  // ─── Public Signals (from store) ─────────────────────────────────────────────
  readonly members           = toSignal(this.store.select(FamilySelectors.selectFamilyMembers),              { initialValue: [] as FamilyMember[] });
  readonly transactions      = toSignal(this.store.select(TransactionsSelectors.selectAllTransactions),      { initialValue: [] as Transaction[] });
  readonly recentTxns        = toSignal(this.store.select(TransactionsSelectors.selectRecentTransactions(5)), { initialValue: [] as Transaction[] });
  readonly settlements       = toSignal(this.store.select(FamilySelectors.selectSettlements),               { initialValue: [] as Settlement[] });
  readonly loading           = toSignal(this.store.select(TransactionsSelectors.selectTransactionsLoading),  { initialValue: true });
  private readonly settlementsLoading = toSignal(this.store.select(FamilySelectors.selectSettlementsLoading), { initialValue: false });

  // ─── Processor Signals ───────────────────────────────────────────────────────
  readonly recentActivities = this.familyProcessor.activities;
  readonly settleBalances   = this.familyProcessor.balances;
  readonly stats            = computed(() => this.familyProcessor.stats());

  // ─── Pagination Signals ──────────────────────────────────────────────────────
  readonly activityLimit = signal(5);
  readonly displayedActivities = computed(() => this.recentActivities().slice(0, this.activityLimit()));

  /**
   * Combines all store slices into ONE computed signal so Effect 2 fires
   * only once per batch instead of once per individual signal change.
   *
   * `settlementsReady` is false while settlements are being fetched from the
   * server and becomes true only after the fetch completes — preventing the
   * worker from receiving an incomplete dataset.
   */
  private readonly processorInput = computed(() => ({
    transactions:     this.transactions(),
    members:          this.members(),
    settlements:      this.settlements(),
    familyId:         this.family()?.id,           // ensures family has resolved
    settlementsReady: !this.settlementsLoading(),  // true only after fetch completes
  }));

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
    if (!s || !this.currentUserId) return 0;
    return s.memberBreakdown.find(m => m.userId === this.currentUserId)?.totalExpense ?? 0;
  });

  readonly currentUserSharePercentage = computed(() => {
    const total = this.stats()?.totalExpense ?? 0;
    if (total <= 0) return 0;
    return (this.currentUserExpense() / total) * 100;
  });

  readonly myNetSettleBalance = computed(() => {
    const uid = this.currentUserId;
    if (!uid) return 0;
    const balances = this.settleBalances();
    const owedByMe = balances.filter(b => b.fromUserId === uid).reduce((s, b) => s + b.amount, 0);
    const owedToMe = balances.filter(b => b.toUserId === uid).reduce((s, b) => s + b.amount, 0);
    return owedToMe - owedByMe;
  });

  readonly currentUserPaid = computed(() => {
    const txs = this.transactions();
    const uid = this.currentUserId;
    if (!txs || !uid) return 0;

    return txs.reduce((sum, tx) => {
      if (tx.status === TransactionStatus.DELETED || tx.category === 'Settlement') return sum;
      if (tx.type !== 'expense') return sum;

      if (tx.splitData) {
        if (tx.splitData.paidByUserId === 'multiple') {
          const myPayment = tx.splitData.paidBy?.find(p => p.userId === uid);
          return sum + (myPayment?.amount ?? 0);
        }
        return sum + (tx.splitData.paidByUserId === uid ? tx.amount : 0);
      }
      // Simple mode: creator is the payer
      return sum + (tx.userId === uid ? tx.amount : 0);
    }, 0);
  });

  // ─── Getters ─────────────────────────────────────────────────────────────────
  get currentUserId(): string | undefined {
    return this.auth.currentUser?.uid;
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────
  constructor() {
    // Effect 1: Load settlements when family resolves + manage global loader
    effect(() => {
      const fam = this.family();
      const isLoading = this.loading() && !fam;

      if (fam?.id) {
        this.store.dispatch(FamilyActions.loadSettlements({ familyId: fam.id }));
      }

      if (isLoading && !this.isInstanceLoading) {
        this.isInstanceLoading = true;
        this.loaderService.show();
      } else if (!isLoading && this.isInstanceLoading) {
        this.isInstanceLoading = false;
        this.loaderService.hide();
      }
    });

    // Effect 2: Process family data ONLY after:
    //   • Family has resolved (familyId is set — settlements load was dispatched)
    //   • Settlements fetch is complete (not mid-flight)
    //   • Transactions and members are non-empty
    effect(() => {
      const { transactions, members, settlements, familyId, settlementsReady } = this.processorInput();

      if (familyId && settlementsReady && transactions.length > 0 && members.length > 0) {
        this.familyProcessor.process({
          transactions,
          members,
          settlements,
          currentUserId:    this.currentUserId,
          sessionStartTime: this.sessionStartTime,
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
    if (!familyId) return;

    const isOwner = fam.ownerUserId === this.currentUserId;
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
            userId:      this.currentUserId!,
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
