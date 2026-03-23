import {
  Component, inject, OnInit, ChangeDetectionStrategy,
  computed, effect, DestroyRef, untracked, signal
} from '@angular/core';
import { Store } from '@ngrx/store';
import { Actions, ofType } from '@ngrx/effects';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatRippleModule } from '@angular/material/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { distinctUntilChanged, debounceTime } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  SettleAvatarColorPipe,
  MethodLabelPipe,
  SettleDatePipe, IOWEPipe, OwedToMePipe
} from './settle-up.pipes';

import { AppState } from 'src/app/store/app.state';
import * as FamilyActions from '../../store/family.actions';
import * as FamilySelectors from '../../store/family.selectors';
import * as ProfileSelectors from 'src/app/store/profile/profile.selectors';
import * as TransactionsSelectors from 'src/app/store/transactions/transactions.selectors';
import { FamilyService } from '../../services/family.service';
import { CategoryService } from 'src/app/util/service/db/category.service';
import {
  FamilyMember, Settlement, BalanceEntry, AddSettlementRequest
} from 'src/app/util/models/family.model';
import { SettleDialogComponent, SettleDialogData } from './settle-dialog/settle-dialog.component';
import { LocalIndexDBStorageService } from 'src/app/util/service/indexdb-storage.service';
import { TransactionType, AccountType } from 'src/app/util/config/enums';
import { Transaction } from 'src/app/util/models/transaction.model';
import { selectAllAccounts } from 'src/app/store/accounts/accounts.selectors';
import { ImageFallbackDirective } from 'src/app/util/directives/image-fallback.directive';
import { CommonSyncService } from 'src/app/util/service/common-sync.service';
import { FamilyProcessorService } from 'src/app/util/service/family-processor.service';
import { CurrencyPipe } from 'src/app/util/pipes';

@Component({
  selector: 'app-settle-up',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatChipsModule,
    MatDividerModule, MatDialogModule,
    MatRippleModule, MatBadgeModule, MatTooltipModule,
    SettleAvatarColorPipe,
    MethodLabelPipe,
    SettleDatePipe, IOWEPipe, OwedToMePipe,
    ImageFallbackDirective,
    CurrencyPipe
  ],
  templateUrl: './settle-up.component.html',
  styleUrls: ['./settle-up.component.scss'],
})
export class SettleUpComponent implements OnInit {
  private store = inject(Store<AppState>);
  private familyService = inject(FamilyService);
  private categoryService = inject(CategoryService);
  private dialog = inject(MatDialog);
  private destroyRef = inject(DestroyRef);
  private actions$ = inject(Actions);
  private commonSyncService = inject(CommonSyncService);
  private familyProcessor = inject(FamilyProcessorService);

  family = toSignal(this.store.select(FamilySelectors.selectFamily).pipe(distinctUntilChanged()), { initialValue: null });
  members = toSignal(this.store.select(FamilySelectors.selectFamilyMembers).pipe(debounceTime(50), distinctUntilChanged((a, b) => a.length === b.length)), { initialValue: [] as FamilyMember[] });
  transactions = toSignal(this.store.select(TransactionsSelectors.selectAllTransactions).pipe(debounceTime(50), distinctUntilChanged((a, b) => a.length === b.length && a[0]?.id === b[0]?.id && (a[0] as any)?.updatedAt === (b[0] as any)?.updatedAt)), { initialValue: [] as Transaction[] });
  settlements = toSignal(this.store.select(FamilySelectors.selectSettlements).pipe(debounceTime(50), distinctUntilChanged((a, b) => a.length === b.length)), { initialValue: [] as Settlement[] });
  loading = toSignal(this.store.select(TransactionsSelectors.selectTransactionsLoading).pipe(distinctUntilChanged()), { initialValue: true });
  settlementsLoading = toSignal(this.store.select(FamilySelectors.selectSettlementsLoading).pipe(distinctUntilChanged()), { initialValue: false });
  isProcessorProcessing = this.familyProcessor.isProcessing;

  isLoadingCombined = computed(() => this.loading() || this.isProcessorProcessing() || this.settlementsLoading());

