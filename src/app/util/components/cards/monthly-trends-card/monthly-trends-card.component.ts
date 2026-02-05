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
import { Transaction } from '../../../../util/models/transaction.model';
import { Category } from '../../../../util/models/category.model';
import { TransactionType } from '../../../../util/config/enums';
import { CurrencyService } from '../../../service/currency.service';

export interface MonthlyTrend {
  month: string;
  income: number;
  expenses: number;
  savings: number;
  change?: number;
  changePercentage?: number;
}

export interface MonthlyTrendsConfig {
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
  showIncome?: boolean;
  showExpenses?: boolean;
  showSavings?: boolean;
  showChange?: boolean;
  layout?: 'grid' | 'list' | 'compact';
  onMonthClick?: (month: MonthlyTrend) => void;
  onRefresh?: () => void;
}

@Component({
  selector: 'app-monthly-trends-card',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  templateUrl: './monthly-trends-card.component.html',
  styleUrl: './monthly-trends-card.component.scss'
})
export class MonthlyTrendsCardComponent implements OnInit, OnDestroy {
  @Input() config: MonthlyTrendsConfig = {
    title: 'Monthly Trends',
    subtitle: 'Compare monthly performance',
    currency: 'INR',
    showHeaderIcon: true,
    headerIcon: 'trending_up',
    headerIconColor: 'green',
    showFooter: false,
    footerText: 'Last updated',
    cardHeight: 'medium',
    theme: 'auto',
    animations: true,
    clickable: true,
    loading: false,
    error: '',
    emptyStateMessage: 'Add transactions to see monthly trends',
    showDebugInfo: false,
    maxItems: 6,
    period: 'monthly',
    transactionType: 'all',
    showIncome: true,
    showExpenses: true,
    showSavings: true,
    showChange: true,
    layout: 'grid'
  };

  // Store observables
  transactions$: Observable<Transaction[]>;
  categories$: Observable<Category[]>;
  transactionsLoading$: Observable<boolean>;
  categoriesLoading$: Observable<boolean>;

  // Computed data
  monthlyTrends$: Observable<MonthlyTrend[]>;
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

    // Calculate monthly trends
    this.monthlyTrends$ = this.calculateMonthlyTrends();
  }

  ngOnInit(): void {
    // Component initialization if needed
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private calculateMonthlyTrends(): Observable<MonthlyTrend[]> {
    return this.transactions$.pipe(
      map(transactions => {
        const currentDate = new Date();
        const months = new Map<string, { income: number; expenses: number; savings: number }>();

        // Group transactions by month
        transactions.forEach(t => {
          const txDate = this.convertToDate(t.date);
          const monthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
          const monthName = txDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

          if (!months.has(monthKey)) {
            months.set(monthKey, { income: 0, expenses: 0, savings: 0 });
          }

          const monthData = months.get(monthKey)!;

          if (t.type === TransactionType.INCOME) {
            monthData.income += t.amount;
          } else {
            monthData.expenses += t.amount;
          }

          monthData.savings = monthData.income - monthData.expenses;
        });

        // Convert to array and sort by date
        const trends: MonthlyTrend[] = Array.from(months.entries())
          .map(([key, data]) => {
            const [year, month] = key.split('-');
            const date = new Date(parseInt(year), parseInt(month) - 1);
            return {
              month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
              income: data.income,
              expenses: data.expenses,
              savings: data.savings
            };
          })
          .sort((a, b) => {
            const dateA = new Date(a.month);
            const dateB = new Date(b.month);
            return dateB.getTime() - dateA.getTime();
          })
          .slice(0, this.effectiveConfig.maxItems || 6);

        // Calculate change percentages
        if (trends.length > 1) {
          for (let i = 0; i < trends.length - 1; i++) {
            const current = trends[i];
            const previous = trends[i + 1];
            const change = current.savings - previous.savings;
            const changePercentage = previous.savings !== 0 ? (change / Math.abs(previous.savings)) * 100 : 0;

            current.change = change;
            current.changePercentage = changePercentage;
          }
        }

        return trends;
      })
    );
  }

  private convertToDate(date: Date | any): Date {
    if (date instanceof Date) return date;
    if (date?.seconds) return new Date(date.seconds * 1000);
    return new Date(date);
  }

  get effectiveConfig(): MonthlyTrendsConfig {
    return {
      title: this.config.title ?? 'Monthly Trends',
      subtitle: this.config.subtitle ?? 'Compare monthly performance',
      currency: this.config.currency ?? 'INR',
      showHeaderIcon: this.config.showHeaderIcon ?? true,
      headerIcon: this.config.headerIcon ?? 'trending_up',
      headerIconColor: this.config.headerIconColor ?? 'green',
      showFooter: this.config.showFooter ?? false,
      footerText: this.config.footerText ?? 'Last updated',
      cardHeight: this.config.cardHeight ?? 'medium',
      theme: this.config.theme ?? 'auto',
      animations: this.config.animations ?? true,
      clickable: this.config.clickable ?? true,
      loading: this.config.loading ?? false,
      error: this.config.error ?? '',
      emptyStateMessage: this.config.emptyStateMessage ?? 'Add transactions to see monthly trends',
      showDebugInfo: this.config.showDebugInfo ?? false,
      maxItems: this.config.maxItems ?? 6,
      period: this.config.period ?? 'monthly',
      transactionType: this.config.transactionType ?? 'all',
      showIncome: this.config.showIncome ?? true,
      showExpenses: this.config.showExpenses ?? true,
      showSavings: this.config.showSavings ?? true,
      showChange: this.config.showChange ?? true,
      layout: this.config.layout ?? 'grid',
      onMonthClick: this.config.onMonthClick,
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
    const color = this.effectiveConfig.headerIconColor || 'green';
    return `bg-${color}-500/10 text-${color}-600 dark:text-${color}-400`;
  }

  get layoutClass(): string {
    switch (this.effectiveConfig.layout) {
      case 'list': return 'grid-cols-1';
      case 'compact': return 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6';
      default: return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6';
    }
  }

  formatCurrency(value: number): string {
    return this.currencyService.formatAmount(value);
  }

  getChangeColor(change: number): string {
    return change >= 0
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400';
  }

  getChangeIcon(change: number): string {
    return change >= 0 ? 'trending_up' : 'trending_down';
  }

  onMonthClick(month: MonthlyTrend): void {
    if (this.effectiveConfig.clickable && this.effectiveConfig.onMonthClick) {
      this.effectiveConfig.onMonthClick(month);
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
    return this.monthlyTrends$.pipe(
      map(trends => trends.length === 0)
    );
  }

  get hasError(): boolean {
    return !!(this.effectiveConfig.error && this.effectiveConfig.error.trim());
  }
} 