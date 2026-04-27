import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, inject, signal, effect, computed } from '@angular/core';
import { CommonModule, DecimalPipe, TitleCasePipe } from '@angular/common';
import { Subscription, take } from 'rxjs';
import { Transaction } from '../../../../util/models/transaction.model';
import { Store } from '@ngrx/store';
import { AppState } from '../../../../store/app.state';
import * as TransactionsSelectors from '../../../../store/transactions/transactions.selectors';
import * as CategoriesSelectors from '../../../../store/categories/categories.selectors';
import * as ProfileSelectors from '../../../../store/profile/profile.selectors';
import * as AccountsSelectors from '../../../../store/accounts/accounts.selectors';
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
import { CategoryReportItemComponent } from 'src/app/util/components/cards/category-report-item/category-report-item.component';
import { LocalStorageKey } from '../../../../util/models/local-storage.model';

interface ReportsPreferences {
    selectedPeriod: 'weekly' | 'monthly' | 'yearly' | 'all';
    selectedYear: number;
    selectedMonth: number | null;
    selectedWeekOffset: number;
}

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
        // CategorySummaryCardComponent,
        CurrencyPipe,
        // AccountSummaryCardComponent,
        RouterModule,
        AbsPipe,
        MathPipe,
        TrendPipe,
        CategoryReportItemComponent
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
    selectedPeriod = signal<'weekly' | 'monthly' | 'yearly' | 'all'>('monthly');
    selectedYear = signal<number>(new Date().getFullYear());
    selectedMonth = signal<number | null>(null);
    selectedWeekOffset = signal<number>(0);
    expandedCategoryId = signal<string | null>(null);
    isIncomeCollapsed = signal<boolean>(false);
    isAccountsCollapsed = signal<boolean>(false);
    isExpenseCollapsed = signal<boolean>(false);

    // Store Signals
    readonly transactions = this.store.selectSignal(TransactionsSelectors.selectAllTransactions);
    readonly allCategories = this.store.selectSignal(CategoriesSelectors.selectAllCategories);
    readonly allAccounts = this.store.selectSignal(AccountsSelectors.selectAllAccounts);
    readonly totalBalance = this.store.selectSignal(AccountsSelectors.selectTotalBalance);

    // Data from ReportsProcessorService (Signals)
    monthlySummariesSignal = this.reportsProcessor.monthlySummaries;
    availableYearsSignal = this.reportsProcessor.availableYears;
    avgMonthlySpendingSignal = this.reportsProcessor.avgMonthlySpending;
    highestSpendingCategorySignal = this.reportsProcessor.highestSpendingCategory;
    overallSavingsRateSignal = this.reportsProcessor.overallSavingsRate;
    currentPeriodSummarySignal = this.reportsProcessor.currentPeriodSummary;
    previousPeriodSummarySignal = this.reportsProcessor.previousPeriodSummary;
    currentPeriodTransactionsSignal = this.reportsProcessor.currentPeriodTransactions;

    readonly incomeBreakdown = computed(() => {
        const summary = this.currentPeriodSummarySignal();
        if (!summary || !summary.incomeCategoryBreakdown) return [];

        const categories = this.allCategories();
        const categoryMap = new Map(categories.map(c => [c.id!, c]));

        return summary.incomeCategoryBreakdown.map(item => {
            const cat = categoryMap.get(item.categoryId);
            return {
                ...item,
                budget: cat?.budget?.budgetAmount ?? null
            };
        });
    });

    readonly groupedCategoryBreakdown = computed(() => {
        const summary = this.currentPeriodSummarySignal();
        const prevSummary = this.previousPeriodSummarySignal();
        if (!summary || !summary.categoryBreakdown) return [];

        const categories = this.allCategories();
        const categoryMap = new Map(categories.map(c => [c.id, c]));
        const validCategoryIds = new Set(categories.map(c => c.id));

        // Internal helper to aggregate category data into groups/standalone items
        const aggregate = (breakdown: CategoryBreakdownItem[]) => {
            const groups = new Map<string, { 
                name: string, 
                amount: number, 
                transactionCount: number, 
                budget: number,
                categoryIcon: string, 
                groupIcon?: string,
                categoryColor: string,
                categoryId: string 
            }>();

            breakdown.forEach(item => {
                const cat = categoryMap.get(item.categoryId);
                const isUnrecognized = !validCategoryIds.has(item.categoryId);
                const budget = cat?.budget?.budgetAmount || 0;

                if (isUnrecognized) {
                    const groupId = 'group_unrecognized';
                    if (!groups.has(groupId)) {
                        groups.set(groupId, {
                            name: 'Unrecognized Category', amount: 0, transactionCount: 0, budget: 0,
                            categoryIcon: 'help_outline', groupIcon: 'help_outline',
                            categoryColor: '#94a3b8', categoryId: groupId
                        });
                    }
                    const g = groups.get(groupId)!;
                    g.amount += item.amount;
                    g.transactionCount += item.transactionCount;
                    g.budget += budget;
                } else {
                    const groupName = cat?.group;
                    if (groupName && groupName.trim() !== '') {
                        const groupId = 'group_' + groupName;
                        if (!groups.has(groupId)) {
                            groups.set(groupId, {
                                name: groupName, amount: 0, transactionCount: 0, budget: 0,
                                categoryIcon: item.categoryIcon, groupIcon: cat?.groupIcon,
                                categoryColor: (!item.categoryColor || item.categoryColor === '#9ca3af') ? this.stringToColor(groupName) : item.categoryColor,
                                categoryId: groupId
                            });
                        }
                        const g = groups.get(groupId)!;
                        g.amount += item.amount;
                        g.transactionCount += item.transactionCount;
                        g.budget += budget;
                        // Keep icon/color of the largest contributor in the group
                        if (item.amount > (g.amount - item.amount)) {
                            g.categoryIcon = item.categoryIcon;
                        }
                    } else {
                        groups.set(item.categoryId, {
                            name: item.categoryName, amount: item.amount, transactionCount: item.transactionCount,
                            budget: budget, categoryIcon: item.categoryIcon, categoryColor: item.categoryColor,
                            categoryId: item.categoryId
                        });
                    }
                }
            });
            return groups;
        };

        const currentAggregated = aggregate(summary.categoryBreakdown);
        const prevAggregated = prevSummary ? aggregate(prevSummary.categoryBreakdown) : new Map();

        const sorted = Array.from(currentAggregated.values())
            .map(g => {
                const prev = prevAggregated.get(g.categoryId);
                const prevAmount = prev ? prev.amount : 0;
                const diff = g.amount - prevAmount;
                const trend = prevAmount > 0 ? (diff / prevAmount) * 100 : (g.amount > 0 ? 100 : 0);

                return {
                    categoryId: g.categoryId,
                    categoryName: g.name,
                    categoryIcon: g.categoryIcon,
                    groupIcon: g.groupIcon,
                    categoryColor: g.categoryColor,
                    amount: g.amount,
                    prevAmount,
                    diff,
                    trend,
                    transactionCount: g.transactionCount,
                    budget: g.budget,
                    percentage: (summary.income ?? 0) > 0 ? (g.amount / summary.income!) * 100 : 0,
                    isGrouped: g.categoryId.startsWith('group_')
                };
            })
            .sort((a, b) => b.amount - a.amount);

        return sorted;
    });

    readonly totalExpenseBudget = computed(() => {
        return this.groupedCategoryBreakdown().reduce((sum, item) => sum + (item.budget || 0), 0);
    });

    readonly expandedItemData = computed(() => {
        const catId = this.expandedCategoryId();
        if (!catId) return null;

        const txns = this.currentPeriodTransactionsSignal();
        const categories = this.allCategories();
        const validCategoryIds = new Set(categories.map(c => c.id));

        if (catId === 'group_unrecognized') {
            const items = txns.filter(t => !validCategoryIds.has(t.categoryId));
            const summary = this.currentPeriodSummarySignal();
            const breakdown = summary?.categoryBreakdown.filter(item => !validCategoryIds.has(item.categoryId)) || [];

            return {
                isGroup: true,
                groupName: 'Unrecognized Category',
                transactions: items.map(t => ({ ...t, date: this.toDateHelper(t.date) })).sort((a, b) => ((b.date as Date)?.getTime() || 0) - ((a.date as Date)?.getTime() || 0)),
                breakdown: breakdown.sort((a, b) => b.amount - a.amount)
            };
        }

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

    toggleIncomeCollapse(): void {
        this.isIncomeCollapsed.update(v => !v);
    }

    toggleAccountsCollapse(): void {
        this.isAccountsCollapsed.update(v => !v);
    }

    toggleExpenseCollapse(): void {
        this.isExpenseCollapsed.update(v => !v);
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
        if (period === 'all') return false;
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
            
            // Optimization: instead of iterating over ALL transactions, 
            // the reportsProcessor already knows the bounds from monthlySummaries.
            // But let's keep it simple for now as transactions() is relatively small in memory.
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
        if (period === 'all') return false;
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
    readonly periodOptions: ('weekly' | 'monthly' | 'yearly' | 'all')[] = ['weekly', 'monthly', 'yearly', 'all'];

    // Category icon & color lookup
    private categoryIconMap = new Map<string, string>();
    private categoryColorMap = new Map<string, string>();
    private categoryGroupMap = new Map<string, string>();

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
        // Load cached preferences
        const cachedPrefs = this.storageService.getItem<ReportsPreferences>(LocalStorageKey.REPORTS_PREFERENCES);
        if (cachedPrefs) {
            this.selectedPeriod.set(cachedPrefs.selectedPeriod);
            this.selectedYear.set(cachedPrefs.selectedYear);
            this.selectedMonth.set(cachedPrefs.selectedMonth);
            this.selectedWeekOffset.set(cachedPrefs.selectedWeekOffset);
        }

        // Load cached UI state (expanded category & collapse states)
        const uiState = this.storageService.getItem<any>(LocalStorageKey.REPORTS_UI_STATE);
        if (uiState) {
            if (uiState.expandedCategoryId) this.expandedCategoryId.set(uiState.expandedCategoryId);
            if (uiState.isIncomeCollapsed !== undefined) this.isIncomeCollapsed.set(uiState.isIncomeCollapsed);
            if (uiState.isAccountsCollapsed !== undefined) this.isAccountsCollapsed.set(uiState.isAccountsCollapsed);
            if (uiState.isExpenseCollapsed !== undefined) this.isExpenseCollapsed.set(uiState.isExpenseCollapsed);
        }

        // Effect to save preferences when they change
        effect(() => {
            const prefs: ReportsPreferences = {
                selectedPeriod: this.selectedPeriod(),
                selectedYear: this.selectedYear(),
                selectedMonth: this.selectedMonth(),
                selectedWeekOffset: this.selectedWeekOffset()
            };
            this.storageService.setItem(LocalStorageKey.REPORTS_PREFERENCES, prefs);
        });

        // Effect to save expanded category & collapse states
        effect(() => {
            const currentUIState = this.storageService.getItem<any>(LocalStorageKey.REPORTS_UI_STATE) || {};
            this.storageService.setItem(LocalStorageKey.REPORTS_UI_STATE, {
                ...currentUIState,
                expandedCategoryId: this.expandedCategoryId(),
                isIncomeCollapsed: this.isIncomeCollapsed(),
                isAccountsCollapsed: this.isAccountsCollapsed(),
                isExpenseCollapsed: this.isExpenseCollapsed()
            });
        });

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
                const groupMap: { [key: string]: string } = {};
                this.categoryIconMap.forEach((v, k) => iconMap[k] = v);
                this.categoryColorMap.forEach((v, k) => colorMap[k] = v);
                this.categoryGroupMap.forEach((v, k) => groupMap[k] = v);

                this.reportsProcessor.process({
                    transactions: txns,
                    currentUserId: this.userService.getCurrentUserId(),
                    selectedPeriod: period,
                    selectedYear: year,
                    selectedMonth: month,
                    selectedWeekOffset: offset,
                    categoryIconMap: iconMap,
                    categoryColorMap: colorMap,
                    categoryGroupMap: groupMap,
                    isIncomeCollapsed: this.isIncomeCollapsed(),
                    isAccountsCollapsed: this.isAccountsCollapsed(),
                    isExpenseCollapsed: this.isExpenseCollapsed()
                });
            }
        });

        // Effect to update category maps when allCategories signal changes
        this.updateCategoryMaps();
    }

    ngOnInit(): void {
        const cachedPrefs = this.storageService.getItem<ReportsPreferences>(LocalStorageKey.REPORTS_PREFERENCES);
        
        const viewSub = this.appViewService.appView$.subscribe(view => {
            // Only apply app-view defaults if no cached preferences exist
            if (!cachedPrefs) {
                if (view === 'WEEKLY') this.selectedPeriod.set('weekly');
                else if (view === 'YEARLY') this.selectedPeriod.set('yearly');
                else this.selectedPeriod.set('monthly');
            }
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
            this.categoryGroupMap.clear();
            for (const cat of categories) {
                if (cat.id) {
                    this.categoryIconMap.set(cat.id, cat.icon || 'category');
                    this.categoryColorMap.set(cat.id, cat.color || '#9ca3af');
                    if (cat.group) {
                        this.categoryGroupMap.set(cat.id, cat.group);
                    }
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

    selectPeriod(period: 'weekly' | 'monthly' | 'yearly' | 'all'): void {
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
