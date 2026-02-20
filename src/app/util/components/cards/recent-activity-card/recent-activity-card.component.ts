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
import { TransactionType } from '../../../../util/config/enums';
import { CurrencyService } from '../../../service/currency.service';

export interface RecentTransaction {
  id: string;

  category: string;
  amount: number;
  type: 'income' | 'expense';
  date: Date;
  icon: string;
  color: string;
}

export interface RecentActivityConfig {
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
  maxItems?: number;
  period?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  transactionType?: 'all' | 'income' | 'expense';
  onTransactionClick?: (transaction: RecentTransaction) => void;
  onRefresh?: () => void;
}

@Component({
  selector: 'app-recent-activity-card',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  templateUrl: './recent-activity-card.component.html',
  styleUrl: './recent-activity-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RecentActivityCardComponent implements OnInit, OnDestroy {
  @Input() config: RecentActivityConfig = {
    title: 'Recent transactions',
    subtitle: 'Latest transactions',
    currency: 'INR',
    showHeaderIcon: true,
    headerIcon: 'schedule',
    headerIconColor: 'orange',
    showFooter: false,
    footerText: 'Last updated',
    cardHeight: 'medium',
    theme: 'auto',
    animations: true,
    clickable: true,
    loading: false,
    error: '',
    emptyStateMessage: 'Your recent activity will appear here',
    showDebugInfo: false,
    maxItems: 5,
    period: 'monthly',
    transactionType: 'all'
  };

  // Store observables
  transactions$: Observable<Transaction[]>;
  categories$: Observable<Category[]>;
  transactionsLoading$: Observable<boolean>;
  categoriesLoading$: Observable<boolean>;

  // Computed data
  recentTransactions$: Observable<RecentTransaction[]>;
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

    // Calculate recent transactions
    this.recentTransactions$ = this.calculateRecentTransactions();
  }

  ngOnInit(): void {
    // Component initialization if needed
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private calculateRecentTransactions(): Observable<RecentTransaction[]> {
    return combineLatest([this.transactions$, this.categories$]).pipe(
      map(([transactions, categories]) => {
        const currentDate = new Date();
        let startDate: Date;

        // Filter transactions based on period
        switch (this.effectiveConfig.period) {
          case 'daily':
            startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
            break;
          case 'weekly':
            const dayOfWeek = currentDate.getDay();
            const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - daysToSubtract);
            break;
          case 'yearly':
            startDate = new Date(currentDate.getFullYear(), 0, 1);
            break;
          default: // monthly
            startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            break;
        }

        // Filter transactions by date and type
        const filteredTransactions = transactions.filter(t => {
          const txDate = this.convertToDate(t.date);
          const matchesDate = txDate >= startDate && txDate <= currentDate;
          const matchesType = this.effectiveConfig.transactionType === 'all' ||
            t.type === (this.effectiveConfig.transactionType === 'income' ? TransactionType.INCOME : TransactionType.EXPENSE);
          return matchesDate && matchesType;
        });

        // Convert to recent transactions format
        const recentTransactions: RecentTransaction[] = filteredTransactions
          .map(t => {
            const category = categories.find(c => c.id === t.categoryId);
            return {
              id: t.id || '',

              category: category?.name || 'Uncategorized',
              amount: t.amount,
              type: (t.type === TransactionType.INCOME ? 'income' : 'expense') as 'income' | 'expense',
              date: this.convertToDate(t.date),
              icon: category?.icon || 'receipt',
              color: category?.color || '#6B7280'
            };
          })
          .sort((a, b) => b.date.getTime() - a.date.getTime())
          .slice(0, this.effectiveConfig.maxItems || 5);

        return recentTransactions;
      })
    );
  }

  private convertToDate(date: Date | any): Date {
    if (date instanceof Date) return date;
    if (date?.seconds) return new Date(date.seconds * 1000);
    return new Date(date);
  }

  get effectiveConfig(): RecentActivityConfig {
    return {
      title: this.config.title ?? 'Recent Activity',
      subtitle: this.config.subtitle ?? 'Latest transactions',
      currency: this.config.currency ?? 'INR',
      showHeaderIcon: this.config.showHeaderIcon ?? true,
      headerIcon: this.config.headerIcon ?? 'schedule',
      headerIconColor: this.config.headerIconColor ?? 'orange',
      showFooter: this.config.showFooter ?? false,
      footerText: this.config.footerText ?? 'Last updated',
      cardHeight: this.config.cardHeight ?? 'medium',
      theme: this.config.theme ?? 'auto',
      animations: this.config.animations ?? true,
      clickable: this.config.clickable ?? true,
      loading: this.config.loading ?? false,
      error: this.config.error ?? '',
      emptyStateMessage: this.config.emptyStateMessage ?? 'Your recent activity will appear here',
      showDebugInfo: this.config.showDebugInfo ?? false,
      maxItems: this.config.maxItems ?? 5,
      period: this.config.period ?? 'monthly',
      transactionType: this.config.transactionType ?? 'all',
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
    const color = this.effectiveConfig.headerIconColor || 'orange';
    return `bg-${color}-500/10 text-${color}-600 dark:text-${color}-400`;
  }

  formatCurrency(value: number): string {
    return this.currencyService.formatAmount(value);
  }

  getTransactionColor(transaction: RecentTransaction): string {
    return transaction.type === 'income'
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400';
  }

  getTransactionIcon(transaction: RecentTransaction): string {
    return transaction.icon;
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  }

  onTransactionClick(transaction: RecentTransaction): void {
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
    return this.recentTransactions$.pipe(
      map(transactions => transactions.length === 0)
    );
  }

  get hasError(): boolean {
    return !!(this.effectiveConfig.error && this.effectiveConfig.error.trim());
  }
} 