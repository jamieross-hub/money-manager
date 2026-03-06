import { Component, Input, OnInit, OnDestroy, AfterViewInit, ViewChild, ChangeDetectionStrategy, ChangeDetectorRef, signal, input, effect, computed, inject } from '@angular/core';

import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { SearchFilterComponent } from './search-filter/search-filter.component';
import { TransactionTableComponent } from './transaction-table/transaction-table.component';
import { MobileTransactionListComponent } from './mobile-transaction-list/mobile-transaction-list.component';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Auth } from '@angular/fire/auth';
import { UserService } from 'src/app/util/service/db/user.service';
import { Transaction } from 'src/app/util/models/transaction.model';
import { NotificationService } from 'src/app/util/service/notification.service';
import { MobileAddTransactionComponent } from './add-transaction/mobile-add-transaction/mobile-add-transaction.component';
import { CalendarViewComponent } from '../calendar-view/calendar-view.component';
import { MonthlyExpenditureCardComponent } from '../../../util/components/cards/monthly-expenditure-card/monthly-expenditure-card.component';
import { LoaderService } from 'src/app/util/service/loader.service';
import { ImportTransactionsComponent } from './add-transaction/import-transactions.component';
import { FilterService } from 'src/app/util/service/filter.service';
import { Subject, Subscription, Observable, map } from 'rxjs'; // Subject needed for destroy$
import { takeUntil } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import { AppState } from '../../../store/app.state';
import * as TransactionsActions from '../../../store/transactions/transactions.actions';
import * as TransactionsSelectors from '../../../store/transactions/transactions.selectors';
import * as CategoriesActions from '../../../store/categories/categories.actions';
import * as FamilyActions from '../../../modules/family/store/family.actions';
import * as ProfileSelectors from '../../../store/profile/profile.selectors';
import { DateService } from 'src/app/util/service/date.service';
import { RecurringInterval, SyncStatus, TransactionStatus, TransactionType } from 'src/app/util/config/enums';
import { APP_CONFIG } from 'src/app/util/config/config';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';
import { TransactionsService } from 'src/app/util/service/db/transactions.service';
import { FamilyService } from 'src/app/modules/family/services/family.service';

@Component({
  selector: 'transaction-list',
  templateUrl: './transaction-list.component.html',
  styleUrl: './transaction-list.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterModule,
    MatTabsModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatDialogModule,
    TranslateModule,
    SearchFilterComponent,
    TransactionTableComponent,
    MobileTransactionListComponent,
    CalendarViewComponent,
    MonthlyExpenditureCardComponent
]
})
export class TransactionListComponent implements OnInit, OnDestroy {
  isHome = input<boolean>(false);

  private readonly loaderService = inject(LoaderService);
  private readonly _dialog = inject(MatDialog);
  private readonly auth = inject(Auth);
  private readonly notificationService = inject(NotificationService);
  private readonly filterService = inject(FilterService);
  private readonly store = inject(Store<AppState>);
  private readonly dateService = inject(DateService);
  public readonly breakpointService = inject(BreakpointService);
  private readonly router = inject(Router);
  private readonly transactionsService = inject(TransactionsService);
  private readonly userService = inject(UserService);
  private readonly route = inject(ActivatedRoute);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly familyService = inject(FamilyService);

  // Signals from store
  transactions = this.store.selectSignal(TransactionsSelectors.selectAllTransactions);
  transactionsLoading = this.store.selectSignal(TransactionsSelectors.selectTransactionsLoading);
  transactionsError = this.store.selectSignal(TransactionsSelectors.selectTransactionsError);

  selectedTx = signal<any>(null);
  selectedTabIndex = signal<number>(0);

  // UI State
  showFullTable = signal<boolean>(false);
  isTransactionsPage = signal<boolean>(false);
  isRecurringTab = signal<boolean>(false);

  private destroy$ = new Subject<void>();

