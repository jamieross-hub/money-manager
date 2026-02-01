import { Component, ViewChild, OnInit, OnDestroy, Input } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Auth } from '@angular/fire/auth';
import { UserService } from 'src/app/util/service/db/user.service';
import { Transaction } from 'src/app/util/models/transaction.model';
import { NotificationService } from 'src/app/util/service/notification.service';
import { MobileAddTransactionComponent } from './add-transaction/mobile-add-transaction/mobile-add-transaction.component';
import { MatDialog } from '@angular/material/dialog';
import { LoaderService } from 'src/app/util/service/loader.service';
import { ImportTransactionsComponent } from './add-transaction/import-transactions.component';
import { FilterService } from 'src/app/util/service/filter.service';
import { Subscription, Observable } from 'rxjs';
import moment from 'moment';
import { Store } from '@ngrx/store';
import { AppState } from '../../../store/app.state';
import * as TransactionsActions from '../../../store/transactions/transactions.actions';
import * as TransactionsSelectors from '../../../store/transactions/transactions.selectors';
import * as CategoriesActions from '../../../store/categories/categories.actions';
import { DateService } from 'src/app/util/service/date.service';
import { RecurringInterval, SyncStatus, TransactionStatus, TransactionType } from 'src/app/util/config/enums';
import { APP_CONFIG } from 'src/app/util/config/config';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';
import { ActivatedRoute, Router } from '@angular/router';
import { TransactionsService } from 'src/app/util/service/db/transactions.service';

@Component({
  selector: 'transaction-list',
  templateUrl: './transaction-list.component.html',
  styleUrl: './transaction-list.component.scss'
})
export class TransactionListComponent implements OnInit, OnDestroy {
  @Input() isHome: boolean = false;
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild("tableSort", { static: false }) sort!: MatSort;
  dataSource: MatTableDataSource<any> = new MatTableDataSource();

  // Observables from store
  transactions$: Observable<Transaction[]>;
  transactionsLoading$: Observable<boolean>;
  transactionsError$: Observable<any>;

  displayedColumns: string[] = ['Payee', 'Amount', 'Status', 'Type', 'Date', 'Actions'];
  public pageSizeOptions: number[] = [...APP_CONFIG.PAGINATION.PAGE_SIZE_OPTIONS]; // Use config values and make mutable
  selectedTx: any = null;
  longPressTimeout: any;
  selectedTabIndex: number = 0;

  // Table properties
  showFullTable: boolean = false;
  isTransactionsPage: boolean = false;

  constructor(
    private loaderService: LoaderService,
    private _dialog: MatDialog,
    private auth: Auth,
    private notificationService: NotificationService,
    private filterService: FilterService,
    private store: Store<AppState>,
    private dateService: DateService,
    public readonly breakpointService: BreakpointService,
    private router: Router,
    private transactionsService: TransactionsService,
    private userService: UserService,
    private route: ActivatedRoute

  ) {
    this.isTransactionsPage = this.router.url.includes('transactions') ? true : false;
    // Initialize selectors
    this.transactions$ = this.store.select(TransactionsSelectors.selectAllTransactions);
    this.transactionsLoading$ = this.store.select(TransactionsSelectors.selectTransactionsLoading);
    this.transactionsError$ = this.store.select(TransactionsSelectors.selectTransactionsError);
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  ngOnInit() {
    this.loadTransactions();
    this.subscribeToStoreData();
    this.checkQueryParams();
  }

  private checkQueryParams() {
    this.route.queryParams.subscribe(params => {
      if (params['tab'] === 'recurring') {
        this.selectedTabIndex = 3;
        this.onTabChange(3);
      }
      if (params['search']) {
        this.filterService.setSearchTerm(params['search']);
      }
    });
  }

  onTabChange(index: number) {
    if (index === 3) {
      // Recurring tab selected, filter for recurring transactions
      this.filterService.setIsRecurring(true);
    } else {
      // For all other tabs (including the main Transaction list),
      // we clear the recurring filter so they work as intended.
      this.filterService.setIsRecurring(null);
    }
  }

  ngOnDestroy() {
    // Cleanup handled by individual subscriptions
  }

  loadTransactions() {
    this.loaderService.show();

    // Load transactions and categories from store
    const userId = this.userService.getCurrentUserId();
    if (userId) {
      this.store.dispatch(TransactionsActions.loadTransactions({ userId }));
      this.store.dispatch(CategoriesActions.loadCategories({ userId }));
    }
  }

  subscribeToStoreData() {
    // Subscribe to store data for error handling
    this.transactions$.subscribe(transactions => {
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
      this.loaderService.hide();
    });

    // Handle errors
    this.transactionsError$.subscribe(error => {
      if (error) {
        console.error('Error loading transactions:', error);
        this.notificationService.error('Failed to load transactions');
        this.loaderService.hide();
      }
    });
  }

  editTransaction(transaction: Transaction) {
    let dialogRef = this._dialog.open(MobileAddTransactionComponent, {
      panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : 'desktop-dialog',
      data: transaction
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadTransactions();
      }
    });
  }

