import { Component, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectionStrategy, signal, computed, effect, inject } from '@angular/core';

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
import { Store } from '@ngrx/store';
import { AppState } from '../../../../store/app.state';
import * as CategoriesSelectors from '../../../../store/categories/categories.selectors';
import { selectAllTransactions } from '../../../../store/transactions/transactions.selectors';
import dayjs from 'dayjs';
import { DateService } from 'src/app/util/service/date.service';
import { FilterService } from '../../../../util/service/filter.service';

@Component({
  selector: 'search-filter',
  templateUrl: './search-filter.component.html',
  styleUrls: ['./search-filter.component.scss'],
  standalone: true,
  imports: [
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
export class SearchFilterComponent implements OnInit, OnDestroy {
  @Output() addTransaction = new EventEmitter<void>();
  @Output() importTransactions = new EventEmitter<void>();
  @Output() openFilterDialog = new EventEmitter<void>();
  @Output() viewAnalytics = new EventEmitter<void>();
  @Output() expandTable = new EventEmitter<void>();

  // Injected services
  private store = inject(Store<AppState>);
  private dateService = inject(DateService);
  private filterService = inject(FilterService);

  // Store signals
  allTransactions = this.store.selectSignal(selectAllTransactions);
  storeCategories = this.store.selectSignal(CategoriesSelectors.selectAllCategories);

  // UI state signals
  searchTerm = signal('');
  selectedCategory = signal('all');
  selectedType = signal('all');
  selectedYear = signal(dayjs().year());
  selectedMonth = signal(dayjs().month());
  selectedMonthOption = signal('all');
  selectedDate = signal<Date | null>(null);
  selectedDateRange = signal<{ start: Date; end: Date } | null>(null);
  isRecurring = signal<boolean | null>(null);

  categories = computed(() => {
    return this.storeCategories()
      .filter(category => !category.isSystem)
      .map(category => ({
        id: category.id || '',
        name: category.name
      })).sort((a, b) => a.name.localeCompare(b.name));
  });

  availableYears = signal<number[]>([]);
  months = signal<{ value: number; label: string }[]>([]);
  currentYear = dayjs().year();

  // Computed filtered count
  filteredCount = computed(() => {
    const transactions = this.allTransactions();
    const filterState = this.filterService.filterState();
    return this.filterService.filterTransactions(transactions, filterState).length;
  });

  constructor() {
    this.updateMonths();

    // Sync from FilterService to local UI state
    effect(() => {
      const state = this.filterService.filterState();
      this.searchTerm.set(state.searchTerm);
      this.selectedCategory.set(state.selectedCategory[0] || 'all');
      this.selectedType.set(state.selectedType);
      
      if (state.selectedYear) {
        this.selectedYear.set(state.selectedYear.startYear);
      } else {
        const defaultYear = this.availableYears().length > 0 ? this.availableYears()[0] : this.currentYear;
        this.selectedYear.set(defaultYear);
      }

      if (state.selectedDateRange) {
        const start = dayjs(state.selectedDateRange.startDate);
        const end = dayjs(state.selectedDateRange.endDate);
        if (start.isSame(start.startOf('month'), 'day') && end.isSame(end.endOf('month'), 'day') && start.year() === end.year() && start.month() === end.month()) {
          this.selectedMonthOption.set(start.month().toString());
          this.selectedYear.set(start.year());
        } else {
          this.selectedMonthOption.set('all');
        }
        this.selectedDateRange.set({ 
          start: state.selectedDateRange.startDate, 
          end: state.selectedDateRange.endDate 
        });
        this.selectedDate.set(null);
      } else if (state.selectedDate) {
        this.selectedDate.set(state.selectedDate);
        this.selectedDateRange.set(null);
        this.selectedMonthOption.set('all');
      } else {
        this.selectedDate.set(null);
        this.selectedDateRange.set(null);
        if (!state.selectedYear) {
          this.selectedMonthOption.set('all');
        }
      }

      this.isRecurring.set(state.isRecurring ?? null);
    });

    effect(() => {
      this.updateAvailableYears();
    });
  }

  ngOnInit() {}

  ngOnDestroy() {}

  private updateAvailableYears() {
    const transactions = this.allTransactions();
    const yearsSet = new Set<number>();
    yearsSet.add(this.currentYear);

    transactions.forEach(tx => {
      if (tx.date) {
        const year = dayjs(this.dateService.toDate(tx.date)).year();
        yearsSet.add(year);
      }
    });

    this.availableYears.set(Array.from(yearsSet).sort((a, b) => b - a));
  }

  private updateMonths() {
    this.months.set([
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
    ]);
  }

  onSearchChange(value: any) {
    this.filterService.searchTerm.set(value);
  }

  onCategoryChange(value: any) {
    this.filterService.selectedCategory.set([value]);
  }

  onTypeChange(value: any) {
    this.filterService.selectedType.set(value);
  }

  onSelectedYearChange(year: number) {
    if (this.selectedMonthOption() !== 'all') {
      const month = parseInt(this.selectedMonthOption());
      const startDate = dayjs().year(year).month(month).startOf('month').toDate();
      const endDate = dayjs().year(year).month(month).endOf('month').toDate();
      this.filterService.selectedDateRange.set({ startDate, endDate });
    } else {
      this.filterService.selectedYear.set({ startYear: year, endYear: year });
    }
  }

  onSelectedMonthChange(monthValue: string) {
    if (monthValue !== 'all') {
      const month = parseInt(monthValue);
      const startDate = dayjs().year(this.selectedYear()).month(month).startOf('month').toDate();
      const endDate = dayjs().year(this.selectedYear()).month(month).endOf('month').toDate();
      this.filterService.selectedDateRange.set({ startDate, endDate });
    } else {
      this.filterService.selectedDate.set(null);
      this.filterService.selectedDateRange.set(null);
      this.filterService.selectedYear.set({ startYear: this.selectedYear(), endYear: this.selectedYear() });
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
    this.filterService.selectedDate.set(null);
    this.filterService.selectedDateRange.set(null);
    this.filterService.selectedYear.set(null);
    this.filterService.selectedCategory.set(['all']);
    this.filterService.selectedType.set('all');
    this.filterService.searchTerm.set('');
    this.filterService.isRecurring.set(null);
  }

  onClearSearchFilter() {
    this.filterService.searchTerm.set('');
  }

  onClearYearFilter() {
    this.filterService.selectedYear.set(null);
  }

  onClearMonthFilter() {
    this.filterService.selectedDateRange.set(null);
  }

  onClearCategoryFilter() {
    this.filterService.selectedCategory.set(['all']);
  }

  onClearTypeFilter() {
    this.filterService.selectedType.set('all');
  }

  onClearDateRangeFilter() {
    this.filterService.selectedDateRange.set(null);
  }

  onClearDateFilter() {
    this.filterService.selectedDate.set(null);
  }

  onClearRecurringFilter() {
    this.filterService.isRecurring.set(null);
  }

  getActiveFilters() {
    const filters = [];
    const state = this.filterService.filterState();
    const defaultYear = this.availableYears().length > 0 ? this.availableYears()[0] : this.currentYear;

    if (state.searchTerm) {
      filters.push({
        type: 'search',
        label: `Search: "${state.searchTerm}"`,
        onRemove: () => this.onClearSearchFilter()
      });
    }

    if (state.selectedYear && state.selectedYear.startYear !== defaultYear) {
      filters.push({
        type: 'year',
        label: `Year: ${state.selectedYear.startYear}`,
        onRemove: () => this.onClearYearFilter()
      });
    }

    if (this.selectedMonthOption() !== 'all') {
      const monthLabel = this.months().find(m => m.value === parseInt(this.selectedMonthOption()))?.label;
      filters.push({
        type: 'month',
        label: `Month: ${monthLabel}`,
        onRemove: () => this.onClearMonthFilter()
      });
    }

    if (state.selectedCategory[0] !== 'all') {
      const categoryName = this.categories().find(c => c.id === state.selectedCategory[0])?.name;
      filters.push({
        type: 'category',
        label: `Category: ${categoryName || 'Unknown'}`,
        onRemove: () => this.onClearCategoryFilter()
      });
    }

    if (state.selectedType !== 'all') {
      filters.push({
        type: 'type',
        label: `Type: ${state.selectedType}`,
        onRemove: () => this.onClearTypeFilter()
      });
    }

    if (state.selectedDateRange) {
      filters.push({
        type: 'dateRange',
        label: `Date Range: ${state.selectedDateRange.startDate.toLocaleDateString()} - ${state.selectedDateRange.endDate.toLocaleDateString()}`,
        onRemove: () => this.onClearDateRangeFilter()
      });
    }

    if (state.selectedDate) {
      filters.push({
        type: 'date',
        label: `Date: ${state.selectedDate.toLocaleDateString()}`,
        onRemove: () => this.onClearDateFilter()
      });
    }

    if (state.isRecurring !== null) {
      filters.push({
        type: 'recurring',
        label: state.isRecurring ? 'Type: Recurring' : 'Type: Normal',
        onRemove: () => this.onClearRecurringFilter()
      });
    }

    return filters;
  }

  hasActiveFilters(): boolean {
    return this.filterService.hasActiveFilters();
  }
}