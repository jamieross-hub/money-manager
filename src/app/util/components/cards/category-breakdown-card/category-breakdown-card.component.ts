import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, Inject, NgZone, PLATFORM_ID, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Store } from '@ngrx/store';
import { Observable, Subject, combineLatest } from 'rxjs';
import { takeUntil, map, startWith, filter } from 'rxjs/operators';

import { AppState } from '../../../../store/app.state';
import * as TransactionsSelectors from '../../../../store/transactions/transactions.selectors';
import * as CategoriesSelectors from '../../../../store/categories/categories.selectors';
import { Transaction } from '../../../../util/models/transaction.model';
import { Category } from '../../../../util/models/category.model';
import { TransactionType } from '../../../../util/config/enums';
import { CurrencyService } from '../../../service/currency.service';

export interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
  icon: string;
  color: string;
  count: number;
  averageAmount: number;
}

export interface CategoryBreakdownConfig {
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
  showProgressBar?: boolean;
  showPercentage?: boolean;
  showCount?: boolean;
  showAverage?: boolean;
  layout?: 'list' | 'grid' | 'compact';
  chartType?: 'bar' | 'radial';
  onCategoryClick?: (category: CategoryBreakdown) => void;
  onRefresh?: () => void;
}

@Component({
  selector: 'app-category-breakdown-card',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: './category-breakdown-card.component.html',
  styleUrl: './category-breakdown-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CategoryBreakdownCardComponent implements OnInit, OnDestroy {
  @Input() config: CategoryBreakdownConfig = {
    title: 'Category Breakdown',
    subtitle: 'Spending by category',
    currency: 'INR',
    showHeaderIcon: true,
    headerIcon: 'category',
    headerIconColor: 'blue',
    showFooter: false,
    footerText: 'Last updated',
    cardHeight: 'large',
    theme: 'auto',
    animations: true,
    clickable: true,
    loading: false,
    error: '',
    emptyStateMessage: 'Add transactions to see category breakdown',
    showDebugInfo: false,
    maxItems: 8,
    period: 'monthly',
    transactionType: 'expense',
    showProgressBar: true,
    showPercentage: true,
    showCount: false,
    showAverage: false,
    layout: 'list',
    chartType: 'radial'
  };

  // Store observables
  transactions$: Observable<Transaction[]>;
  categories$: Observable<Category[]>;
  transactionsLoading$: Observable<boolean>;
  categoriesLoading$: Observable<boolean>;

  // Computed data
  categoryBreakdown$: Observable<CategoryBreakdown[]>;
  isLoading$: Observable<boolean>;

  // AmCharts removed
  // private root: am5.Root | undefined;
  // private chart: am5xy.XYChart | am5radar.RadarChart | undefined;
  currentChartType: 'bar' | 'radial' = 'radial';


  // Generate unique chart container ID
  chartContainerId: string;

  // Premium color palette
  private premiumColors: string[] = [
    '#6366F1', // Indigo
    '#8B5CF6', // Violet
    '#EC4899', // Pink
    '#EF4444', // Red
    '#F97316', // Orange
    '#EAB308', // Yellow
    '#22C55E', // Green
    '#06B6D4', // Cyan
    '#3B82F6', // Blue
    '#84CC16', // Lime
    '#F59E0B', // Amber
    '#10B981', // Emerald
    '#8B5A2B', // Brown
    '#6B7280', // Gray
    '#1F2937', // Dark Gray
    '#DC2626'  // Dark Red
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private store: Store<AppState>,
    @Inject(PLATFORM_ID) private platformId: Object,
    private zone: NgZone,
    private currencyService: CurrencyService
  ) {
    // Generate unique chart container ID with chart type
    this.chartContainerId = `category-breakdown-chart-removed`;


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

    // Calculate category breakdown
    this.categoryBreakdown$ = this.calculateCategoryBreakdown();
  }

  ngOnInit(): void {
    // Chart type is controlled by config only
    this.currentChartType = this.effectiveConfig.chartType || 'radial';

    // Update chart container ID if chart type changes
    this.updateChartContainerId();
  }

  private updateChartContainerId(): void {
    const newId = `category-breakdown-chart-${this.currentChartType}`;
    this.chartContainerId = newId;
  }

  ngAfterViewInit(): void {
    this.browserOnly(() => {
      // this.initializeChart();
      this.subscribeToData();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    this.browserOnly(() => {
      // if (this.root) {
      //   this.root.dispose();
      // }
    });
  }

  // Run the function only in the browser
  private browserOnly(f: () => void) {
    if (isPlatformBrowser(this.platformId)) {
      this.zone.runOutsideAngular(() => {
        f();
      });
    }
  }

  private initializeChart(): void {
    // Chart initialization removed
  }

  private createBarChart(): void {
    // Bar chart creation removed
  }

  private createRadialChart(): void {
    // Radial chart creation removed
  }

  // Store chart components for data updates
  // private xAxis: am5xy.CategoryAxis<am5xy.AxisRenderer> | undefined;
  // private yAxis: am5xy.ValueAxis<am5xy.AxisRenderer> | undefined;
  // private series: am5xy.ColumnSeries | undefined;
  // private radarXAxis: am5xy.ValueAxis<any> | undefined;
  // private radarYAxis: am5xy.CategoryAxis<any> | undefined;
  // private radarSeries: am5radar.RadarColumnSeries | undefined;
  // private legend: am5.Legend | undefined;


  private subscribeToData(): void {
    this.categoryBreakdown$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(breakdown => {
      console.log('Category breakdown data received:', breakdown);
      this.browserOnly(() => {
        if (breakdown && breakdown.length > 0) {
          console.log('Setting real chart data:', breakdown);
          this.updateChartData(breakdown);
        } else {
          console.log('No real data available, clearing chart');
          this.clearChartData();
        }
      });
    });
  }



  private updateChartData(breakdown: CategoryBreakdown[]): void {
    // Chart updates removed
  }

  private clearChartData(): void {
    // Chart clearing removed
  }

  private calculateCategoryBreakdown(): Observable<CategoryBreakdown[]> {
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

        // Calculate category totals
        const categoryMap = new Map<string, { amount: number; count: number; category: Category }>();

        filteredTransactions.forEach(t => {
          const category = categories.find(c => c.id === t.categoryId);
          if (category) {
            const existing = categoryMap.get(t.categoryId) || { amount: 0, count: 0, category };
            existing.amount += t.amount;
            existing.count += 1;
            categoryMap.set(t.categoryId, existing);
          }
        });

        // Calculate total for percentage
        const totalAmount = Array.from(categoryMap.values()).reduce((sum, item) => sum + item.amount, 0);

        // Convert to category breakdown
        const breakdown: CategoryBreakdown[] = Array.from(categoryMap.values())
          .filter(item => item.amount > 0)
          .map(item => ({
            category: item.category.name,
            amount: item.amount,
            percentage: totalAmount > 0 ? (item.amount / totalAmount) * 100 : 0,
            icon: item.category.icon || 'category',
            color: item.category.color || '#6B7280',
            count: item.count,
            averageAmount: item.count > 0 ? item.amount / item.count : 0
          }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, this.effectiveConfig.maxItems || 8);

        return breakdown;
      })
    );
  }

  private convertToDate(date: Date | any): Date {
    if (date instanceof Date) return date;
    if (date?.seconds) return new Date(date.seconds * 1000);
    return new Date(date);
  }

  get effectiveConfig(): CategoryBreakdownConfig {
    return {
      title: this.config.title ?? 'Category Breakdown',
      subtitle: this.config.subtitle ?? 'Spending by category',
      currency: this.config.currency ?? 'INR',
      showHeaderIcon: this.config.showHeaderIcon ?? true,
      headerIcon: this.config.headerIcon ?? 'category',
      headerIconColor: this.config.headerIconColor ?? 'blue',
      showFooter: this.config.showFooter ?? false,
      footerText: this.config.footerText ?? 'Last updated',
      cardHeight: this.config.cardHeight ?? 'medium',
      theme: this.config.theme ?? 'auto',
      animations: this.config.animations ?? true,
      clickable: this.config.clickable ?? true,
      loading: this.config.loading ?? false,
      error: this.config.error ?? '',
      emptyStateMessage: this.config.emptyStateMessage ?? 'Add transactions to see category breakdown',
      showDebugInfo: this.config.showDebugInfo ?? false,
      maxItems: this.config.maxItems ?? 8,
      period: this.config.period ?? 'monthly',
      transactionType: this.config.transactionType ?? 'expense',
      showProgressBar: this.config.showProgressBar ?? true,
      showPercentage: this.config.showPercentage ?? true,
      showCount: this.config.showCount ?? false,
      showAverage: this.config.showAverage ?? false,
      layout: this.config.layout ?? 'list',
      chartType: this.config.chartType ?? 'radial',
      onCategoryClick: this.config.onCategoryClick,
      onRefresh: this.config.onRefresh
    };
  }

  get cardHeightClass(): string {
    switch (this.effectiveConfig.cardHeight) {
      case 'small': return 'min-h-20';
      case 'large': return 'min-h-40'; // Full view for radial charts
      case 'auto': return 'min-h-0';
      default: return 'min-h-32';
    }
  }

  get headerIconColorClass(): string {
    const color = this.effectiveConfig.headerIconColor || 'blue';
    return `bg-${color}-500/10 text-${color}-600 dark:text-${color}-400`;
  }

  formatCurrency(value: number): string {
    return this.currencyService.formatAmount(value);
  }

  getProgressBarColor(percentage: number): string {
    if (percentage > 50) return 'bg-red-500';
    if (percentage > 25) return 'bg-yellow-500';
    return 'bg-blue-500';
  }

  onCategoryClick(category: CategoryBreakdown): void {
    if (this.effectiveConfig.clickable && this.effectiveConfig.onCategoryClick) {
      this.effectiveConfig.onCategoryClick(category);
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
    return this.categoryBreakdown$.pipe(
      map(breakdown => breakdown.length === 0)
    );
  }

  get hasError(): boolean {
    return !!(this.effectiveConfig.error && this.effectiveConfig.error.trim());
  }

  get chartOptions(): Observable<any> {
    return new Observable(observer => {
      observer.next(null);
      observer.complete();
    });
  }





  // Method to refresh chart data
  private refreshChartData(): void {
    this.categoryBreakdown$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(breakdown => {
      this.browserOnly(() => {
        if (breakdown && breakdown.length > 0) {
          console.log('Refreshing chart data:', breakdown);
          this.updateChartData(breakdown);
        } else {
          console.log('No data to refresh');
          this.clearChartData();
        }
      });
    });
  }
} 