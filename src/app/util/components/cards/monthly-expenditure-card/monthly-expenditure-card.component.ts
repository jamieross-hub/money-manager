import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID, NgZone, AfterViewInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Store } from '@ngrx/store';
import { Subscription, combineLatest } from 'rxjs';
import { AppState } from '../../../../store/app.state';
import * as TransactionsSelectors from '../../../../store/transactions/transactions.selectors';
import { Transaction } from '../../../models/transaction.model';
import { FilterService } from '../../../service/filter.service';
import moment from 'moment';
import { CurrencyPipe } from 'src/app/util/pipes';
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { AppViewService } from '../../../../util/service/app-view.service';

@Component({
    selector: 'app-monthly-expenditure-card',
    standalone: true,
    imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule, MatTooltipModule, CurrencyPipe],
    templateUrl: './monthly-expenditure-card.component.html',
    styleUrl: './monthly-expenditure-card.component.scss'
})
export class MonthlyExpenditureCardComponent implements OnInit, OnDestroy, AfterViewInit {
    chartId = 'daily-trend-chart-' + Math.random().toString(36).substr(2, 9);
    private root: am5.Root | undefined;
    private series: am5xy.XYSeries | undefined;
    private xAxis: am5xy.CategoryAxis<any> | undefined;

    chartType: 'line' | 'bar' = 'line';
    totalIncome = 0;
    totalExpenses = 0;

    selectedYear = moment().year();
    selectedMonth = moment().month();

    currentView: 'WEEKLY' | 'MONTHLY' | 'YEARLY' = 'MONTHLY';
    chartTitle = 'Monthly Expenditure';
    chartFooter = 'Expenditure per month';

    private subscription = new Subscription();

