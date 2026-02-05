import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
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
import { TransactionType, AccountType } from '../../../../util/config/enums';
import { CurrencyService } from '../../../service/currency.service';

export interface KeyMetric {
  id?: string;
  title: string;
  value: number;
  period?: string;
  icon?: string;
  color: 'green' | 'red' | 'blue' | 'purple' | 'orange' | 'yellow' | 'gray';
  trend?: 'up' | 'down' | 'neutral';
  changeValue?: number;
  changePercentage?: number;
  description?: string;
  customData?: any;
}

export interface KeyMetricsConfig {
  title?: string;
  subtitle?: string;
  currency?: string;
  showTrends?: boolean;
  showIcons?: boolean;
  showPeriod?: boolean;
  showHeaderIcon?: boolean;
  headerIcon?: string;
  showFooter?: boolean;
  footerText?: string;
  cardHeight?: 'small' | 'medium' | 'large' | 'auto';
  layout?: 'grid' | 'list' | 'compact';
  columns?: 1 | 2 | 3 | 4 | 5 | 6;
  cardsPerRow?: {
    xs?: 1 | 2;      // Extra small screens (< 480px)
    sm?: 1 | 2 | 3;  // Small screens (480px - 640px)
    md?: 1 | 2 | 3 | 4; // Medium screens (640px - 768px)
    lg?: 1 | 2 | 3 | 4 | 5; // Large screens (768px - 1024px)
    xl?: 1 | 2 | 3 | 4 | 5 | 6; // Extra large screens (1024px - 1280px)
    xxl?: 1 | 2 | 3 | 4 | 5 | 6; // 2XL screens (> 1280px)
  };
  responsiveBreakpoints?: {
    mobile?: 1 | 2;
    tablet?: 1 | 2 | 3;
    desktop?: 1 | 2 | 3 | 4 | 5 | 6;
  };
  theme?: 'light' | 'dark' | 'auto';
  animations?: boolean;
  clickable?: boolean;
  loading?: boolean;
  error?: string;
  emptyStateMessage?: string;
  showDebugInfo?: boolean;
  customColors?: {
    green?: string;
    red?: string;
    blue?: string;
    purple?: string;
    orange?: string;
    yellow?: string;
    gray?: string;
  };
  onMetricClick?: (metric: KeyMetric) => void;
  onRefresh?: () => void;
}

@Component({
  selector: 'app-key-metrics-summary-card',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  templateUrl: './key-metrics-summary-card.component.html',
  styleUrl: './key-metrics-summary-card.component.scss'
})
export class KeyMetricsSummaryCardComponent implements OnInit, OnDestroy {
  @Input() config: KeyMetricsConfig = {
    title: 'Key Metrics Summary',
    subtitle: 'Financial overview for this period',
    currency: 'INR',
    showTrends: true,
    showIcons: true,
    showPeriod: true,
    showHeaderIcon: true,
    headerIcon: 'analytics',
    showFooter: false,
    footerText: 'Last updated',
    cardHeight: 'medium',
    layout: 'grid',
    columns: 4,
    cardsPerRow: {
      xs: 1,
      sm: 2,
      md: 2,
      lg: 3,
      xl: 4,
      xxl: 4
    },
    responsiveBreakpoints: {
      mobile: 1,
      tablet: 2,
      desktop: 4
    },
    theme: 'auto',
    animations: true,
    clickable: true,
    loading: false,
    error: '',
    emptyStateMessage: 'No metrics available',
    showDebugInfo: false,
    customColors: {}
  };

  // Store observables
  transactions$: Observable<Transaction[]>;
  categories$: Observable<Category[]>;
  accounts$: Observable<Account[]>;
  transactionsLoading$: Observable<boolean>;
  categoriesLoading$: Observable<boolean>;
  accountsLoading$: Observable<boolean>;

  // Computed metrics data
  metrics$: Observable<KeyMetric[]>;
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

