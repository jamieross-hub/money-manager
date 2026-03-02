import {
  Component, inject, OnInit, ChangeDetectionStrategy,
  computed, effect, DestroyRef
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
import { take, switchMap, map } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  SettleAvatarPipe, SettleAvatarColorPipe,
  MethodIconPipe, MethodLabelPipe,
  SettleDatePipe, IOWEPipe, OwedToMePipe
} from './settle-up.pipes';

import { AppState } from 'src/app/store/app.state';
import * as FamilyActions from '../../store/family.actions';
import * as FamilySelectors from '../../store/family.selectors';
import * as ProfileSelectors from 'src/app/store/profile/profile.selectors';
import * as TransactionsActions from 'src/app/store/transactions/transactions.actions';
import { FamilyService } from '../../services/family.service';
import { CategoryService } from 'src/app/util/service/db/category.service';
import {
  FamilyMember, Settlement, BalanceEntry, AddSettlementRequest
} from 'src/app/util/models/family.model';
import { SettleDialogComponent, SettleDialogData } from './settle-dialog/settle-dialog.component';
import { LocalIndexDBStorageService } from 'src/app/util/service/indexdb-storage.service';
import { TransactionType, SyncStatus, TransactionStatus, AccountType } from 'src/app/util/config/enums';
import { Transaction } from 'src/app/util/models/transaction.model';
import { selectAllAccounts } from 'src/app/store/accounts/accounts.selectors';
import { ImageFallbackDirective } from 'src/app/util/directives/image-fallback.directive';
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
    SettleAvatarPipe, SettleAvatarColorPipe,
    MethodIconPipe, MethodLabelPipe,
    SettleDatePipe, IOWEPipe, OwedToMePipe,
    ImageFallbackDirective,
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

  family = toSignal(this.store.select(FamilySelectors.selectFamily), { initialValue: null });
  members = toSignal(this.store.select(FamilySelectors.selectFamilyMembers), { initialValue: [] as FamilyMember[] });
  transactions = toSignal(this.store.select(FamilySelectors.selectFamilyTransactions), { initialValue: [] as Transaction[] });
  settlements = toSignal(this.store.select(FamilySelectors.selectSettlements), { initialValue: [] as Settlement[] });
  loading = toSignal(this.store.select(FamilySelectors.selectFamilyLoading), { initialValue: true });
  settlementsLoading = toSignal(this.store.select(FamilySelectors.selectSettlementsLoading), { initialValue: false });

  /** Current user's UID from AppState.profile */
  private readonly profile = this.store.selectSignal(ProfileSelectors.selectProfile);
  get currentUserId(): string { return this.profile()?.uid ?? ''; }

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
  balances = computed<BalanceEntry[]>(() => {
    const trans = this.transactions();
    const mems = this.members();
    const sets = this.settlements();
    const fam = this.family();

    if (!fam?.id || mems.length === 0) return [];

    // Perform calculation when data is loaded (instantly responsive thanks to signals)
    return this.familyService.computeBalances(trans, mems, sets);
  });

  /** Balances involving the current user (highlighted) */
  myBalances = computed<BalanceEntry[]>(() => {
    const uid = this.currentUserId;
    return this.balances().filter(b => b.fromUserId === uid || b.toUserId === uid);
  });

  /** Other balances (not involving current user) */
  otherBalances = computed<BalanceEntry[]>(() => {
    const uid = this.currentUserId;
    return this.balances().filter(b => b.fromUserId !== uid && b.toUserId !== uid);
  });

  totalOwedByMe = computed<number>(() => {
    const uid = this.currentUserId;
    return this.myBalances().filter(b => b.fromUserId === uid).reduce((s, b) => s + b.amount, 0);
  });

  totalOwedToMe = computed<number>(() => {
    const uid = this.currentUserId;
    return this.myBalances().filter(b => b.toUserId === uid).reduce((s, b) => s + b.amount, 0);
  });

  constructor() {
    // When family loads, fetch members, transactions, and settlements
    effect(() => {
      const fam = this.family();
      if (fam?.id) {
        this.store.dispatch(FamilyActions.loadMembers({ familyId: fam.id }));
        this.store.dispatch(FamilyActions.loadTransactions({ familyId: fam.id }));
        this.store.dispatch(FamilyActions.loadSettlements({ familyId: fam.id }));
      }
    }, { allowSignalWrites: true });
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
        const famId = this.family()?.id;

        // 1. Subscribe to the successful settlement action BEFORE dispatching it
        const sub = this.actions$.pipe(
          ofType(FamilyActions.addSettlementSuccess),
          take(1),
          switchMap(({ settlement }: { settlement: Settlement }) => {
            return this.categoryService.findOrCreateSystemCategory(
              this.currentUserId, // <--- Securely always fetch/create on current user's DB
              'Settlement',
              TransactionType.TRANSFER,
              'handshake',
              '#10b981'
            ).pipe(
              map((categoryId: string) => ({ settlement, categoryId }))
            );
          })
        ).subscribe(({ settlement, categoryId }) => {
          const userId = this.currentUserId; // <--- Securely log personal tx under current user
          const amIPaying = userId === req.fromUserId;
          const payee = amIPaying ? req.toDisplayName : req.fromDisplayName;

          const now = new Date();
          const methodLabel = req.method === 'cash' ? 'Cash'
            : req.method === 'upi' ? 'UPI'
            : 'Bank Transfer';

          const transferTx: Omit<Transaction, 'id'> = {
            userId,
            accountId: this.getDefaultAccountId(),
            categoryId: categoryId,
            category: 'Settlement',
            payee: payee,
            amount: req.amount,
            type: amIPaying ? TransactionType.EXPENSE : TransactionType.INCOME, // Personal ledger reflects net flow
            date: now,
            notes: `Settlement: ${req.fromDisplayName} \u2192 ${req.toDisplayName} via ${methodLabel}${req.note ? ' | ' + req.note : ''}`,
            status: TransactionStatus.COMPLETED,
            syncStatus: SyncStatus.PENDING,
            createdAt: now,
            updatedAt: now,
            createdBy: userId,
            updatedBy: userId,
            settlementId: settlement.id,
            settlementFamilyId: famId,
            settlementFromUserId: req.fromUserId,
            settlementToUserId: req.toUserId,
            familyId: famId // Also tag personal record with familyId for easier filtering
          };

          const familyTxRequest = {
            ...transferTx,
            type: TransactionType.TRANSFER, // Keep external family perspective as a neutral Transfer
            familyId: famId!,
            userDisplayName: this.profile()?.displayName || '',
            userPhotoURL: this.profile()?.photoURL || ''
          };

          // 1. Record in personal transactions (for account balance)
          this.store.dispatch(TransactionsActions.createTransaction({ userId, transaction: transferTx }));
          
          // 2. Record in family transactions (for shared visibility)
          this.store.dispatch(FamilyActions.addTransaction({ request: familyTxRequest as any }));
        });

        // 2. Dispatch the settlement ONLY AFTER the listener is set up
        this.store.dispatch(FamilyActions.addSettlement({ request: req }));
      }
    });
  }

  trackByEntry(_: number, b: BalanceEntry) {
    return `${b.fromUserId}::${b.toUserId}`;
  }

  trackBySettlement(_: number, s: Settlement) {
    return s.id;
  }
}
