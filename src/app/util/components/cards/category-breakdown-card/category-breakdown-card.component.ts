import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, Inject, NgZone, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Store } from '@ngrx/store';
import { Observable, Subject, combineLatest } from 'rxjs';
import { takeUntil, map, startWith, filter } from 'rxjs/operators';
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import * as am5radar from "@amcharts/amcharts5/radar";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
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
  styleUrl: './category-breakdown-card.component.scss'
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

  // AmCharts
  private root: am5.Root | undefined;
  private chart: am5xy.XYChart | am5radar.RadarChart | undefined;
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
    this.chartContainerId = `category-breakdown-chart-${this.currentChartType}`;

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
      this.initializeChart();
      this.subscribeToData();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    this.browserOnly(() => {
      if (this.root) {
        this.root.dispose();
      }
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
    try {
      this.root = am5.Root.new(this.chartContainerId);
      this.root.setThemes([am5themes_Animated.new(this.root)]);

      // Create chart based on current type
      if (this.currentChartType === 'radial') {
        this.createRadialChart();
      } else {
        this.createBarChart();
      }
    } catch (error) {
      console.error('Error initializing chart:', error);
    }
  }

  private createBarChart(): void {
    if (!this.root) return;

    console.log('Creating bar chart...');

    // Dispose existing chart if any
    if (this.chart) {
      this.chart.dispose();
      this.chart = undefined;
    }

    // Create XY chart for bar chart
    this.chart = this.root.container.children.push(
      am5xy.XYChart.new(this.root, {
        layout: this.root.verticalLayout,
        paddingTop: 20,
        paddingRight: 20,
        paddingBottom: 20,
        paddingLeft: 20
      })
    );

    // Create X axis (categories)
    const xAxis = this.chart.xAxes.push(
      am5xy.CategoryAxis.new(this.root, {
        categoryField: "category",
        renderer: am5xy.AxisRendererX.new(this.root, {
          minGridDistance: 30,
          cellStartLocation: 0.1,
          cellEndLocation: 0.9
        })
      })
    );

    // Create Y axis (values)
    const yAxis = this.chart.yAxes.push(
      am5xy.ValueAxis.new(this.root, {
        renderer: am5xy.AxisRendererY.new(this.root, {})
      })
    );

    // Create series
    const series = this.chart.series.push(
      am5xy.ColumnSeries.new(this.root, {
        name: 'Amount',
        xAxis,
        yAxis,
        valueYField: 'amount',
        categoryXField: 'category',
        tooltip: am5.Tooltip.new(this.root, {
          labelText: '{categoryX}: {valueY}'
        })
      })
    );

    // Configure series appearance
    series.columns.template.setAll({
      cornerRadiusTL: 5,
      cornerRadiusTR: 5,
      strokeOpacity: 0,
      fillOpacity: 0.8
    });

    // Add color set
    const colorSet = am5.ColorSet.new(this.root, {});
    colorSet.set("colors", this.premiumColors.map(color => am5.color(color)));
    series.columns.template.set("fill", colorSet.next());

    // Add hover effects
    series.columns.template.states.create("hover", {
      fillOpacity: 1,
      scale: 1.05
    });

    // Store references for data updates
    this.xAxis = xAxis;
    this.yAxis = yAxis;
    this.series = series;

    console.log('Bar chart created successfully');
    series.appear(1000);
    this.chart.appear(1000, 100);
  }

  private createRadialChart(): void {
    if (!this.root) return;

    console.log('Creating radial bar chart...');

    // Dispose existing chart if any
    if (this.chart) {
      this.chart.dispose();
      this.chart = undefined;
    }

    // Create radar chart
    this.chart = this.root.container.children.push(
      am5radar.RadarChart.new(this.root, {
        panX: false,
        panY: false,
        wheelX: "panX",
        wheelY: "zoomX",
        innerRadius: am5.percent(40)
      })
    );

    // Add cursor
    const radarChart = this.chart as am5radar.RadarChart;
    const cursor = radarChart.set("cursor", am5radar.RadarCursor.new(this.root, {
      behavior: "zoomX"
    }));
    cursor.lineY.set("visible", false);

    // Create axes and their renderers
    const xRenderer = am5radar.AxisRendererCircular.new(this.root, {
      strokeOpacity: 0.1,
      minGridDistance: 50
    });

    xRenderer.labels.template.setAll({
      radius: 10,
      maxPosition: 0.98
    });

    const xAxis = radarChart.xAxes.push(
      am5xy.ValueAxis.new(this.root, {
        renderer: xRenderer,
        extraMax: 0.1,
        tooltip: am5.Tooltip.new(this.root, {})
      })
    );

    const yAxis = radarChart.yAxes.push(
      am5xy.CategoryAxis.new(this.root, {
        categoryField: "category",
        renderer: am5radar.AxisRendererRadial.new(this.root, { minGridDistance: 20 })
      })
    );

    // Create series
    const series = radarChart.series.push(
      am5radar.RadarColumnSeries.new(this.root, {
        name: "Amount",
        xAxis: xAxis,
        yAxis: yAxis,
        valueXField: "amount",
        categoryYField: "category"
      })
    );

    // Configure series appearance
    series.set("stroke", this.root.interfaceColors.get("background"));
    series.columns.template.setAll({
      width: am5.p100,
      strokeOpacity: 0.1,
      tooltipText: "[bold]{category}[/]\nAmount: {valueX}\nPercentage: {valuePercentTotal.formatNumber('#.0')}%"
    });

    // Add color set
    const colorSet = am5.ColorSet.new(this.root, {});
    colorSet.set("colors", this.premiumColors.map(color => am5.color(color)));
    series.columns.template.set("fill", colorSet.next());

    // Add hover effects
    series.columns.template.states.create("hover", {
      fillOpacity: 1,
      scale: 1.05
    });

    // Store references for data updates
    this.radarXAxis = xAxis;
    this.radarYAxis = yAxis;
    this.radarSeries = series;

    console.log('Radial bar chart created successfully');
    series.appear(1000);
    this.chart.appear(1000, 100);
  }

  // Store chart components for data updates
  private xAxis: am5xy.CategoryAxis<am5xy.AxisRenderer> | undefined;
  private yAxis: am5xy.ValueAxis<am5xy.AxisRenderer> | undefined;
  private series: am5xy.ColumnSeries | undefined;
  private radarXAxis: am5xy.ValueAxis<any> | undefined;
  private radarYAxis: am5xy.CategoryAxis<any> | undefined;
  private radarSeries: am5radar.RadarColumnSeries | undefined;
  private legend: am5.Legend | undefined;

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
    if (!this.root) {
      console.error('Root not available for data update');
      return;
    }

    const data = breakdown.map(item => ({
      category: item.category,
      amount: item.amount,
      count: item.count,
      percentage: item.percentage,
      color: item.color
    }));

    console.log('Updating chart data:', data);

    if (this.currentChartType === 'radial') {
      if (this.radarSeries && this.radarYAxis) {
        console.log('Setting radial chart data');

        // Set data for both axis and series
        this.radarYAxis.data.setAll(data);
        this.radarSeries.data.setAll(data);

        this.radarSeries.appear(1000, 100);
      } else {
        console.error('Radar series not available');
      }
    } else {
      if (this.series && this.xAxis) {
        console.log('Setting bar chart data');
        this.xAxis.data.setAll(data);
        this.series.data.setAll(data);
      } else {
        console.error('Bar series or axis not available');
      }
    }
  }

  private clearChartData(): void {
    if (!this.root) return;

    if (this.currentChartType === 'radial') {
      if (this.radarSeries) {
        this.radarSeries.data.clear();
      }
      if (this.radarYAxis) {
        this.radarYAxis.data.clear();
      }
    } else {
      if (this.series && this.xAxis) {
        this.xAxis.data.clear();
        this.series.data.clear();
      }
    }
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
      if (this.chart) {
        observer.next(this.chart);
        observer.complete();
      } else {
        observer.next(null);
        observer.complete();
      }
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