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
import * as AccountsSelectors from '../../../../store/accounts/accounts.selectors';
import { Transaction } from '../../../../util/models/transaction.model';
import { Category } from '../../../../util/models/category.model';
import { Account } from '../../../../util/models/account.model';
import { TransactionType } from '../../../../util/config/enums';
import { CurrencyService } from '../../../service/currency.service';

export interface CategoryTrend {
  category: string;
  change: number;
  percentage: number;
  color?: string;
  icon?: string;
}

export interface SpendingTrend {
  period: string;
  amount: number;
  change?: number;
  percentage?: number;
}

export interface AccountBalance {
  account: string;
  balance: number;
  change?: number;
  percentage?: number;
  color?: string;
  icon?: string;
}

export interface AnalyticsSummaryConfig {
  title?: string;
  subtitle?: string;
  currency?: string;
  showHeaderIcon?: boolean;
  headerIcon?: string;
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
  maxItems?: {
    categoryTrends?: number;
    spendingTrends?: number;
    accountBalances?: number;
  };
  onCategoryClick?: (trend: CategoryTrend) => void;
  onSpendingClick?: (trend: SpendingTrend) => void;
  onAccountClick?: (account: AccountBalance) => void;
  onRefresh?: () => void;
}

@Component({
  selector: 'app-analytics-summary-card',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  templateUrl: './analytics-summary-card.component.html',
  styleUrl: './analytics-summary-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnalyticsSummaryCardComponent implements OnInit, OnDestroy {
  @Input() config: AnalyticsSummaryConfig = {
    title: 'Analytics Summary',
    subtitle: 'Key insights and trends',
    currency: 'INR',
    showHeaderIcon: true,
    headerIcon: 'insights',
    showFooter: false,
    footerText: 'Last updated',
    cardHeight: 'medium',
    theme: 'auto',
    animations: true,
    clickable: true,
    loading: false,
    error: '',
    emptyStateMessage: 'No analytics data available',
    showDebugInfo: false,
    maxItems: {
      categoryTrends: 3,
      spendingTrends: 3,
      accountBalances: 3
    }
  };

  // Store observables
  transactions$: Observable<Transaction[]>;
  categories$: Observable<Category[]>;
  accounts$: Observable<Account[]>;
  transactionsLoading$: Observable<boolean>;
  categoriesLoading$: Observable<boolean>;
  accountsLoading$: Observable<boolean>;

  // Computed analytics data
  categoryTrends$: Observable<CategoryTrend[]>;
  spendingTrends$: Observable<SpendingTrend[]>;
  accountBalances$: Observable<AccountBalance[]>;
  isLoading$: Observable<boolean>;

  private destroy$ = new Subject<void>();

  constructor(
    private store: Store<AppState>,
    private currencyService: CurrencyService
  ) {
    // Initialize store selectors
    this.transactions$ = this.store.select(TransactionsSelectors.selectAllTransactions);
    this.categories$ = this.store.select(CategoriesSelectors.selectAllCategories);
    this.accounts$ = this.store.select(AccountsSelectors.selectAllAccounts);
    this.transactionsLoading$ = this.store.select(TransactionsSelectors.selectTransactionsLoading);
    this.categoriesLoading$ = this.store.select(CategoriesSelectors.selectCategoriesLoading);
    this.accountsLoading$ = this.store.select(AccountsSelectors.selectAccountsLoading);

    // Combine loading states
    this.isLoading$ = combineLatest([
      this.transactionsLoading$,
      this.categoriesLoading$,
      this.accountsLoading$
    ]).pipe(
      map(([transactionsLoading, categoriesLoading, accountsLoading]) =>
        transactionsLoading || categoriesLoading || accountsLoading
      )
    );

    // Calculate analytics data
    this.categoryTrends$ = this.calculateCategoryTrends();
    this.spendingTrends$ = this.calculateSpendingTrends();
    this.accountBalances$ = this.calculateAccountBalances();
  }

  ngOnInit(): void {
    // Component initialization if needed
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private calculateCategoryTrends(): Observable<CategoryTrend[]> {
    return combineLatest([this.transactions$, this.categories$]).pipe(
      map(([transactions, categories]) => {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;

        // Get current month transactions
        const currentMonthTransactions = transactions.filter(t => {
          const txDate = this.convertToDate(t.date);
          return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
        });

        // Get previous month transactions
        const previousMonthTransactions = transactions.filter(t => {
          const txDate = this.convertToDate(t.date);
          return txDate.getMonth() === previousMonth && txDate.getFullYear() === previousYear;
        });

        // Calculate category trends
        const categoryMap = new Map<string, { current: number; previous: number; category: Category }>();

        // Process current month
        currentMonthTransactions.forEach(t => {
          const category = categories.find(c => c.id === t.categoryId);
          if (category) {
            const existing = categoryMap.get(t.categoryId) || { current: 0, previous: 0, category };
            existing.current += t.amount;
            categoryMap.set(t.categoryId, existing);
          }
        });

        // Process previous month
        previousMonthTransactions.forEach(t => {
          const category = categories.find(c => c.id === t.categoryId);
          if (category) {
            const existing = categoryMap.get(t.categoryId) || { current: 0, previous: 0, category };
            existing.previous += t.amount;
            categoryMap.set(t.categoryId, existing);
          }
        });

        // Convert to trends
        const trends: CategoryTrend[] = Array.from(categoryMap.values())
          .filter(item => item.current > 0 || item.previous > 0)
          .map(item => {
            const change = item.current - item.previous;
            const percentage = item.previous > 0 ? ((change / item.previous) * 100) : 0;

            return {
              category: item.category.name,
              change: Math.abs(change),
              percentage: Math.abs(percentage),
              color: item.category.color,
              icon: item.category.icon
            };
          })
          .sort((a, b) => b.change - a.change)
          .slice(0, this.config.maxItems?.categoryTrends || 3);

        return trends;
      })
    );
  }

  private calculateSpendingTrends(): Observable<SpendingTrend[]> {
    return this.transactions$.pipe(
      map(transactions => {
        const currentDate = new Date();
        const trends: SpendingTrend[] = [];

        // Calculate last 6 months
        for (let i = 5; i >= 0; i--) {
          const month = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
          const monthName = month.toLocaleDateString('en-US', { month: 'short' });

          const monthTransactions = transactions.filter(t => {
            const txDate = this.convertToDate(t.date);
            return txDate.getMonth() === month.getMonth() &&
              txDate.getFullYear() === month.getFullYear() &&
              t.type === TransactionType.EXPENSE;
          });

          const totalAmount = monthTransactions.reduce((sum, t) => sum + t.amount, 0);

          trends.push({
            period: monthName,
            amount: totalAmount
          });
        }

        // Calculate percentage changes
        for (let i = 1; i < trends.length; i++) {
          const current = trends[i];
          const previous = trends[i - 1];
          if (previous.amount > 0) {
            current.change = current.amount - previous.amount;
            current.percentage = (current.change / previous.amount) * 100;
          }
        }

        return trends.slice(-(this.config.maxItems?.spendingTrends || 3));
      })
    );
  }

  private calculateAccountBalances(): Observable<AccountBalance[]> {
    return this.accounts$.pipe(
      map(accounts => {
        return accounts
          .filter(account => account.isActive !== false)
          .map(account => {
            // Handle all accounts consistently using the standard balance property
            const balance = Number(account.balance) || 0;

            return {
              account: account.name,
              balance: balance,
              change: 0, // Could be calculated from transaction history
              percentage: 0,
              color: balance >= 0 ? '#10B981' : '#EF4444',
              icon: this.getAccountIcon(account)
            };
          })
          .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
          .slice(0, this.config.maxItems?.accountBalances || 3);
      })
    );
  }

  private convertToDate(date: Date | any): Date {
    if (date instanceof Date) return date;
    if (date?.seconds) return new Date(date.seconds * 1000);
    return new Date(date);
  }

  private getAccountIcon(account: Account): string {
    switch (account.type) {
      case 'bank': return 'account_balance';
      case 'cash': return 'money';
      case 'credit': return 'credit_card';
      case 'loan': return 'account_balance_wallet';
      default: return 'account_balance';
    }
  }

  get effectiveConfig(): AnalyticsSummaryConfig {
    return {
      title: this.config.title ?? 'Analytics Summary',
      subtitle: this.config.subtitle ?? 'Key insights and trends',
      currency: this.config.currency ?? 'INR',
      showHeaderIcon: this.config.showHeaderIcon ?? true,
      headerIcon: this.config.headerIcon ?? 'insights',
      showFooter: this.config.showFooter ?? false,
      footerText: this.config.footerText ?? 'Last updated',
      cardHeight: this.config.cardHeight ?? 'medium',
      theme: this.config.theme ?? 'auto',
      animations: this.config.animations ?? true,
      clickable: this.config.clickable ?? true,
      loading: this.config.loading ?? false,
      error: this.config.error ?? '',
      emptyStateMessage: this.config.emptyStateMessage ?? 'No analytics data available',
      showDebugInfo: this.config.showDebugInfo ?? false,
      maxItems: this.config.maxItems ?? {
        categoryTrends: 3,
        spendingTrends: 3,
        accountBalances: 3
      },
      onCategoryClick: this.config.onCategoryClick,
      onSpendingClick: this.config.onSpendingClick,
      onAccountClick: this.config.onAccountClick,
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

  formatCurrency(value: number): string {
    return this.currencyService.formatAmount(value);
  }

  getTrendColor(trend: CategoryTrend): string {
    // For category trends, positive change means spending increased (red), negative means spending decreased (green)
    return trend.change >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400';
  }

  getTrendIcon(trend: CategoryTrend): string {
    return trend.change >= 0 ? 'trending_up' : 'trending_down';
  }

  getAccountColor(account: AccountBalance): string {
    if (account.color) return account.color;
    return account.balance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  }

  getAccountIconForBalance(account: AccountBalance): string {
    return account.icon || 'account_balance';
  }

  onCategoryClick(trend: CategoryTrend): void {
    if (this.effectiveConfig.clickable && this.effectiveConfig.onCategoryClick) {
      this.effectiveConfig.onCategoryClick(trend);
    }
  }

  onSpendingClick(trend: SpendingTrend): void {
    if (this.effectiveConfig.clickable && this.effectiveConfig.onSpendingClick) {
      this.effectiveConfig.onSpendingClick(trend);
    }
  }

  onAccountClick(account: AccountBalance): void {
    if (this.effectiveConfig.clickable && this.effectiveConfig.onAccountClick) {
      this.effectiveConfig.onAccountClick(account);
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
    return combineLatest([
      this.categoryTrends$,
      this.spendingTrends$,
      this.accountBalances$
    ]).pipe(
      map(([categoryTrends, spendingTrends, accountBalances]) =>
        categoryTrends.length === 0 &&
        spendingTrends.length === 0 &&
        accountBalances.length === 0
      )
    );
  }

  get hasError(): boolean {
    return !!(this.effectiveConfig.error && this.effectiveConfig.error.trim());
  }
} 