import { Component, Inject, OnInit, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { toSignal } from '@angular/core/rxjs-interop';
import { Transaction } from '../../../../util/models/transaction.model';
import { Account } from '../../../../util/models/account.model';
import { AppState } from '../../../../store/app.state';
import { TransactionType } from '../../../../util/config/enums';
import { selectTransactionsByAccount } from '../../../../store/transactions/transactions.selectors';
import { DateService } from '../../../../util/service/date.service';
import { CurrencyService } from '../../../../util/service/currency.service';

import { CommonHeaderComponent } from 'src/app/util/components/dialog/common-header/common-header.component';
import { CommonBodyContentComponent } from 'src/app/util/components/dialog/common-body-content/common-body-content.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatRippleModule } from '@angular/material/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSortModule } from '@angular/material/sort';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';

export interface AccountStatementDialogData {
  account: Account;
}

@Component({
  selector: 'app-account-statement-dialog',
  templateUrl: './account-statement-dialog.component.html',
  styleUrls: ['./account-statement-dialog.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CommonBodyContentComponent,
    CommonHeaderComponent,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatRippleModule,
    MatTooltipModule,
    MatDividerModule,
    MatListModule,
    MatTabsModule,
    MatCardModule,
    MatSlideToggleModule,
    MatAutocompleteModule,
    MatExpansionModule,
    MatChipsModule,
    MatSnackBarModule,
    MatSliderModule,
    MatStepperModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatProgressSpinnerModule,
    TranslateModule
],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccountStatementDialogComponent implements OnInit {
  account = signal<Account | null>(null);
  
  // Use toSignal for transactions
  private _transactions = toSignal(
    this.store.select(selectTransactionsByAccount(this.data.account.accountId)),
    { initialValue: [] as Transaction[] }
  );

  transactions = computed(() => this._transactions() || []);
  isLoading = signal(false); // Transactions are already being streamed, usually loader isn't needed if fast

  // Calculated values using signals
  calculatedBalance = computed(() => {
    return this.transactions().reduce((balance, transaction) => {
      const amount = transaction.amount || 0;
      switch (transaction.type) {
        case TransactionType.INCOME: return balance + amount;
        case TransactionType.EXPENSE: return balance - amount;
        default: return balance;
      }
    }, 0);
  });

  recordedBalance = computed(() => this.account()?.balance || 0);
  balanceDifference = computed(() => this.calculatedBalance() - this.recordedBalance());
  isBalanceAccurate = computed(() => Math.abs(this.balanceDifference()) < 0.01);

  // Summary statistics
  totalDeposits = computed(() => 
    this.transactions()
      .filter(t => t.type === TransactionType.INCOME)
      .reduce((sum, t) => sum + (t.amount || 0), 0)
  );

  totalWithdrawals = computed(() => 
    this.transactions()
      .filter(t => t.type === TransactionType.EXPENSE)
      .reduce((sum, t) => sum + (t.amount || 0), 0)
  );

  totalTransactions = computed(() => this.transactions().length);
  
  averageTransaction = computed(() => {
    const total = this.totalTransactions();
    if (total === 0) return 0;
    const totalAmount = this.transactions().reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
    return totalAmount / total;
  });

  largestTransaction = computed(() => {
    if (this.transactions().length === 0) return 0;
    return Math.max(...this.transactions().map(t => Math.abs(t.amount || 0)));
  });

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: AccountStatementDialogData,
    public dialogRef: MatDialogRef<AccountStatementDialogComponent>,
    private store: Store<AppState>,
    private dateService: DateService,
    private currencyService: CurrencyService
  ) {
    this.account.set(data.account);
  }

  ngOnInit(): void {}

  getTransactionTypeIcon(transaction: Transaction): string {
    switch (transaction.type) {
      case TransactionType.INCOME: return 'trending_up';
      case TransactionType.EXPENSE: return 'trending_down';
      case TransactionType.TRANSFER: return 'swap_horiz';
      default: return 'help';
    }
  }

  getTransactionTypeClass(transaction: Transaction): string {
    switch (transaction.type) {
      case TransactionType.INCOME: return 'positive';
      case TransactionType.EXPENSE: return 'negative';
      case TransactionType.TRANSFER: return 'transfer';
      default: return 'neutral';
    }
  }

  getBalanceClass(): string {
    if (this.isBalanceAccurate()) return 'accurate';
    return this.balanceDifference() > 0 ? 'positive' : 'negative';
  }

  getBalanceStatusText(): string {
    if (this.isBalanceAccurate()) {
      return 'Statement balance matches recorded balance';
    }
    return this.balanceDifference() > 0
      ? `Calculated balance is ${this.currencyService.formatAmount(this.balanceDifference())} higher than recorded`
      : `Calculated balance is ${this.currencyService.formatAmount(Math.abs(this.balanceDifference()))} lower than recorded`;
  }

  formatDate(date: any): string {
    return this.dateService.toDate(date)?.toLocaleDateString(undefined, { 
      day: '2-digit', month: 'short', year: 'numeric' 
    }) || 'N/A';
  }

  formatAmount(amount: number): string {
    return this.currencyService.formatAmount(amount);
  }

  close(): void {
    this.dialogRef.close();
  }

  exportStatement(): void {
    // TODO: Implement export functionality
    console.log('Export statement functionality to be implemented');
  }

  trackByTransactionId(index: number, transaction: Transaction): string {
    return transaction.id || index.toString();
  }
}
 