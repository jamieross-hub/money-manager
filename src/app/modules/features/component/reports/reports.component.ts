import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DecimalPipe, TitleCasePipe } from '@angular/common';
import { Subscription, take } from 'rxjs';
import { Transaction } from '../../../../util/models/transaction.model';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import * as TransactionsSelectors from '../../../../store/transactions/transactions.selectors';
import * as CategoriesSelectors from '../../../../store/categories/categories.selectors';
import { UserService } from 'src/app/util/service/db/user.service';
import { CurrencyService } from '../../../../util/service/currency.service';
import { DateService } from '../../../../util/service/date.service';
import { AppViewService, AppView } from 'src/app/util/service/app-view.service';
import dayjs from 'dayjs';

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
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { CategorySummaryCardComponent } from 'src/app/util/components/cards/category-summary-card/category-summary-card.component';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';
import { CurrencyPipe } from 'src/app/util/pipes/currency.pipe';
import { AccountSummaryCardComponent } from 'src/app/util/components/cards/account-summary-card/account-summary-card.component';
import { RouterModule } from '@angular/router';

// ── Types ──

export interface MonthlySummary {
    month: number;      // 0-11
    year: number;
    label: string;      // "Jan 2025"
    income: number;
    expense: number;
    savings: number;
    savingsRate: number; // %
    categoryBreakdown: CategoryBreakdownItem[];
}

export interface CategoryBreakdownItem {
    categoryId: string;
    categoryName: string;
    categoryIcon: string;
    categoryColor: string;
    amount: number;
    percentage: number;
    transactionCount: number;
}

export interface PeriodSummary {
    label: string;
    income: number;
    expense: number;
    savings: number;
    savingsRate: number;
    avgMonthlySpending: number;
    topCategory: CategoryBreakdownItem | null;
    categoryBreakdown: CategoryBreakdownItem[];
    expenseGrowth: number | null;  // % vs previous period
}

