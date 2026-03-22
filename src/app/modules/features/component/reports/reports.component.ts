import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, inject, signal, effect, computed } from '@angular/core';
import { CommonModule, DecimalPipe, TitleCasePipe } from '@angular/common';
import { Subscription, take } from 'rxjs';
import { Transaction } from '../../../../util/models/transaction.model';
import { Store } from '@ngrx/store';
import { AppState } from '../../../../store/app.state';
import * as TransactionsSelectors from '../../../../store/transactions/transactions.selectors';
import * as CategoriesSelectors from '../../../../store/categories/categories.selectors';
import * as ProfileSelectors from '../../../../store/profile/profile.selectors';
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
    expandedCategoryId = signal<string | null>(null);

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

    readonly groupedCategoryBreakdown = computed(() => {
        const summary = this.currentPeriodSummarySignal();
        if (!summary || !summary.categoryBreakdown) return [];

        const categories = this.allCategories();
        const categoryMap = new Map(categories.map(c => [c.id, c]));

        const groups = new Map<string, { 
            name: string, 
            amount: number, 
            transactionCount: number, 
            categoryIcon: string, 
            groupIcon?: string, // [NEW]
            categoryColor: string,
            categoryId: string 
        }>();

        let totalAmount = 0;

        summary.categoryBreakdown.forEach(item => {
            const cat = categoryMap.get(item.categoryId);
            const groupName = cat?.group;

            if (groupName && groupName.trim() !== '') {
                if (!groups.has(groupName)) {
                    groups.set(groupName, {
                        name: groupName,
                        amount: 0,
                        transactionCount: 0,
                        categoryIcon: item.categoryIcon,
                        groupIcon: cat?.groupIcon, // [NEW]
                        categoryColor: (!item.categoryColor || item.categoryColor === '#9ca3af') ? this.stringToColor(groupName) : item.categoryColor,
                        categoryId: 'group_' + groupName
                    });
                }
                const g = groups.get(groupName)!;
                g.amount += item.amount;
                g.transactionCount += item.transactionCount;
                if (item.amount > (g.amount - item.amount)) {
                    g.categoryIcon = item.categoryIcon;
                    g.categoryColor = (!item.categoryColor || item.categoryColor === '#9ca3af') ? this.stringToColor(groupName) : item.categoryColor;
                }
            } else {
                groups.set(item.categoryId, {
                    name: item.categoryName,
                    amount: item.amount,
                    transactionCount: item.transactionCount,
                    categoryIcon: item.categoryIcon,
                    categoryColor: item.categoryColor,
                    categoryId: item.categoryId
                });
            }
            totalAmount += item.amount;
        });

        const result = Array.from(groups.values()).map(g => ({
            categoryId: g.categoryId,
            categoryName: g.name,
            categoryIcon: g.categoryIcon,
            groupIcon: g.groupIcon, // [NEW]
            categoryColor: g.categoryColor,
            amount: g.amount,
            transactionCount: g.transactionCount,
            percentage: totalAmount > 0 ? (g.amount / totalAmount) * 100 : 0
        }));

        return result.sort((a, b) => b.amount - a.amount);
    });

    readonly currentPeriodTransactions = computed(() => {
        const txns = this.transactions();
        if (!txns || txns.length === 0) return [];

        const period = this.selectedPeriod();
        const year = this.selectedYear();
        const month = this.selectedMonth();
        const offset = this.selectedWeekOffset();

        const now = new Date();
        const startOfCurrentWeek = dayjs().add(offset, 'week').startOf('week');
        const endOfCurrentWeek = dayjs().add(offset, 'week').endOf('week');

        return txns.filter(t => {
            const date = this.toDateHelper(t.date);
            if (!date) return false;
            
            const d = dayjs(date);
            if (period === 'monthly') {
                const currentMonth = month !== null ? month : (year === now.getFullYear() ? now.getMonth() : 0);
                return d.year() === year && d.month() === currentMonth;
            } else if (period === 'weekly') {
                return d.isAfter(startOfCurrentWeek.subtract(1, 'millisecond')) && d.isBefore(endOfCurrentWeek.add(1, 'millisecond'));
            } else { // yearly
                return d.year() === year;
            }
        });
    });

    readonly expandedItemData = computed(() => {
        const catId = this.expandedCategoryId();
        if (!catId) return null;

        const txns = this.currentPeriodTransactions();
        const categories = this.allCategories();
        
        if (catId.startsWith('group_')) {
            const groupName = catId.replace('group_', '');
            const groupCatIds = new Set(categories.filter(c => c.group === groupName).map(c => c.id));
            const items = txns.filter(t => groupCatIds.has(t.categoryId));
            
            const summary = this.currentPeriodSummarySignal();
            const breakdown = summary?.categoryBreakdown.filter(item => groupCatIds.has(item.categoryId)) || [];
            
            return {
                isGroup: true,
                groupName,
                transactions: items.map(t => ({ ...t, date: this.toDateHelper(t.date) })).sort((a, b) => ((b.date as Date)?.getTime() || 0) - ((a.date as Date)?.getTime() || 0)),
                breakdown: breakdown.sort((a, b) => b.amount - a.amount)
            };
        } else {
            const items = txns.filter(t => t.categoryId === catId);
            return {
                isGroup: false,
                transactions: items.map(t => ({ ...t, date: this.toDateHelper(t.date) })).sort((a, b) => ((b.date as Date)?.getTime() || 0) - ((a.date as Date)?.getTime() || 0))
            };
        }
    });

    toggleExpand(categoryId: string): void {
        this.expandedCategoryId.update(current => current === categoryId ? null : categoryId);
    }

    filteredMonthlySummariesSignal = this.reportsProcessor.filteredMonthlySummaries;
    
    readonly totalHistory = computed(() => {
        const summaries = this.filteredMonthlySummariesSignal();
        let income = 0;
        let expense = 0;
        summaries.forEach(s => {
            income += s.income;
            expense += s.expense;
        });
        const savings = income - expense;
        return { income, expense, savings };
    });

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

    private stringToColor(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        let color = '#';
        for (let i = 0; i < 3; i++) {
            const value = (hash >> (i * 8)) & 0xFF;
            const adjusted = Math.floor((value + 140) / 1.4); // Pastel-ish range
            color += ('00' + adjusted.toString(16)).substr(-2);
        }
        return color;
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
                    currentUserId: this.userService.getCurrentUserId(),
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
