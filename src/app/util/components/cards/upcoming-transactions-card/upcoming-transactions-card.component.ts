import { Component, Input, Output, EventEmitter, OnInit, OnDestroy , ChangeDetectionStrategy} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Store } from '@ngrx/store';
import { Observable, Subject, combineLatest } from 'rxjs';
import { takeUntil, map } from 'rxjs/operators';
import { AppState } from '../../../../store/app.state';
import * as TransactionsSelectors from '../../../../store/transactions/transactions.selectors';
import * as CategoriesSelectors from '../../../../store/categories/categories.selectors';
import { Transaction } from '../../../../util/models/transaction.model';
import { Category } from '../../../../util/models/category.model';
import { TransactionType, TransactionStatus } from '../../../../util/config/enums';
import { CurrencyService } from '../../../service/currency.service';

export interface UpcomingTransaction {
  id: string;

  amount: number;
  type: TransactionType;
  date: Date;
  category: string;
  categoryColor: string;
  categoryIcon: string;
  isRecurring: boolean;
  daysUntil: number;
}

export interface MonthlySummary {
  totalIncome: number;
  totalExpense: number;
  netAmount: number;
  transactionCount: number;
}

export interface UpcomingTransactionsConfig {
  title?: string;
  subtitle?: string;
  currency?: string;
  showHeaderIcon?: boolean;
  headerIcon?: string;
  headerIconColor?: string;
  showFooter?: boolean;
  footerText?: string;
  cardHeight?: 'small' | 'medium' | 'large' | 'auto';
  theme?: 'light' | 'dark' | 'auto';
  animations?: boolean;
  clickable?: boolean;
  loading?: boolean;
  error?: string;
  emptyStateMessage?: string;
  showDebugInfo?: boolean;
  maxUpcomingItems?: number;
  daysAhead?: number;
  showMonthlySummary?: boolean;
  onTransactionClick?: (transaction: UpcomingTransaction) => void;
  onRefresh?: () => void;
}

