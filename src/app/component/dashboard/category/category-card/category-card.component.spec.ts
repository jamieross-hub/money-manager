import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CategoryCardComponent } from './category-card.component';
import { MatDialog } from '@angular/material/dialog';
import { NotificationService } from 'src/app/util/service/notification.service';
import { CategoryService } from 'src/app/util/service/db/category.service';
import { CategoryBudgetService } from 'src/app/util/service/category-budget.service';
import { Store } from '@ngrx/store';
import { Auth } from '@angular/fire/auth';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';
import { DateService } from 'src/app/util/service/date.service';
import { Category } from 'src/app/util/models';
import { Transaction } from 'src/app/util/models/transaction.model';
import { TransactionType } from 'src/app/util/config/enums';

describe('CategoryCardComponent', () => {
  let component: CategoryCardComponent;
  let fixture: ComponentFixture<CategoryCardComponent>;
  let mockDateService: jasmine.SpyObj<DateService>;

  const mockCategory: Category = {
    id: 'test-category',
    name: 'Test Category',
    type: TransactionType.EXPENSE,
    icon: 'test',
    color: '#ff0000',
    createdAt: Date.now(),
    budget: {
      hasBudget: true,
      budgetAmount: 1000,
      budgetPeriod: 'monthly',
      budgetStartDate: new Date() as any,
      budgetEndDate: new Date() as any,
      budgetAlertThreshold: 80,
      budgetAlertEnabled: true
    }
  };

  const mockTransactions: Transaction[] = [
    {
      id: 'tx1',
      amount: 100,
      categoryId: 'test-category',
      type: TransactionType.EXPENSE,
      date: new Date(),
      payee: 'Test Payee 1',
      category: 'Test Category',
      accountId: 'account1',
      userId: 'user1',
      status: 'completed' as any,
      syncStatus: 'synced' as any,
      createdAt: new Date() as any,
      updatedAt: new Date() as any,
      createdBy: 'user1',
      updatedBy: 'user1',
      familyId: ''
    },
    {
      id: 'tx2',
      amount: 200,
      categoryId: 'test-category',
      type: TransactionType.EXPENSE,
      date: new Date(),
      payee: 'Test Payee 2',
      category: 'Test Category',
      accountId: 'account1',
      userId: 'user1',
      status: 'completed' as any,
      syncStatus: 'synced' as any,
      createdAt: new Date() as any,
      updatedAt: new Date() as any,
      createdBy: 'user1',
      updatedBy: 'user1',
      familyId: ''
    }
  ];

  beforeEach(async () => {
    const dateServiceSpy = jasmine.createSpyObj('DateService', ['toDate']);
    dateServiceSpy.toDate.and.callFake((date: any) => new Date(date));

    await TestBed.configureTestingModule({
      declarations: [ CategoryCardComponent ],
      providers: [
        { provide: MatDialog, useValue: {} },
        { provide: NotificationService, useValue: {} },
        { provide: CategoryService, useValue: {} },
        { provide: CategoryBudgetService, useValue: {} },
        { provide: Store, useValue: {} },
        { provide: Auth, useValue: {} },
        { provide: BreakpointService, useValue: { device: { isDesktop: true } } },
        { provide: DateService, useValue: dateServiceSpy }
      ]
    })
    .compileComponents();

    mockDateService = TestBed.inject(DateService) as jasmine.SpyObj<DateService>;
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CategoryCardComponent);
    component = fixture.componentInstance;
    component.category = mockCategory;
    component.allTransactions = mockTransactions;
    component.Math = Math;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Dynamic Budget Calculation', () => {
    it('should calculate budget spent for monthly period', () => {
      const spent = component.calculateBudgetSpent(mockCategory);
      expect(spent).toBe(300); // 100 + 200
    });

    it('should return 0 for category without budget', () => {
      const categoryWithoutBudget = { ...mockCategory, budget: undefined };
      const spent = component.calculateBudgetSpent(categoryWithoutBudget);
      expect(spent).toBe(0);
    });

    it('should calculate budget progress percentage correctly', () => {
      const percentage = component.calculateBudgetProgressPercentage(mockCategory);
      expect(percentage).toBe(30); // (300 / 1000) * 100
    });

    it('should get dynamic budget period dates for monthly', () => {
      const result = (component as any).getDynamicBudgetPeriodDates('monthly');
      expect(result.startDate).toBeTruthy();
      expect(result.endDate).toBeTruthy();
      expect(result.startDate.getDate()).toBe(1); // First day of month
    });

    it('should get dynamic budget period dates for daily', () => {
      const result = (component as any).getDynamicBudgetPeriodDates('daily');
      expect(result.startDate).toBeTruthy();
      expect(result.endDate).toBeTruthy();
      expect(result.startDate.getDate()).toBe(new Date().getDate());
    });

    it('should get current budget period text', () => {
      const text = component.getCurrentBudgetPeriodText('monthly');
      expect(text).toContain('This Month');
    });

    it('should calculate remaining days in budget period', () => {
      const remainingDays = component.getRemainingDaysInBudgetPeriod('monthly');
      expect(remainingDays).toBeGreaterThanOrEqual(0);
    });

    it('should calculate total days in budget period', () => {
      const totalDays = component.getTotalDaysInBudgetPeriod('monthly');
      expect(totalDays).toBeGreaterThan(0);
    });

    it('should calculate daily average spending', () => {
      const dailyAverage = component.getDailyAverageSpending(mockCategory);
      expect(dailyAverage).toBeGreaterThan(0);
    });

    it('should calculate projected spending', () => {
      const projected = component.getProjectedSpending(mockCategory);
      expect(projected).toBeGreaterThan(0);
    });

    it('should determine if spending is on track', () => {
      const onTrack = component.isSpendingOnTrack(mockCategory);
      expect(typeof onTrack).toBe('boolean');
    });

    it('should calculate time progress percentage', () => {
      const timeProgress = component.getTimeProgressPercentage('monthly');
      expect(timeProgress).toBeGreaterThanOrEqual(0);
      expect(timeProgress).toBeLessThanOrEqual(100);
    });

    it('should get time progress tooltip text', () => {
      const tooltip = component.getTimeProgressTooltip('monthly');
      expect(tooltip).toContain('Time Progress:');
      expect(tooltip).toContain('Period:');
      expect(tooltip).toContain('Elapsed:');
      expect(tooltip).toContain('Remaining:');
    });

    it('should get progress comparison tooltip', () => {
      const tooltip = component.getProgressComparisonTooltip(mockCategory);
      expect(tooltip).toContain('Budget Progress Comparison');
      expect(tooltip).toContain('Spending:');
      expect(tooltip).toContain('Time:');
    });
  });
}); 