  /** Current user's UID from AppState.profile */
  private readonly profile = this.store.selectSignal(ProfileSelectors.selectProfile);
  readonly currentUserId = computed(() => this.profile()?.uid ?? '');

  private storageService = inject(LocalIndexDBStorageService);

  /** User's accounts for default account resolution */
  private readonly accounts = toSignal(
    this.store.select(selectAllAccounts),
    { initialValue: [] as any[] }
  );

  /**
   * Mirrors the default account priority logic from mobile-add-transaction:
   * 1. First BANK type account
   * 2. First account if only one exists
   * 3. Fallback: 'settlement'
   */
  private getDefaultAccountId(): string {
    const accs = this.accounts();
    if (!accs || accs.length === 0) return 'settlement';
    const bankAccount = accs.find(a => a.type === AccountType.BANK);
    if (bankAccount) return bankAccount.accountId;
    if (accs.length === 1) return accs[0].accountId;
    return 'settlement';
  }

  /** All outstanding balances (from owes to) */
  balances = this.familyProcessor.balances;


  /**
   * Optimized: Single pass over the balances array to categorize data for the UI.
   * Prevents downstream updates if the relevant values haven't changed.
   */
  private readonly processedData = computed(() => {
    const raw = this.balances();
    const uid = this.currentUserId();
    
    const my: BalanceEntry[] = [];
    const others: BalanceEntry[] = [];
    let owedByMe = 0;
    let owedToMe = 0;

    for (const b of raw) {
      if (b.fromUserId === uid || b.toUserId === uid) {
        my.push(b);
        if (b.fromUserId === uid) owedByMe += b.amount;
        if (b.toUserId === uid) owedToMe += b.amount;
      } else {
        others.push(b);
      }
    }

    return { 
      my, 
      others, 
      owedByMe: Math.round(owedByMe * 100) / 100, 
      owedToMe: Math.round(owedToMe * 100) / 100 
    };
  }, {
    equal: (a, b) => (
      Math.abs(a.owedByMe - b.owedByMe) < 0.01 &&
      Math.abs(a.owedToMe - b.owedToMe) < 0.01 &&
      a.my.length === b.my.length &&
      a.others.length === b.others.length
    )
  });

  myBalances = computed(() => this.processedData().my);
  otherBalances = computed(() => this.processedData().others);
  totalOwedByMe = computed(() => this.processedData().owedByMe);
  totalOwedToMe = computed(() => this.processedData().owedToMe);

  readonly familyId = computed(() => this.family()?.id);
  expandedSettlementId = signal<string | null>(null);
  expandedBalanceId = signal<string | null>(null);

  toggleExpandBalance(b: BalanceEntry) {
    const id = `${b.fromUserId}::${b.toUserId}`;
    this.expandedBalanceId.set(this.expandedBalanceId() === id ? null : id);
  }

  constructor() {
    // When family ID changes, fetch its relevant sub-collections
    effect(() => {
      const id = this.familyId();
      if (id) {
        untracked(() => {
          this.store.dispatch(FamilyActions.loadMembers({ familyId: id }));
          this.store.dispatch(FamilyActions.loadTransactions({ familyId: id }));
          this.store.dispatch(FamilyActions.loadSettlements({ familyId: id }));
        });
      }
    });

  }

  ngOnInit() {
    this.store.dispatch(FamilyActions.loadMyFamily());
  }

  openSettleDialog(balance: BalanceEntry) {
    const fam = this.family();
    if (!fam?.id) return;

    const data: SettleDialogData = {
      familyId: fam.id,
      balance,
      suggestedAmount: balance.amount,
    };

    const ref = this.dialog.open(SettleDialogComponent, {
      data,
    });

    ref.afterClosed().subscribe((req: AddSettlementRequest | undefined) => {
      if (req) {
        // Consolidated settlement and transaction creation to avoid loop loops
        this.familyService.recordSettlement(req);
      }
    });
  }

  toggleExpand(id: string | undefined) {
    if (!id) return;
    this.expandedSettlementId.set(this.expandedSettlementId() === id ? null : id);
  }

  trackByEntry(_: number, b: BalanceEntry) {
    return `${b.fromUserId}::${b.toUserId}`;
  }

  trackBySettlement(_: number, s: Settlement) {
    return s.id;
  }
}
