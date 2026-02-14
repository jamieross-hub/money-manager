import {
  Component,
  OnInit,
  OnDestroy,
  Output,
  EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';
import { TranslateModule } from '@ngx-translate/core';
import { CurrencyPipe } from 'src/app/util/pipes/currency.pipe';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { MatDialog } from '@angular/material/dialog';
import { Transaction } from '../../../../util/models/transaction.model';
import { Subject, Subscription, Observable } from 'rxjs';
import moment from 'moment';
import { Auth } from '@angular/fire/auth';
import { Account, Category } from 'src/app/util/models';
import { Router } from '@angular/router';
import { ConfirmDialogComponent } from '../../../../util/components/confirm-dialog/confirm-dialog.component';
import {
  CustomDateRangeDialogComponent,
  CustomDateRangeData,
} from '../../../../util/components/custom-date-range-dialog';
import { DateService } from 'src/app/util/service/date.service';
import { selectAllAccounts } from 'src/app/store/accounts/accounts.selectors';
import { selectAllTransactions } from 'src/app/store/transactions/transactions.selectors';
import { AppState } from 'src/app/store/app.state';
import { Store } from '@ngrx/store';
import { selectAllCategories } from 'src/app/store/categories/categories.selectors';
import { RecurringInterval, SyncStatus } from 'src/app/util/config/enums';
import { FilterService } from 'src/app/util/service/filter.service';
import { CategoryService } from 'src/app/util/service/db/category.service';
import { CurrencyService } from 'src/app/util/service/currency.service';
import { ThemeSwitchingService } from 'src/app/util/service/theme-switching.service';
import { AppViewService } from 'src/app/util/service/app-view.service';

interface SortOption {
  value: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'mobile-transaction-list',
  templateUrl: './mobile-transaction-list.component.html',
  styleUrls: ['./mobile-transaction-list.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatDialogModule,
    MatMenuModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    TranslateModule,
    CurrencyPipe,
    FormsModule,
    MatDividerModule
  ]
})
export class MobileTransactionListComponent
  implements OnInit, OnDestroy {
  @Output() editTransaction = new EventEmitter<Transaction>();
  @Output() deleteTransaction = new EventEmitter<Transaction>();
  @Output() addTransaction = new EventEmitter<void>();
  @Output() importTransactions = new EventEmitter<void>();

  selectedTx: Transaction | null = null;
  filteredTransactions: Transaction[] = [];
  selectedSort: string = 'date-desc';
  showFilters: boolean = false;
  accounts: Account[] = [];

  // Filter state from FilterService
  searchTerm: string = '';
  selectedCategory: string[] = ['all'];
  selectedType: string = 'all';
  selectedDate: Date | null = null;
  selectedDateRange: { startDate: Date; endDate: Date } | null = null;

  sortOptions: SortOption[] = [
    { value: 'date-desc', label: 'Newest First', icon: 'schedule' },
    { value: 'date-asc', label: 'Oldest First', icon: 'schedule' },
    { value: 'amount-desc', label: 'Highest Amount', icon: 'trending_up' },
    { value: 'amount-asc', label: 'Lowest Amount', icon: 'trending_down' },
    { value: 'payee-asc', label: 'Payee A-Z', icon: 'sort_by_alpha' },
    { value: 'category-asc', label: 'Category A-Z', icon: 'category' },
  ];

  private subscription = new Subscription();
  destroy$: Subject<void> = new Subject<void>();
  categories: Category[] = [];
  private availableCategories: (Category & { id: string })[] = [];

  // Store observables
  transactions$: Observable<Transaction[]> = this.store.select(selectAllTransactions);
  allTransactions: Transaction[] = [];
  public selectedRange: string = '';

  constructor(
    private readonly auth: Auth,
    private readonly route: Router,
    private readonly dialog: MatDialog,
    public readonly dateService: DateService,
    private readonly store: Store<AppState>,
    private readonly filterService: FilterService,
    private readonly categoryService: CategoryService,
    private readonly currencyService: CurrencyService,
    private readonly themeService: ThemeSwitchingService,
    private readonly appViewService: AppViewService
  ) { }

  ngOnInit() {
    this.setupFilterServiceSubscriptions();
    this.setupTransactionSubscriptions();
    this.loadUserCategories();
    this.loadUserAccounts();
    if (this.route.url.includes('transactions')) {
      this.showFilters = true;
    }

    // Set initial date range based on App View preference
    this.subscription.add(
      this.appViewService.appView$.subscribe(view => {
        let range = 'this-month';
        if (view === 'WEEKLY') {
          range = 'this-week';
        } else if (view === 'YEARLY') {
          range = 'this-year';
        }
        this.onDateRangeChange(range);
      })
    );

    // Subscribe to theme changes
    this.subscription.add(
      this.themeService.currentTheme.subscribe(() => {
        if (this.showChart) {
          this.renderChart();
        }
      })
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
    this.disposeChart();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupTransactionSubscriptions() {
    // Subscribe to transactions from store
    this.subscription.add(
      this.transactions$.subscribe(transactions => {
        this.allTransactions = transactions.sort((a: any, b: any) => {
          const dateA = this.dateService.toDate(a.date);
          const dateB = this.dateService.toDate(b.date);
          return (dateB?.getTime() ?? 0) - (dateA?.getTime() ?? 0);
        });
        this.updateAvailableCategories();
        this.filterTransactions();
      })
    );
  }

  private setupFilterServiceSubscriptions() {
    // Subscribe to FilterService state changes
    this.subscription.add(
      this.filterService.searchTerm$.subscribe(searchTerm => {
        this.searchTerm = searchTerm;
        this.filterTransactions();
      })
    );

    this.subscription.add(
      this.filterService.selectedCategory$.subscribe(categories => {
        this.selectedCategory = categories;
        this.filterTransactions();
      })
    );

    this.subscription.add(
      this.filterService.selectedType$.subscribe(type => {
        this.selectedType = type;
        this.filterTransactions();
      })
    );

    this.subscription.add(
      this.filterService.selectedDate$.subscribe(date => {
        this.selectedDate = date;
        this.filterTransactions();
      })
    );

    this.subscription.add(
      this.filterService.selectedDateRange$.subscribe(dateRange => {
        this.selectedDateRange = dateRange;
        this.filterTransactions();
      })
    );
  }

  get groupedTransactions() {
    const groups: { date: string; transactions: Transaction[] }[] = [];
    this.filteredTransactions.forEach(tx => {
      const date = moment(this.dateService.toDate(tx.date)).format('YYYY-MM-DD');
      const group = groups.find(g => g.date === date);
      if (group) {
        group.transactions.push(tx);
      } else {
        groups.push({ date, transactions: [tx] });
      }
    });
    return groups;
  }

  filterTransactions() {
    // Use FilterService to filter transactions
    let filteredData: Transaction[];

    // Use all filters including date filters (or no date filters if none selected)
    filteredData = this.filterService.filterTransactions(
      this.allTransactions,
      this.filterService.getCurrentFilterState()
    );

    // Apply sorting using FilterService
    const sortedData = this.filterService.sortTransactions(filteredData, this.selectedSort);

    this.filteredTransactions = sortedData;

    if (this.showChart) {
      this.renderChart();
    }
  }

  onSearchChange(term: string) {
    this.filterService.setSearchTerm(term);
  }

  onSortChange(sortValue: string) {
    this.selectedSort = sortValue;
    this.filterTransactions();
  }

  onTypeChange(type: string) {
    this.filterService.setSelectedType(type);
  }

  onCategoryChange(category: string) {
    if (category === 'all') {
      this.selectedCategory = ['all'];
    } else {
      if (this.selectedCategory.includes('all')) {
        this.selectedCategory = [];
      }

      if (this.selectedCategory.includes(category)) {
        this.selectedCategory = this.selectedCategory.filter(c => c !== category);
      } else {
        this.selectedCategory = [...this.selectedCategory, category];
      }

      if (this.selectedCategory.length === 0) {
        this.selectedCategory = ['all'];
      }
    }
    this.filterService.setSelectedCategory(this.selectedCategory);
    this.filterTransactions();
  }

  onDateRangeChange(range: string | null) {
    if (!range) {
      this.filterService.clearSelectedDate();
      return;
    }

    let startDate: Date;
    let endDate: Date;
    this.selectedRange = range;

    switch (range) {
      case 'today':
        startDate = moment().startOf('day').toDate();
        endDate = moment().endOf('day').toDate();
        break;
      case 'yesterday':
        startDate = moment().subtract(1, 'day').startOf('day').toDate();
        endDate = moment().subtract(1, 'day').endOf('day').toDate();
        break;
      case 'this-week':
        startDate = moment().startOf('week').toDate();
        endDate = moment().endOf('week').toDate();
        break;
      case 'last-week':
        startDate = moment().subtract(1, 'week').startOf('week').toDate();
        endDate = moment().subtract(1, 'week').endOf('week').toDate();
        break;
      case 'this-month':
        startDate = moment().startOf('month').toDate();
        endDate = moment().endOf('month').toDate();
        break;
      case 'last-month':
        startDate = moment().subtract(1, 'month').startOf('month').toDate();
        endDate = moment().subtract(1, 'month').endOf('month').toDate();
        break;
      case 'this-year':
        startDate = moment().startOf('year').toDate();
        endDate = moment().endOf('year').toDate();
        break;
      default:
        return;
    }

    this.filterService.setSelectedDateRange(startDate, endDate);
  }

  isCurrentMonth(): boolean {
    const currentMonth = moment().month();
    const currentYear = moment().year();
    return this.filteredTransactions.some(tx => {
      const txDate = moment(this.dateService.toDate(tx.date));
      return txDate.month() === currentMonth && txDate.year() === currentYear;
    });
  }

  isCurrentWeek(): boolean {
    const currentWeek = moment().week();
    const currentYear = moment().year();
    return this.filteredTransactions.some(tx => {
      const txDate = moment(this.dateService.toDate(tx.date));
      return txDate.week() === currentWeek && txDate.year() === currentYear;
    });
  }

  isLastMonth(): boolean {
    const lastMonth = moment().subtract(1, 'month').month();
    const lastMonthYear = moment().subtract(1, 'month').year();
    return this.filteredTransactions.some(tx => {
      const txDate = moment(this.dateService.toDate(tx.date));
      return txDate.month() === lastMonth && txDate.year() === lastMonthYear;
    });
  }

  isCurrentYear(): boolean {
    const currentYear = moment().year();
    return this.filteredTransactions.some(tx => {
      const txDate = moment(this.dateService.toDate(tx.date));
      return txDate.year() === currentYear;
    });
  }

  hasActiveFilters(): boolean {
    return this.filterService.hasActiveFilters();
  }

  getCurrentSortLabel(): string {
    const option = this.sortOptions.find(opt => opt.value === this.selectedSort);
    return option ? option.label : 'Sort';
  }

  getCurrentTypeLabel(): string {
    switch (this.selectedType) {
      case 'income':
        return 'Income';
      case 'expense':
        return 'Expense';
      default:
        return 'All Types';
    }
  }

  getCurrentCategoryLabel(): string {
    if (this.selectedCategory.includes('all')) {
      return 'All Categories';
    }

    if (this.selectedCategory.length === 1) {
      const category = this.categories.find(cat => cat.id === this.selectedCategory[0]);
      return category ? category.name : 'Unknown Category';
    }

    return `${this.selectedCategory.length} Categories`;
  }

  getCurrentDateLabel(): string {
    if (this.selectedDate) {
      return moment(this.selectedDate).format('MMM DD, YYYY');
    }
    if (this.selectedDateRange) {
      const start = moment(this.selectedDateRange.startDate).format('MMM DD');
      const end = moment(this.selectedDateRange.endDate).format('MMM DD, YYYY');
      return `${start} - ${end}`;
    }
    return 'All Dates';
  }

  onLongPress(transaction: Transaction) {

    if (this.selectedTx?.id == transaction.id) {
      this.selectedTx = null;
    } else {
      this.selectedTx = transaction;
    }
  }

  onEditTransaction(transaction: Transaction) {
    this.editTransaction.emit(transaction);
  }

  onDeleteTransaction(transaction: Transaction) {
    this.dialog
      .open(ConfirmDialogComponent, {
        width: '300px',
        data: {
          title: 'Delete Transaction',
          message: 'Are you sure you want to delete this transaction?',
          confirmText: 'Delete',
          cancelText: 'Cancel',
        },
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.deleteTransaction.emit(transaction);
        }
      });
  }

  onAddTransaction() {
    this.addTransaction.emit();
  }

  onImportTransactions() {
    this.importTransactions.emit();
  }

  getTotalIncome(): number {
    return this.filteredTransactions
      .filter(transaction => transaction.type === 'income')
      .reduce((sum, transaction) => sum + transaction.amount, 0);
  }

  getTotalExpenses(): number {
    return this.filteredTransactions
      .filter(transaction => transaction.type === 'expense')
      .reduce((sum, transaction) => sum + transaction.amount, 0);
  }

  getNetAmount(): number {
    return this.getTotalIncome() - this.getTotalExpenses();
  }

  getCategoriesList(): (Category & { id: string })[] {
    return this.availableCategories;
  }

  private updateAvailableCategories() {
    if (!this.categories || !this.allTransactions) return;

    const usedCategoryIds = new Set<string>();

    this.allTransactions.forEach(tx => {
      if (tx.categoryId) {
        usedCategoryIds.add(tx.categoryId);
      }

      if (tx.isCategorySplit && tx.categorySplits) {
        tx.categorySplits.forEach(split => {
          if (split.categoryId) {
            usedCategoryIds.add(split.categoryId);
          }
        });
      }
    });

    this.availableCategories = this.categories
      .filter(category => usedCategoryIds.has(category.id || ''))
      .map(category => ({
        ...category,
        id: category.id || ''
      }));
  }

  getFilteredCount(): number {
    return this.filteredTransactions.length;
  }

  getTotalCount(): number {
    return this.allTransactions.length;
  }

  getCurrentYear(): number {
    return moment().year();
  }

  getCategoryIcon(categoryId: string): string {
    const category = this.categories.find(cat => cat.id === categoryId);
    return category?.icon || 'category';
  }

  getCategoryColor(categoryId: string): string {
    const category = this.categories.find(cat => cat.id === categoryId);
    return category?.color || '#46777f';
  }

  private async loadUserCategories(): Promise<void> {
    this.subscription.add(
      this.store.select(selectAllCategories).subscribe((categories: Category[]) => {
        this.categories = categories;
        this.updateAvailableCategories();
      })
    );
  }

  private async loadUserAccounts(): Promise<void> {
    this.subscription.add(
      this.store.select(selectAllAccounts).subscribe((accounts: Account[]) => {
        this.accounts = accounts;
      })
    );
  }

  getAccountName(accountId: string): string {
    const account = this.accounts.find(acc => acc.accountId === accountId);
    return account?.name || 'Unknown Account';
  }

  getAccountType(accountId: string): string {
    const account = this.accounts.find(acc => acc.accountId === accountId);
    return account?.type || 'Unknown';
  }

  getRecurringInfo(transaction: Transaction): string {
    if (transaction.recurringInterval) {
      return `Repeats ${transaction.recurringInterval.toLowerCase()}`;
    }
    return '';
  }

  getSyncStatusInfo(transaction: Transaction): string {
    switch (transaction.syncStatus) {
      case SyncStatus.PENDING:
        return 'Pending sync';
      case SyncStatus.SYNCED:
        return 'Synced';
      case SyncStatus.FAILED:
        return 'Sync failed';
      default:
        return '';
    }
  }

  getSyncStatusIcon(transaction: Transaction): string {
    switch (transaction.syncStatus) {
      case SyncStatus.PENDING:
        return 'schedule';
      case SyncStatus.SYNCED:
        return 'check_circle';
      case SyncStatus.FAILED:
        return 'error';
      default:
        return 'help';
    }
  }

  getSyncStatusColor(transaction: Transaction): string {
    switch (transaction.syncStatus) {
      case SyncStatus.PENDING:
        return 'orange';
      case SyncStatus.SYNCED:
        return 'green';
      case SyncStatus.FAILED:
        return 'red';
      default:
        return 'gray';
    }
  }

  clearAllFilters() {
    this.filterService.clearAllFilters();
    this.selectedSort = 'date-desc';
  }

  quickClearFilters() {
    this.filterService.clearAllFilters();
  }

  onClearDateFilter() {
    this.filterService.clearSelectedDate();
  }

  getActiveFiltersCount(): number {
    return this.filterService.getActiveFiltersCount();
  }

  isCategorySelected(categoryId: string): boolean {
    return this.selectedCategory.includes(categoryId);
  }

  isCustomDateRange(): boolean {
    return !!(this.selectedDate || (this.selectedDateRange &&
      (this.selectedDateRange.startDate !== moment().startOf('month').toDate() ||
        this.selectedDateRange.endDate !== moment().endOf('month').toDate())));
  }

  openCustomDateRangeDialog() {
    const dialogRef = this.dialog.open(CustomDateRangeDialogComponent, {
      width: '400px',
      data: {
        startDate: this.selectedDateRange?.startDate ?? new Date(),
        endDate: this.selectedDateRange?.endDate ?? new Date(),
      } as CustomDateRangeData,
    });

    dialogRef.afterClosed().subscribe((result: { start: Date; end: Date } | undefined) => {
      if (result) {
        this.filterService.setSelectedDateRange(result.start, result.end);
      }
    });
  }

  openImportDialog() {
    this.importTransactions.emit();
  }

  getCategoryName(categoryId: string): string {
    const category = this.categories.find(cat => cat.id === categoryId);
    return category?.name || categoryId;
  }

  // Chart state
  showChart: boolean = false;
  private chartRoot: am5.Root | null = null;

  toggleChartView() {
    this.showChart = !this.showChart;
    if (this.showChart) {
      // render chart after a short delay to ensure container exists
      setTimeout(() => this.renderChart(), 50);
    } else {
      this.disposeChart();
    }
  }

  private renderChart() {
    this.disposeChart();

    const root = am5.Root.new('transactionChart');
    root.setThemes([am5themes_Animated.new(root)]);

    const isDark = this.themeService.currentTheme.value === 'dark-theme';
    const textColor = isDark ? am5.color(0xe5e7eb) : am5.color(0x9ca3af);
    const gridColor = isDark ? am5.color(0xffffff) : am5.color(0x000000);

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: false,
        wheelX: 'panX',
        wheelY: 'zoomX',
        layout: root.verticalLayout,
      })
    );

    // Create axes
    const xRenderer = am5xy.AxisRendererX.new(root, {
      minGridDistance: 30,
      cellStartLocation: 0.1,
      cellEndLocation: 0.9,
    });

    xRenderer.grid.template.set('visible', false);

    xRenderer.labels.template.setAll({
      rotation: -45,
      centerY: am5.p50,
      centerX: am5.p100,
      paddingRight: 15,
      fontSize: 10,
      fill: textColor,
    });

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: 'category',
        renderer: xRenderer,
        tooltip: am5.Tooltip.new(root, {}),
      })
    );

    const yRenderer = am5xy.AxisRendererY.new(root, {});
    yRenderer.grid.template.setAll({
      strokeDasharray: [3, 3],
      strokeOpacity: 0.2,
      stroke: gridColor
    });

    yRenderer.labels.template.setAll({
      fontSize: 10,
      fill: textColor,
    });

    yRenderer.labels.template.adapters.add("text", (text, target) => {
      if (target.dataItem && typeof (target.dataItem as any).get("value") === "number") {
        return this.currencyService.formatAmount((target.dataItem as any).get("value") as number, {
          compact: true,
          decimalPlaces: 0
        });
      }
      return text;
    });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: yRenderer,
        min: 0,
      })
    );

    // Add series
    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: 'Amount',
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: 'value',
        categoryXField: 'category',
        tooltip: am5.Tooltip.new(root, {
          labelText: '{fullCategory}: {formattedValue}'
        }),
      })
    );

    series.columns.template.setAll({
      cornerRadiusTL: 5,
      cornerRadiusTR: 5,
      width: am5.percent(70),
      strokeOpacity: 0
    });

    // Make each column a different color
    series.columns.template.adapters.add("fill", (fill, target) => {
      return chart.get("colors")?.getIndex(series.columns.indexOf(target));
    });

    series.columns.template.adapters.add("stroke", (stroke, target) => {
      return chart.get("colors")?.getIndex(series.columns.indexOf(target));
    });

    // Process data
    const categoryMap = new Map<string, number>();
    this.filteredTransactions.forEach((tx) => {
      const catId = tx.categoryId;
      const current = categoryMap.get(catId) || 0;
      categoryMap.set(catId, current + tx.amount);
    });

    const data = Array.from(categoryMap.entries())
      .map(([catId, value]) => ({
        category: this.getCategoryName(catId).substring(0, 3).toUpperCase(),
        fullCategory: this.getCategoryName(catId),
        value: value,
        formattedValue: this.currencyService.formatAmount(value)
      }))
      .sort((a, b) => b.value - a.value);

    xAxis.data.setAll(data);
    series.data.setAll(data);

    chart.set('cursor', am5xy.XYCursor.new(root, {
      behavior: "none",
      xAxis: xAxis
    }));

    this.chartRoot = root;
  }


  private disposeChart() {
    try {
      if (this.chartRoot) {
        this.chartRoot.dispose();
        this.chartRoot = null;
      }
    } catch (e) {
      // ignore disposal errors
    }
  }
}