    constructor(
        private store: Store<AppState>,
        private filterService: FilterService,
        @Inject(PLATFORM_ID) private platformId: Object,
        private zone: NgZone,
        private appViewService: AppViewService
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
                    const start = moment(dateRange.startDate);
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
                this.initChart();
                this.subscribeToData();
            }, 100);
        });
    }

    ngOnDestroy(): void {
        this.subscription.unsubscribe();
        this.browserOnly(() => {
            if (this.root) {
                this.root.dispose();
            }
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

    private initChart() {
        //this.chartId = 'daily-trend-chart-' + Math.random().toString(36).substr(2, 9);
        this.root = am5.Root.new(this.chartId);
        this.root.setThemes([am5themes_Animated.new(this.root)]);

        const chart = this.root.container.children.push(
            am5xy.XYChart.new(this.root, {
                panX: false,
                panY: false,
                wheelX: "none",
                wheelY: "none",
                layout: this.root.verticalLayout
            })
        );

        const xRenderer = am5xy.AxisRendererX.new(this.root, {
            minGridDistance: 30,
            cellStartLocation: 0.1,
            cellEndLocation: 0.9
        });

        xRenderer.grid.template.set("visible", false);
        xRenderer.labels.template.setAll({
            fontSize: 10,
            fill: am5.color(0x9ca3af)
        });

        this.xAxis = chart.xAxes.push(
            am5xy.CategoryAxis.new(this.root, {
                categoryField: "period",
                renderer: xRenderer,
                tooltip: am5.Tooltip.new(this.root, {})
            })
        );

        const yRenderer = am5xy.AxisRendererY.new(this.root, {});
        yRenderer.grid.template.setAll({
            strokeDasharray: [3, 3],
            strokeOpacity: 0.2
        });
        yRenderer.labels.template.setAll({
            fontSize: 10,
            fill: am5.color(0x9ca3af)
        });

        const yAxis = chart.yAxes.push(
            am5xy.ValueAxis.new(this.root, {
                renderer: yRenderer,
                min: 0
            })
        );

        this.renderSeries(chart, yAxis);

        chart.set("cursor", am5xy.XYCursor.new(this.root, {
            behavior: "none",
            xAxis: this.xAxis
        }));

        chart.appear(1000, 100);
    }

    private renderSeries(chart: am5xy.XYChart, yAxis: am5xy.ValueAxis<any>) {
        if (this.chartType === 'line') {
            const series = chart.series.push(
                am5xy.LineSeries.new(this.root!, {
                    name: "Expenditure",
                    xAxis: this.xAxis!,
                    yAxis: yAxis,
                    valueYField: "value",
                    categoryXField: "period",
                    stroke: am5.color(0x0d9488),
                    tooltip: am5.Tooltip.new(this.root!, {
                        labelText: "{valueY}"
                    })
                })
            );

            series.fills.template.setAll({
                fillOpacity: 0.1,
                visible: true,
                fill: am5.color(0x0d9488)
            });

            series.strokes.template.setAll({
                strokeWidth: 3
            });

            series.set("fill", am5.color(0x0d9488));

            // Smooth the line
            series.set("curveFactory", (am5 as any).curveBasis);

            this.series = series;
        } else {
            const series = chart.series.push(
                am5xy.ColumnSeries.new(this.root!, {
                    name: "Expenditure",
                    xAxis: this.xAxis!,
                    yAxis: yAxis,
                    valueYField: "value",
                    categoryXField: "period",
                    fill: am5.color(0x0d9488),
                    stroke: am5.color(0x0d9488),
                    tooltip: am5.Tooltip.new(this.root!, {
                        labelText: "{valueY}"
                    })
                })
            );

            series.columns.template.setAll({
                cornerRadiusTL: 5,
                cornerRadiusTR: 5,
                width: am5.percent(70)
            });

            this.series = series;
        }
    }

    private subscribeToData() {
        this.subscription.add(
            this.store.select(TransactionsSelectors.selectAllTransactions).subscribe(transactions => {
                const dailyData = this.processTransactions(transactions);
                this.updateChart(dailyData);
            })
        );
    }

    private updateData() {
        // Manual trigger for data update when filters change
        this.store.select(TransactionsSelectors.selectAllTransactions).subscribe(transactions => {
            const dailyData = this.processTransactions(transactions);
            this.updateChart(dailyData);
        }).unsubscribe();
    }

    private processTransactions(transactions: Transaction[]) {
        if (this.currentView === 'WEEKLY') {
            return this.processWeeklyTransactions(transactions);
        } else if (this.currentView === 'YEARLY') {
            return this.processYearlyTransactions(transactions);
        } else {
            return this.processMonthlyTransactions(transactions);
        }
    }

    private processWeeklyTransactions(transactions: Transaction[]) {
        const startOfWeek = moment().startOf('week');
        const endOfWeek = moment().endOf('week');
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const totals: { [day: string]: number } = {};
        days.forEach(d => totals[d] = 0);

        this.resetTotals();

        transactions.forEach(t => {
            const txDate = moment(this.convertToDate(t.date));
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
        const startOfMonth = moment().startOf('month');
        const endOfMonth = moment().endOf('month');
        const daysInMonth = startOfMonth.daysInMonth();
        const days: string[] = [];
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(i.toString());
        }

        const totals: { [day: string]: number } = {};
        days.forEach(d => totals[d] = 0);

        this.resetTotals();

        transactions.forEach(t => {
            const txDate = moment(this.convertToDate(t.date));
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
        const year = moment().year(); // In yearly view, usually we show current year or selected year
        // We can respect selectedYear if needed, usually 'this-year' implies current year.
        // But let's use the year from filters if available, or current year.
        const targetYear = this.selectedYear || moment().year();

        const months = moment.monthsShort();
        const totals: { [month: string]: number } = {};
        months.forEach(m => totals[m] = 0);

        this.resetTotals();

        transactions.forEach(t => {
            const txDate = moment(this.convertToDate(t.date));
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
        this.browserOnly(() => {
            if (this.series && this.xAxis) {
                this.series.data.setAll(data);
                this.xAxis.data.setAll(data);
            }
        });
    }

    toggleChartType(type: 'line' | 'bar') {
        if (this.chartType === type) return;
        this.chartType = type;

        this.browserOnly(() => {
            if (this.root) {
                this.root.dispose();
                this.initChart();
                this.updateData();
            }
        });
    }
}
