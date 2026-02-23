import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID, NgZone, AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Store } from '@ngrx/store';
import { Subscription, combineLatest, take } from 'rxjs';
import { AppState } from '../../../../store/app.state';
import * as TransactionsSelectors from '../../../../store/transactions/transactions.selectors';
import * as CategoriesSelectors from '../../../../store/categories/categories.selectors';
import { Transaction } from '../../../models/transaction.model';
import { Category } from '../../../models/category.model';
import { FilterService } from '../../../service/filter.service';
import { TransactionType } from '../../../../util/config/enums';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import localeData from 'dayjs/plugin/localeData';
import { CurrencyPipe } from 'src/app/util/pipes';

import { AppViewService } from '../../../../util/service/app-view.service';

dayjs.extend(isBetween);
dayjs.extend(localeData);

@Component({
    selector: 'app-monthly-expenditure-card',
    standalone: true,
    imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule, MatTooltipModule, CurrencyPipe],
    templateUrl: './monthly-expenditure-card.component.html',
    styleUrl: './monthly-expenditure-card.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonthlyExpenditureCardComponent implements OnInit, OnDestroy, AfterViewInit {
    chartId = 'daily-trend-chart-removed';
    // private root: am5.Root | undefined;
    // private series: am5xy.XYSeries | undefined;
    // private xAxis: am5xy.CategoryAxis<any> | undefined;


    chartType: 'line' | 'bar' = 'bar';
    viewMode: 'trend' | 'category' = 'category';
    totalIncome = 0;
    totalExpenses = 0;

    chartData: any[] = [];
    maxChartValue: number = 0;

    selectedYear = dayjs().year();
    selectedMonth = dayjs().month();

    currentView: 'WEEKLY' | 'MONTHLY' | 'YEARLY' = 'MONTHLY';
    chartTitle = 'Monthly Expenditure';
    chartFooter = 'Expenditure per month';

    private subscription = new Subscription();

    constructor(
        private store: Store<AppState>,
        private filterService: FilterService,
        @Inject(PLATFORM_ID) private platformId: Object,
        private zone: NgZone,
        private appViewService: AppViewService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit(): void {
        // Subscribe to App View
        this.subscription.add(
            this.appViewService.appView$.subscribe(view => {
                this.currentView = view;
                this.updateChartLabels();
                this.updateData();
            })
        );

        // Synchronize with global filters
        this.subscription.add(
            combineLatest([
                this.filterService.selectedYear$,
                this.filterService.selectedDateRange$
            ]).subscribe(([yearRange, dateRange]) => {
                if (yearRange) {
                    this.selectedYear = yearRange.startYear;
                }
                if (dateRange) {
                    const start = dayjs(dateRange.startDate);
                    this.selectedMonth = start.month();
                    this.selectedYear = start.year();
                }
                this.updateData();
            })
        );
    }

    ngAfterViewInit(): void {
        this.browserOnly(() => {
            // Small timeout to ensure DOM is ready
            setTimeout(() => {
                // this.initChart();
                this.subscribeToData();
            }, 100);
        });
    }

    ngOnDestroy(): void {
        this.subscription.unsubscribe();
        this.browserOnly(() => {
            // if (this.root) {
            //     this.root.dispose();
            // }

        });
    }

    private browserOnly(f: () => void) {
        if (isPlatformBrowser(this.platformId)) {
            this.zone.runOutsideAngular(() => {
                f();
            });
        }
    }

    private updateChartLabels() {
        switch (this.currentView) {
            case 'WEEKLY':
                this.chartTitle = 'Weekly Expenditure';
                this.chartFooter = 'Expenditure per day';
                break;
            case 'YEARLY':
                this.chartTitle = 'Yearly Expenditure';
                this.chartFooter = 'Expenditure per month';
                break;
            case 'MONTHLY':
            default:
                this.chartTitle = 'Monthly Expenditure';
                this.chartFooter = 'Expenditure per day';
                break;
        }
    }





    private subscribeToData() {
        this.subscription.add(
            combineLatest([
                this.store.select(TransactionsSelectors.selectAllTransactions),
                this.store.select(CategoriesSelectors.selectAllCategories)
            ]).subscribe(([transactions, categories]) => {
                const data = this.processTransactions(transactions, categories);
                this.updateChart(data);
            })
        );
    }

    private updateData() {
        this.subscription.add(
            combineLatest([
                this.store.select(TransactionsSelectors.selectAllTransactions),
                this.store.select(CategoriesSelectors.selectAllCategories)
            ]).pipe(take(1)).subscribe(([transactions, categories]: [Transaction[], Category[]]) => {
                const data = this.processTransactions(transactions, categories);
                this.updateChart(data);
            })
        );
    }

    private processTransactions(transactions: Transaction[], categories: Category[]) {
        if (this.viewMode === 'category') {
            return this.processCategoryTransactions(transactions, categories);
        }

        if (this.currentView === 'WEEKLY') {
            return this.processWeeklyTransactions(transactions);
        } else if (this.currentView === 'YEARLY') {
            return this.processYearlyTransactions(transactions);
        } else {
            return this.processMonthlyTransactions(transactions);
        }
    }

    private processCategoryTransactions(transactions: Transaction[], categories: Category[]) {
        const { start, end } = this.getCurrentPeriodRange();
        this.resetTotals();

        const categoryTotals: Record<string, number> = {};

        transactions.forEach(t => {
            const txDate = dayjs(this.convertToDate(t.date));
            if (txDate.isBetween(start, end, 'day', '[]')) {
                const catId: string = t.categoryId;
                if (t.type === 'expense' && catId) {
                    categoryTotals[catId] = (categoryTotals[catId] || 0) + t.amount;
                    this.totalExpenses += t.amount;
                } else if (t.type === 'income') {
                    this.totalIncome += t.amount;
                }
            }
        });

        return categories
            .map(c => ({
                period: c.name,
                value: c.id ? categoryTotals[c.id] || 0 : 0,
                color: c.color,
                icon: c.icon
            }))
            .filter(item => item.value > 0)
            .sort((a, b) => b.value - a.value);
    }

    private getCurrentPeriodRange() {
        if (this.currentView === 'WEEKLY') {
            return { start: dayjs().startOf('week'), end: dayjs().endOf('week') };
        } else if (this.currentView === 'YEARLY') {
            const targetYear = this.selectedYear || dayjs().year();
            return { start: dayjs().year(targetYear).startOf('year'), end: dayjs().year(targetYear).endOf('year') };
        } else {
            return { start: dayjs().startOf('month'), end: dayjs().endOf('month') };
        }
    }

    private processWeeklyTransactions(transactions: Transaction[]) {
        const startOfWeek = dayjs().startOf('week');
        const endOfWeek = dayjs().endOf('week');
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const totals: { [day: string]: number } = {};
        days.forEach(d => totals[d] = 0);

        this.resetTotals();

        transactions.forEach(t => {
            const txDate = dayjs(this.convertToDate(t.date));
            if (txDate.isBetween(startOfWeek, endOfWeek, 'day', '[]')) {
                if (t.type === 'expense') {
                    const dayName = txDate.format('ddd');
                    if (totals[dayName] !== undefined) {
                        totals[dayName] += t.amount;
                        this.totalExpenses += t.amount;
                    }
                } else if (t.type === 'income') {
                    this.totalIncome += t.amount;
                }
            }
        });

        return days.map(day => ({
            period: day,
            value: totals[day]
        }));
    }

    private processMonthlyTransactions(transactions: Transaction[]) {
        const startOfMonth = dayjs().startOf('month');
        const endOfMonth = dayjs().endOf('month');
        const daysInMonth = startOfMonth.daysInMonth();
        const days: string[] = [];
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(i.toString());
        }

        const totals: { [day: string]: number } = {};
        days.forEach(d => totals[d] = 0);

        this.resetTotals();

        transactions.forEach(t => {
            const txDate = dayjs(this.convertToDate(t.date));
            if (txDate.isBetween(startOfMonth, endOfMonth, 'day', '[]')) {
                if (t.type === 'expense') {
                    const dayObj = txDate.date().toString();
                    if (totals[dayObj] !== undefined) {
                        totals[dayObj] += t.amount;
                        this.totalExpenses += t.amount;
                    }
                } else if (t.type === 'income') {
                    this.totalIncome += t.amount;
                }
            }
        });

        return days.map(day => ({
            period: day,
            value: totals[day]
        }));
    }

    private processYearlyTransactions(transactions: Transaction[]) {
        // const year = dayjs().year(); // In yearly view, usually we show current year or selected year
        // We can respect selectedYear if needed, usually 'this-year' implies current year.
        // But let's use the year from filters if available, or current year.
        const targetYear = this.selectedYear || dayjs().year();

        const months = dayjs.monthsShort();
        const totals: { [month: string]: number } = {};
        months.forEach(m => totals[m] = 0);

        this.resetTotals();

        transactions.forEach(t => {
            const txDate = dayjs(this.convertToDate(t.date));
            if (txDate.year() === targetYear) {
                if (t.type === 'expense') {
                    const monthName = txDate.format('MMM');
                    if (totals[monthName] !== undefined) {
                        totals[monthName] += t.amount;
                        this.totalExpenses += t.amount;
                    }
                } else if (t.type === 'income') {
                    this.totalIncome += t.amount;
                }
            }
        });

        return months.map(month => ({
            period: month,
            value: totals[month]
        }));
    }

    private resetTotals() {
        this.totalIncome = 0;
        this.totalExpenses = 0;
    }

    private convertToDate(date: any): Date {
        if (date instanceof Date) return date;
        if (date?.seconds) return new Date(date.seconds * 1000);
        return new Date(date);
    }

    private updateChart(data: any[]) {
        this.chartData = data;
        this.maxChartValue = Math.max(...data.map(d => d.value), 0);
        this.cdr.markForCheck();
    }

    toggleViewMode(mode: 'trend' | 'category') {
        if (this.viewMode === mode) return;
        this.viewMode = mode;
        this.updateData();
    }

    toggleChartType(type: 'line' | 'bar') {
        if (this.chartType === type) return;
        this.chartType = type;
        this.cdr.markForCheck();
    }
}
