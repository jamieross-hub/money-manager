import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TransactionTableComponent } from './transaction-table.component';
import { TestSetup } from '../../../../util/testing/test-setup';
import { TEST_IMPORTS } from '../../../../util/testing/test-config';
import { of } from 'rxjs';
import { Transaction } from '../../../../util/models/transaction.model';
import { Category } from '../../../../util/models';
import { TransactionType, TransactionStatus, SyncStatus } from '../../../../util/config/enums';
import { Store } from '@ngrx/store';
import { Auth } from '@angular/fire/auth';
import { MatDialog } from '@angular/material/dialog';
import { BreakpointService } from '../../../../util/service/breakpoint.service';
import { DateService } from '../../../../util/service/date.service';
import { FilterService } from '../../../../util/service/filter.service';
import { SsrService } from '../../../../util/service/ssr.service';

describe('TransactionTableComponent', () => {
  let component: TransactionTableComponent;
  let fixture: ComponentFixture<TransactionTableComponent>;
  let mockStore: any;
  let mockAuth: any;
  let mockDialog: any;
  let mockBreakpointService: any;
  let mockDateService: any;
  let mockFilterService: any;
  let mockSsrService: any;

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

  const mockCategories: { [key: string]: Category } = {
    '1': {
      id: '1',
      name: 'Food',
      type: TransactionType.EXPENSE,
      icon: 'restaurant',
      color: '#FF5722',
      createdAt: Date.now()
    }
  };

  beforeEach(async () => {
    mockStore = TestSetup.getMockStore();
    mockAuth = TestSetup.getMockAuth();
    mockDialog = TestSetup.getMockMatDialog();
    mockBreakpointService = TestSetup.getMockBreakpointService();
    mockDateService = TestSetup.getMockDateService();
    mockFilterService = TestSetup.getMockFilterService();
    mockSsrService = jasmine.createSpyObj('SsrService', ['isClientSide'], {
      isClientSide: () => true
    });

    // Setup store selectors with returnValues
    mockStore.select.and.callFake(() => of(mockTransactions));

    await TestSetup.configureTestingModule(
      [TransactionTableComponent], // declarations
      TEST_IMPORTS, // imports
      [
        { provide: Store, useValue: mockStore },
        { provide: Auth, useValue: mockAuth },
        { provide: MatDialog, useValue: mockDialog },
        { provide: BreakpointService, useValue: mockBreakpointService },
        { provide: DateService, useValue: mockDateService },
        { provide: FilterService, useValue: mockFilterService },
        { provide: SsrService, useValue: mockSsrService }
      ]
    ).compileComponents();
    
    fixture = TestBed.createComponent(TransactionTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with transactions', () => {
    expect(component.dataSource).toBeDefined();
    expect(component.dataSource.data).toEqual(mockTransactions);
  });

  it('should have correct displayed columns', () => {
    expect(component.displayedColumns).toContain('Date');
    expect(component.displayedColumns).toContain('Payee');
    expect(component.displayedColumns).toContain('Amount');
    expect(component.displayedColumns).toContain('Actions');
  });

  it('should get category name correctly', () => {
    const categoryName = component.getCategoryName('1');
    expect(categoryName).toBe('Food');
  });

  it('should get category icon correctly', () => {
    const icon = component.getCategoryIcon('1');
    expect(icon).toBe('restaurant');
  });

  it('should get category color correctly', () => {
    const color = component.getCategoryColor('1');
    expect(color).toBe('#FF5722');
  });

  it('should calculate totals correctly', () => {
    expect(component.getTotalExpense()).toBe(50);
    expect(component.getTotalIncome()).toBe(0);
    expect(component.getNetAmount()).toBe(-50);
  });

  it('should get transaction count correctly', () => {
    expect(component.getTransactionCount()).toBe(1);
  });
}); 