export interface Prediction {
    label: string;
    predictedExpense: number;
    predictedIncome: number;
    predictedSavings: number;
    confidence: 'low' | 'medium' | 'high';
    trend: 'increasing' | 'decreasing' | 'stable';
    overspendCategories: CategoryBreakdownItem[];
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
        MatSelectModule,
        MatFormFieldModule,
        CategorySummaryCardComponent,
        CurrencyPipe,
        AccountSummaryCardComponent,
        RouterModule
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportsComponent implements OnInit, OnDestroy {

    // ── State ──
    transactions: Transaction[] = [];
    isLoading = true;

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

    // Period selector
    selectedPeriod: 'weekly' | 'monthly' | 'yearly' = 'monthly';
    selectedYear: number = new Date().getFullYear();
    selectedMonth: number | null = null;
    selectedWeekOffset: number = 0;
    availableYears: number[] = [];

    // Computed
    monthlySummaries: MonthlySummary[] = [];
    filteredMonthlySummaries: MonthlySummary[] = [];
    currentPeriodSummary: PeriodSummary | null = null;
    previousPeriodSummary: PeriodSummary | null = null;

    // Predictions
    nextMonthPrediction: Prediction | null = null;
    next3MonthsPrediction: Prediction | null = null;
    yearEndPrediction: Prediction | null = null;

    // Key metrics
    avgMonthlySpending = 0;
    highestSpendingCategory: CategoryBreakdownItem | null = null;
    overallSavingsRate = 0;

    // Pre-computed trend data (for template binding with OnPush)
    savingsTrend: MonthlySummary[] = [];
    savingsTrendMax = 1;

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

    constructor(
        private userService: UserService,
        private store: Store<AppState>,
        private currencyService: CurrencyService,
        private dateService: DateService,
        private appViewService: AppViewService,
        private cdr: ChangeDetectorRef,
        public breakpointService: BreakpointService
    ) { }

    ngOnInit(): void {
        const viewSub = this.appViewService.appView$.subscribe(view => {
            if (view === 'WEEKLY') this.selectedPeriod = 'weekly';
            else if (view === 'YEARLY') this.selectedPeriod = 'yearly';
            else this.selectedPeriod = 'monthly';
            this.computeAll();
        });
        this.subscriptions.push(viewSub);

        this.loadTransactions();
    }

    ngOnDestroy(): void {
        this.subscriptions.forEach(s => s.unsubscribe());
    }

    // ══════════════════════════════════════════
    // Data Loading
    // ══════════════════════════════════════════

    private loadTransactions(): void {
        const userId = this.userService.getCurrentUserId();
        if (!userId) {
            this.isLoading = false;
            this.cdr.markForCheck();
            return;
        }

        // Load category icons
        const catSub = this.store.select(CategoriesSelectors.selectAllCategories)
            .pipe(take(1))
            .subscribe(categories => {
                this.categoryIconMap.clear();
                this.categoryColorMap.clear();
                for (const cat of categories) {
                    if (cat.id) {
                        this.categoryIconMap.set(cat.id, cat.icon || 'category');
                        this.categoryColorMap.set(cat.id, cat.color || '#9ca3af');
                    }
                }
            });
        this.subscriptions.push(catSub);

        const sub = this.store.select(TransactionsSelectors.selectAllTransactions)
            .pipe(take(1))
            .subscribe({
                next: (transactions) => {
                    this.transactions = transactions;
                    this.computeAll();
                    this.isLoading = false;
                    this.cdr.markForCheck();
                },
                error: () => {
                    this.isLoading = false;
                    this.cdr.markForCheck();
                }
            });
        this.subscriptions.push(sub);
    }

    // ══════════════════════════════════════════
    // Compute all data
    // ══════════════════════════════════════════

    private computeAll(): void {
        this.monthlySummaries = this.buildMonthlySummaries();
        this.extractAvailableYears();
        this.computeKeyMetrics();
        this.computePeriodSummary();
        this.computePredictions();
        this.computeTrendData();
    }

    private extractAvailableYears(): void {
        const yearSet = new Set<number>();
        for (const m of this.monthlySummaries) {
            yearSet.add(m.year);
        }
        this.availableYears = Array.from(yearSet).sort((a, b) => b - a);
        // Ensure selectedYear is valid
        if (this.availableYears.length > 0 && !this.availableYears.includes(this.selectedYear)) {
            this.selectedYear = this.availableYears[0];
        }
    }

    // ══════════════════════════════════════════
    // Monthly Summaries
    // ══════════════════════════════════════════

    private buildMonthlySummaries(): MonthlySummary[] {
        const map = new Map<string, { income: number; expense: number; categories: Map<string, CategoryBreakdownItem> }>();

        for (const t of this.transactions) {
            const d = this.dateService.toDate(t.date);
            if (!d) continue;

            const key = `${d.getFullYear()}-${d.getMonth()}`;
            if (!map.has(key)) {
                map.set(key, { income: 0, expense: 0, categories: new Map() });
            }
            const entry = map.get(key)!;

            if (t.type === 'income') {
                entry.income += t.amount;
            } else if (t.type === 'expense') {
                entry.expense += t.amount;

                const catKey = t.categoryId || t.category || 'Uncategorized';
                const catName = t.category || 'Uncategorized';
                if (!entry.categories.has(catKey)) {
                    entry.categories.set(catKey, { categoryId: catKey, categoryName: catName, categoryIcon: this.categoryIconMap.get(catKey) || 'category', categoryColor: this.categoryColorMap.get(catKey) || '#9ca3af', amount: 0, percentage: 0, transactionCount: 0 });
                }
                const cat = entry.categories.get(catKey)!;
                cat.amount += t.amount;
                cat.transactionCount += 1;
            }
        }

        const summaries: MonthlySummary[] = [];
        for (const [key, val] of map) {
            const [yearStr, monthStr] = key.split('-');
            const year = parseInt(yearStr);
            const month = parseInt(monthStr);
            const savings = val.income - val.expense;
            const savingsRate = val.income > 0 ? (savings / val.income) * 100 : 0;

            // Compute percentages
            const categories = Array.from(val.categories.values());
            if (val.expense > 0) {
                categories.forEach(c => c.percentage = (c.amount / val.expense) * 100);
            }
            categories.sort((a, b) => b.amount - a.amount);

            summaries.push({
                month, year,
                label: `${this.MONTHS[month]} ${year}`,
                income: val.income,
                expense: val.expense,
                savings,
                savingsRate,
                categoryBreakdown: categories
            });
        }

        summaries.sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            return b.month - a.month;
        });

