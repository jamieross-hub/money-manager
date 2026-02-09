import {
  Component,
  OnInit,
  OnDestroy,
  Output,
  EventEmitter,
} from '@angular/core';
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

interface SortOption {
  value: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'mobile-transaction-list',
  templateUrl: './mobile-transaction-list.component.html',
  styleUrls: ['./mobile-transaction-list.component.scss'],
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

  // Store observables
  transactions$: Observable<Transaction[]> = this.store.select(selectAllTransactions);
  allTransactions: Transaction[] = [];

  constructor(
    private readonly auth: Auth,
    private readonly route: Router,
    private readonly dialog: MatDialog,
    public readonly dateService: DateService,
    private readonly store: Store<AppState>,
    private readonly filterService: FilterService,
    private readonly categoryService: CategoryService
  ) { }

  ngOnInit() {
    this.setupFilterServiceSubscriptions();
    this.setupTransactionSubscriptions();
    this.loadUserCategories();
    this.loadUserAccounts();
    if (this.route.url.includes('transactions')) {
      this.showFilters = true;
    }
    this.onDateRangeChange('this-month');
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
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

    // Check if we have specific date filters applied
    const hasDateFilters = this.filterService.getSelectedDate() ||
      this.filterService.getSelectedDateRange() ||
      this.filterService.getSelectedYear();

    if (!hasDateFilters) {
      // Filter to show only current year transactions when no specific date filter is applied
      filteredData = this.filterService.filterCurrentYearTransactions(
        this.allTransactions,
        this.filterService.getCurrentFilterState()
      );
    } else {
      // Use all filters including date filters
      filteredData = this.filterService.filterTransactions(
        this.allTransactions,
        this.filterService.getCurrentFilterState()
      );
    }

    // Apply sorting using FilterService
    const sortedData = this.filterService.sortTransactions(filteredData, this.selectedSort);

    this.filteredTransactions = sortedData;
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
      this.filterService.setSelectedCategory(['all']);
    } else {
      this.filterService.setSelectedCategory([category]);
    }
  }

  onDateRangeChange(range: string | null) {
    if (!range) {
      this.filterService.clearSelectedDate();
      return;
    }

    const now = moment();
    let startDate: Date;
    let endDate: Date;

    switch (range) {
      case 'today':
        startDate = now.startOf('day').toDate();
        endDate = now.endOf('day').toDate();
        break;
      case 'yesterday':
        startDate = now.subtract(1, 'day').startOf('day').toDate();
        endDate = now.endOf('day').toDate();
        break;
      case 'this-week':
        startDate = now.startOf('week').toDate();
        endDate = now.endOf('week').toDate();
        break;
      case 'last-week':
        startDate = now.subtract(1, 'week').startOf('week').toDate();
        endDate = now.subtract(1, 'week').endOf('week').toDate();
        break;
      case 'this-month':
        startDate = now.startOf('month').toDate();
        endDate = now.endOf('month').toDate();
        break;
      case 'last-month':
        startDate = now.subtract(1, 'month').startOf('month').toDate();
        endDate = now.subtract(1, 'month').endOf('month').toDate();
        break;
      case 'this-year':
        startDate = now.startOf('year').toDate();
        endDate = now.endOf('year').toDate();
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

    const category = this.categories.find(cat => cat.id === this.selectedCategory[0]);
    return category ? category.name : 'Unknown Category';
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
    return this.categories.map(category => ({
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
}
