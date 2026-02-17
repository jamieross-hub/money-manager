import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, Inject, NgZone, PLATFORM_ID, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Store } from '@ngrx/store';
import { Observable, Subject, combineLatest } from 'rxjs';
import { takeUntil, map } from 'rxjs/operators';

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

  // AmCharts removed
  // private root: am5.Root | undefined;
  // private chart: am5percent.PieChart | undefined;
  chartContainerId: string = 'financial-metrics-pie-chart-removed';


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
      // this.initializePieChart();
      this.subscribeToPieChartData();
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
    // Pie chart initialization removed
  }

  private subscribeToPieChartData(): void {
    // Subscription logic removed - handled in template via async pipe
  }

  private updatePieChartData(metrics: { expenses: number; savings: number }): void {
    // Update logic removed - handled in template via async pipe
  }

  private clearPieChartData(): void {
    // Clear logic removed
  }

  private getCustomColor(type: string, defaultColor: string): string {
    const customColors = this.effectiveConfig.customColors;
    if (customColors && customColors[type as keyof typeof customColors]) {
      return customColors[type as keyof typeof customColors] || defaultColor;
    }
    return defaultColor;
  }

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
