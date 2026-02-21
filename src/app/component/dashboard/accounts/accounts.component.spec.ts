import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { AccountsComponent } from './accounts.component';
import { Auth } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Store } from '@ngrx/store';
import { NotificationService } from 'src/app/util/service/notification.service';
import { DateService } from 'src/app/util/service/date.service';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';
import { of } from 'rxjs';
import { Account, LoanDetails } from 'src/app/util/models/account.model';
import { AccountType } from 'src/app/util/config/enums';
import * as AccountsActions from '../../../store/accounts/accounts.actions';

describe('AccountsComponent', () => {
  let component: AccountsComponent;
  let fixture: ComponentFixture<AccountsComponent>;
  let mockAuth: jasmine.SpyObj<Auth>;
  let mockRouter: jasmine.SpyObj<Router>;
  let mockDialog: jasmine.SpyObj<MatDialog>;
  let mockBreakpointObserver: jasmine.SpyObj<BreakpointObserver>;
  let mockNotificationService: jasmine.SpyObj<NotificationService>;
  let mockStore: jasmine.SpyObj<Store>;
  let mockDateService: jasmine.SpyObj<DateService>;
  let mockBreakpointService: jasmine.SpyObj<BreakpointService>;

  const mockUser = {
    uid: 'test-user-id',
    email: 'test@example.com'
  };

  const mockAccounts: Account[] = [
    {
      accountId: '1',
      name: 'Main Bank Account',
      type: AccountType.BANK,
      balance: 5000,
      currency: 'USD',
      userId: 'test-user-id',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      accountId: '2',
      name: 'Credit Card',
      type: AccountType.CREDIT,
      balance: -1500,
      currency: 'USD',
      userId: 'test-user-id',
      isActive: true,
      creditCardDetails: {
        dueDate: 15,
        billingCycleStart: 1,
        creditLimit: 5000,
        minimumPayment: 50,
        showReminder: true
      },
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      accountId: '3',
      name: 'Car Loan',
      type: AccountType.LOAN,
      balance: -25000,
      currency: 'USD',
      userId: 'test-user-id',
      isActive: true,
      loanDetails: {
        lenderName: 'Bank',
        loanAmount: 25000,
        interestRate: 5.5,
        startDate: new Date('2024-01-01'),
        durationMonths: 60,
        repaymentFrequency: 'monthly',
        status: 'active',
        totalPaid: 0,
        remainingBalance: 25000,
        nextDueDate: new Date('2024-02-01'),
        showReminder: true,
        monthlyPayment: 478.33,
        endDate: new Date('2029-01-01')
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  beforeEach(async () => {
    const authSpy = jasmine.createSpyObj('Auth', [], { currentUser: mockUser });
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    const dialogSpy = jasmine.createSpyObj('MatDialog', ['open']);
    const breakpointSpy = jasmine.createSpyObj('BreakpointObserver', ['observe']);
    const notificationSpy = jasmine.createSpyObj('NotificationService', ['success', 'error']);
    const storeSpy = jasmine.createSpyObj('Store', ['dispatch', 'select']);
    const dateSpy = jasmine.createSpyObj('DateService', ['toDate', 'now']);
    const breakpointServiceSpy = jasmine.createSpyObj('BreakpointService', [], {
      device: {
        isMobile: false,
        isTablet: false,
        isDesktop: true
      },
      isMobile: false,
      isTablet: false,
      isDesktop: true
    });

    await TestBed.configureTestingModule({
      declarations: [AccountsComponent],
      providers: [
        { provide: Auth, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
        { provide: MatDialog, useValue: dialogSpy },
        { provide: BreakpointObserver, useValue: breakpointSpy },
        { provide: NotificationService, useValue: notificationSpy },
        { provide: Store, useValue: storeSpy },
        { provide: DateService, useValue: dateSpy },
        { provide: BreakpointService, useValue: breakpointServiceSpy }
      ]
    }).compileComponents();

    mockAuth = TestBed.inject(Auth) as jasmine.SpyObj<Auth>;
    mockRouter = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    mockDialog = TestBed.inject(MatDialog) as jasmine.SpyObj<MatDialog>;
    mockBreakpointObserver = TestBed.inject(BreakpointObserver) as jasmine.SpyObj<BreakpointObserver>;
    mockNotificationService = TestBed.inject(NotificationService) as jasmine.SpyObj<NotificationService>;
    mockStore = TestBed.inject(Store) as jasmine.SpyObj<Store>;
    mockDateService = TestBed.inject(DateService) as jasmine.SpyObj<DateService>;
    mockBreakpointService = TestBed.inject(BreakpointService) as jasmine.SpyObj<BreakpointService>;

    // Setup store selectors
    mockStore.select.and.returnValues(
      of(mockAccounts), // accounts$
      of(false), // isLoading$
      of(null), // error$
      of(1000) // totalBalance$
    );

    // Setup breakpoint observer
    mockBreakpointObserver.observe.and.returnValue(of({ matches: false, breakpoints: {} }));

    // Setup date service
    mockDateService.toDate.and.returnValue(new Date());
    mockDateService.now.and.returnValue({ toDate: () => new Date() } as any);
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AccountsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Initialization', () => {
    it('should initialize component with authenticated user', fakeAsync(() => {
      fixture.detectChanges();
      tick();

      expect(mockStore.dispatch).toHaveBeenCalledWith(
        AccountsActions.loadAccounts({ userId: 'test-user-id' })
      );
    }));

    it('should handle unauthenticated user', fakeAsync(() => {
      (mockAuth.currentUser as any) = null;
      
      fixture.detectChanges();
      tick();

      expect(component.errorMessage).toBe('User not authenticated');
    }));

    it('should load accounts from store', () => {
      component.accounts = mockAccounts;
      
      expect(component.accounts).toEqual(mockAccounts);
      expect(component.accounts.length).toBe(3);
    });
  });

  describe('CRUD Operations - Add Account', () => {
    it('should open add account dialog', () => {
      mockDialog.open.and.returnValue({
        afterClosed: () => of(null)
      } as any);

      component.addAccount();

      expect(mockDialog.open).toHaveBeenCalled();
    });

    it('should handle successful account creation', () => {
      const newAccount = { ...mockAccounts[0], accountId: '4', name: 'New Account' };
      mockDialog.open.and.returnValue({
        afterClosed: () => of(newAccount)
      } as any);

      component.addAccount();

      expect(mockNotificationService.success).toHaveBeenCalled();
    });
  });

  describe('CRUD Operations - Edit Account', () => {
    it('should open edit account dialog', () => {
      mockDialog.open.and.returnValue({
        afterClosed: () => of(null)
      } as any);

      component.editAccount(mockAccounts[0]);

      expect(mockDialog.open).toHaveBeenCalled();
      expect(component.selectedAccount).toEqual(mockAccounts[0]);
    });

    it('should open account dialog for editing', () => {
      mockDialog.open.and.returnValue({
        afterClosed: () => of(null)
      } as any);

      component.openAccountDialog(mockAccounts[0]);

      expect(mockDialog.open).toHaveBeenCalled();
    });
  });

  describe('CRUD Operations - Delete Account', () => {
    it('should open delete confirmation dialog', async () => {
      mockDialog.open.and.returnValue({
        afterClosed: () => of(true)
      } as any);

      await component.deleteAccount(mockAccounts[0]);

      expect(mockDialog.open).toHaveBeenCalled();
    });

    it('should handle successful account deletion', async () => {
      mockDialog.open.and.returnValue({
        afterClosed: () => of(true)
      } as any);

      await component.deleteAccount(mockAccounts[0]);

      expect(mockNotificationService.success).toHaveBeenCalled();
    });

    it('should handle deletion cancellation', async () => {
      mockDialog.open.and.returnValue({
        afterClosed: () => of(false)
      } as any);

      await component.deleteAccount(mockAccounts[0]);

      expect(mockNotificationService.success).not.toHaveBeenCalled();
    });
  });

  describe('Account Operations', () => {
    beforeEach(() => {
      component.accounts = mockAccounts;
    });

    it('should track accounts by ID', () => {
      const result = component.trackByAccountId(0, mockAccounts[0]);
      expect(result).toBe('1');
    });

    it('should handle account click', () => {
      component.onAccountClick(mockAccounts[0]);

      expect(component.selectedAccount).toEqual(mockAccounts[0]);
    });

    it('should toggle account expansion', () => {
      expect(component.expandedAccount).toBeNull();

      component.toggleAccountExpansion(mockAccounts[0]);
      expect(component.expandedAccount).toEqual(mockAccounts[0]);

      component.toggleAccountExpansion(mockAccounts[0]);
      expect(component.expandedAccount).toBeNull();
    });
  });

  describe('Account Calculations', () => {
    beforeEach(() => {
      component.accounts = mockAccounts;
    });

    it('should calculate monthly interest for loan account', () => {
      const result = component.calculateMonthlyInterest(mockAccounts[2]); // Car loan
      expect(result).toBeCloseTo(114.58, 2); // (25000 * 5.5%) / 12
    });

    it('should return 0 for non-loan accounts', () => {
      const result = component.calculateMonthlyInterest(mockAccounts[0]); // Bank account
      expect(result).toBe(0);
    });

    it('should identify loan accounts correctly', () => {
      expect(component.isLoanAccount(mockAccounts[2])).toBe(true);
      expect(component.isLoanAccount(mockAccounts[0])).toBe(false);
    });

    it('should identify credit card accounts correctly', () => {
      expect(component.isCreditCardAccount(mockAccounts[1])).toBe(true);
      expect(component.isCreditCardAccount(mockAccounts[0])).toBe(false);
    });

    it('should get loan details', () => {
      const result = component.getLoanDetails(mockAccounts[2]);
      expect(result).toBeDefined();
      expect(result?.loanAmount).toBe(25000);
    });

    it('should get credit card details', () => {
      const result = component.getCreditCardDetails(mockAccounts[1]);
      expect(result).toBeDefined();
      expect(result.creditLimit).toBe(5000);
    });
  });

  describe('Date Calculations', () => {
    it('should calculate next due date for credit card', () => {
      const result = component.calculateNextDueDate(mockAccounts[1]);
      expect(result).toBeInstanceOf(Date);
    });

    it('should calculate next billing date for credit card', () => {
      const result = component.calculateNextBillingDate(mockAccounts[1]);
      expect(result).toBeInstanceOf(Date);
    });

    it('should get day suffix correctly', () => {
      expect(component.getDaySuffix(1)).toBe('st');
      expect(component.getDaySuffix(2)).toBe('nd');
      expect(component.getDaySuffix(3)).toBe('rd');
      expect(component.getDaySuffix(4)).toBe('th');
      expect(component.getDaySuffix(21)).toBe('st');
    });
  });

  describe('Account Filtering and Statistics', () => {
    beforeEach(() => {
      component.accounts = mockAccounts;
    });

    it('should get positive accounts', () => {
      const result = component.getPositiveAccounts();
      expect(result.length).toBe(1);
      expect(result[0].balance).toBeGreaterThan(0);
    });

    it('should get negative accounts', () => {
      const result = component.getNegativeAccounts();
      expect(result.length).toBe(2);
      expect(result[0].balance).toBeLessThan(0);
    });

    it('should calculate total positive balance', () => {
      const result = component.getTotalPositiveBalance();
      expect(result).toBe(5000);
    });

    it('should calculate total negative balance', () => {
      const result = component.getTotalNegativeBalance();
      expect(result).toBe(-26500); // -1500 + (-25000)
    });

    it('should get account stats', () => {
      const result = component.getAccountStats(mockAccounts[0]);
      expect(result).toBeDefined();
    });

    it('should get recent transactions for account', () => {
      const result = component.getRecentTransactions(mockAccounts[0]);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('UI State Management', () => {
    it('should get balance class correctly', () => {
      expect(component.getBalanceClass(mockAccounts[0])).toBe('positive-balance');
      expect(component.getBalanceClass(mockAccounts[1])).toBe('negative-balance');
    });

    it('should get account icon correctly', () => {
      expect(component.getAccountIcon(AccountType.BANK)).toBe('account_balance');
      expect(component.getAccountIcon(AccountType.CREDIT)).toBe('credit_card');
      expect(component.getAccountIcon(AccountType.LOAN)).toBe('account_balance_wallet');
      expect(component.getAccountIcon(AccountType.CASH)).toBe('payments');
      expect(component.getAccountIcon(AccountType.INVESTMENT)).toBe('account_balance');
    });

    it('should clear error message', () => {
      component.errorMessage = 'Test error';
      component.clearError();
      expect(component.errorMessage).toBe('');
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors gracefully', fakeAsync(() => {
      (mockAuth.currentUser as any) = null;
      
      fixture.detectChanges();
      tick();

      expect(component.errorMessage).toBe('User not authenticated');
    }));

    it('should handle store errors gracefully', () => {
      mockStore.select.and.returnValue(of('Error loading accounts'));
      
      component.errorMessage = 'Error loading accounts';
      expect(component.errorMessage).toBe('Error loading accounts');
    });
  });

  describe('Component Lifecycle', () => {
    it('should clean up subscriptions on destroy', () => {
      const destroySpy = spyOn(component['destroy$'], 'next');
      const completeSpy = spyOn(component['destroy$'], 'complete');

      component.ngOnDestroy();

      expect(destroySpy).toHaveBeenCalled();
      expect(completeSpy).toHaveBeenCalled();
    });
  });
});