        return summaries;
    }

    // ══════════════════════════════════════════
    // Key Metrics
    // ══════════════════════════════════════════

    private computeKeyMetrics(): void {
        if (this.monthlySummaries.length === 0) return;

        // Average monthly spending
        const totalExpense = this.monthlySummaries.reduce((s, m) => s + m.expense, 0);
        const totalIncome = this.monthlySummaries.reduce((s, m) => s + m.income, 0);
        this.avgMonthlySpending = totalExpense / this.monthlySummaries.length;

        // Overall savings rate
        this.overallSavingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;

        // Highest spending category across all months
        const catMap = new Map<string, CategoryBreakdownItem>();
        for (const m of this.monthlySummaries) {
            for (const c of m.categoryBreakdown) {
                if (!catMap.has(c.categoryId)) {
                    catMap.set(c.categoryId, { ...c, categoryIcon: c.categoryIcon || this.categoryIconMap.get(c.categoryId) || 'category', categoryColor: c.categoryColor || this.categoryColorMap.get(c.categoryId) || '#9ca3af', amount: 0, transactionCount: 0, percentage: 0 });
                }
                const existing = catMap.get(c.categoryId)!;
                existing.amount += c.amount;
                existing.transactionCount += c.transactionCount;
            }
        }
        const allCats = Array.from(catMap.values()).sort((a, b) => b.amount - a.amount);
        if (totalExpense > 0) {
            allCats.forEach(c => c.percentage = (c.amount / totalExpense) * 100);
        }
        this.highestSpendingCategory = allCats.length > 0 ? allCats[0] : null;
    }

    // ══════════════════════════════════════════
    // Period Summary
    // ══════════════════════════════════════════

    computePeriodSummary(): void {
        const now = new Date();
        const year = this.selectedYear;
        let currentMonths: MonthlySummary[] = [];
        let previousMonths: MonthlySummary[] = [];

        if (this.selectedPeriod === 'monthly') {
            // For selected year: use the latest available month in that year
            const monthsInYear = this.monthlySummaries.filter(m => m.year === year).sort((a, b) => b.month - a.month);
            
            if (this.selectedMonth === null) {
                this.selectedMonth = year === now.getFullYear() ? now.getMonth() : (monthsInYear.length > 0 ? monthsInYear[0].month : 0);
            }
            
            const currentMonth = this.selectedMonth;
            currentMonths = this.monthlySummaries.filter(m => m.month === currentMonth && m.year === year);
            const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
            const prevYear = currentMonth === 0 ? year - 1 : year;
            previousMonths = this.monthlySummaries.filter(m => m.month === prevMonth && m.year === prevYear);
        } else if (this.selectedPeriod === 'weekly') {
            const startOfCurrentWeek = dayjs().add(this.selectedWeekOffset, 'week').startOf('week');
            const endOfCurrentWeek = dayjs().add(this.selectedWeekOffset, 'week').endOf('week');
            const startOfPrevWeek = dayjs().add(this.selectedWeekOffset - 1, 'week').startOf('week');
            const endOfPrevWeek = dayjs().add(this.selectedWeekOffset - 1, 'week').endOf('week');

            currentMonths = this.buildAdhocSummary(this.transactions.filter(t => {
                const d = dayjs(this.dateService.toDate(t.date));
                return d.isAfter(startOfCurrentWeek.subtract(1, 'millisecond')) && d.isBefore(endOfCurrentWeek.add(1, 'millisecond'));
            }));

            previousMonths = this.buildAdhocSummary(this.transactions.filter(t => {
                const d = dayjs(this.dateService.toDate(t.date));
                return d.isAfter(startOfPrevWeek.subtract(1, 'millisecond')) && d.isBefore(endOfPrevWeek.add(1, 'millisecond'));
            }));
        } else {
            currentMonths = this.monthlySummaries.filter(m => m.year === year);
            previousMonths = this.monthlySummaries.filter(m => m.year === year - 1);
        }

        this.currentPeriodSummary = this.aggregatePeriod(currentMonths, this.getPeriodLabel('current'));
        this.previousPeriodSummary = this.aggregatePeriod(previousMonths, this.getPeriodLabel('previous'));

        // Expense growth
        if (this.currentPeriodSummary && this.previousPeriodSummary && this.previousPeriodSummary.expense > 0) {
            this.currentPeriodSummary.expenseGrowth =
                ((this.currentPeriodSummary.expense - this.previousPeriodSummary.expense) / this.previousPeriodSummary.expense) * 100;
        }

        // Filter monthly history for the table
        this.filteredMonthlySummaries = this.monthlySummaries.filter(m => m.year === this.selectedYear);

        this.cdr.markForCheck();
    }

    private buildAdhocSummary(txns: Transaction[]): MonthlySummary[] {
        if (txns.length === 0) return [];
        let income = 0;
        let expense = 0;
        const catMap = new Map<string, CategoryBreakdownItem>();

        for (const t of txns) {
            if (t.type === 'income') income += t.amount;
            else if (t.type === 'expense') {
                expense += t.amount;
                const catKey = t.categoryId || t.category || 'Uncategorized';
                const catName = t.category || 'Uncategorized';
                if (!catMap.has(catKey)) {
                    catMap.set(catKey, { categoryId: catKey, categoryName: catName, categoryIcon: this.categoryIconMap.get(catKey) || 'category', categoryColor: this.categoryColorMap.get(catKey) || '#9ca3af', amount: 0, percentage: 0, transactionCount: 0 });
                }
                const cat = catMap.get(catKey)!;
                cat.amount += t.amount;
                cat.transactionCount += 1;
            }
        }

        const categories = Array.from(catMap.values());
        if (expense > 0) categories.forEach(c => c.percentage = (c.amount / expense) * 100);
        categories.sort((a, b) => b.amount - a.amount);

        return [{
            month: 0, year: 0, label: '', income, expense, savings: income - expense,
            savingsRate: income > 0 ? ((income - expense) / income) * 100 : 0,
            categoryBreakdown: categories
        }];
    }

    private aggregatePeriod(months: MonthlySummary[], label: string): PeriodSummary | null {
        if (months.length === 0) return null;

        const income = months.reduce((s, m) => s + m.income, 0);
        const expense = months.reduce((s, m) => s + m.expense, 0);
        const savings = income - expense;
        const savingsRate = income > 0 ? (savings / income) * 100 : 0;
        const avgMonthlySpending = expense / (months.length || 1);

        // Merge categories
        const catMap = new Map<string, CategoryBreakdownItem>();
        for (const m of months) {
            for (const c of m.categoryBreakdown) {
                if (!catMap.has(c.categoryId)) {
                    catMap.set(c.categoryId, { ...c, categoryIcon: c.categoryIcon || this.categoryIconMap.get(c.categoryId) || 'category', categoryColor: c.categoryColor || this.categoryColorMap.get(c.categoryId) || '#9ca3af', amount: 0, transactionCount: 0, percentage: 0 });
                }
                const existing = catMap.get(c.categoryId)!;
                existing.amount += c.amount;
                existing.transactionCount += c.transactionCount;
            }
        }
        const categories = Array.from(catMap.values()).sort((a, b) => b.amount - a.amount);
        if (expense > 0) categories.forEach(c => c.percentage = (c.amount / expense) * 100);

        return {
            label, income, expense, savings, savingsRate, avgMonthlySpending,
            topCategory: categories.length > 0 ? categories[0] : null,
            categoryBreakdown: categories,
            expenseGrowth: null
        };
    }

    public getPeriodLabel(which: 'current' | 'previous'): string {
        const now = new Date();
        const year = this.selectedYear;
        if (this.selectedPeriod === 'monthly') {
            const currentMonth = this.selectedMonth !== null ? this.selectedMonth : (year === now.getFullYear() ? now.getMonth() : 0);
            if (which === 'current') return `${this.MONTHS[currentMonth]} ${year}`;
            const pm = currentMonth === 0 ? 11 : currentMonth - 1;
            const py = currentMonth === 0 ? year - 1 : year;
            return `${this.MONTHS[pm]} ${py}`;
        } else if (this.selectedPeriod === 'weekly') {
            const offset = which === 'current' ? this.selectedWeekOffset : this.selectedWeekOffset - 1;
            const start = dayjs().add(offset, 'week').startOf('week');
            const end = dayjs().add(offset, 'week').endOf('week');
            
            if (offset === 0 && which === 'current') return 'This Week';
            if (offset === -1 && which === 'previous') return 'Last Week';
            
            return `${start.format('D MMM')} - ${end.format('D MMM YYYY')}`;
        } else {
            return which === 'current' ? `${year}` : `${year - 1}`;
        }
    }

    // ══════════════════════════════════════════
    // Predictions / Forecasting
    // ══════════════════════════════════════════

    private computePredictions(): void {
        if (this.monthlySummaries.length < 2) {
            this.nextMonthPrediction = null;
            this.next3MonthsPrediction = null;
            this.yearEndPrediction = null;
            return;
        }

        // Use most recent 6 months (or all if fewer)
        const recent = this.monthlySummaries.slice(0, Math.min(6, this.monthlySummaries.length));
        const avgExpense = recent.reduce((s, m) => s + m.expense, 0) / recent.length;
        const avgIncome = recent.reduce((s, m) => s + m.income, 0) / recent.length;

        // Trend: compare first half to second half of recent
        const half = Math.floor(recent.length / 2);
        const recentHalf = recent.slice(0, half);
        const olderHalf = recent.slice(half);
        const recentAvgExp = recentHalf.reduce((s, m) => s + m.expense, 0) / (recentHalf.length || 1);
        const olderAvgExp = olderHalf.reduce((s, m) => s + m.expense, 0) / (olderHalf.length || 1);

        const trendFactor = olderAvgExp > 0 ? recentAvgExp / olderAvgExp : 1;
        const trend: 'increasing' | 'decreasing' | 'stable' =
            trendFactor > 1.05 ? 'increasing' : trendFactor < 0.95 ? 'decreasing' : 'stable';

        const confidence: 'low' | 'medium' | 'high' =
            recent.length >= 6 ? 'high' : recent.length >= 3 ? 'medium' : 'low';

        // Find categories likely to overspend (above average trend)
        const catAvgMap = new Map<string, { total: number; count: number; name: string; id: string }>();
        for (const m of recent) {
            for (const c of m.categoryBreakdown) {
                if (!catAvgMap.has(c.categoryId)) {
                    catAvgMap.set(c.categoryId, { total: 0, count: 0, name: c.categoryName, id: c.categoryId });
                }
                const e = catAvgMap.get(c.categoryId)!;
                e.total += c.amount;
                e.count += 1;
            }
        }
        // Check which categories have growing trend in recent months
        const overspendCategories: CategoryBreakdownItem[] = [];
        for (const [catId, data] of catAvgMap) {
            const catAvg = data.total / data.count;
            // Check most recent month's spend vs average
            const latestMonth = recent[0];
            const latestCatSpend = latestMonth.categoryBreakdown.find(c => c.categoryId === catId);
            if (latestCatSpend && latestCatSpend.amount > catAvg * 1.2) {
                overspendCategories.push({
                    categoryId: catId,
                    categoryName: data.name,
                    categoryIcon: this.categoryIconMap.get(catId) || 'category',
                    categoryColor: this.categoryColorMap.get(catId) || '#9ca3af',
                    amount: latestCatSpend.amount,
                    percentage: catAvg > 0 ? ((latestCatSpend.amount - catAvg) / catAvg) * 100 : 0,
                    transactionCount: latestCatSpend.transactionCount
                });
            }
        }
        overspendCategories.sort((a, b) => b.percentage - a.percentage);

        // Next month
        const predictedExpMonth = avgExpense * (trend === 'increasing' ? trendFactor : trend === 'decreasing' ? trendFactor : 1);
        this.nextMonthPrediction = {
            label: this.getNextMonthLabel(1),
            predictedExpense: Math.round(predictedExpMonth),
            predictedIncome: Math.round(avgIncome),
            predictedSavings: Math.round(avgIncome - predictedExpMonth),
            confidence, trend, overspendCategories
        };

        // Next 3 months
        const predictedExp3 = predictedExpMonth * 3;
        this.next3MonthsPrediction = {
            label: `Next 3 Months`,
            predictedExpense: Math.round(predictedExp3),
            predictedIncome: Math.round(avgIncome * 3),
            predictedSavings: Math.round((avgIncome * 3) - predictedExp3),
            confidence, trend, overspendCategories
        };

        // Year-end
        const now = new Date();
        const remainingMonths = 12 - now.getMonth();
        const currentYearMonths = this.monthlySummaries.filter(m => m.year === now.getFullYear());
        const currentYearExpense = currentYearMonths.reduce((s, m) => s + m.expense, 0);
        const currentYearIncome = currentYearMonths.reduce((s, m) => s + m.income, 0);
        const predictedRemainingExp = predictedExpMonth * remainingMonths;
        const predictedRemainingInc = avgIncome * remainingMonths;

        this.yearEndPrediction = {
            label: `Year-End ${now.getFullYear()}`,
            predictedExpense: Math.round(currentYearExpense + predictedRemainingExp),
            predictedIncome: Math.round(currentYearIncome + predictedRemainingInc),
            predictedSavings: Math.round((currentYearIncome + predictedRemainingInc) - (currentYearExpense + predictedRemainingExp)),
            confidence: recent.length >= 4 ? 'medium' : 'low',
            trend, overspendCategories: []
        };
    }

    private getNextMonthLabel(offset: number): string {
        const d = new Date();
        d.setMonth(d.getMonth() + offset);
        return `${this.MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    }

    // ══════════════════════════════════════════
    // Helpers
    // ══════════════════════════════════════════

    selectPeriod(period: 'weekly' | 'monthly' | 'yearly'): void {
        this.selectedPeriod = period;
        this.selectedWeekOffset = 0;
        this.selectedMonth = null;
        // Optionally update the global app view here if desired
        // e.g. this.appViewService.setAppView(period.toUpperCase());
        this.computePeriodSummary();
    }

    selectYear(year: number): void {
        this.selectedYear = year;
        this.selectedMonth = null;
        this.selectedWeekOffset = 0;
        this.computePeriodSummary();
    }

    selectTab(tab: 'summary' | 'forecast'): void {
        this.activeTab = tab;
        this.cdr.markForCheck();
    }

    previousMonth(): void {
        if (this.selectedPeriod !== 'monthly') return;
        if (this.selectedMonth === null) {
            const now = new Date();
            this.selectedMonth = this.selectedYear === now.getFullYear() ? now.getMonth() : 0;
        }
        
        if (this.selectedMonth === 0) {
            this.selectedMonth = 11;
            this.selectedYear--;
            if (this.availableYears.length > 0 && !this.availableYears.includes(this.selectedYear)) {
                this.availableYears = [...this.availableYears, this.selectedYear].sort((a,b) => b - a);
            }
        } else {
            this.selectedMonth--;
        }
        this.computePeriodSummary();
    }

    nextMonth(): void {
        if (this.selectedPeriod !== 'monthly') return;
        if (this.selectedMonth === null) {
            const now = new Date();
            this.selectedMonth = this.selectedYear === now.getFullYear() ? now.getMonth() : 0;
        }
        
        if (this.selectedMonth === 11) {
            this.selectedMonth = 0;
            this.selectedYear++;
            if (this.availableYears.length > 0 && !this.availableYears.includes(this.selectedYear)) {
                this.availableYears = [...this.availableYears, this.selectedYear].sort((a,b) => b - a);
            }
        } else {
            this.selectedMonth++;
        }
        this.computePeriodSummary();
    }

    previousWeek(): void {
        if (this.selectedPeriod !== 'weekly') return;
        this.selectedWeekOffset--;
        this.computePeriodSummary();
    }

    nextWeek(): void {
        if (this.selectedPeriod !== 'weekly') return;
        this.selectedWeekOffset++;
        this.computePeriodSummary();
    }

    formatCurrency(amount: number): string {
        return this.currencyService.formatAmount(amount, { compact: true, round: true });
    }

    formatCompact(amount: number): string {
        return this.currencyService.formatAmount(amount, { compact: true, round: true });
    }

    abs(n: number): number {
        return Math.abs(n);
    }

    // Get max amount from a category breakdown to compute bar widths
    getMaxCategoryAmount(breakdown: CategoryBreakdownItem[]): number {
        if (!breakdown || breakdown.length === 0) return 1;
        return breakdown[0].amount || 1;
    }

    // Get the bar width as percentage
    getBarWidth(amount: number, max: number): number {
        return max > 0 ? (amount / max) * 100 : 0;
    }

    // Income vs Expense bar ratio
    getIncomeExpenseRatio(income: number, expense: number): { incomeWidth: number; expenseWidth: number } {
        const max = Math.max(income, expense, 1);
        return {
            incomeWidth: (income / max) * 100,
            expenseWidth: (expense / max) * 100
        };
    }

    // Pre-compute trend data (called once in computeAll)
    private computeTrendData(): void {
        this.savingsTrend = [...this.monthlySummaries].reverse().slice(-12);
        if (this.savingsTrend.length === 0) {
            this.savingsTrendMax = 1;
        } else {
            const maxVal = Math.max(...this.savingsTrend.map(m => Math.max(m.income, m.expense)));
            this.savingsTrendMax = maxVal || 1;
        }
    }

    // Get bar height as percentage for trend chart
    getTrendBarHeight(value: number): number {
        return this.savingsTrendMax > 0 ? (value / this.savingsTrendMax) * 100 : 0;
    }

    getConfidenceColor(confidence: 'low' | 'medium' | 'high'): string {
        switch (confidence) {
            case 'high': return 'text-success-500';
            case 'medium': return 'text-warning-500';
            case 'low': return 'text-error-500';
        }
    }

    getTrendIcon(trend: 'increasing' | 'decreasing' | 'stable'): string {
        switch (trend) {
            case 'increasing': return 'trending_up';
            case 'decreasing': return 'trending_down';
            case 'stable': return 'trending_flat';
        }
    }

    getTrendColor(trend: 'increasing' | 'decreasing' | 'stable'): string {
        switch (trend) {
            case 'increasing': return 'text-error-500';
            case 'decreasing': return 'text-success-500';
            case 'stable': return 'text-primary-500';
        }
    }

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
