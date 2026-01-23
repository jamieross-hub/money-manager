import { Component, Output, EventEmitter, ViewChild, OnInit, OnDestroy, AfterViewInit, HostListener, Input } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort, Sort } from '@angular/material/sort';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';
import { Transaction } from '../../../../util/models/transaction.model';
import { Auth } from '@angular/fire/auth';
import { UserService } from 'src/app/util/service/db/user.service';
import { Subscription, Observable } from 'rxjs';
import moment from 'moment';
import { DateService } from 'src/app/util/service/date.service';
import { FilterService } from 'src/app/util/service/filter.service';
import { selectAllCategories } from 'src/app/store/categories/categories.selectors';
import { selectAllTransactions } from 'src/app/store/transactions/transactions.selectors';
import { Account, Category } from 'src/app/util/models';
import { AppState } from 'src/app/store/app.state';
import { Store } from '@ngrx/store';
import { APP_CONFIG } from 'src/app/util/config/config';
import { SsrService } from 'src/app/util/service/ssr.service';
import { ConfirmDialogComponent } from 'src/app/util/components/confirm-dialog/confirm-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { MobileAddTransactionComponent } from '../add-transaction/mobile-add-transaction/mobile-add-transaction.component';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';
import { ParentCategorySelectorDialogComponent } from '../../category/parent-category-selector-dialog/parent-category-selector-dialog.component';
import { selectAllAccounts } from 'src/app/store/accounts/accounts.selectors';

