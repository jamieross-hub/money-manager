import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, inject, signal, effect, computed } from '@angular/core';
import { CommonModule, DecimalPipe, TitleCasePipe } from '@angular/common';
import { Subscription, take } from 'rxjs';
import { Transaction } from '../../../../util/models/transaction.model';
import { Store } from '@ngrx/store';
import { AppState } from '../../../../store/app.state';
import * as TransactionsSelectors from '../../../../store/transactions/transactions.selectors';
import * as CategoriesSelectors from '../../../../store/categories/categories.selectors';
import { UserService } from '../../../../util/service/db/user.service';
import { CurrencyService } from '../../../../util/service/currency.service';
import { DateService } from '../../../../util/service/date.service';
import { AppViewService, AppView } from '../../../../util/service/app-view.service';
import dayjs from 'dayjs';
import { ReportsProcessorService, MonthlySummary, CategoryBreakdownItem, PeriodSummary, Prediction } from '../../../../util/service/reports-processor.service';

// Angular Material
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatListModule } from '@angular/material/list';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { CategorySummaryCardComponent } from '../../../../util/components/cards/category-summary-card/category-summary-card.component';
import { BreakpointService } from '../../../../util/service/breakpoint.service';
import { CurrencyPipe } from '../../../../util/pipes/currency.pipe';
import { AccountSummaryCardComponent } from '../../../../util/components/cards/account-summary-card/account-summary-card.component';
import { RouterModule } from '@angular/router';
import { AbsPipe } from '../../../../util/pipes/abs.pipe';
import { MathPipe } from '../../../../util/pipes/math.pipe';
import { TrendPipe } from '../../../../util/pipes/trend.pipe';
import { LocalIndexDBStorageService } from '../../../../util/service/indexdb-storage.service';