    // Calculate metrics data
    this.metrics$ = this.calculateKeyMetrics();
  }

  ngOnInit(): void {
    // Component initialization if needed
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private calculateKeyMetrics(): Observable<KeyMetric[]> {
    return combineLatest([this.transactions$, this.categories$, this.accounts$]).pipe(
      map(([transactions, categories, accounts]) => {
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

        // Calculate current month metrics
        const currentIncome = currentMonthTransactions
          .filter(t => t.type === TransactionType.INCOME)
          .reduce((sum, t) => sum + t.amount, 0);

        const currentExpenses = currentMonthTransactions
          .filter(t => t.type === TransactionType.EXPENSE)
          .reduce((sum, t) => sum + t.amount, 0);

        const currentNetSavings = currentIncome - currentExpenses;

        // Calculate previous month metrics
        const previousIncome = previousMonthTransactions
          .filter(t => t.type === TransactionType.INCOME)
          .reduce((sum, t) => sum + t.amount, 0);

        const previousExpenses = previousMonthTransactions
          .filter(t => t.type === TransactionType.EXPENSE)
          .reduce((sum, t) => sum + t.amount, 0);

        const previousNetSavings = previousIncome - previousExpenses;

        // Calculate changes
        const incomeChange = currentIncome - previousIncome;
        const expenseChange = currentExpenses - previousExpenses;
        const savingsChange = currentNetSavings - previousNetSavings;

        // Calculate percentages
        const incomeChangePercentage = previousIncome > 0 ? (incomeChange / previousIncome) * 100 : 0;
        const expenseChangePercentage = previousExpenses > 0 ? (expenseChange / previousExpenses) * 100 : 0;
        const savingsChangePercentage = previousNetSavings !== 0 ? (savingsChange / Math.abs(previousNetSavings)) * 100 : 0;

        // Calculate total account balance
        const totalBalance = accounts.reduce((sum, account) => {
          if (account.type === AccountType.LOAN) {
            const loanDetails = account.loanDetails as any;
            return sum - (loanDetails?.remainingBalance || 0);
          }
          return sum + account.balance;
        }, 0);

        // Calculate total loan amount
        const totalLoanAmount = accounts.reduce((sum, account) => {
          if (account.type === AccountType.LOAN) {
            const loanDetails = account.loanDetails as any;
            return sum + (loanDetails?.remainingBalance || 0);
          }
          return sum;
        }, 0);

        // Calculate total credit card balance
        const totalCreditCardBalance = accounts.reduce((sum, account) => {
          if (account.type === AccountType.CREDIT) {
            return sum + Math.abs(account.balance);
          }
          return sum;
        }, 0);

        const metrics: KeyMetric[] = [
          {
            id: 'total-income',
            title: 'Total Income',
            value: currentIncome,
            period: 'This month',
            icon: 'trending_up',
            color: 'green',
            trend: currentIncome > 0 ? 'up' : 'neutral',
            changeValue: incomeChange,
            changePercentage: incomeChangePercentage,
            description: 'Total income for the current month'
          },
          {
            id: 'total-expenses',
            title: 'Total Expenses',
            value: currentExpenses,
            period: 'This month',
            icon: 'trending_down',
            color: 'red',
            trend: currentExpenses > 0 ? 'down' : 'neutral',
            changeValue: expenseChange,
            changePercentage: expenseChangePercentage,
            description: 'Total expenses for the current month'
          },
          {
            id: 'net-savings',
            title: 'Net Savings',
            value: Math.abs(currentNetSavings),
            period: 'This month',
            icon: 'account_balance_wallet',
            color: 'blue',
            trend: currentNetSavings >= 0 ? 'up' : 'down',
            changeValue: savingsChange,
            changePercentage: savingsChangePercentage,
            description: 'Net savings (income - expenses) for the current month'
          },
          {
            id: 'total-balance',
            title: 'Total Balance',
            value: Math.abs(totalBalance),
            period: 'All accounts',
            icon: 'account_balance',
            color: totalBalance >= 0 ? 'green' : 'red',
            trend: totalBalance >= 0 ? 'up' : 'down',
            description: 'Total balance across all accounts'
          },
          {
            id: 'total-loan-amount',
            title: 'Total Loan Amount',
            value: totalLoanAmount,
            period: 'All loans',
            icon: 'credit_score',
            color: totalLoanAmount > 0 ? 'red' : 'gray',
            trend: totalLoanAmount > 0 ? 'down' : 'neutral',
            description: 'Total outstanding loan amount across all loan accounts'
          },
          {
            id: 'credit-card-balance',
            title: 'Credit Card Balance',
            value: totalCreditCardBalance,
            period: 'All cards',
            icon: 'credit_card',
            color: totalCreditCardBalance > 0 ? 'red' : 'gray',
            trend: totalCreditCardBalance > 0 ? 'down' : 'neutral',
            description: 'Total outstanding balance across all credit cards'
          }
        ];

        // Add additional metrics if there are more columns available
        if (this.config.columns && this.config.columns > 4) {
          // Average daily spending
          const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
          const averageDailySpending = daysInMonth > 0 ? currentExpenses / daysInMonth : 0;

          metrics.push({
            id: 'avg-daily-spending',
            title: 'Avg Daily Spending',
            value: averageDailySpending,
            period: 'This month',
            icon: 'schedule',
            color: 'orange',
            trend: 'neutral',
            description: 'Average daily spending for the current month'
          });

          // Transaction count
          const transactionCount = currentMonthTransactions.length;
          const previousTransactionCount = previousMonthTransactions.length;
          const transactionChange = transactionCount - previousTransactionCount;
          const transactionChangePercentage = previousTransactionCount > 0 ?
            (transactionChange / previousTransactionCount) * 100 : 0;

          metrics.push({
            id: 'transaction-count',
            title: 'Transactions',
            value: transactionCount,
            period: 'This month',
            icon: 'receipt',
            color: 'purple',
            trend: transactionChange >= 0 ? 'up' : 'down',
            changeValue: transactionChange,
            changePercentage: transactionChangePercentage,
            description: 'Number of transactions this month'
          });
        }

        return metrics;
      })
    );
  }

  private convertToDate(date: Date | any): Date {
    if (date instanceof Date) return date;
    if (date?.seconds) return new Date(date.seconds * 1000);
    return new Date(date);
  }

  get effectiveConfig(): KeyMetricsConfig {
    return {
      title: this.config.title ?? 'Key Metrics Summary',
      subtitle: this.config.subtitle ?? 'Financial overview for this period',
      currency: this.config.currency ?? 'INR',
      showTrends: this.config.showTrends ?? true,
      showIcons: this.config.showIcons ?? true,
      showPeriod: this.config.showPeriod ?? true,
      showHeaderIcon: this.config.showHeaderIcon ?? true,
      headerIcon: this.config.headerIcon ?? 'analytics',
      showFooter: this.config.showFooter ?? false,
      footerText: this.config.footerText ?? 'Last updated',
      cardHeight: this.config.cardHeight ?? 'medium',
      layout: this.config.layout ?? 'grid',
      columns: this.config.columns ?? 4,
      cardsPerRow: this.config.cardsPerRow ?? {
        xs: 1,
        sm: 2,
        md: 2,
        lg: 3,
        xl: 4,
        xxl: 4
      },
      responsiveBreakpoints: this.config.responsiveBreakpoints ?? {
        mobile: 1,
        tablet: 2,
        desktop: 4
      },
      theme: this.config.theme ?? 'auto',
      animations: this.config.animations ?? true,
      clickable: this.config.clickable ?? true,
      loading: this.config.loading ?? false,
      error: this.config.error ?? '',
      emptyStateMessage: this.config.emptyStateMessage ?? 'No metrics available',
      showDebugInfo: this.config.showDebugInfo ?? false,
      customColors: this.config.customColors ?? {},
      onMetricClick: this.config.onMetricClick,
      onRefresh: this.config.onRefresh
    };
  }

  get gridColumns(): string {
    // Use cardsPerRow if available, otherwise fall back to responsiveBreakpoints
    if (this.effectiveConfig.cardsPerRow) {
      const cardsPerRow = this.effectiveConfig.cardsPerRow;
      let classes = `grid-cols-${cardsPerRow.xs || 1}`;

      if (cardsPerRow.sm && cardsPerRow.sm !== cardsPerRow.xs) {
        classes += ` sm:grid-cols-${cardsPerRow.sm}`;
      }

      if (cardsPerRow.md && cardsPerRow.md !== cardsPerRow.sm) {
        classes += ` md:grid-cols-${cardsPerRow.md}`;
      }

      if (cardsPerRow.lg && cardsPerRow.lg !== cardsPerRow.md) {
        classes += ` lg:grid-cols-${cardsPerRow.lg}`;
      }

      if (cardsPerRow.xl && cardsPerRow.xl !== cardsPerRow.lg) {
        classes += ` xl:grid-cols-${cardsPerRow.xl}`;
      }

      if (cardsPerRow.xxl && cardsPerRow.xxl !== cardsPerRow.xl) {
        classes += ` 2xl:grid-cols-${cardsPerRow.xxl}`;
      }

      return classes;
    }

    // Fallback to responsiveBreakpoints for backward compatibility
    const breakpoints = this.effectiveConfig.responsiveBreakpoints;
    const mobile = breakpoints?.mobile ?? 1;
    const tablet = breakpoints?.tablet ?? 2;
    const desktop = breakpoints?.desktop ?? 4;

    // Build responsive grid classes
    let classes = `grid-cols-${mobile}`;

    if (tablet > mobile) {
      classes += ` sm:grid-cols-${tablet}`;
    }

    if (desktop > tablet) {
      classes += ` lg:grid-cols-${desktop}`;
    }

    if (desktop > 4) {
      classes += ` xl:grid-cols-${Math.min(desktop, 6)}`;
    }

    return classes;
  }

  get cardHeightClass(): string {
    switch (this.effectiveConfig.cardHeight) {
      case 'small': return 'min-h-20';
      case 'large': return 'min-h-32';
      case 'auto': return 'min-h-0';
      default: return 'min-h-24';
    }
  }

  get layoutClass(): string {
    switch (this.effectiveConfig.layout) {
      case 'list': return 'flex flex-col space-y-3';
      case 'compact': return 'grid gap-2';
      default: return 'grid';
    }
  }

  formatCurrency(value: number): string {
    return this.currencyService.formatAmount(value);
  }

  getMetricClasses(metric: KeyMetric): { [key: string]: boolean } {
    return {
      'metric-green': metric.color === 'green',
      'metric-red': metric.color === 'red',
      'metric-blue': metric.color === 'blue',
      'metric-purple': metric.color === 'purple',
      'metric-orange': metric.color === 'orange',
      'metric-yellow': metric.color === 'yellow',
      'metric-gray': metric.color === 'gray',
      'clickable': this.effectiveConfig.clickable ?? true,
      'no-animations': !(this.effectiveConfig.animations ?? true),
      'loading': this.effectiveConfig.loading ?? false
    };
  }

  getMetricColorClass(color: string, type: 'text' | 'value' | 'bg'): string {
    // Check for custom colors first
    const customColor = this.effectiveConfig.customColors?.[color as keyof typeof this.effectiveConfig.customColors];
    if (customColor && type === 'text') {
      return `color: ${customColor};`;
    }

    switch (color) {
      case 'green':
        return type === 'text' ? 'text-green-600 dark:text-green-400' :
          type === 'value' ? 'text-green-700 dark:text-green-300' :
            'bg-green-50 dark:bg-green-900/20';
      case 'red':
        return type === 'text' ? 'text-red-600 dark:text-red-400' :
          type === 'value' ? 'text-red-700 dark:text-red-300' :
            'bg-red-50 dark:bg-red-900/20';
      case 'blue':
        return type === 'text' ? 'text-blue-600 dark:text-blue-400' :
          type === 'value' ? 'text-blue-700 dark:text-blue-300' :
            'bg-blue-50 dark:bg-blue-900/20';
      case 'purple':
        return type === 'text' ? 'text-purple-600 dark:text-purple-400' :
          type === 'value' ? 'text-purple-700 dark:text-purple-300' :
            'bg-purple-50 dark:bg-purple-900/20';
      case 'orange':
        return type === 'text' ? 'text-orange-600 dark:text-orange-400' :
          type === 'value' ? 'text-orange-700 dark:text-orange-300' :
            'bg-orange-50 dark:bg-orange-900/20';
      case 'yellow':
        return type === 'text' ? 'text-yellow-600 dark:text-yellow-400' :
          type === 'value' ? 'text-yellow-700 dark:text-yellow-300' :
            'bg-yellow-50 dark:bg-yellow-900/20';
      case 'gray':
        return type === 'text' ? 'text-gray-600 dark:text-gray-400' :
          type === 'value' ? 'text-gray-700 dark:text-gray-300' :
            'bg-gray-50 dark:bg-gray-900/20';
      default:
        return '';
    }
  }

  getTrendIcon(metric: KeyMetric): string {
    if (!metric.trend) return '';

    switch (metric.trend) {
      case 'up':
        return 'trending_up';
      case 'down':
        return 'trending_down';
      default:
        return 'trending_flat';
    }
  }

  getTrendColor(metric: KeyMetric): string {
    if (!metric.trend) return '';

    switch (metric.trend) {
      case 'up':
        return 'text-green-600 dark:text-green-400';
      case 'down':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  }

  onMetricClick(metric: KeyMetric): void {
    if (this.effectiveConfig.clickable && this.effectiveConfig.onMetricClick) {
      this.effectiveConfig.onMetricClick(metric);
    }
  }

  getChangeDisplay(metric: KeyMetric): string {
    if (metric.changeValue === undefined && metric.changePercentage === undefined) {
      return '';
    }

    let display = '';

    if (metric.changeValue !== undefined) {
      const sign = metric.changeValue >= 0 ? '+' : '';
      display += `${sign}${this.formatCurrency(metric.changeValue)}`;
    }

    if (metric.changePercentage !== undefined) {
      const sign = metric.changePercentage >= 0 ? '+' : '';
      const percentage = `${sign}${metric.changePercentage.toFixed(1)}%`;

      if (display) {
        display += ` (${percentage})`;
      } else {
        display = percentage;
      }
    }

    return display;
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
    return this.metrics$.pipe(
      map(metrics => !metrics || metrics.length === 0)
    );
  }

  get hasError(): boolean {
    return !!(this.effectiveConfig.error && this.effectiveConfig.error.trim());
  }

  getCurrentCardsPerRow(): number {
    const cardsPerRow = this.effectiveConfig.cardsPerRow;
    if (!cardsPerRow) return this.effectiveConfig.columns || 4;

    // This is a simplified version - in a real app you might want to use a service
    // to detect the actual screen size. For now, we'll return the default.
    return cardsPerRow.xl || cardsPerRow.lg || cardsPerRow.md || cardsPerRow.sm || cardsPerRow.xs || 1;
  }

  getCardsPerRowInfo(): string {
    const cardsPerRow = this.effectiveConfig.cardsPerRow;
    if (!cardsPerRow) return `${this.effectiveConfig.columns || 4} columns`;

    const parts = [];
    if (cardsPerRow.xs) parts.push(`XS: ${cardsPerRow.xs}`);
    if (cardsPerRow.sm) parts.push(`SM: ${cardsPerRow.sm}`);
    if (cardsPerRow.md) parts.push(`MD: ${cardsPerRow.md}`);
    if (cardsPerRow.lg) parts.push(`LG: ${cardsPerRow.lg}`);
    if (cardsPerRow.xl) parts.push(`XL: ${cardsPerRow.xl}`);
    if (cardsPerRow.xxl) parts.push(`2XL: ${cardsPerRow.xxl}`);

    return parts.join(', ');
  }
} 