  async deleteTransaction(transaction: Transaction) {
    const userId = this.userService.getCurrentUserId();
    if (userId && transaction.id) {
      this.store.dispatch(TransactionsActions.deleteTransaction({ userId, transactionId: transaction.id }));
      this.notificationService.success('Transaction deleted successfully');
    }
  }

  onLongPress(tx: any) {
    this.selectedTx = tx;
  }

  // Row-level editing methods
  startRowEdit(element: any) {
    // Store original values for cancellation
    element.originalValues = {
      payee: element.payee,
      amount: element.amount,
      type: element.type
    };
    element.isEditing = true;
  }

  saveRowEdit(element: any) {
    // Validate inputs
    if (!element.payee || !element.payee.trim()) {
      this.notificationService.error('Payee cannot be empty');
      return;
    }

    const amount = parseFloat(element.amount);
    if (!amount || amount <= 0) {
      this.notificationService.error('Amount must be a positive number');
      return;
    }

    if (!element.type || (element.type !== 'income' && element.type !== 'expense')) {
      this.notificationService.error('Please select a valid transaction type');
      return;
    }

    // Prepare update data
    const updateData = {
      payee: element.payee.trim(),
      amount: amount,
      type: element.type
    };

    // Save to database using store
    const userId = this.userService.getCurrentUserId();
    if (userId && element.id) {
      this.store.dispatch(TransactionsActions.updateTransaction({
        userId,
        transactionId: element.id,
        transaction: updateData
      }));
      this.notificationService.success('Transaction updated successfully');
      element.isEditing = false;
      delete element.originalValues;
    }
  }

  cancelRowEdit(element: any) {
    // Revert to original values
    element.payee = element.originalValues.payee;
    element.amount = element.originalValues.amount;
    element.type = element.originalValues.type;
    element.isEditing = false;
    delete element.originalValues;
  }

  openImportDialog() {
    const dialogRef = this._dialog.open(ImportTransactionsComponent, {
      panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : 'import-transactions-dialog',
    });
    dialogRef.afterClosed().subscribe((imported: any[]) => {
      if (imported && imported.length) {
        this.importTransactions(imported);
      }
    });
  }

  private async importTransactions(transactions: any[]) {
    this.loaderService.show();
    const userId = this.userService.getCurrentUserId();

    if (!userId) {
      this.notificationService.error('User not authenticated');
      this.loaderService.hide();
      return;
    }

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const tx of transactions) {
        try {
          // Convert date string to Firestore timestamp
          const date = new Date(tx.date);
          if (isNaN(date.getTime())) {
            throw new Error('Invalid date format');
          }

          const transactionData = {
            payee: tx.payee,
            userId: userId,
            accountId: tx.accountId, // Default account ID - you might want to get this from user's accounts
            amount: parseFloat(tx.amount),
            type: tx.type,
            category: tx?.category || '',
            categoryId: tx?.categoryId || '',
            date: date,
            notes: tx.narration || '',
            isPending: false,
            syncStatus: SyncStatus.PENDING,
            lastSyncedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: userId,
            updatedBy: userId,
            status: TransactionStatus.COMPLETED,
          };

          this.store.dispatch(TransactionsActions.createTransaction({ userId, transaction: transactionData }));
          successCount++;
        } catch (error) {
          console.error('Error importing transaction:', tx, error);
          errorCount++;
        }
      }

      this.loaderService.hide();

      if (successCount > 0) {
        this.notificationService.success(`Successfully imported ${successCount} transactions`);
        // Refresh the list by dispatching load action
        this.store.dispatch(TransactionsActions.loadTransactions({ userId }));
      }

