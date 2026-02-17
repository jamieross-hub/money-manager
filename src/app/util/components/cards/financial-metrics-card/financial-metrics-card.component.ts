import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, Inject, NgZone, PLATFORM_ID , ChangeDetectionStrategy} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Store } from '@ngrx/store';
import { Observable, Subject, combineLatest } from 'rxjs';
import { takeUntil, map } from 'rxjs/operators';
import * as am5 from "@amcharts/amcharts5";
import * as am5percent from "@amcharts/amcharts5/percent";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { AppState } from '../../../../store/app.state';
import * as TransactionsSelectors from '../../../../store/transactions/transactions.selectors';
import { Transaction } from '../../../../util/models/transaction.model';
import { TransactionType } from '../../../../util/config/enums';
import { CurrencyService } from '../../../service/currency.service';

export interface FinancialMetricsConfig {
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
  loading?: boolean;
  error?: string;
  emptyStateMessage?: string;
  pieChartHeight?: number | 'auto' | 'inherit';
  customColors?: {
    income?: string;
    expenses?: string;
    savings?: string;
  };
  onRefresh?: () => void;
}

@Component({
  selector: 'app-financial-metrics-card',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  templateUrl: './financial-metrics-card.component.html',
  styleUrl: './financial-metrics-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FinancialMetricsCardComponent implements OnInit, OnDestroy {
  @Input() config: FinancialMetricsConfig = {
    title: 'Financial Overview',
    subtitle: '',
    currency: 'INR',
    showHeaderIcon: true,
    headerIcon: 'pie_chart',
    showFooter: false,
    footerText: 'Last updated',
    cardHeight: 'medium',
    theme: 'auto',
    animations: true,
    loading: false,
    error: '',
    emptyStateMessage: 'No financial data available',
    pieChartHeight: 'inherit',
    customColors: {}
  };

  // Store observables
  transactions$: Observable<Transaction[]>;
  transactionsLoading$: Observable<boolean>;

  // Computed metrics data
  metrics$: Observable<{ expenses: number; savings: number }>;
  isLoading$: Observable<boolean>;

  // AmCharts
  private root: am5.Root | undefined;
  private chart: am5percent.PieChart | undefined;
  chartContainerId: string = 'financial-metrics-pie-chart';

  private destroy$ = new Subject<void>();

  constructor(
    private store: Store<AppState>,
    @Inject(PLATFORM_ID) private platformId: Object,
    private zone: NgZone,
    private currencyService: CurrencyService
  ) {
    // Initialize store selectors
    this.transactions$ = this.store.select(TransactionsSelectors.selectAllTransactions);
    this.transactionsLoading$ = this.store.select(TransactionsSelectors.selectTransactionsLoading);

    // Set loading state
    this.isLoading$ = this.transactionsLoading$;

    // Calculate metrics data
    this.metrics$ = this.calculateFinancialMetrics();
  }

  ngOnInit(): void {
    // Component initialization if needed
  }

  ngAfterViewInit(): void {
    this.browserOnly(() => {
      this.initializePieChart();
      this.subscribeToPieChartData();
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

  private calculateFinancialMetrics(): Observable<{ expenses: number; savings: number }> {
    return this.transactions$.pipe(
      map((transactions) => {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        // Get current month transactions
        const currentMonthTransactions = transactions.filter(t => {
          const txDate = this.convertToDate(t.date);
          return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
        });

        // Calculate current month metrics
        const income = currentMonthTransactions
          .filter(t => t.type === TransactionType.INCOME)
          .reduce((sum, t) => sum + t.amount, 0);

        const expenses = currentMonthTransactions
          .filter(t => t.type === TransactionType.EXPENSE)
          .reduce((sum, t) => sum + t.amount, 0);

        const savings = income - expenses;

        return { expenses, savings };
      })
    );
  }

  private convertToDate(date: Date | any): Date {
    if (date instanceof Date) return date;
    if (date?.seconds) return new Date(date.seconds * 1000);
    return new Date(date);
  }

  private initializePieChart(): void {
    try {
      this.root = am5.Root.new(this.chartContainerId);
      this.root.setThemes([am5themes_Animated.new(this.root)]);

      // Create chart
      this.chart = this.root.container.children.push(
        am5percent.PieChart.new(this.root, {
          layout: this.root.verticalLayout
        })
      );

      // Create outer series (Income + Expenses)
      const series0 = this.chart.series.push(
        am5percent.PieSeries.new(this.root, {
          valueField: "value",
          categoryField: "category",
          alignLabels: false,
          radius: am5.percent(80),
          innerRadius: am5.percent(60)
        })
      );

      series0.states.create("hidden", {
        startAngle: 180,
        endAngle: 180
      });

      series0.slices.template.setAll({
        fillOpacity: 0.5,
        strokeOpacity: 0,
        templateField: "settings"
      });

      series0.slices.template.states.create("hover", { scale: 1 });
      series0.slices.template.states.create("active", { shiftRadius: 0 });

      series0.labels.template.setAll({
        templateField: "settings"
      });

      series0.ticks.template.setAll({
        templateField: "settings"
      });

      series0.labels.template.setAll({
        textType: "circular",
        radius: 30
      });

      // Create inner series (Income breakdown)
      const series1 = this.chart.series.push(
        am5percent.PieSeries.new(this.root, {
          radius: am5.percent(85),
          innerRadius: am5.percent(60),
          valueField: "value",
          categoryField: "category",
          alignLabels: false
        })
      );

      series1.states.create("hidden", {
        startAngle: 180,
        endAngle: 180
      });

      series1.slices.template.setAll({
        templateField: "sliceSettings",
        strokeOpacity: 0
      });

      series1.labels.template.setAll({
        textType: "circular",
        fontSize: 12,
        fill: am5.color(0xffffff),
        fontWeight: "bold"
      });

      series1.labels.template.adapters.add("radius", function (radius, target) {
        return -15;
      });

      // Custom label formatter to show both percentage and amount
      series1.labels.template.adapters.add("text", (text, target) => {
        const dataItem = target.dataItem;
        if (dataItem && dataItem.dataContext) {
          const dataContext = dataItem.dataContext as any;
          const amount = dataContext.amount;
          const percentage = dataContext.percent;

          if (amount !== undefined && percentage !== undefined) {
            return `${percentage.toFixed(0)}% ${amount}`;
          }
        }
        return text;
      });

      series1.slices.template.states.create("hover", { scale: 1.1 });
      series1.slices.template.states.create("active", { shiftRadius: 0 });

      // Add tooltip for hover information
      series1.slices.template.set("tooltipText", `{category}: {percent.formatNumber('#.0')}% ({amount})`);
      series1.slices.template.set("tooltipPosition", "pointer");

      series1.ticks.template.setAll({
        forceHidden: true
      });

      // Store references for data updates
      this.outerSeries = series0;
      this.innerSeries = series1;

      console.log('Two-level pie chart initialized successfully');
    } catch (error) {
      console.error('Error initializing pie chart:', error);
    }
  }

  private subscribeToPieChartData(): void {
    this.metrics$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(metrics => {
      this.browserOnly(() => {
        if (metrics) {
          this.updatePieChartData(metrics);
        } else {
          this.clearPieChartData();
        }
      });
    });
  }

  private updatePieChartData(metrics: { expenses: number; savings: number }): void {
    if (!this.outerSeries || !this.innerSeries) {
      console.error('Pie chart series not available');
      return;
    }

    const { expenses, savings } = metrics;
    const total = expenses + Math.abs(savings);

    if (total === 0) {
      this.clearPieChartData();
      return;
    }

    // Prepare outer series data (Total Financial Flow)
    const outerData = [
      {
        category: "Expenses and Savings Overview",
        value: total,
        sliceSettings: {
          fill: am5.color(0x000000),
          stroke: am5.color(0x000000),
          strokeWidth: 0.5,

        }
      }
    ];

    // Prepare inner series data (Expenses, Savings breakdown)
    const innerData = [
      {
        category: "Expenses",
        value: expenses,
        amount: this.formatCurrency(expenses),
        percent: total > 0 ? (expenses / total) * 100 : 0,
        sliceSettings: {
          fill: am5.color(this.getCustomColor('expenses', '#EF4444'))
        }
      }
    ];

    // Add savings (can be positive or negative)
    if (savings !== 0) {
      innerData.push({
        category: savings >= 0 ? "Savings" : "Deficit",
        value: Math.abs(savings),
        amount: this.formatCurrency(Math.abs(savings)),
        percent: total > 0 ? (Math.abs(savings) / total) * 100 : 0,
        sliceSettings: {
          fill: am5.color(this.getCustomColor('savings', savings >= 0 ? '#3B82F6' : '#F59E0B'))
        }
      });
    }

    // Add remaining space if needed
    if (total < 100) {
      innerData.push({
        category: "Remaining",
        value: 100 - total,
        amount: this.formatCurrency(100 - total),
        percent: total > 0 ? ((100 - total) / total) * 100 : 0,
        sliceSettings: { fill: am5.color(0xdedede) }
      });
    }

    // Update the series data
    this.outerSeries.data.setAll(outerData);
    this.innerSeries.data.setAll(innerData);

    // Animate the chart
    this.outerSeries.appear(1000, 100);

    this.innerSeries.appear(1000, 100);
  }

  private clearPieChartData(): void {
    if (this.outerSeries) {
      this.outerSeries.data.clear();
    }
    if (this.innerSeries) {
      this.innerSeries.data.clear();
    }
  }

  private getCustomColor(type: string, defaultColor: string): string {
    const customColors = this.effectiveConfig.customColors;
    if (customColors && customColors[type as keyof typeof customColors]) {
      return customColors[type as keyof typeof customColors] || defaultColor;
    }
    return defaultColor;
  }

  // Store chart series references
  private outerSeries: am5percent.PieSeries | undefined;
  private innerSeries: am5percent.PieSeries | undefined;

  get effectiveConfig(): FinancialMetricsConfig {
    return {
      title: this.config.title ?? 'Financial Overview',
      subtitle: this.config.subtitle ?? '',
      currency: this.config.currency ?? 'INR',
      showHeaderIcon: this.config.showHeaderIcon ?? true,
      headerIcon: this.config.headerIcon ?? 'pie_chart',
      showFooter: this.config.showFooter ?? false,
      footerText: this.config.footerText ?? 'Last updated',
      cardHeight: this.config.cardHeight ?? 'medium',
      theme: this.config.theme ?? 'auto',
      animations: this.config.animations ?? true,
      loading: this.config.loading ?? false,
      error: this.config.error ?? '',
      emptyStateMessage: this.config.emptyStateMessage ?? 'No financial data available',
      pieChartHeight: this.config.pieChartHeight ?? 'inherit',
      customColors: this.config.customColors ?? {},
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

  onRefreshClick(): void {
    if (this.effectiveConfig.onRefresh) {
      this.effectiveConfig.onRefresh();
    }
  }

  get isEmpty(): Observable<boolean> {
    return this.metrics$.pipe(
      map(metrics => !metrics || (metrics.expenses === 0))
    );
  }

  get hasError(): boolean {
    return !!(this.effectiveConfig.error && this.effectiveConfig.error.trim());
  }

  getLastUpdatedTime(): string {
    return new Date().toLocaleString('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
} 