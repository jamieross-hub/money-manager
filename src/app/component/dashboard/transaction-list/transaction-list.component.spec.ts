import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { TransactionListComponent } from './transaction-list.component';
import { Auth } from '@angular/fire/auth';
import { MatDialog } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { NotificationService } from 'src/app/util/service/notification.service';
import { LoaderService } from 'src/app/util/service/loader.service';
import { FilterService } from 'src/app/util/service/filter.service';
import { DateService } from 'src/app/util/service/date.service';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';
import { Router, ActivatedRoute } from '@angular/router';
import { TransactionsService } from 'src/app/util/service/db/transactions.service';
import { UserService } from 'src/app/util/service/db/user.service';
import { of, Subject } from 'rxjs';
import { Transaction } from 'src/app/util/models/transaction.model';
import { TransactionType, TransactionStatus, SyncStatus } from 'src/app/util/config/enums';
import * as TransactionsActions from '../../../store/transactions/transactions.actions';
import * as CategoriesActions from '../../../store/categories/categories.actions';
import { signal } from '@angular/core';

describe('TransactionListComponent', () => {
  let component: TransactionListComponent;
  let fixture: ComponentFixture<TransactionListComponent>;
  let mockAuth: jasmine.SpyObj<Auth>;
  let mockDialog: jasmine.SpyObj<MatDialog>;
  let mockStore: jasmine.SpyObj<Store>;
  let mockNotificationService: jasmine.SpyObj<NotificationService>;
  let mockLoaderService: jasmine.SpyObj<LoaderService>;
  let mockFilterService: jasmine.SpyObj<FilterService>;
  let mockDateService: jasmine.SpyObj<DateService>;
  let mockBreakpointService: jasmine.SpyObj<BreakpointService>;
  let mockRouter: jasmine.SpyObj<Router>;
  let mockTransactionsService: jasmine.SpyObj<TransactionsService>;
  let mockUserService: jasmine.SpyObj<UserService>;

  const mockUser = {
    uid: 'test-user-id',
    email: 'test@example.com'
  };

  const mockTransactions: Transaction[] = [
    {
      id: '1',
      amount: 50,
      payee: 'Grocery Store',
      categoryId: '1',
      category: 'Food',
      accountId: 'account1',
      userId: 'test-user-id',
      type: TransactionType.EXPENSE,
      date: new Date('2024-01-15'),
      status: TransactionStatus.COMPLETED,
      syncStatus: SyncStatus.SYNCED,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'test-user-id',
      updatedBy: 'test-user-id'
    }
  ];

  beforeEach(async () => {
    const authSpy = jasmine.createSpyObj('Auth', [], { currentUser: mockUser });
    const dialogSpy = jasmine.createSpyObj('MatDialog', ['open']);
    const storeSpy = jasmine.createSpyObj('Store', ['dispatch', 'select', 'selectSignal']);
    const notificationSpy = jasmine.createSpyObj('NotificationService', ['success', 'error']);
    const loaderSpy = jasmine.createSpyObj('LoaderService', ['show', 'hide']);
    const filterSpy = jasmine.createSpyObj('FilterService', ['clearAllFilters', 'hasActiveFilters', 'setSearchTerm', 'setIsRecurring']);
    const dateSpy = jasmine.createSpyObj('DateService', ['toDate', 'now']);
    const breakpointServiceSpy = jasmine.createSpyObj('BreakpointService', [], {
      device: { isMobile: false, isTablet: false, isDesktop: true },
      isMobile: false
    });
    const routerSpy = jasmine.createSpyObj('Router', ['navigate'], { url: '/transactions' });
    const transactionsServiceSpy = jasmine.createSpyObj('TransactionsService', ['deleteTransaction', 'updateTransaction']);
    const userServiceSpy = jasmine.createSpyObj('UserService', ['getCurrentUserId']);

    // Mock ActivatedRoute
    const queryParamsSubject = new Subject();
    const mockActivatedRoute = {
      queryParams: queryParamsSubject.asObservable()
    };

    await TestBed.configureTestingModule({
      imports: [TransactionListComponent], // Standalone component
      providers: [
        { provide: Auth, useValue: authSpy },
        { provide: MatDialog, useValue: dialogSpy },
        { provide: Store, useValue: storeSpy },
        { provide: NotificationService, useValue: notificationSpy },
        { provide: LoaderService, useValue: loaderSpy },
        { provide: FilterService, useValue: filterSpy },
        { provide: DateService, useValue: dateSpy },
        { provide: BreakpointService, useValue: breakpointServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: TransactionsService, useValue: transactionsServiceSpy },
        { provide: UserService, useValue: userServiceSpy },
        { provide: ActivatedRoute, useValue: mockActivatedRoute }
      ]
    }).compileComponents();

    mockStore = TestBed.inject(Store) as jasmine.SpyObj<Store>;
    mockLoaderService = TestBed.inject(LoaderService) as jasmine.SpyObj<LoaderService>;
    mockNotificationService = TestBed.inject(NotificationService) as jasmine.SpyObj<NotificationService>;
    mockDialog = TestBed.inject(MatDialog) as jasmine.SpyObj<MatDialog>;
    mockTransactionsService = TestBed.inject(TransactionsService) as jasmine.SpyObj<TransactionsService>;
    mockUserService = TestBed.inject(UserService) as jasmine.SpyObj<UserService>;

    mockUserService.getCurrentUserId.and.returnValue('test-user-id');

    // Mock selectSignal to return signals
    // Use 'any' to bypass strict generic checks in mock
    mockStore.selectSignal.and.callFake((selector: any) => {
      return signal(mockTransactions) as any;
    });

    const transactionsSignal = signal(mockTransactions);
    const loadingSignal = signal(false);
    const errorSignal = signal(null);

    mockStore.selectSignal.and.returnValues(
      transactionsSignal as any,
      loadingSignal as any,
      errorSignal as any
    );
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TransactionListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Initialization', () => {
    it('should initialize component and load transactions', () => {
      expect(mockLoaderService.show).toHaveBeenCalled();

      expect(mockStore.dispatch).toHaveBeenCalledWith(
        TransactionsActions.loadTransactions({ userId: 'test-user-id' })
      );
      expect(mockStore.dispatch).toHaveBeenCalledWith(
        CategoriesActions.loadCategories({ userId: 'test-user-id' })
      );
    });

    it('should detect transactions page correctly', () => {
      expect(component.isTransactionsPage()).toBe(true);
    });
  });

  describe('CRUD Operations - Add Transaction', () => {
    it('should open add transaction dialog', () => {
      mockDialog.open.and.returnValue({
        afterClosed: () => of(null)
      } as any);

      component.addTransactionDialog();

      expect(mockDialog.open).toHaveBeenCalled();
    });

    it('should handle successful transaction creation', () => {
      const newTransaction = { ...mockTransactions[0], id: '4', payee: 'New Transaction' };
      mockDialog.open.and.returnValue({
        afterClosed: () => of(newTransaction)
      } as any);

      component.addTransactionDialog();

      // The dialog close triggers loadTransactions dispatch
      expect(mockStore.dispatch).toHaveBeenCalled();
    });
  });

  describe('CRUD Operations - Edit Transaction', () => {
    it('should open edit transaction dialog', () => {
      mockDialog.open.and.returnValue({
        afterClosed: () => of(null)
      } as any);

      component.editTransaction(mockTransactions[0]);

      expect(mockDialog.open).toHaveBeenCalled();
    });

    it('should handle inline row editing', () => {
      const element = { ...mockTransactions[0], isEditing: false };

      component.startRowEdit(element);
      expect(element.isEditing).toBe(true);

      component.saveRowEdit(element);
      expect(element.isEditing).toBe(false);
    });

    it('should cancel row editing', () => {
      const element = { ...mockTransactions[0], isEditing: true };

      component.cancelRowEdit(element);
      expect(element.isEditing).toBe(false);
    });
  });

  describe('CRUD Operations - Delete Transaction', () => {
    it('should dispatch delete action', async () => {
      await component.deleteTransaction(mockTransactions[0]);

      expect(mockStore.dispatch).toHaveBeenCalledWith(
        TransactionsActions.deleteTransaction({ userId: 'test-user-id', transactionId: mockTransactions[0].id! })
      );
      expect(mockNotificationService.success).toHaveBeenCalled();
    });
  });

  describe('Import Operations', () => {
    it('should open import dialog', () => {
      mockDialog.open.and.returnValue({
        afterClosed: () => of(null)
      } as any);

      component.openImportDialog();

      expect(mockDialog.open).toHaveBeenCalled();
    });
  });

  describe('Filtering and Search', () => {
    it('should open filter dialog', () => {
      component.openFilterDialog();
      expect(mockNotificationService.success).toHaveBeenCalledWith('Filter functionality coming soon');
    });
  });

  describe('UI Interactions', () => {
    it('should handle long press on transaction', () => {
      const tx = { ...mockTransactions[0] };
      component.onLongPress(tx);
      expect(component.selectedTx()).toEqual(tx);
    });

    it('should expand table view', () => {
      expect(component.showFullTable()).toBe(false);
      component.expandTable();
      expect(component.showFullTable()).toBe(true);
    });

    it('should refresh transactions', () => {
      component.refreshTransactions();
      expect(mockStore.dispatch).toHaveBeenCalledWith(
        TransactionsActions.loadTransactions({ userId: 'test-user-id' })
      );
    });

    it('should view analytics', () => {
      component.viewAnalytics();
      expect(mockNotificationService.success).toHaveBeenCalledWith('Analytics view coming soon');
    });
  });

  describe('Component Lifecycle', () => {
    it('should cleanup on destroy', () => {
      spyOn(component, 'ngOnDestroy').and.callThrough();
      component.ngOnDestroy();
      expect(component.ngOnDestroy).toHaveBeenCalled();
    });
  });
});
