import {
  Component, inject, OnInit, ChangeDetectionStrategy,
  computed, effect, DestroyRef
} from '@angular/core';
import { Store } from '@ngrx/store';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatRippleModule } from '@angular/material/core';
import { MatBadgeModule } from '@angular/material/badge';
import { toSignal } from '@angular/core/rxjs-interop';

import { AppState } from 'src/app/store/app.state';
import * as FamilyActions from '../../store/family.actions';
import * as FamilySelectors from '../../store/family.selectors';
import * as ProfileSelectors from 'src/app/store/profile/profile.selectors';
import { FamilyService } from '../../services/family.service';
import {
  FamilyMember, FamilyTransaction, Settlement, BalanceEntry, AddSettlementRequest
} from 'src/app/util/models/family.model';
import { SettleDialogComponent, SettleDialogData } from './settle-dialog/settle-dialog.component';

@Component({
  selector: 'app-settle-up',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatChipsModule,
    MatDividerModule, MatDialogModule,
    MatRippleModule, MatBadgeModule,
  ],
  templateUrl: './settle-up.component.html',
  styleUrls: ['./settle-up.component.scss'],
})
export class SettleUpComponent implements OnInit {
  private store = inject(Store<AppState>);
  private familyService = inject(FamilyService);
  private dialog = inject(MatDialog);
  private destroyRef = inject(DestroyRef);

  family = toSignal(this.store.select(FamilySelectors.selectFamily), { initialValue: null });
  members = toSignal(this.store.select(FamilySelectors.selectFamilyMembers), { initialValue: [] as FamilyMember[] });
  transactions = toSignal(this.store.select(FamilySelectors.selectFamilyTransactions), { initialValue: [] as FamilyTransaction[] });
  settlements = toSignal(this.store.select(FamilySelectors.selectSettlements), { initialValue: [] as Settlement[] });
  loading = toSignal(this.store.select(FamilySelectors.selectFamilyLoading), { initialValue: true });
  settlementsLoading = toSignal(this.store.select(FamilySelectors.selectSettlementsLoading), { initialValue: false });

  /** Current user's UID from AppState.profile */
  private readonly profile = this.store.selectSignal(ProfileSelectors.selectProfile);
  get currentUserId(): string { return this.profile()?.uid ?? ''; }

  /** All outstanding balances (from owes to) */
  balances = computed<BalanceEntry[]>(() =>
    this.familyService.computeBalances(
      this.transactions(),
      this.members(),
      this.settlements()
    )
  );

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
      width: '100%',
      maxWidth: '420px',
      panelClass: 'settle-dialog-panel',
    });

    ref.afterClosed().subscribe((req: AddSettlementRequest | undefined) => {
      if (req) {
        this.store.dispatch(FamilyActions.addSettlement({ request: req }));
      }
    });
  }

  /** User is the one who OWES (from) */
  iOwe(balance: BalanceEntry): boolean {
    return balance.fromUserId === this.currentUserId;
  }

  /** User is the one who is OWED (to) */
  owedToMe(balance: BalanceEntry): boolean {
    return balance.toUserId === this.currentUserId;
  }

  formatDate(date: any): string {
    if (!date) return '';
    const d = date?.seconds ? new Date(date.seconds * 1000) : new Date(date);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  methodLabel(method: string): string {
    return { cash: 'Cash', upi: 'UPI', bank_transfer: 'Bank Transfer' }[method] ?? method;
  }

  methodIcon(method: string): string {
    return { cash: 'payments', upi: 'phone_iphone', bank_transfer: 'account_balance' }[method] ?? 'swap_horiz';
  }

  avatar(name: string): string {
    return (name || '?').charAt(0).toUpperCase();
  }

  private memberColors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];
  avatarColor(userId: string): string {
    let hash = 0;
    for (const c of userId) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
    return this.memberColors[hash % this.memberColors.length];
  }

  trackByEntry(_: number, b: BalanceEntry) {
    return `${b.fromUserId}::${b.toUserId}`;
  }

  trackBySettlement(_: number, s: Settlement) {
    return s.id;
  }
}
