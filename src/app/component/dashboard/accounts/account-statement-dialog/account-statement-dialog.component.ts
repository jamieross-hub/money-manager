import { Component, Inject, OnInit, OnDestroy , ChangeDetectionStrategy} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { Observable, Subject, takeUntil, combineLatest } from 'rxjs';
import { Transaction } from '../../../../util/models/transaction.model';
import { Account } from '../../../../util/models/account.model';
import { AppState } from '../../../../store/app.state';
import { TransactionType } from '../../../../util/config/enums';
import { selectTransactionsByAccount } from '../../../../store/transactions/transactions.selectors';
import { DateService } from '../../../../util/service/date.service';
import { CurrencyService } from '../../../../util/service/currency.service';
import { CommonModule } from '@angular/common';
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
import { CurrencyPipe } from 'src/app/util/pipes/currency.pipe';

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
    MatCheckboxModule,
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
    TranslateModule,
    CurrencyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccountStatementDialogComponent implements OnInit, OnDestroy {
  account: Account;
  transactions$: Observable<Transaction[]>;
  transactions: Transaction[] = [];
  calculatedBalance: number = 0;
  recordedBalance: number = 0;
  balanceDifference: number = 0;
  isBalanceAccurate: boolean = true;
  isLoading: boolean = true;
  errorMessage: string = '';

  // Summary statistics
  totalDeposits: number = 0;
  totalWithdrawals: number = 0;
  totalTransactions: number = 0;
  averageTransaction: number = 0;
  largestTransaction: number = 0;

  private destroy$ = new Subject<void>();

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: AccountStatementDialogData,
    public dialogRef: MatDialogRef<AccountStatementDialogComponent>,
    private store: Store<AppState>,
    private dateService: DateService,
    private currencyService: CurrencyService
  ) {
    this.account = data.account;
    this.recordedBalance = this.account.balance || 0;
    this.transactions$ = this.store.select(selectTransactionsByAccount(this.account.accountId));
  }

  ngOnInit(): void {
    this.loadTransactions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadTransactions(): void {
    this.transactions$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (transactions) => {
          this.transactions = transactions;
          this.calculateBalanceFromTransactions();
          this.calculateSummaryStatistics();
          this.isLoading = false;
        },
        error: (error) => {
          this.errorMessage = 'Failed to load transactions';
          this.isLoading = false;
          console.error('Error loading transactions:', error);
        }
      });
  }

  private calculateBalanceFromTransactions(): void {
    // Calculate balance by considering transaction types
    this.calculatedBalance = this.transactions.reduce((balance, transaction) => {
      const amount = transaction.amount || 0;

      switch (transaction.type) {
        case TransactionType.INCOME:
          return balance + amount; // Income increases balance
        case TransactionType.EXPENSE:
          return balance - amount; // Expense decreases balance
        case TransactionType.TRANSFER:
          // For transfers, we need to consider if it's incoming or outgoing
          // Since we're looking at a specific account, transfers to this account are positive
          // and transfers from this account are negative
          // For now, we'll treat transfers as neutral (they don't affect the account balance)
          // as they should be handled by the transfer logic between accounts
          return balance;
        default:
          return balance;
      }
    }, 0);

    // Calculate the difference between calculated and recorded balance
    this.balanceDifference = this.calculatedBalance - this.recordedBalance;
    this.isBalanceAccurate = Math.abs(this.balanceDifference) < 0.01; // Allow for small rounding differences
  }

  private calculateSummaryStatistics(): void {
    this.totalTransactions = this.transactions.length;

    if (this.totalTransactions === 0) {
      this.totalDeposits = 0;
      this.totalWithdrawals = 0;
      this.averageTransaction = 0;
      this.largestTransaction = 0;
      return;
    }

    // Calculate deposits (income transactions) and withdrawals (expense transactions)
    this.totalDeposits = this.transactions
      .filter(t => t.type === TransactionType.INCOME)
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    this.totalWithdrawals = this.transactions
      .filter(t => t.type === TransactionType.EXPENSE)
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    // Calculate average transaction (considering all transaction types)
    const totalAmount = this.transactions.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
    this.averageTransaction = totalAmount / this.totalTransactions;

    // Find largest transaction
    this.largestTransaction = Math.max(...this.transactions.map(t => Math.abs(t.amount || 0)));
  }

  getTransactionTypeIcon(transaction: Transaction): string {
    switch (transaction.type) {
      case TransactionType.INCOME:
        return 'trending_up';
      case TransactionType.EXPENSE:
        return 'trending_down';
      case TransactionType.TRANSFER:
        return 'swap_horiz';
      default:
        return 'help';
    }
  }

  getTransactionTypeClass(transaction: Transaction): string {
    switch (transaction.type) {
      case TransactionType.INCOME:
        return 'positive';
      case TransactionType.EXPENSE:
        return 'negative';
      case TransactionType.TRANSFER:
        return 'transfer';
      default:
        return 'neutral';
    }
  }

  getBalanceClass(): string {
    if (this.isBalanceAccurate) return 'accurate';
    return this.balanceDifference > 0 ? 'positive' : 'negative';
  }

  getBalanceStatusText(): string {
    if (this.isBalanceAccurate) {
      return 'Balance is accurate';
    }
    return this.balanceDifference > 0
      ? `Calculated balance is ${this.currencyService.formatAmount(this.balanceDifference)} higher than recorded`
      : `Calculated balance is ${this.currencyService.formatAmount(Math.abs(this.balanceDifference))} lower than recorded`;
  }

  formatDate(date: any): string {
    return this.dateService.toDate(date)?.toLocaleDateString() || 'N/A';
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