@Component({
    selector: 'app-reports',
    templateUrl: './reports.component.html',
    styleUrls: ['./reports.component.scss'],
    standalone: true,
    imports: [
        CommonModule,
        DecimalPipe,
        TitleCasePipe,
        MatCardModule,
        MatTabsModule,
        MatButtonToggleModule,
        MatTableModule,
        MatProgressBarModule,
        MatProgressSpinnerModule,
        MatListModule,
        MatExpansionModule,
        MatChipsModule,
        MatDividerModule,
        MatTooltipModule,
        MatIconModule,
        MatButtonModule,
        MatSelectModule,
        MatFormFieldModule,
        CategorySummaryCardComponent,
        CurrencyPipe,
        AccountSummaryCardComponent,
        RouterModule,
        AbsPipe,
        MathPipe,
        TrendPipe
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportsComponent implements OnInit, OnDestroy {

    // ── State ──
    private readonly reportsProcessor: ReportsProcessorService = inject(ReportsProcessorService);

    // Tab
    activeTab: 'summary' | 'forecast' = 'summary';

    // Summary Cards
    activeSummaryCard: 'category' | 'account' = 'category';

    swapSummaryCard(): void {
        this.activeSummaryCard = this.activeSummaryCard === 'category' ? 'account' : 'category';
    }

    // ── Summary Card Swipe Helpers ──
    private summaryTouchStartX = 0;
    private summaryTouchStartY = 0;
    private summaryTouchStartTime = 0;

    onSummaryTouchStart(event: TouchEvent): void {
        this.summaryTouchStartX = event.touches[0].clientX;
        this.summaryTouchStartY = event.touches[0].clientY;
        this.summaryTouchStartTime = Date.now();
    }

    onSummaryTouchEnd(event: TouchEvent): void {
        const touchEndX = event.changedTouches[0].clientX;
        const touchEndY = event.changedTouches[0].clientY;
        const deltaX = this.summaryTouchStartX - touchEndX;
        const deltaY = this.summaryTouchStartY - touchEndY;
        const elapsed = Date.now() - this.summaryTouchStartTime;

        // Trigger swap if either horizontal or vertical swipe distance is > 50px and less than 300ms
        if (elapsed < 300 && (Math.abs(deltaX) > 50 || Math.abs(deltaY) > 50)) {
            this.swapSummaryCard();
        }
    }

    // Period selector (Signals)
    selectedPeriod = signal<'weekly' | 'monthly' | 'yearly'>('monthly');
    selectedYear = signal<number>(new Date().getFullYear());
    selectedMonth = signal<number | null>(null);
    selectedWeekOffset = signal<number>(0);

    // Store Signals
    readonly transactions = this.store.selectSignal(TransactionsSelectors.selectAllTransactions);
    readonly allCategories = this.store.selectSignal(CategoriesSelectors.selectAllCategories);

    // Data from ReportsProcessorService (Signals)
    monthlySummariesSignal = this.reportsProcessor.monthlySummaries;
    availableYearsSignal = this.reportsProcessor.availableYears;
    avgMonthlySpendingSignal = this.reportsProcessor.avgMonthlySpending;
    highestSpendingCategorySignal = this.reportsProcessor.highestSpendingCategory;
    overallSavingsRateSignal = this.reportsProcessor.overallSavingsRate;
    currentPeriodSummarySignal = this.reportsProcessor.currentPeriodSummary;
    previousPeriodSummarySignal = this.reportsProcessor.previousPeriodSummary;
    filteredMonthlySummariesSignal = this.reportsProcessor.filteredMonthlySummaries;
    nextMonthPredictionSignal = this.reportsProcessor.nextMonthPrediction;
    next3MonthsPredictionSignal = this.reportsProcessor.next3MonthsPrediction;
    yearEndPredictionSignal = this.reportsProcessor.yearEndPrediction;
    isProcessing = this.reportsProcessor.isProcessing;
    
    // Navigation Bounds (Signals)
    readonly canGoPrevious = computed(() => {
        const period = this.selectedPeriod();
        const summaries = this.monthlySummariesSignal();
        if (summaries.length === 0) return false;

        const oldest = summaries[summaries.length - 1];

        if (period === 'yearly') {
            return this.selectedYear() > oldest.year;
        }

        if (period === 'monthly') {
            const currentYear = this.selectedYear();
            const currentMonth = this.selectedMonth() ?? (currentYear === new Date().getFullYear() ? new Date().getMonth() : 0);
            return currentYear > oldest.year || (currentYear === oldest.year && currentMonth > oldest.month);
        }

        if (period === 'weekly') {
            const txns = this.transactions();
            if (!txns || txns.length === 0) return false;
            let minTime = Infinity;
            txns.forEach(t => {
                const d = this.toDateHelper(t.date)?.getTime();
                if (d && d < minTime) minTime = d;
            });
            const startOfOldestWeek = dayjs(minTime).startOf('week');
            const currentWeekStart = dayjs().add(this.selectedWeekOffset(), 'week').startOf('week');
            return currentWeekStart.isAfter(startOfOldestWeek);
        }
        return false;
    });

    readonly canGoNext = computed(() => {
        const period = this.selectedPeriod();
        const summaries = this.monthlySummariesSignal();
        if (summaries.length === 0) return false;

        const newest = summaries[0];

        if (period === 'yearly') {
            return this.selectedYear() < newest.year;
        }

        if (period === 'monthly') {
            const currentYear = this.selectedYear();
            const currentMonth = this.selectedMonth() ?? (currentYear === new Date().getFullYear() ? new Date().getMonth() : 0);
            return currentYear < newest.year || (currentYear === newest.year && currentMonth < newest.month);
        }

        if (period === 'weekly') {
            const txns = this.transactions();
            if (!txns || txns.length === 0) return false;
            let maxTime = -Infinity;
            txns.forEach(t => {
                const d = this.toDateHelper(t.date)?.getTime();
                if (d && d > maxTime) maxTime = d;
            });
            const endOfNewestWeek = dayjs(maxTime).endOf('week');
            const currentWeekEnd = dayjs().add(this.selectedWeekOffset(), 'week').endOf('week');
            return currentWeekEnd.isBefore(endOfNewestWeek);
        }
        return false;
    });

    private toDateHelper(date: any): Date | null {
        if (!date) return null;
        if (date instanceof Date) return date;
        if (typeof date === 'string') return new Date(date);
        if (date && typeof date.toDate === 'function') return date.toDate();
        if (date && date.seconds) return new Date(date.seconds * 1000);
        if (typeof date === 'number') return new Date(date);
        return null;
    }

    // Backward compatibility getters
    get monthlySummaries() { return this.monthlySummariesSignal(); }
    get availableYears() { return this.availableYearsSignal(); }
    get avgMonthlySpending() { return this.avgMonthlySpendingSignal(); }
    get highestSpendingCategory() { return this.highestSpendingCategorySignal(); }
    get overallSavingsRate() { return this.overallSavingsRateSignal(); }
    get currentPeriodSummary() { return this.currentPeriodSummarySignal(); }
    get previousPeriodSummary() { return this.previousPeriodSummarySignal(); }
    get filteredMonthlySummaries() { return this.filteredMonthlySummariesSignal(); }
    get nextMonthPrediction() { return this.nextMonthPredictionSignal(); }
    get next3MonthsPrediction() { return this.next3MonthsPredictionSignal(); }
    get yearEndPrediction() { return this.yearEndPredictionSignal(); }

    get spendingLabel(): string {
        switch (this.selectedPeriod()) {
            case 'weekly': return 'Weekly Spending';
            case 'monthly': return 'Monthly Spending';
            case 'yearly': return 'Avg Monthly Spending';
            default: return 'Total Spending';
        }
    }

    // Pre-computed trend data (removed - not used in template)

    private subscriptions: Subscription[] = [];

    // Period options for template iteration (typed)
    readonly periodOptions: ('weekly' | 'monthly' | 'yearly')[] = ['weekly', 'monthly', 'yearly'];

    // Category icon & color lookup
    private categoryIconMap = new Map<string, string>();
    private categoryColorMap = new Map<string, string>();

    // Month labels
    private readonly MONTHS = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    private storageService = inject(LocalIndexDBStorageService);

    constructor(
        private userService: UserService,
        private store: Store<AppState>,
        private currencyService: CurrencyService,
        private dateService: DateService,
        private appViewService: AppViewService,
        private cdr: ChangeDetectorRef,
        public breakpointService: BreakpointService
    ) {
        // Effect to trigger processor when dependencies change
        effect(() => {
            const txns = this.transactions();
            const period = this.selectedPeriod();
            const year = this.selectedYear();
            const month = this.selectedMonth();
            const offset = this.selectedWeekOffset();
            
            if (txns && txns.length > 0) {
                const iconMap: { [key: string]: string } = {};
                const colorMap: { [key: string]: string } = {};
                this.categoryIconMap.forEach((v, k) => iconMap[k] = v);
                this.categoryColorMap.forEach((v, k) => colorMap[k] = v);

                this.reportsProcessor.process({
                    transactions: txns,
                    selectedPeriod: period,
                    selectedYear: year,
                    selectedMonth: month,
                    selectedWeekOffset: offset,
                    categoryIconMap: iconMap,
                    categoryColorMap: colorMap
                });
            }
        });

        // Effect to update category maps when allCategories signal changes
        this.updateCategoryMaps();
    }

    ngOnInit(): void {
        const viewSub = this.appViewService.appView$.subscribe(view => {
            if (view === 'WEEKLY') this.selectedPeriod.set('weekly');
            else if (view === 'YEARLY') this.selectedPeriod.set('yearly');
            else this.selectedPeriod.set('monthly');
        });
        this.subscriptions.push(viewSub);
    }

    ngOnDestroy(): void {
        this.subscriptions.forEach(s => s.unsubscribe());
    }

    // ══════════════════════════════════════════
    // Data Loading
    // ══════════════════════════════════════════

    private updateCategoryMaps(): void {
        effect(() => {
            const categories = this.allCategories();
            this.categoryIconMap.clear();
            this.categoryColorMap.clear();
            for (const cat of categories) {
                if (cat.id) {
                    this.categoryIconMap.set(cat.id, cat.icon || 'category');
                    this.categoryColorMap.set(cat.id, cat.color || '#9ca3af');
                }
            }
        });
    }

    get isLoading() { return this.isProcessing() && this.transactions().length === 0; }

    // ══════════════════════════════════════════
    // Compute all data
    // ══════════════════════════════════════════

    private computeAll(): void {}
    private extractAvailableYears(): void {}
    private buildMonthlySummaries(): MonthlySummary[] { return []; }
    private computeKeyMetrics(): void {}
    computePeriodSummary(): void {}
    private buildAdhocSummary(txns: Transaction[]): MonthlySummary[] { return []; }
    private aggregatePeriod(months: MonthlySummary[], label: string): PeriodSummary | null { return null; }
    public getPeriodLabel(which: 'current' | 'previous'): string {
        const summary = which === 'current' ? this.currentPeriodSummary : this.previousPeriodSummary;
        return summary?.label || '';
    }
    private computePredictions(): void {}

    private getNextMonthLabel(offset: number): string {
        const d = new Date();
        d.setMonth(d.getMonth() + offset);
        return `${this.MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    }

    // ══════════════════════════════════════════
    // Helpers
    // ══════════════════════════════════════════

    selectPeriod(period: 'weekly' | 'monthly' | 'yearly'): void {
        this.selectedPeriod.set(period);
        this.selectedWeekOffset.set(0);
        this.selectedMonth.set(null);
    }

    selectYear(year: number): void {
        this.selectedYear.set(year);
        this.selectedMonth.set(null);
        this.selectedWeekOffset.set(0);
    }

    selectTab(tab: 'summary' | 'forecast'): void {
        this.activeTab = tab;
        this.cdr.markForCheck();
    }

    previousMonth(): void {
        if (!this.canGoPrevious()) return;
        const period = this.selectedPeriod();
        if (period === 'yearly') {
            this.selectedYear.update(y => y - 1);
            return;
        }
        if (period !== 'monthly') return;
        
        if (this.selectedMonth() === null) {
            const now = new Date();
            this.selectedMonth.set(this.selectedYear() === now.getFullYear() ? now.getMonth() : 0);
        }
        
        if (this.selectedMonth() === 0) {
            this.selectedMonth.set(11);
            this.selectedYear.update(y => y - 1);
        } else {
            this.selectedMonth.update(m => (m || 0) - 1);
        }
    }

    nextMonth(): void {
        if (!this.canGoNext()) return;
        const period = this.selectedPeriod();
        if (period === 'yearly') {
            this.selectedYear.update(y => y + 1);
            return;
        }
        if (this.selectedPeriod() !== 'monthly') return;
        
        if (this.selectedMonth() === null) {
            const now = new Date();
            this.selectedMonth.set(this.selectedYear() === now.getFullYear() ? now.getMonth() : 0);
        }
        
        if (this.selectedMonth() === 11) {
            this.selectedMonth.set(0);
            this.selectedYear.update(y => y + 1);
        } else {
            this.selectedMonth.update(m => (m || 0) + 1);
        }
    }

    previousWeek(): void {
        if (!this.canGoPrevious()) return;
        if (this.selectedPeriod() !== 'weekly') return;
        this.selectedWeekOffset.update(o => o - 1);
    }

    nextWeek(): void {
        if (!this.canGoNext()) return;
        if (this.selectedPeriod() !== 'weekly') return;
        this.selectedWeekOffset.update(o => o + 1);
    }

    // Removed helper methods as they are now handled by pure pipes in the template

    // ── Touch scroll helpers ──
    private touchStartX = 0;
    private touchStartScrollLeft = 0;
    private touchStartTime = 0;

    onTouchStart(event: TouchEvent): void {
        const container = event.currentTarget as HTMLElement;
        this.touchStartX = event.touches[0].clientX;
        this.touchStartScrollLeft = container.scrollLeft;
        this.touchStartTime = Date.now();
    }

    onTouchEnd(event: TouchEvent): void {
        const container = event.currentTarget as HTMLElement;
        const touchEndX = event.changedTouches[0].clientX;
        const deltaX = this.touchStartX - touchEndX;
        const elapsed = Date.now() - this.touchStartTime;

        // Apply momentum scroll if swipe was fast enough
        if (elapsed < 300 && Math.abs(deltaX) > 30) {
            const velocity = (deltaX / elapsed) * 500;
            container.scrollBy({ left: velocity, behavior: 'smooth' });
        }
    }
}