      if (errorCount > 0) {
        this.notificationService.warning(`${errorCount} transactions failed to import`);
      }

    } catch (error) {
      this.loaderService.hide();
      this.notificationService.error('Failed to import transactions');
      console.error('Import error:', error);
    }
  }

  exportToExcel() {
    if (!this.dataSource.data || this.dataSource.data.length === 0) {
      this.notificationService.error('No transactions to export');
      return;
    }

    // Prepare data for export using Moment.js
    const exportData = this.dataSource.data.map(tx => {
      const transactionDate = this.dateService.toDate(tx.date);
      return {
        'Date': moment(transactionDate).format('MM/DD/YYYY'),
        'Time': moment(transactionDate).format('hh:mm A'),
        'Payee': tx.payee,
        'Amount': tx.amount,
        'Type': tx.type,
        'Category': tx.category,
        'Notes': tx.notes || ''
      };
    });

    // Convert to CSV
    const headers = Object.keys(exportData[0]);
    const csvContent = [
      headers.join(','),
      ...exportData.map(row => headers.map(header => `"${(row as any)[header]}"`).join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `transactions_${moment().format('YYYY-MM-DD')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    this.notificationService.success(`Exported ${exportData.length} transactions successfully`);
  }

  // Header enhancement methods
  getCurrentMonthTransactions(): number {
    const currentMonth = moment().month();
    const currentYear = moment().year();
    return this.dataSource.data.filter((tx: any) => {
      const transactionDate = this.dateService.toDate(tx.date);
      if (!transactionDate) return false;
      const txDate = moment(transactionDate);
      return txDate.month() === currentMonth && txDate.year() === currentYear;
    }).length;
  }

  getUniqueCategories(): number {
    const categories = new Set(this.dataSource.data.map((tx: any) => tx.category));
    return categories.size;
  }

  getFilteredCount(): number {
    return this.dataSource.data.length;
  }

  getTotalCount(): number {
    return this.dataSource.data.length;
  }

  getCurrentYearCount(): number {
    const currentYear = moment().year();
    return this.dataSource.data.filter((tx: any) => {
      const transactionDate = this.dateService.toDate(tx.date);
      if (!transactionDate) return false;
      const txYear = moment(transactionDate).year();
      return txYear === currentYear;
    }).length;
  }

  getCurrentYear(): number {
    return moment().year();
  }

  getCategoriesList(): string[] {
    const categories = new Set(this.dataSource.data.map((tx: any) => tx.category));
    return Array.from(categories).sort();
  }

  getTypesList(): string[] {
    return [TransactionType.INCOME, TransactionType.EXPENSE];
  }

  refreshTransactions(): void {
    const userId = this.userService.getCurrentUserId();
    if (userId) {
      this.store.dispatch(TransactionsActions.loadTransactions({ userId }));
      this.notificationService.success('Transactions refreshed');
    }
  }

  openFilterDialog(): void {
    // TODO: Implement filter dialog
    this.notificationService.success('Filter functionality coming soon');
  }

  viewAnalytics(): void {
    // TODO: Navigate to analytics or open analytics dialog
    this.notificationService.success('Analytics view coming soon');
  }

  addTransactionDialog(): void {
    this._dialog.open(MobileAddTransactionComponent, {
      panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : 'desktop-dialog',
    }).afterClosed().subscribe((transaction: Transaction) => {
      if (transaction) {
        const userId = this.userService.getCurrentUserId();
        if (userId) {
          this.store.dispatch(TransactionsActions.loadTransactions({ userId }));
        }
      }
    });
  }

  expandTable(): void {
    this.showFullTable = !this.showFullTable;
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

  // Bulk operations
  async bulkDeleteTransactions(transactions: Transaction[]) {
    if (!transactions || transactions.length === 0) return;

    this.loaderService.show();
    const userId = this.userService.getCurrentUserId();

    if (!userId) {
      this.notificationService.error('User not authenticated');
      this.loaderService.hide();
      return;
    }

    try {
      // Delete transactions one by one
      for (const transaction of transactions) {
        await this.transactionsService.deleteTransaction(userId, transaction.id!).toPromise();
      }

      this.notificationService.success(`Successfully deleted ${transactions.length} transaction(s)`);
    } catch (error) {
      console.error('Error deleting transactions:', error);
      this.notificationService.error('Failed to delete some transactions');
    } finally {
      this.loaderService.hide();
    }
  }

  async bulkUpdateCategory(data: { transactions: Transaction[], categoryId: string }) {
    const { transactions, categoryId } = data;

    if (!transactions || transactions.length === 0 || !categoryId) return;

    this.loaderService.show();
    const userId = this.userService.getCurrentUserId();

    if (!userId) {
      this.notificationService.error('User not authenticated');
      this.loaderService.hide();
      return;
    }

    try {
      // Update transactions one by one
      for (const transaction of transactions) {
        const updatedTransaction = {
          categoryId: categoryId
        };

        await this.transactionsService.updateTransaction(userId, transaction.id!, updatedTransaction).toPromise();
      }

      this.notificationService.success(`Successfully updated category for ${transactions.length} transaction(s)`);
    } catch (error) {
      console.error('Error updating transactions:', error);
      this.notificationService.error('Failed to update some transactions');
    } finally {
      this.loaderService.hide();
    }
  }
}