@Component({
  selector: 'app-upcoming-transactions-card',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  templateUrl: './upcoming-transactions-card.component.html',
  styleUrl: './upcoming-transactions-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UpcomingTransactionsCardComponent implements OnInit, OnDestroy {
  @Input() config: UpcomingTransactionsConfig = {
    title: 'Upcoming Transactions',
    subtitle: 'Your scheduled payments and income',
    currency: 'INR',
    showHeaderIcon: true,
    headerIcon: 'schedule',
    headerIconColor: 'blue',
    showFooter: false,
    footerText: 'Last updated',
    cardHeight: 'medium',
    theme: 'auto',
    animations: true,
    clickable: true,
    loading: false,
    error: '',
    emptyStateMessage: 'No upcoming transactions found',
    showDebugInfo: false,
    maxUpcomingItems: 5,
    daysAhead: 30,
    showMonthlySummary: true,
    onTransactionClick: undefined,
    onRefresh: undefined
  };

  // Store observables
  transactions$: Observable<Transaction[]>;
  categories$: Observable<Category[]>;
  transactionsLoading$: Observable<boolean>;
  categoriesLoading$: Observable<boolean>;

  // Computed data
  upcomingTransactions$: Observable<UpcomingTransaction[]>;
  monthlySummary$: Observable<MonthlySummary>;
  isLoading$: Observable<boolean>;

  private destroy$ = new Subject<void>();

  constructor(
    private store: Store<AppState>,
    private currencyService: CurrencyService
  ) {
    // Initialize store selectors
    this.transactions$ = this.store.select(TransactionsSelectors.selectAllTransactions);
    this.categories$ = this.store.select(CategoriesSelectors.selectAllCategories);
    this.transactionsLoading$ = this.store.select(TransactionsSelectors.selectTransactionsLoading);
    this.categoriesLoading$ = this.store.select(CategoriesSelectors.selectCategoriesLoading);

    // Combine loading states
    this.isLoading$ = combineLatest([
      this.transactionsLoading$,
      this.categoriesLoading$
    ]).pipe(
      map(([transactionsLoading, categoriesLoading]) =>
        transactionsLoading || categoriesLoading
      )
    );

    // Calculate upcoming transactions
    this.upcomingTransactions$ = this.calculateUpcomingTransactions();

    // Calculate monthly summary
    this.monthlySummary$ = this.calculateMonthlySummary();
  }

  ngOnInit(): void {
    // Component initialization if needed
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private calculateUpcomingTransactions(): Observable<UpcomingTransaction[]> {
    return combineLatest([this.transactions$, this.categories$]).pipe(
      map(([transactions, categories]) => {
        const currentDate = new Date();
        const daysAhead = this.effectiveConfig.daysAhead || 30;
        const endDate = new Date(currentDate);
        endDate.setDate(currentDate.getDate() + daysAhead);

        // Filter upcoming transactions
        const upcomingTransactions = transactions
          .filter(t => {
            const txDate = this.convertToDate(t.date);
            const isUpcoming = txDate >= currentDate && txDate <= endDate;
            const isPending = t.status === TransactionStatus.PENDING;
            const isRecurring = t.isRecurring || false;

            return isUpcoming && (isPending || isRecurring);
          })
          .map(t => {
            const category = categories.find(c => c.id === t.categoryId);
            const txDate = this.convertToDate(t.date);
            const daysUntil = Math.ceil((txDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));

            return {
              id: t.id || '',

              amount: t.amount,
              type: t.type,
              date: txDate,
              category: category?.name || 'Unknown',
              categoryColor: category?.color || '#6B7280',
              categoryIcon: category?.icon || 'category',
              isRecurring: t.isRecurring || false,
              daysUntil
            };
          })
          .sort((a, b) => a.daysUntil - b.daysUntil)
          .slice(0, this.effectiveConfig.maxUpcomingItems || 5);

        return upcomingTransactions;
      })
    );
  }

  private calculateMonthlySummary(): Observable<MonthlySummary> {
    return this.transactions$.pipe(
      map(transactions => {
        const currentDate = new Date();
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

        const monthlyTransactions = transactions.filter(t => {
          const txDate = this.convertToDate(t.date);
          return txDate >= startOfMonth && txDate <= endOfMonth;
        });

        const totalIncome = monthlyTransactions
          .filter(t => t.type === TransactionType.INCOME)
          .reduce((sum, t) => sum + t.amount, 0);

        const totalExpense = monthlyTransactions
          .filter(t => t.type === TransactionType.EXPENSE)
          .reduce((sum, t) => sum + t.amount, 0);

        return {
          totalIncome,
          totalExpense,
          netAmount: totalIncome - totalExpense,
          transactionCount: monthlyTransactions.length
        };
      })
    );
  }

  private convertToDate(date: Date | any): Date {
    if (date instanceof Date) return date;
    if (date?.seconds) return new Date(date.seconds * 1000);
    return new Date(date);
  }

  get effectiveConfig(): UpcomingTransactionsConfig {
    return {
      title: this.config.title ?? 'Upcoming Transactions',
      subtitle: this.config.subtitle ?? 'Your scheduled payments and income',
      currency: this.config.currency ?? 'INR',
      showHeaderIcon: this.config.showHeaderIcon ?? true,
      headerIcon: this.config.headerIcon ?? 'schedule',
      headerIconColor: this.config.headerIconColor ?? 'blue',
      showFooter: this.config.showFooter ?? false,
      footerText: this.config.footerText ?? 'Last updated',
      cardHeight: this.config.cardHeight ?? 'medium',
      theme: this.config.theme ?? 'auto',
      animations: this.config.animations ?? true,
      clickable: this.config.clickable ?? true,
      loading: this.config.loading ?? false,
      error: this.config.error ?? '',
      emptyStateMessage: this.config.emptyStateMessage ?? 'No upcoming transactions found',
      showDebugInfo: this.config.showDebugInfo ?? false,
      maxUpcomingItems: this.config.maxUpcomingItems ?? 5,
      daysAhead: this.config.daysAhead ?? 30,
      showMonthlySummary: this.config.showMonthlySummary ?? true,
      onTransactionClick: this.config.onTransactionClick,
      onRefresh: this.config.onRefresh
    };
  }

  get cardHeightClass(): string {
    switch (this.effectiveConfig.cardHeight) {
      case 'small': return 'min-h-20';
      case 'large': return 'min-h-32';
      case 'auto': return 'min-h-0';
      default: return 'min-h-24';
    }
  }

  get headerIconColorClass(): string {
    const color = this.effectiveConfig.headerIconColor || 'blue';
    return `bg-${color}-500/10 text-${color}-600 dark:text-${color}-400`;
  }

  formatCurrency(value: number): string {
    return this.currencyService.formatAmount(value);
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric'
    });
  }

  getDaysUntilText(daysUntil: number): string {
    if (daysUntil === 0) return 'Today';
    if (daysUntil === 1) return 'Tomorrow';
    if (daysUntil < 7) return `${daysUntil} days`;
    if (daysUntil < 30) return `${Math.ceil(daysUntil / 7)} weeks`;
    return `${Math.ceil(daysUntil / 30)} months`;
  }

  getDaysUntilColor(daysUntil: number): string {
    if (daysUntil <= 1) return 'text-red-600 dark:text-red-400';
    if (daysUntil <= 3) return 'text-orange-600 dark:text-orange-400';
    if (daysUntil <= 7) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  }

  onTransactionClick(transaction: UpcomingTransaction): void {
    if (this.effectiveConfig.clickable && this.effectiveConfig.onTransactionClick) {
      this.effectiveConfig.onTransactionClick(transaction);
    }
  }

  getLastUpdatedTime(): string {
    return new Date().toLocaleString('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  onRefreshClick(): void {
    if (this.effectiveConfig.onRefresh) {
      this.effectiveConfig.onRefresh();
    }
  }

  get isEmpty(): Observable<boolean> {
    return this.upcomingTransactions$.pipe(
      map(transactions => transactions.length === 0)
    );
  }

  get hasError(): boolean {
    return !!(this.effectiveConfig.error && this.effectiveConfig.error.trim());
  }
} 