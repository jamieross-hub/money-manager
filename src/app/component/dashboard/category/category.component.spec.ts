import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { CategoryComponent } from './category.component';
import { Auth } from '@angular/fire/auth';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Store } from '@ngrx/store';
import { NotificationService } from 'src/app/util/service/notification.service';
import { HapticFeedbackService } from 'src/app/util/service/haptic-feedback.service';
import { CategoryBudgetService } from 'src/app/util/service/category-budget.service';
import { DateService } from 'src/app/util/service/date.service';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';
import { CategoryService } from 'src/app/util/service/db/category.service';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { Category } from 'src/app/util/models/category.model';
import { Transaction } from 'src/app/util/models/transaction.model';
import { TransactionType } from 'src/app/util/config/enums';
import * as CategoriesActions from '../../../store/categories/categories.actions';
import * as TransactionsActions from '../../../store/transactions/transactions.actions';
import { CommonModule } from '@angular/common';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('CategoryComponent', () => {
  let component: CategoryComponent;
  let fixture: ComponentFixture<CategoryComponent>;
  let mockAuth: jasmine.SpyObj<Auth>;
  let mockDialog: jasmine.SpyObj<MatDialog>;
  let mockStore: jasmine.SpyObj<Store>;
  let mockNotificationService: jasmine.SpyObj<NotificationService>;
  let mockHapticFeedback: jasmine.SpyObj<HapticFeedbackService>;
  let mockBreakpointObserver: jasmine.SpyObj<BreakpointObserver>;
  let mockBudgetService: jasmine.SpyObj<CategoryBudgetService>;
  let mockDateService: jasmine.SpyObj<DateService>;
  let mockBreakpointService: jasmine.SpyObj<BreakpointService>;
  let mockCategoryService: jasmine.SpyObj<CategoryService>;
  let mockRouter: jasmine.SpyObj<Router>;

  const mockUser = {
    uid: 'test-user-id',
    email: 'test@example.com'
  };

  const mockCategories: Category[] = [
    {
      id: '1',
      name: 'Food',
      type: TransactionType.EXPENSE,
      icon: 'restaurant',
      color: '#FF5722',
      createdAt: Date.now(),
      budget: {
        hasBudget: true,
        budgetAmount: 500,
        budgetPeriod: 'monthly',
        budgetStartDate: new Date('2024-01-01'),
        budgetEndDate: new Date('2024-01-31')
      } as any
    },
    {
      id: '2',
      name: 'Transport',
      type: TransactionType.EXPENSE,
      icon: 'directions_car',
      color: '#2196F3',
      createdAt: Date.now(),
      budget: {
        hasBudget: true,
        budgetAmount: 300,
        budgetPeriod: 'monthly',
        budgetStartDate: new Date('2024-01-01'),
        budgetEndDate: new Date('2024-01-31')
      } as any
    }
  ];

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
      status: 'completed' as any,
      syncStatus: 'synced' as any,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'test-user-id',
      updatedBy: 'test-user-id'
    },
    {
      id: '2',
      amount: 30,
      payee: 'Gas Station',
      categoryId: '2',
      category: 'Transport',
      accountId: 'account1',
      userId: 'test-user-id',
      type: TransactionType.EXPENSE,
      date: new Date('2024-01-16'),
      status: 'completed' as any,
      syncStatus: 'synced' as any,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'test-user-id',
      updatedBy: 'test-user-id'
    }
  ];

  beforeEach(async () => {
    const authSpy = jasmine.createSpyObj('Auth', [], { currentUser: Promise.resolve(mockUser) });
    const dialogSpy = jasmine.createSpyObj('MatDialog', ['open']);
    const storeSpy = jasmine.createSpyObj('Store', ['dispatch', 'select']);
    const notificationSpy = jasmine.createSpyObj('NotificationService', ['success', 'error']);
    const hapticSpy = jasmine.createSpyObj('HapticFeedbackService', ['light']);
    const breakpointSpy = jasmine.createSpyObj('BreakpointObserver', ['observe']);
    const budgetSpy = jasmine.createSpyObj('CategoryBudgetService', [
      'calculateBudget',
      'getBudgetProgressColor',
      'formatBudgetPeriod'
    ]);
    const dateSpy = jasmine.createSpyObj('DateService', ['toDate', 'now']);
    const breakpointServiceSpy = jasmine.createSpyObj('BreakpointService', [], {
      device: { isMobile: false }
    });
    const categorySpy = jasmine.createSpyObj('CategoryService', ['deleteCategory']);
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      declarations: [CategoryComponent],
      imports: [
        CommonModule,
        MatIconModule,
        NoopAnimationsModule
      ],
      providers: [
        { provide: Auth, useValue: authSpy },
        { provide: MatDialog, useValue: dialogSpy },
        { provide: Store, useValue: storeSpy },
        { provide: NotificationService, useValue: notificationSpy },
        { provide: HapticFeedbackService, useValue: hapticSpy },
        { provide: BreakpointObserver, useValue: breakpointSpy },
        { provide: CategoryBudgetService, useValue: budgetSpy },
        { provide: DateService, useValue: dateSpy },
        { provide: BreakpointService, useValue: breakpointServiceSpy },
        { provide: CategoryService, useValue: categorySpy },
        { provide: Router, useValue: routerSpy }
      ]
    }).compileComponents();

    mockAuth = TestBed.inject(Auth) as jasmine.SpyObj<Auth>;
    mockDialog = TestBed.inject(MatDialog) as jasmine.SpyObj<MatDialog>;
    mockStore = TestBed.inject(Store) as jasmine.SpyObj<Store>;
    mockNotificationService = TestBed.inject(NotificationService) as jasmine.SpyObj<NotificationService>;
    mockHapticFeedback = TestBed.inject(HapticFeedbackService) as jasmine.SpyObj<HapticFeedbackService>;
    mockBreakpointObserver = TestBed.inject(BreakpointObserver) as jasmine.SpyObj<BreakpointObserver>;
    mockBudgetService = TestBed.inject(CategoryBudgetService) as jasmine.SpyObj<CategoryBudgetService>;
    mockDateService = TestBed.inject(DateService) as jasmine.SpyObj<DateService>;
    mockBreakpointService = TestBed.inject(BreakpointService) as jasmine.SpyObj<BreakpointService>;
    mockCategoryService = TestBed.inject(CategoryService) as jasmine.SpyObj<CategoryService>;
    mockRouter = TestBed.inject(Router) as jasmine.SpyObj<Router>;

    // Setup store selectors
    mockStore.select.and.returnValues(
      of(false), // isLoading$
      of(mockTransactions), // transactions$
      of(mockCategories) // selectAllCategories
    );

    // Setup breakpoint observer
    mockBreakpointObserver.observe.and.returnValue(of({ matches: false, breakpoints: {} }));

    // Setup date service
    mockDateService.toDate.and.returnValue(new Date());
    mockDateService.now.and.returnValue({ toDate: () => new Date() } as any);

    // Setup budget service
    mockBudgetService.getBudgetProgressColor.and.returnValue('success');
    mockBudgetService.formatBudgetPeriod.and.returnValue('Monthly');
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CategoryComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Basic Functionality', () => {
    it('should initialize component', fakeAsync(() => {
      fixture.detectChanges();
      tick();

      expect(mockStore.dispatch).toHaveBeenCalledWith(
        CategoriesActions.loadCategories({ userId: 'test-user-id' })
      );
      expect(mockStore.dispatch).toHaveBeenCalledWith(
        TransactionsActions.loadTransactions({ userId: 'test-user-id' })
      );
    }));

    it('should track categories by ID', () => {
      const result = component.trackByCategoryId(0, mockCategories[0]);
      expect(result).toBe('1');
    });

    it('should clear error message', () => {
      component.errorMessage = 'Test error';
      component.clearError();
      expect(component.errorMessage).toBe('');
    });

