import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatChipsModule } from '@angular/material/chips';
import { TranslateModule } from '@ngx-translate/core';
import { Transaction } from '../../../../util/models/transaction.model';
import { NotificationService } from '../../../../util/service/notification.service';
import { Store } from '@ngrx/store';
import { AppState } from '../../../../store/app.state';
import * as CategoriesSelectors from '../../../../store/categories/categories.selectors';
import { selectAllTransactions } from '../../../../store/transactions/transactions.selectors';
import { Category } from '../../../../util/models';
import { Subscription, Observable } from 'rxjs';
import moment from 'moment';
import { DateService } from 'src/app/util/service/date.service';
import { FilterService } from '../../../../util/service/filter.service';

@Component({
  selector: 'search-filter',
  templateUrl: './search-filter.component.html',
  styleUrls: ['./search-filter.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatOptionModule,
    MatChipsModule,
    TranslateModule,
    FormsModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SearchFilterComponent implements OnInit, OnChanges, OnDestroy {
  // Remove the @Input() filteredCount property
  // @Input() filteredCount: number = 0;

  @Output() addTransaction = new EventEmitter<void>();
  @Output() importTransactions = new EventEmitter<void>();
  @Output() openFilterDialog = new EventEmitter<void>();
  @Output() viewAnalytics = new EventEmitter<void>();
  @Output() expandTable = new EventEmitter<void>();

  // Filter state from FilterService
  searchTerm: string = '';
  selectedCategory: string = 'all';
  selectedType: string = 'all';
  selectedYear: number = moment().year();
  selectedMonth: number = moment().month();
  selectedMonthOption: string = 'all';
  selectedDate: Date | null = null;
  selectedDateRange: { start: Date; end: Date } | null = null;
  isRecurring: boolean | null = null;

  categories: { id: string; name: string }[] = [];
  availableYears: number[] = [];
  months: { value: number; label: string }[] = [];
  currentYear: number;
  private subscription = new Subscription();

  // Store observables
  transactions$: Observable<Transaction[]> = this.store.select(selectAllTransactions);
  allTransactions: Transaction[] = [];

  // Computed filtered count from FilterService
  filteredCount: number = 0;

  constructor(
    private notificationService: NotificationService,
    private store: Store<AppState>,
    public dateService: DateService,
    private filterService: FilterService,
    private cdr: ChangeDetectorRef
  ) {
    this.currentYear = moment().year();
  }

  ngOnInit() {
    this.loadCategoriesFromStore();
    this.setupTransactionSubscriptions();
    this.updateAvailableYears();
    this.updateMonths();
    this.setupFilterServiceSubscriptions();
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  ngOnChanges(changes: SimpleChanges) {
    // Update available years and categories when transactions change
    if (changes['transactions']) {
      this.updateAvailableYears();
      this.updateCategoriesFromTransactions();
    }
  }

  private setupTransactionSubscriptions() {
    // Subscribe to transactions from store
    this.subscription.add(
      this.transactions$.subscribe(transactions => {
        this.allTransactions = transactions;
        this.updateAvailableYears();
        this.updateCategoriesFromTransactions();
        this.updateFilteredCount();
        this.cdr.markForCheck();
      })
    );
  }

  private setupFilterServiceSubscriptions() {
    // Subscribe to FilterService state changes
    this.subscription.add(
      this.filterService.searchTerm$.subscribe(searchTerm => {
        this.searchTerm = searchTerm;
        this.updateFilteredCount();
        this.cdr.markForCheck();
      })
    );

    this.subscription.add(
      this.filterService.selectedCategory$.subscribe(categories => {
        this.selectedCategory = categories.includes('all') ? 'all' : categories[0] || 'all';
        this.updateFilteredCount();
        this.cdr.markForCheck();
      })
    );

    this.subscription.add(
      this.filterService.selectedType$.subscribe(type => {
        this.selectedType = type;
        this.updateFilteredCount();
        this.cdr.markForCheck();
      })
    );

    this.subscription.add(
      this.filterService.selectedDate$.subscribe(date => {
        this.selectedDate = date;
        if (date) {
          this.selectedDateRange = null;
        }
        this.updateFilteredCount();
        this.cdr.markForCheck();
      })
    );

    this.subscription.add(
      this.filterService.selectedDateRange$.subscribe(dateRange => {
        this.selectedDateRange = dateRange ? {
          start: dateRange.startDate,
          end: dateRange.endDate
        } : null;
        if (dateRange) {
          this.selectedDate = null;
        }
        this.updateFilteredCount();
        this.cdr.markForCheck();
      })
    );

    this.subscription.add(
      this.filterService.selectedYear$.subscribe(yearRange => {
        if (yearRange) {
          this.selectedYear = yearRange.startYear;
        }
        this.updateFilteredCount();
        this.cdr.markForCheck();
      })
    );

    this.subscription.add(
      this.filterService.isRecurring$.subscribe(isRecurring => {
        this.isRecurring = isRecurring;
        this.updateFilteredCount();
        this.cdr.markForCheck();
      })
    );
  }

  private loadCategoriesFromStore() {
    this.subscription.add(
      this.store.select(CategoriesSelectors.selectAllCategories).subscribe((categories: Category[]) => {
        this.categories = categories.map(category => ({
          id: category.id || '',
          name: category.name
        })).sort((a, b) => a.name.localeCompare(b.name));
        this.cdr.markForCheck();
      })
    );
  }

  private updateCategoriesFromTransactions() {
    // Update categories based on actual transaction data
    if (this.allTransactions && this.allTransactions.length > 0) {
      const categoriesSet = new Set<string>();
      const categoryMap = new Map<string, string>();

      this.allTransactions.forEach(tx => {
        if (tx.categoryId && tx.category) {
          categoriesSet.add(tx.categoryId);
          categoryMap.set(tx.categoryId, tx.category);
        }
      });

      // Convert to array and sort
      this.categories = Array.from(categoriesSet).map(id => ({
        id: id,
        name: categoryMap.get(id) || 'Unknown'
      })).sort((a, b) => a.name.localeCompare(b.name));
    } else {
      this.categories = [];
    }
  }

  private updateAvailableYears() {
    // Extract unique years from transaction data
    if (this.allTransactions && this.allTransactions.length > 0) {
      const yearsSet = new Set<number>();

      this.allTransactions.forEach(tx => {
        if (tx.date) {
          const year = moment(this.dateService.toDate(tx.date)).year();
          yearsSet.add(year);
        }
      });

      // Add current year if not present in transactions
      yearsSet.add(this.currentYear);

      // Convert to array, sort in descending order (newest first)
      this.availableYears = Array.from(yearsSet).sort((a, b) => b - a);
    } else {
      // Fallback to current year if no transactions
      this.availableYears = [this.currentYear];
    }

    // Ensure selected year is valid
    if (isNaN(this.selectedYear) || !this.availableYears.includes(this.selectedYear)) {
      this.selectedYear = this.availableYears.length > 0 ? this.availableYears[0] : this.currentYear;
    }
  }

  private updateMonths() {
    this.months = [
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
  }

  private updateFilteredCount() {
    // Check if we have specific date filters applied
    const hasDateFilters = this.filterService.getSelectedDate() ||
      this.filterService.getSelectedDateRange() ||
      this.filterService.getSelectedYear();

    if (!hasDateFilters) {
      // Filter to show only current year transactions when no specific date filter is applied
      this.filteredCount = this.filterService.getCurrentYearFilteredCount(
        this.allTransactions,
        this.filterService.getCurrentFilterState()
      );
    } else {
      // Use all filters including date filters
      this.filteredCount = this.filterService.getFilteredCount(
        this.allTransactions,
        this.filterService.getCurrentFilterState()
      );
    }
  }

  onSearchChange(value: any) {
    const searchValue = value;
    this.filterService.setSearchTerm(searchValue);
  }

  onCategoryChange(value: any) {
    const category = value;
    this.filterService.setSelectedCategory([category]);
  }

  onTypeChange(value: any) {
    const type = value;
    this.filterService.setSelectedType(type);
  }

  onSelectedYearChange(value: any) {
    const year = value;
    this.selectedYear = year;

    // If a specific month is selected, update the date range for the new year
    if (this.selectedMonthOption !== 'all') {
      const month = parseInt(this.selectedMonthOption);
      const startDate = moment().year(year).month(month).startOf('month').toDate();
      const endDate = moment().year(year).month(month).endOf('month').toDate();
      this.filterService.setSelectedDateRange(startDate, endDate);
    } else {
      // Use the year selection method
      this.filterService.setSelectedYear(year, year);
    }
  }

  onSelectedMonthChange(monthValue: string) {
    this.selectedMonthOption = monthValue;
    if (monthValue !== 'all') {
      // When a specific month is selected, set the date range for that month
      const month = parseInt(monthValue);
      const startDate = moment().year(this.selectedYear).month(month).startOf('month').toDate();
      const endDate = moment().year(this.selectedYear).month(month).endOf('month').toDate();
      this.filterService.setSelectedDateRange(startDate, endDate);
    } else {
      // When "all" is selected, clear date filters but keep year filter
      this.filterService.clearSelectedDate();
      // Restore year filter when switching back to "all months"
      this.filterService.setSelectedYear(this.selectedYear, this.selectedYear);
    }
  }

  onAddTransaction() {
    this.addTransaction.emit();
  }

  onImportTransactions() {
    this.importTransactions.emit();
  }

  onOpenFilterDialog() {
    this.openFilterDialog.emit();
  }

  onViewAnalytics() {
    this.viewAnalytics.emit();
  }

  onExpandTable() {
    this.expandTable.emit();
  }

  onClearAllFilters() {
    this.filterService.clearAllFilters();
    // Reset local state
    this.selectedDateRange = null;
    this.selectedDate = null;
    this.searchTerm = '';
    this.selectedCategory = 'all';
    this.selectedType = 'all';
    this.selectedYear = this.availableYears.length > 0 ? this.availableYears[0] : this.currentYear;
    this.selectedMonthOption = 'all';
    this.isRecurring = null;
  }

  onClearSearchFilter() {
    this.filterService.clearSearchTerm();
  }

  onClearYearFilter() {
    // Reset to current year or first available year
    const resetYear = this.availableYears.length > 0 ? this.availableYears[0] : this.currentYear;
    this.selectedYear = resetYear;
    this.filterService.setSelectedYear(this.selectedYear, this.selectedYear);
    if (this.selectedMonthOption !== 'all') {
      this.filterService.setSelectedDateRange(moment().year(this.selectedYear).startOf('year').toDate(), moment().year(this.selectedYear).endOf('year').toDate());
    }
  }

  onClearMonthFilter() {
    this.selectedMonthOption = 'all';
    this.filterService.clearSelectedDate();
    // Restore year filter when clearing month filter
    this.filterService.setSelectedYear(this.selectedYear, this.selectedYear);
  }

  onClearCategoryFilter() {
    this.filterService.clearSelectedCategory();
  }

  onClearTypeFilter() {
    this.filterService.clearSelectedType();
  }

  onClearDateRangeFilter() {
    this.filterService.clearSelectedDate();
    this.filterService.clearSelectedYear();
  }

  onClearDateFilter() {
    this.filterService.clearSelectedDate();
    this.filterService.clearSelectedYear();
  }

  onClearRecurringFilter() {
    this.filterService.clearIsRecurring();
  }

  getActiveFilters() {
    const filters = [];
    const defaultYear = this.availableYears.length > 0 ? this.availableYears[0] : this.currentYear;

    if (this.searchTerm) {
      filters.push({
        type: 'search',
        label: `Search: "${this.searchTerm}"`,
        onRemove: () => this.onClearSearchFilter()
      });
    }

    // Handle year filter
    if (this.selectedYear !== defaultYear) {
      filters.push({
        type: 'year',
        label: `Year: ${this.selectedYear}`,
        onRemove: () => this.onClearYearFilter()
      });
    }

    // Handle month filter separately
    if (this.selectedMonthOption !== 'all') {
      const monthLabel = this.months.find(m => m.value === parseInt(this.selectedMonthOption))?.label;
      filters.push({
        type: 'month',
        label: `Month: ${monthLabel}`,
        onRemove: () => this.onClearMonthFilter()
      });
    }

    if (this.selectedCategory !== 'all') {
      const categoryName = this.categories.find(c => c.id === this.selectedCategory)?.name;
      filters.push({
        type: 'category',
        label: `Category: ${categoryName || 'Unknown'}`,
        onRemove: () => this.onClearCategoryFilter()
      });
    }

    if (this.selectedType !== 'all') {
      filters.push({
        type: 'type',
        label: `Type: ${this.selectedType}`,
        onRemove: () => this.onClearTypeFilter()
      });
    }

    if (this.selectedDateRange) {
      filters.push({
        type: 'dateRange',
        label: `Date Range: ${this.selectedDateRange.start.toLocaleDateString()} - ${this.selectedDateRange.end.toLocaleDateString()}`,
        onRemove: () => this.onClearDateRangeFilter()
      });
    }

    if (this.selectedDate) {
      filters.push({
        type: 'date',
        label: `Date: ${this.selectedDate.toLocaleDateString()}`,
        onRemove: () => this.onClearDateFilter()
      });
    }

    if (this.isRecurring) {
      filters.push({
        type: 'recurring',
        label: 'Type: Recurring',
        onRemove: () => this.onClearRecurringFilter()
      });
    }

    return filters;
  }

  hasActiveFilters(): boolean {
    return this.filterService.hasActiveFilters();
  }

  // FilterService interaction methods
  getActiveFiltersCount(): number {
    return this.filterService.getActiveFiltersCount();
  }

  getCurrentFilterState() {
    return this.filterService.getCurrentFilterState();
  }

  saveFilterPreset(name: string, description: string): void {
    this.filterService.saveAsPreset(name, description);
  }

  applyFilterPreset(presetId: string): void {
    this.filterService.applyPreset(presetId);
  }

  getFilterPresets() {
    return this.filterService.filterPresets$;
  }

  getFilterHistory() {
    return this.filterService.filterHistory$;
  }
} 