  constructor() {
    this.isTransactionsPage.set(this.router.url.includes('transactions') ? true : false);

    // Effect for error handling
    effect(() => {
      const error = this.transactionsError();
      if (error) {
        console.error('Error loading transactions:', error);
        // Use untracked if we don't want to loop, but here it's just a reaction to error
        this.notificationService.error('Failed to load transactions');
       // this.loaderService.hide();
      }
    });

    // Effect for loading state
    effect(() => {
      const loading = this.transactionsLoading();
      if (!loading) {
        //this.loaderService.hide();
      }
    });
  }

  ngOnInit() {
    this.loadTransactions();
    this.checkQueryParams();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private checkQueryParams() {
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['tab'] === 'recurring') {
        this.selectedTabIndex.set(3);
        this.filterService.setIsRecurring(true);
        this.isRecurringTab.set(true);
      } else {
        this.selectedTabIndex.set(0);
        this.filterService.setIsRecurring(null);
        this.isRecurringTab.set(false);
      }
      if (params['search']) {
        this.filterService.setSearchTerm(params['search']);
      }
    });
  }

  onTabChange(index: number) {
    if (this.selectedTabIndex() === index) return;
    this.selectedTabIndex.set(index);
    if (index === 3) {
      this.filterService.setIsRecurring(true);
      this.isRecurringTab.set(true);
      this.router.navigate([], { queryParams: { tab: 'recurring' }, queryParamsHandling: 'merge' });
    } else {
      this.filterService.setIsRecurring(null);
      this.isRecurringTab.set(false);
      this.router.navigate([], { queryParams: { tab: null }, queryParamsHandling: 'merge' });
    }
  }

  loadTransactions() {
    //this.loaderService.show();
    const userId = this.userService.getCurrentUserId();
    if (userId) {
      this.store.dispatch(TransactionsActions.loadTransactions({ userId }));
      this.store.dispatch(CategoriesActions.loadCategories({ userId }));
    }
  }

  editTransaction(transaction: Transaction) {
    let dialogRef = this._dialog.open(MobileAddTransactionComponent, {
      panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : 'desktop-dialog',
      data: transaction
    });

    dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe((result) => {
    });
  }

  adjustTransaction(transaction: Transaction) {
    let dialogRef = this._dialog.open(MobileAddTransactionComponent, {
      panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : 'desktop-dialog',
      data: { transaction, mode: 'adjustment' }
    });

    dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe((result) => {
    });
  }

  async deleteTransaction(transaction: Transaction) {
    const userId = this.userService.getCurrentUserId();
    if (userId && transaction.id) {
      const isFamily = !!transaction.familyId && !transaction.accountId;
      
      if (isFamily) {
        this.store.dispatch(FamilyActions.deleteTransaction({ 
          familyId: transaction.familyId!, 
          txId: transaction.id 
        }));
      } else {
        this.store.dispatch(TransactionsActions.deleteTransaction({ 
          userId, 
          transactionId: transaction.id 
        }));
      }
      
      // If it's a settlement, the Effects layer will cascade and show 'Settlement reverted'
      // We shouldn't show a double toast here.
      if (!transaction.settlementId) {
        this.notificationService.success('Transaction deleted');
      }
    }
  }

  onLongPress(tx: any) {
    this.selectedTx.set(tx);
  }

  // Row-level editing methods
  startRowEdit(element: any) {
    element.originalValues = {
      amount: element.amount,
      type: element.type
    };
    element.isEditing = true;
  }

  saveRowEdit(element: any) {
    const amount = parseFloat(element.amount);
    if (!amount || amount <= 0) {
      this.notificationService.error('Amount must be a positive number');
      return;
    }

    if (!element.type || (element.type !== 'income' && element.type !== 'expense')) {
      this.notificationService.error('Please select a valid transaction type');
      return;
    }

    const updateData = {
      amount: amount,
      type: element.type
    };

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
    element.amount = element.originalValues.amount;
    element.type = element.originalValues.type;
    element.isEditing = false;
    delete element.originalValues;
  }

  openImportDialog() {
    const dialogRef = this._dialog.open(ImportTransactionsComponent, {
      panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : 'import-transactions-dialog',
    });
    dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe((imported: any[]) => {
      if (imported && imported.length) {
        this.importTransactions(imported);
      }
    });
  }

  private async importTransactions(transactions: any[]) {
    //this.loaderService.show();
    const userId = this.userService.getCurrentUserId();

    if (!userId) {
      this.notificationService.error('User not authenticated');
      //this.loaderService.hide();
      return;
    }

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const tx of transactions) {
        try {
          const date = new Date(tx.date);
          if (isNaN(date.getTime())) {
            throw new Error('Invalid date format');
          }

          const transactionData = {
            userId: userId,
            accountId: tx.accountId,
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
            familyId: this.store.selectSignal(ProfileSelectors.selectIsFamilyMode)() ? (this.familyService.activeFamilyId() || undefined) : undefined,
          };

          this.store.dispatch(TransactionsActions.createTransaction({ userId, transaction: transactionData }));
          successCount++;
        } catch (error) {
          console.error('Error importing transaction:', tx, error);
          errorCount++;
        }
      }

     // this.loaderService.hide();

      if (successCount > 0) {
        this.notificationService.success(`Successfully imported ${successCount} transactions`);
        this.store.dispatch(TransactionsActions.loadTransactions({ userId }));
      }

      if (errorCount > 0) {
        this.notificationService.warning(`${errorCount} transactions failed to import `);
      }

    } catch (error) {
      //this.loaderService.hide();
      this.notificationService.error('Failed to import transactions');
      console.error('Import error:', error);
    }
  }

  refreshTransactions(): void {
    const userId = this.userService.getCurrentUserId();
    if (userId) {
      this.store.dispatch(TransactionsActions.loadTransactions({ userId }));
      this.notificationService.success('Transactions refreshed');
    }
  }

  openFilterDialog(): void {
    this.notificationService.success('Filter functionality coming soon');
  }

  viewAnalytics(): void {
    this.notificationService.success('Analytics view coming soon');
  }

  addTransactionDialog(): void {
    this._dialog.open(MobileAddTransactionComponent, {
      panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : 'desktop-dialog',
    }).afterClosed().pipe(takeUntil(this.destroy$)).subscribe((transaction: Transaction) => {
      if (transaction) {
        const userId = this.userService.getCurrentUserId();
        if (userId) {
          this.store.dispatch(TransactionsActions.loadTransactions({ userId }));
        }
      }
    });
  }

  expandTable(): void {
    this.showFullTable.update(v => !v);
  }

  // Bulk operations - Optimized
  async bulkDeleteTransactions(transactions: Transaction[]) {
    if (!transactions || transactions.length === 0) return;

    //this.loaderService.show();
    const userId = this.userService.getCurrentUserId();

    if (!userId) {
      this.notificationService.error('User not authenticated');
      //this.loaderService.hide();
      return;
    }

    try {
      // Use helper to create array of promises
      const deletePromises = transactions.map(transaction =>
        this.transactionsService.deleteTransaction(userId, transaction.id!).toPromise()
      );

      await Promise.all(deletePromises);

      this.notificationService.success(`Successfully deleted ${transactions.length} transaction(s)`);
      this.store.dispatch(TransactionsActions.loadTransactions({ userId }));
    } catch (error) {
      console.error('Error deleting transactions:', error);
      this.notificationService.error('Failed to delete some transactions');
    } finally {
      //this.loaderService.hide();
    }
  }

  async bulkUpdateCategory(data: { transactions: Transaction[], categoryId: string }) {
    const { transactions, categoryId } = data;

    if (!transactions || transactions.length === 0 || !categoryId) return;

    //this.loaderService.show();
    const userId = this.userService.getCurrentUserId();

    if (!userId) {
      this.notificationService.error('User not authenticated');
      //this.loaderService.hide();
      return;
    }

    try {
      const updatePromises = transactions.map(transaction => {
        const updatedTransaction = { categoryId: categoryId };
        return this.transactionsService.updateTransaction(userId, transaction.id!, updatedTransaction).toPromise();
      });

      await Promise.all(updatePromises);

      this.notificationService.success(`Successfully updated category for ${transactions.length} transaction(s)`);
      this.store.dispatch(TransactionsActions.loadTransactions({ userId }));
    } catch (error) {
      console.error('Error updating transactions:', error);
      this.notificationService.error('Failed to update some transactions');
    } finally {
      //this.loaderService.hide();
    }
  }
}