/*
    it('should toggle budget summary expansion', () => {
      expect(component.isBudgetSummaryExpanded).toBe(false);
      component.toggleBudgetSummaryExpansion();
      expect(component.isBudgetSummaryExpanded).toBe(true);
    });
*/

    it('should toggle list view mode', () => {
      expect(component.isListViewMode).toBe(false);
      component.toggleListViewMode();
      expect(component.isListViewMode).toBe(true);
    });
  });

  describe('Category Operations', () => {
    beforeEach(() => {
      // component.categories = mockCategories;
      // component.transactions = mockTransactions;
    });

/*
    it('should get sub-categories for a parent category', () => {
      const subCategory: Category = {
        ...mockCategories[0],
        id: '3',
        name: 'Sub Food',
        parentCategoryId: '1',
        isSubCategory: true
      };
      component.categories = [...mockCategories, subCategory];

      const result = component.getSubCategoriesForCategory('1');
      expect(result).toEqual([subCategory]);
    });
*/

    it('should open mobile dialog for editing category', () => {
      mockDialog.open.and.returnValue({
        afterClosed: () => of(null)
      } as any);

      component.openMobileDialog(mockCategories[0]);

      expect(mockDialog.open).toHaveBeenCalled();
    });

    it('should open mobile dialog for adding new category', () => {
      mockDialog.open.and.returnValue({
        afterClosed: () => of(null)
      } as any);

      component.openAddMobileDialog();

      expect(mockDialog.open).toHaveBeenCalled();
    });
  });

  describe('Budget Calculations', () => {
    beforeEach(() => {
      // component.categories = mockCategories;
      // component.transactions = mockTransactions;
    });

/*
    it('should calculate budget progress percentage', () => {
      const result = component.calculateBudgetProgressPercentage(mockCategories[0]);
      expect(typeof result).toBe('number');
    });

    it('should calculate budget remaining', () => {
      const result = component.calculateBudgetRemaining(mockCategories[0]);
      expect(typeof result).toBe('number');
    });

    it('should calculate budget spent', () => {
      const result = component.calculateBudgetSpent(mockCategories[0]);
      expect(typeof result).toBe('number');
    });

    it('should get budget progress color', () => {
      const result = component.getBudgetProgressColor(mockCategories[0]);
      expect(typeof result).toBe('string');
    });

    it('should get budget status class', () => {
      const result = component.getBudgetStatusClass(mockCategories[0]);
      expect(typeof result).toBe('string');
    });
*/
  });

  describe('Transaction Operations', () => {
    beforeEach(() => {
      // component.categories = mockCategories;
      // component.transactions = mockTransactions;
    });

/*
    it('should get recent transactions for a category', () => {
      const result = component.getRecentTransactions(mockCategories[0]);
      expect(Array.isArray(result)).toBe(true);
    });
*/

/*
    it('should calculate total spent per month for a category', () => {
      const result = component.calculateTotalSpentPerMonth(mockCategories[0]);
      expect(typeof result).toBe('number');
    });

    it('should calculate total income per month for a category', () => {
      const result = component.calculateTotalIncomePerMonth(mockCategories[0]);
      expect(typeof result).toBe('number');
    });
*/
  });

  describe('UI State Management', () => {
/*
    it('should format budget period correctly', () => {
      const result = component.formatBudgetPeriod('monthly');
      expect(result).toBe('Monthly');
    });

    it('should get remaining budget class', () => {
      const result = component.getRemainingBudgetClass(mockCategories[0]);
      expect(typeof result).toBe('string');
    });
*/
  });

  describe('Component Lifecycle', () => {
    it('should cleanup on destroy', () => {
      spyOn(component['destroy$'], 'next');
      spyOn(component['destroy$'], 'complete');

      component.ngOnDestroy();

      expect(component['destroy$'].next).toHaveBeenCalled();
      expect(component['destroy$'].complete).toHaveBeenCalled();
    });
  });
});
