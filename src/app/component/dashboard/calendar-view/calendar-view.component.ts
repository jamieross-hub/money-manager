import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, OnInit, OnDestroy, ViewChild, Inject, NgZone, PLATFORM_ID, ChangeDetectionStrategy, inject, effect } from '@angular/core';
import { MatCalendar, MatCalendarCellClassFunction } from '@angular/material/datepicker';
import { UserService } from '../../../util/service/db/user.service';
import { FilterService } from '../../../util/service/filter.service';
import { NotificationService } from '../../../util/service/notification.service';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatNativeDateModule } from '@angular/material/core';
import { TotalBalanceComponent } from 'src/app/util/components/cards/total-balance/total-balance.component';

import { Subscription } from 'rxjs';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { DateService } from 'src/app/util/service/date.service';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import * as TransactionsSelectors from '../../../store/transactions/transactions.selectors';
import * as CategoriesSelectors from '../../../store/categories/categories.selectors';
import { Transaction } from 'src/app/util/models/transaction.model';
import { Category } from 'src/app/util/models/category.model';
import { TransactionType } from 'src/app/util/config/enums';

dayjs.extend(isBetween);

@Component({
  selector: 'calendar-view',
  templateUrl: './calendar-view.component.html',
  styleUrl: './calendar-view.component.scss',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatSelectModule,
    MatNativeDateModule,
    TotalBalanceComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarViewComponent implements OnInit, OnDestroy {

  @ViewChild('calendar') calendar!: MatCalendar<Date>;

  isMobile = false;
  transactions: Transaction[] = [];
  categories: Category[] = [];
  selectedDate: Date | null = null;
  selectedDateTransactions: Transaction[] = [];


  // Date range selection properties
  isRangeMode = false;
  startDate: Date | null = null;
  endDate: Date | null = null;
  rangeTransactions: Transaction[] = [];

  // Collapsible controls
  isControlsExpanded = false;

  // AmCharts removed
  // private root: am5.Root | undefined;
  // private chart: am5radar.RadarChart | undefined;
  // private series1: am5radar.RadarColumnSeries | undefined;
  // private series2: am5radar.RadarColumnSeries | undefined;
  chartContainerId = 'calendar-gauge-chart';
  showPieChart = false;
  showCalendar = true;
  // chartViewMode: 'income-expense' | 'category' = 'category'; // Removed as part of AmCharts removal

  // Calendar navigation
  currentViewDate = new Date();

  // Date filter options
  selectedYear = new Date().getFullYear();
  selectedMonth = new Date().getMonth();
  availableYears: number[] = [];
  availableMonths = [
    { value: 0, label: 'January' },
    { value: 1, label: 'February' },
    { value: 2, label: 'March' },
    { value: 3, label: 'April' },
    { value: 4, label: 'May' },
    { value: 5, label: 'June' },
    { value: 6, label: 'July' },
    { value: 7, label: 'August' },
    { value: 8, label: 'September' },
    { value: 9, label: 'October' },
    { value: 10, label: 'November' },
    { value: 11, label: 'December' }
  ];

  // Premium color palette - Removed as part of AmCharts removal
  // private premiumColors: string[] = [
  //   '#6366F1', // Indigo
  //   '#8B5CF6', // Violet
  //   '#EC4899', // Pink
  //   '#EF4444', // Red
  //   '#F97316', // Orange
  //   '#EAB308', // Yellow
  //   '#22C55E', // Green
  //   '#06B6D4', // Cyan
  //   '#3B82F6', // Blue
  //   '#84CC16', // Lime
  //   '#F59E0B', // Amber
  //   '#10B981', // Emerald
  //   '#8B5A2B', // Brown
  //   '#6B7280', // Gray
  //   '#1F2937', // Dark Gray
  //   '#DC2626'  // Dark Red
  // ];

  private subscription = new Subscription();

  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly filterService = inject(FilterService);
  private readonly notificationService = inject(NotificationService);
  private readonly dateService = inject(DateService);
  private readonly store = inject(Store<AppState>);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly zone = inject(NgZone);

  constructor() {
    this.breakpointObserver.observe(['(max-width: 600px)']).subscribe(result => {
      this.isMobile = result.matches;
    });

    effect(() => {
      const yearRange = this.filterService.selectedYear();
      if (yearRange) {
        const newYear = yearRange.startYear;
        if (this.selectedYear !== newYear) {
          this.selectedYear = newYear;
          const currentMonth = dayjs(this.currentViewDate).month();
          this.currentViewDate = dayjs(new Date(newYear, currentMonth, 1)).toDate();
          if (this.calendar) {
            this.calendar.activeDate = this.currentViewDate;
          }
        }
      }
      this.updatePieChart();
    });

    effect(() => {
      const dateRange = this.filterService.selectedDateRange();
      if (dateRange) {
        const startMoment = dayjs(dateRange.startDate);
        const endMoment = dayjs(dateRange.endDate);

        this.selectedYear = startMoment.year();

        if (startMoment.isSame(startMoment.clone().startOf('month')) &&
          endMoment.isSame(endMoment.clone().endOf('month')) &&
          startMoment.month() === endMoment.month()) {
          this.selectedMonth = startMoment.month();
          this.currentViewDate = startMoment.toDate();
          if (this.calendar) {
            this.calendar.activeDate = this.currentViewDate;
          }
        }
      }
      this.updatePieChart();
    });
  }

  ngOnInit() {
    this.loadTransactions();
    this.loadCategories();
    this.generateAvailableYears();
  }

  ngAfterViewInit() {
    this.browserOnly(() => {
      // this.initializeChart(); // Removed as part of AmCharts removal
    });
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
    this.browserOnly(() => {
      // if (this.root) {
      //   this.root.dispose();
      // } // Removed as part of AmCharts removal
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

  // Method removed
  private initializeChart(): void {
  }

  loadTransactions() {
    this.subscription.add(
      this.store.select(TransactionsSelectors.selectAllTransactions).subscribe({
        next: (transactions) => {
          this.transactions = transactions;
          // this.updatePieChart(); // Removed as part of AmCharts removal
          this.updateCalendar();
        },
        error: (error) => {
          console.error('Error loading transactions:', error);
          this.notificationService.error('Failed to load calendar data');
        }
      })
    );
  }

  loadCategories() {
    this.subscription.add(
      this.store.select(CategoriesSelectors.selectAllCategories).subscribe({
        next: (categories) => {
          this.categories = categories;
          this.updatePieChart();
        },
        error: (error) => {
          console.error('Error loading categories:', error);
        }
      })
    );
  }

  generateAvailableYears() {
    const currentYear = new Date().getFullYear();
    this.availableYears = [];
    for (let year = currentYear - 5; year <= currentYear + 1; year++) {
      this.availableYears.push(year);
    }
  }

  // Method removed
  updatePieChart() {
  }

  // Method removed
  updateCategoryChart() {
  }

  // Apply category filter to transaction list
  applyCategoryFilter(categoryId: string) {
    // Find the category name for display
    const category = this.categories.find(c => c.id === categoryId);
    const categoryName = category ? category.name : categoryId;

    // Set category filter using the FilterService
    this.filterService.selectedCategory.set([categoryId]);

    // Also set the date range to the current month/year for context
    const startDate = dayjs(new Date(this.selectedYear, this.selectedMonth, 1)).startOf('month').toDate();
    const endDate = dayjs(new Date(this.selectedYear, this.selectedMonth, 1)).endOf('month').toDate();
    this.filterService.selectedDateRange.set({ startDate, endDate });

    // Show success notification
    this.notificationService.info(`Filtering transactions for ${categoryName} in ${this.availableMonths[this.selectedMonth].label} ${this.selectedYear}`);
  }

  // Method removed
  updateIncomeExpenseChart() {
  }

  // Get filtered transactions based on year/month selection
  getFilteredTransactions(): Transaction[] {
    const startOfMonth = dayjs(new Date(this.selectedYear, this.selectedMonth, 1));
    const endOfMonth = dayjs(startOfMonth).endOf('month');

    return this.transactions.filter(transaction => {
      const transactionDate = dayjs(this.dateService.toDate(transaction.date));
      return transactionDate.isBetween(startOfMonth, endOfMonth, 'day', '[]') &&
        transaction.type === 'expense';
    });
  }

  // Get category-wise spending data
  getCategorySpendingData(transactions: Transaction[]): any[] {
    const categoryMap = new Map<string, { name: string; id: string; amount: number }>();

    transactions.forEach(transaction => {
      const categoryId = transaction.categoryId;
      const category = this.categories.find(c => c.id === categoryId);
      const categoryName = category ? category.name : '';

      if (categoryName && categoryId) {
        if (categoryMap.has(categoryId)) {
          const existing = categoryMap.get(categoryId)!;
          existing.amount += transaction.amount;
        } else {
          categoryMap.set(categoryId, {
            name: categoryName,
            id: categoryId,
            amount: transaction.amount
          });
        }
      }
    });

    // Find the maximum amount to set as the gauge scale
    const maxAmount = Math.max(...Array.from(categoryMap.values()).map(category => category.amount), 1);

    // Convert to chart data format with actual amounts
    return Array.from(categoryMap.values()).map((category, index) => ({
      name: category.name,
      categoryId: category.id,
      value: category.amount,
      maxValue: maxAmount,
      itemStyle: { color: this.getCategoryColor(category.id) }
    }));
  }

  // Helper to get a consistent color for a category
  getCategoryColor(categoryId: string): string {
    // This is a placeholder. In a real app, you'd have a more robust color assignment.
    // For now, we'll use a simple hash-based approach or a predefined list.
    const colors = ['#6366f1', '#f97316', '#10b981', '#ef4444', '#eab308', '#a855f7', '#06b6d4', '#f43f5e'];
    let hash = 0;
    for (let i = 0; i < categoryId.length; i++) {
      hash = categoryId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash % colors.length);
    return colors[index];
  }

  // Toggle pie chart visibility
  togglePieChart() {
    this.showPieChart = !this.showPieChart;
    // Chart toggle logic removed
  }

  // Toggle calendar visibility
  toggleCalendar() {
    this.showCalendar = !this.showCalendar;
    this.showPieChart = !this.showCalendar;
  }

  // Toggle chart view mode
  toggleChartViewMode() {
    // Logic removed
  }

  // Handle year change
  onYearChange(year: number) {
    this.selectedYear = year;
    this.updatePieChart();
  }

  // Handle month change
  onMonthChange(month: number) {
    this.selectedMonth = month;
    this.updatePieChart();
  }

  // Calendar navigation methods
  goToPreviousMonth() {
    this.currentViewDate = dayjs(this.currentViewDate).subtract(1, 'month').toDate();
    if (this.calendar) {
      this.calendar.activeDate = this.currentViewDate;
    }
  }

  goToNextMonth() {
    this.currentViewDate = dayjs(this.currentViewDate).add(1, 'month').toDate();
    if (this.calendar) {
      this.calendar.activeDate = this.currentViewDate;
    }
  }

  goToToday() {
    this.currentViewDate = new Date();
    if (this.calendar) {
      this.calendar.activeDate = this.currentViewDate;
    }
  }

  // Custom date class function to highlight dates with transactions and range selection using dayjs
  dateClass: MatCalendarCellClassFunction<Date> = (cellDate, view) => {
    if (view === 'month') {
      const cellMoment = dayjs(cellDate).startOf('day');
      let classes = '';

      // Check if date has transactions
      const isIncomeTx = this.transactions.some(transaction => {
        const transactionMoment = dayjs(this.dateService.toDate(transaction.date)).startOf('day');
        return transactionMoment.isSame(cellMoment, 'day') && transaction.type === TransactionType.INCOME;
      });

      const hasTransactions = this.transactions.some(transaction => {
        const transactionMoment = dayjs(this.dateService.toDate(transaction.date)).startOf('day');
        return transactionMoment.isSame(cellMoment, 'day');
      });

      if (hasTransactions) {
        if (isIncomeTx) {
          classes += 'has-transactions has-income ';
        } else {
          classes += 'has-transactions has-expense ';
        }
      }

      // Range mode highlighting
      if (this.isRangeMode) {
        if (this.startDate && dayjs(this.startDate).startOf('day').isSame(cellMoment, 'day')) {
          classes += 'range-start ';
        }
        if (this.endDate && dayjs(this.endDate).startOf('day').isSame(cellMoment, 'day')) {
          classes += 'range-end ';
        }
        if (this.startDate && this.endDate) {
          const startMoment = dayjs(this.startDate).startOf('day');
          const endMoment = dayjs(this.endDate).endOf('day');
          if (cellMoment.isBetween(startMoment, endMoment, 'day', '[]')) {
            classes += 'range-in-between ';
          }
        }
      } else {
        // Single date mode highlighting
        if (this.selectedDate && dayjs(this.selectedDate).startOf('day').isSame(cellMoment, 'day')) {
          classes += 'selected-date ';
        }
      }

      return classes.trim();
    }
    return '';
  }

  // Handle date selection
  onDateSelected(date: Date | null) {
    if (this.isRangeMode) {
      this.handleRangeSelection(date);
    } else {
      this.handleSingleDateSelection(date);
    }
    this.updatePieChart();
  }

  // Handle single date selection
  private handleSingleDateSelection(date: Date | null) {
    this.selectedDate = date;
    if (date) {
      this.selectedDateTransactions = this.getTransactionsForDate(date);
      // Emit selected date to other components
      this.filterService.selectedDate.set(date);
    } else {
      this.selectedDateTransactions = [];
      this.filterService.selectedDate.set(null);
    }
  }

  // Handle date range selection
  private handleRangeSelection(date: Date | null) {
    if (!date) return;

    if (!this.startDate || (this.startDate && this.endDate)) {
      // Start new range
      this.startDate = date;
      this.endDate = null;
      this.rangeTransactions = [];
    } else {
      // Complete the range
      if (date >= this.startDate) {
        this.endDate = date;
      } else {
        // If end date is before start date, swap them
        this.endDate = this.startDate;
        this.startDate = date;
      }
      this.rangeTransactions = this.getTransactionsForDateRange(this.startDate, this.endDate);
      // Emit date range to other components
      this.filterService.selectedDateRange.set({ startDate: this.startDate, endDate: this.endDate });
    }
  }

  // Get transactions for a specific date using dayjs
  getTransactionsForDate(date: Date): Transaction[] {
    const targetMoment = dayjs(date).startOf('day');

    return this.transactions.filter(transaction => {
      const transactionMoment = dayjs(this.dateService.toDate(transaction.date)).startOf('day');
      return transactionMoment.isSame(targetMoment, 'day');
    });
  }

  // Get transactions for a date range using dayjs
  getTransactionsForDateRange(startDate: Date, endDate: Date): Transaction[] {
    const startMoment = dayjs(startDate).startOf('day');
    const endMoment = dayjs(endDate).endOf('day');

    return this.transactions.filter(transaction => {
      const transactionMoment = dayjs(this.dateService.toDate(transaction.date));
      return transactionMoment.isBetween(startMoment, endMoment, 'day', '[]'); // inclusive
    });

  }

  // Format date to string for comparison using dayjs
  private formatDate(date: Date): string {
    return dayjs(date).format('YYYY-MM-DD');
  }

  // Get total income for selected date
  getTotalIncome(): number {
    return this.selectedDateTransactions
      .filter(t => t.type === TransactionType.INCOME)
      .reduce((sum, t) => sum + t.amount, 0);
  }

  // Get total expenses for selected date
  getTotalExpenses(): number {
    return this.selectedDateTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  }

  // Get net amount for selected date
  getNetAmount(): number {
    return this.getTotalIncome() - this.getTotalExpenses();
  }

  // Toggle between single date and range mode
  toggleRangeMode(): void {
    this.isRangeMode = !this.isRangeMode;
    this.clearSelections();
  }

  // Toggle controls visibility
  toggleControls(): void {
    this.isControlsExpanded = !this.isControlsExpanded;
  }

  // Check if any date is selected
  hasSelection(): boolean {
    if (this.isRangeMode) {
      return this.startDate !== null || this.endDate !== null;
    } else {
      return this.selectedDate !== null;
    }
  }

  // Clear all selections
  clearSelections(): void {
    this.selectedDate = null;
    this.selectedDateTransactions = [];
    this.startDate = null;
    this.endDate = null;
    this.rangeTransactions = [];
    this.filterService.selectedDate.set(null);
    this.updatePieChart();
  }

  // Get total income for date range
  getRangeTotalIncome(): number {
    return this.rangeTransactions
      .filter(t => t.type === TransactionType.INCOME)
      .reduce((sum, t) => sum + t.amount, 0);
  }

  // Get total expenses for date range
  getRangeTotalExpenses(): number {
    return this.rangeTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  }

  // Get net amount for date range
  getRangeNetAmount(): number {
    return this.getRangeTotalIncome() - this.getRangeTotalExpenses();
  }

  // Utility method to get formatted date range string
  getFormattedDateRange(): string {
    if (!this.startDate || !this.endDate) {
      return '';
    }

    const startMoment = dayjs(this.startDate);
    const endMoment = dayjs(this.endDate);

    if (startMoment.isSame(endMoment, 'day')) {
      return startMoment.format('MMM DD, YYYY');
    } else if (startMoment.isSame(endMoment, 'year')) {
      return `${startMoment.format('MMM DD')} - ${endMoment.format('MMM DD, YYYY')}`;
    } else {
      return `${startMoment.format('MMM DD, YYYY')} - ${endMoment.format('MMM DD, YYYY')}`;
    }
  }

  // Utility method to get number of days in range
  getDaysInRange(): number {
    if (!this.startDate || !this.endDate) {
      return 0;
    }

    const startMoment = dayjs(this.startDate);
    const endMoment = dayjs(this.endDate);
    return endMoment.diff(startMoment, 'day') + 1; // +1 to include both start and end dates
  }

  // Utility method to check if a date is today
  isToday(date: Date): boolean {
    return dayjs(date).isSame(dayjs(), 'day');
  }

  // Utility method to check if a date is in the past
  isPastDate(date: Date): boolean {
    return dayjs(date).isBefore(dayjs(), 'day');
  }

  // Utility method to check if a date is in the future
  isFutureDate(date: Date): boolean {
    return dayjs(date).isAfter(dayjs(), 'day');
  }

  clearAll() {
    this.clearSelections();
    this.isControlsExpanded = this.isRangeMode = false;
    this.filterService.selectedDate.set(null);
  }

  private subscribeToFilterService() {
    // Handled by effects in constructor
  }

  updateCalendar() {
    if (this.calendar) {
      this.calendar.updateTodaysDate();
    }
  }

}