@Component({
  selector: 'transaction-table',
  templateUrl: './transaction-table.component.html',
  styleUrls: ['./transaction-table.component.scss'],
  animations: [
    trigger('listAnimation', [
      transition('* <=> *', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateY(10px)' }),
          stagger('50ms', [
            animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
          ])
        ], { optional: true })
      ])
    ])
  ]
})
export class TransactionTableComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input() isHome: boolean = false;
  @Output() editTransaction = new EventEmitter<Transaction>();
  @Output() deleteTransaction = new EventEmitter<Transaction>();
  @Output() startRowEdit = new EventEmitter<Transaction>();
  @Output() saveRowEdit = new EventEmitter<Transaction>();
  @Output() cancelRowEdit = new EventEmitter<Transaction>();
  @Output() addTransaction = new EventEmitter<void>();
  @Output() bulkDeleteTransactions = new EventEmitter<Transaction[]>();
  @Output() bulkUpdateCategory = new EventEmitter<{ transactions: Transaction[], categoryId: string }>();

  @ViewChild(MatSort) sort!: MatSort;

  dataSource: MatTableDataSource<Transaction> = new MatTableDataSource<Transaction>();
  displayedColumns: string[] = ['Date', 'Type', 'Payee', 'Amount', 'Status', 'Actions'];
  isListView: boolean = false;

  // Selection properties
  selectedTransactions: Set<string> = new Set();
  isAllSelected = false;
  isIndeterminate = false;
  accounts: Account[] = [];

  // Responsive breakpoints
  private readonly MOBILE_BREAKPOINT = 640; // sm
  private readonly TABLET_BREAKPOINT = 768; // md

  private subscription = new Subscription();
  categories: { [key: string]: Category } = {};

  // Store observables
  transactions$: Observable<Transaction[]> = this.store.select(selectAllTransactions);
  allTransactions: Transaction[] = [];

  constructor(
    private auth: Auth,
    private dateService: DateService,
    private filterService: FilterService,
    private store: Store<AppState>,
    private ssrService: SsrService,
    private dialog: MatDialog,
    public breakpointService: BreakpointService,
    private userService: UserService
  ) { }

  ngOnInit() {
    this.setupDataSource();
    this.setupFilterServiceSubscriptions();
    this.setupTransactionSubscriptions();
    this.loadCategories();
    this.loadAccounts();
    this.updateColumnVisibility();
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  ngAfterViewInit() {
    this.setupSorting();
  }

  @HostListener('window:resize', ['$event'])
  onResize() {
    this.updateColumnVisibility();
  }

  private loadAccounts(): void {
    this.store.select(selectAllAccounts).subscribe((accounts: Account[]) => {
      this.accounts = accounts;
    });
  }

  private updateColumnVisibility() {
    if (this.ssrService.isClientSide()) {
      const screenWidth = window.innerWidth;
      if (screenWidth < this.MOBILE_BREAKPOINT) {
        // Mobile: Show only essential columns (no select column)
        this.displayedColumns = ['Date', 'Payee', 'Amount', 'Actions'];
      } else if (screenWidth < this.TABLET_BREAKPOINT) {
        // Small tablet: Show more columns but hide status (include select column only if not home)
        this.displayedColumns = this.isHome ?
          ['Date', 'Type', 'Payee', 'Amount', 'Actions'] :
          ['Date', 'Type', 'Payee', 'Amount', 'Actions'];
      } else {
        // Desktop: Show all columns (include select column only if not home)
        this.displayedColumns = this.isHome ?
          ['Date', 'Type', 'Payee', 'Amount', 'Status', 'Actions'] :
          ['Date', 'Type', 'Payee', 'Amount', 'Status', 'Account', 'Actions'];
      }
    }
  }

  private setupDataSource() {
    this.dataSource = new MatTableDataSource<Transaction>([]);

    // Custom filter predicate for complex filtering - delegate to FilterService
    this.dataSource.filterPredicate = (data: Transaction, filter: string) => {
      // Use FilterService for filtering logic
      const filtered = this.filterService.filterTransactions([data], {
        searchTerm: filter,
        selectedCategory: this.filterService.getSelectedCategory(),
        selectedType: this.filterService.getSelectedType(),
        selectedYear: this.filterService.getSelectedYear(),
        selectedDate: this.filterService.getSelectedDate(),
        selectedDateRange: this.filterService.getSelectedDateRange(),
        categoryFilter: this.filterService.getCategoryFilter(),
        accountFilter: this.filterService.getAccountFilter(),
        amountRange: this.filterService.getAmountRange(),
        statusFilter: this.filterService.getStatusFilter(),
        tags: this.filterService.getTags()
      });
      return filtered.length > 0;
    };
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
        this.updateFilteredData();
      })
    );
  }

  private setupFilterServiceSubscriptions() {
    // Subscribe to filter state changes and update data source
    this.subscription.add(
      this.filterService.filterState$.subscribe(() => {
        this.updateFilteredData();
      })
    );
  }

  private updateFilteredData() {
    // Use FilterService to get filtered and sorted transactions
    const currentYear = moment().year();
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
    const sortDirection = this.sort?.direction || 'desc';
    const sortActive = this.sort?.active || 'Date';
    const sortBy = this.getSortByFromMatSort(sortActive, sortDirection);

    const sortedData = this.filterService.sortTransactions(filteredData, sortBy);

    // Update data source
    this.dataSource.data = sortedData;
  }

  private getSortByFromMatSort(active: string, direction: string): string {
    switch (active) {
      case 'Date':
        return direction === 'asc' ? 'date-asc' : 'date-desc';
      case 'Amount':
        return direction === 'asc' ? 'amount-asc' : 'amount-desc';
      case 'Payee':
        return 'payee-asc';
      case 'Type':
        return 'category-asc';
      default:
        return 'date-desc';
    }
  }

  private setupSorting() {
    // Set up custom sort accessors
    this.dataSource.sortingDataAccessor = (item: Transaction, property: string) => {
      switch (property) {
        case 'Date':
          return (this.dateService.toDate(item?.date) || new Date()).getTime();
        case 'Type':
          return (item?.category.toString().toLowerCase() || '');
        case 'Payee':
          return (item?.payee || '').toLowerCase();
        case 'Amount':
          return item?.amount;
        case 'Status':
          return (item?.type || '').toLowerCase();
        default:
          return '';
      }
    };

    // Connect the sort to the data source
    this.dataSource.sort = this.sort;

    // Subscribe to sort changes and update filtered data
    this.subscription.add(
      this.sort.sortChange.subscribe((sort: Sort) => {
        console.log(`Sorting by ${sort.active} in ${sort.direction} order`);
        this.updateFilteredData();
      })
    );

    // Set default sort
    this.sort.sort({
      id: 'Date',
      start: 'desc',
      disableClear: false
    });
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

  onStartRowEdit(transaction: Transaction) {
    this.editTransaction.emit(transaction);
  }

  onSaveRowEdit(transaction: Transaction) {
    this.saveRowEdit.emit(transaction);
  }

  onCancelRowEdit(transaction: Transaction) {
    this.cancelRowEdit.emit(transaction);
  }

  onAddTransaction() {
    this.addTransaction.emit();
  }

  onRowClick(transaction: Transaction) {
    // Open transaction in view mode (read-only)
    this.openTransactionViewDialog(transaction);
  }

  private openTransactionViewDialog(transaction: Transaction) {
    const dialogRef = this.dialog.open(MobileAddTransactionComponent, {
      panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : 'desktop-dialog',
      data: {
        transaction: transaction,
        mode: 'view' // This will make the dialog read-only
      }
    });
  }

  getFilteredCount(): number {
    return this.dataSource.data.length;
  }

  getTotalCount(): number {
    return this.allTransactions.length;
  }

  getCurrentYear(): number {
    return moment().year();
  }

  // Get current sort state
  getCurrentSortState(): Sort | null {
    return this.sort ? this.sort.active ? {
      active: this.sort.active,
      direction: this.sort.direction
    } : null : null;
  }

  // Clear current sort
  clearSort(): void {
    if (this.sort) {
      this.sort.sort({
        id: '',
        start: 'asc',
        disableClear: false
      });
    }
  }

  private loadCategories(): void {
    const userId = this.userService.getCurrentUserId();
    if (userId) {
      this.store.select(selectAllCategories).subscribe((categories: Category[]) => {
        for (const category of categories) {
          (this.categories as { [key: string]: Category })[category.id as string] = category;
        }
      });
    }
  }

  getCategoryIcon(category: string | undefined): string {
    return category ? this.categories[category]?.icon || "category" : "category";
  }

  getCategoryName(categoryId: string | undefined): string {
    return categoryId ? this.categories[categoryId]?.name || categoryId : "";
  }

  getCategoryColor(category: string): string {
    return this.categories[category]?.color || "#46777f";
  }

  getDateDisplay(date: Date | any): string {
    if (date && typeof date === 'object' && 'seconds' in date) {
      // Handle Timestamp
      return new Date(date.seconds * 1000).toLocaleDateString(APP_CONFIG.LANGUAGE.DEFAULT, { month: 'short', day: 'numeric' });
    } else if (date instanceof Date) {
      // Handle Date
      return date.toLocaleDateString(APP_CONFIG.LANGUAGE.DEFAULT, { month: 'short', day: 'numeric' });
    }
    return '';
  }

  // Calculate totals for the footer using FilterService filtered data
  getTotalIncome(): number {
    return this.dataSource.data
      .filter(transaction => transaction.type === 'income')
      .reduce((sum, transaction) => sum + transaction.amount, 0);
  }

  getTotalExpense(): number {
    return this.dataSource.data
      .filter(transaction => transaction.type === 'expense')
      .reduce((sum, transaction) => sum + transaction.amount, 0);
  }

  getNetAmount(): number {
    return this.getTotalIncome() - this.getTotalExpense();
  }

  getTransactionCount(): number {
    return this.dataSource.data.length;
  }

  // FilterService interaction methods
  clearAllFilters(): void {
    this.filterService.clearAllFilters();
  }

  getActiveFiltersCount(): number {
    return this.filterService.getActiveFiltersCount();
  }

  hasActiveFilters(): boolean {
    return this.filterService.hasActiveFilters();
  }

  getCurrentFilterState() {
    return this.filterService.getCurrentFilterState();
  }

  toggleView() {
    this.isListView = !this.isListView;
  }

  // Selection methods
  isSelected(transaction: Transaction): boolean {
    return this.selectedTransactions.has(transaction.id!);
  }

  toggleSelection(transaction: Transaction): void {
    if (this.selectedTransactions.has(transaction.id!)) {
      this.selectedTransactions.delete(transaction.id!);
    } else {
      this.selectedTransactions.add(transaction.id!);
    }
    this.updateSelectionState();
  }

  toggleAllSelection(): void {
    if (this.isAllSelected) {
      this.selectedTransactions.clear();
    } else {
      this.dataSource.data.forEach(transaction => {
        this.selectedTransactions.add(transaction.id!);
      });
    }
    this.updateSelectionState();
  }

  private updateSelectionState(): void {
    const selectedCount = this.selectedTransactions.size;
    const totalCount = this.dataSource.data.length;

    this.isAllSelected = selectedCount === totalCount && totalCount > 0;
    this.isIndeterminate = selectedCount > 0 && selectedCount < totalCount;
  }

  getSelectedTransactions(): Transaction[] {
    return this.dataSource.data.filter(transaction =>
      this.selectedTransactions.has(transaction.id!)
    );
  }

  getSelectedCount(): number {
    return this.selectedTransactions.size;
  }

  hasSelection(): boolean {
    return this.selectedTransactions.size > 0;
  }

  clearSelection(): void {
    this.selectedTransactions.clear();
    this.updateSelectionState();
  }

  // Bulk operations
  onBulkDelete(): void {
    const selectedTransactions = this.getSelectedTransactions();
    if (selectedTransactions.length === 0) return;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Multiple Transactions',
        message: `Are you sure you want to delete ${selectedTransactions.length} transaction(s)? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        confirmColor: 'warn'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.bulkDeleteTransactions.emit(selectedTransactions);
        this.clearSelection();
      }
    });
  }

  onBulkUpdateCategory(): void {
    const selectedTransactions = this.getSelectedTransactions();
    if (selectedTransactions.length === 0) return;

    // Get all available categories
    const availableCategories = Object.values(this.categories).filter(category =>
      !category.parentCategoryId // Only show parent categories
    );

    const dialogRef = this.dialog.open(ParentCategorySelectorDialogComponent, {
      width: '500px',
      data: {
        title: 'Update Category for Multiple Transactions',
        message: `Select a new category for ${selectedTransactions.length} transaction(s):`,
        categories: availableCategories
      }
    });

    dialogRef.afterClosed().subscribe((selectedCategory: Category | null) => {
      if (selectedCategory) {
        this.bulkUpdateCategory.emit({
          transactions: selectedTransactions,
          categoryId: selectedCategory.id!
        });
        this.clearSelection();
      }
    });
  }

  getAccountName(accountId: string): string {
    return this.accounts.find(account => account.accountId === accountId)?.name || accountId;
  }
} 