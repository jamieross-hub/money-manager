import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { UserService } from 'src/app/util/service/db/user.service';
import { MatDialog } from '@angular/material/dialog';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Subject, Observable } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import { NotificationService } from 'src/app/util/service/notification.service';
import { HapticFeedbackService } from 'src/app/util/service/haptic-feedback.service';
import { MobileCategoryAddEditPopupComponent } from './mobile-category-add-edit-popup/mobile-category-add-edit-popup.component';

import { Category, Budget } from 'src/app/util/models';
import { CategoryBudgetService } from 'src/app/util/service/category-budget.service';
import { Store } from '@ngrx/store';
import { AppState } from '../../../store/app.state';
import * as CategoriesActions from '../../../store/categories/categories.actions';
import * as CategoriesSelectors from '../../../store/categories/categories.selectors';
import * as TransactionsActions from '../../../store/transactions/transactions.actions';
import * as TransactionsSelectors from '../../../store/transactions/transactions.selectors';
import * as ProfileActions from '../../../store/profile/profile.actions';
import * as ProfileSelectors from '../../../store/profile/profile.selectors';
import { TransactionType } from 'src/app/util/config/enums';
import { Transaction } from 'src/app/util/models/transaction.model';
import { DateService } from 'src/app/util/service/date.service';
import moment from 'moment';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';
import { CategoryService } from 'src/app/util/service/db/category.service';
import { Router } from '@angular/router';
import { QuickActionsFabConfig } from 'src/app/util/components/floating-action-buttons/quick-actions-fab/quick-actions-fab.component';

@Component({
  selector: 'user-category',
  templateUrl: './category.component.html',
  styleUrls: ['./category.component.scss']
})
export class CategoryComponent implements OnInit, OnDestroy {

  public quickActionsFabConfig: QuickActionsFabConfig = {
    title: 'Quick Actions',
    mainButtonIcon: 'add',
    mainButtonColor: 'primary',
    mainButtonTooltip: 'Add Category',
    actions: []
  };

  @Input() isChildView: boolean = false;

  public isLoading$: Observable<boolean>;
  // public error$: Observable<any>;
  public transactions$: Observable<Transaction[]>;
  public Math = Math; // Make Math available in template

  public categories!: Category[];
  public transactions: Transaction[] = [];
  public isLoading: boolean = false;
  public errorMessage: string = '';


  public isListViewMode: boolean = false; // Add this property for list view toggle


  public userId: string = '';
  private destroy$ = new Subject<void>();

  constructor(
    private auth: Auth,
    private dialog: MatDialog,
    private notificationService: NotificationService,
    private hapticFeedback: HapticFeedbackService,
    private breakpointObserver: BreakpointObserver,
    private store: Store<AppState>,
    private budgetService: CategoryBudgetService,
    public dateService: DateService,
    public breakpointService: BreakpointService,
    private categoryService: CategoryService,
    private userService: UserService,
  ) {

    this.isLoading$ = this.store.select(CategoriesSelectors.selectCategoriesLoading);
    // this.error$ = this.store.select(CategoriesSelectors.selectCategoriesError);
    this.transactions$ = this.store.select(TransactionsSelectors.selectAllTransactions);

  }

  ngOnInit(): void {
    this.initializeComponent();
    this.subscribeToStoreData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async initializeComponent(): Promise<void> {
    const userId = this.userService.getCurrentUserId();
    if (!userId) {
      this.errorMessage = 'User not authenticated';
      return;
    }

    this.userId = userId;
    this.loadUserCategories();
    this.loadUserTransactions();
    this.loadUserProfile();
  }

  private loadUserCategories(): void {
    this.store.dispatch(CategoriesActions.loadCategories({ userId: this.userId }));
  }

  private loadUserTransactions(): void {
    this.store.dispatch(TransactionsActions.loadTransactions({ userId: this.userId }));
  }

  private loadUserProfile(): void {
    this.store.dispatch(ProfileActions.loadProfile({ userId: this.userId }));
  }

  private subscribeToStoreData(): void {
    this.store.select(CategoriesSelectors.selectAllCategories).subscribe(categories => {
      this.categories = categories.sort((a, b) => {
        // 1. Prioritize categories with budget
        const aHasBudget = a.budget?.hasBudget ?? false;
        const bHasBudget = b.budget?.hasBudget ?? false;
        if (aHasBudget !== bHasBudget) return aHasBudget ? -1 : 1;

        if (this.breakpointService.device.isDesktop) {
          const aHasSub = (a.subCategories?.length ?? 0) > 0;
          const bHasSub = (b.subCategories?.length ?? 0) > 0;
          if (aHasSub !== bHasSub) return aHasSub ? 1 : -1;
        } else {
          // 2. Prioritize categories with subcategories
          const aHasSub = (a.subCategories?.length ?? 0) > 0;
          const bHasSub = (b.subCategories?.length ?? 0) > 0;
          if (aHasSub !== bHasSub) return aHasSub ? -1 : 1;

        }


        // 3. Alphabetical order by name
        return a.name.localeCompare(b.name);
      });
    });

    this.transactions$.pipe(takeUntil(this.destroy$)).subscribe(transactions => {
      this.transactions = transactions;
    });

    this.isLoading$.pipe(takeUntil(this.destroy$)).subscribe(loading => {
      this.isLoading = loading;
    });

    // Subscribe to profile changes to get user preferences
    this.store.select(ProfileSelectors.selectUserPreferences).pipe(take(1)).subscribe(preferences => {
      if (preferences && this.isListViewMode != preferences.categoryListViewMode) {
        this.isListViewMode = preferences.categoryListViewMode ?? false;
      }
    });

    // this.error$.pipe(takeUntil(this.destroy$)).subscribe(error => {
    //   if (error) {
    //     this.errorMessage = 'Failed to load categories';
    //     console.error('Error loading categories:', error);
    //     this.notificationService.error('Failed to load categories');
    //   }
    // });
  }







  public trackByCategoryId(index: number, category: Category): string | number {
    return category.id || index;
  }

  public clearError(): void {
    this.errorMessage = '';
  }



  public openMobileDialog(category?: Category): void {

    const dialogRef = this.dialog.open(MobileCategoryAddEditPopupComponent, {
      panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : 'desktop-dialog',
      data: {
        category: category ? { ...category } : null,
        isEdit: category ? true : false,
        allCategories: this.categories
      }
    });

    dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe(result => {
      if (result) {
        this.loadUserCategories();
      }
    });
  }

  public openAddMobileDialog(): void {
    if (this.breakpointService.device.isMobile) {
      this.hapticFeedback.lightVibration();
    }
    this.openMobileDialog();
  }



  public getSubCategoriesForCategory(categoryId: string): Category[] {
    return this.categories.filter(cat =>
      cat.isSubCategory && cat.parentCategoryId === categoryId
    );
  }







  /**
   * Calculate budget spent for a category based on transactions
   */
  public calculateBudgetSpent(category: Category): number {
    if (!category.budget?.hasBudget || !category.budget?.budgetAmount) {
      return 0;
    }

    const categoryTransactions = this.transactions.filter(t =>
      t.categoryId === category.id &&
      t.type === TransactionType.EXPENSE
    );

    // Filter transactions within the budget period
    const budgetStartDate = category.budget.budgetStartDate;
    const budgetEndDate = category.budget.budgetEndDate;

    let filteredTransactions = categoryTransactions;

    if (budgetStartDate) {
      const startDate = this.dateService.toDate(budgetStartDate);
      if (!startDate) {
        return 0;
      }
      filteredTransactions = filteredTransactions.filter(t => {
        const txDate = this.dateService.toDate(t.date);
        return txDate && txDate >= startDate;
      });
    }

    if (budgetEndDate) {
      const endDate = this.dateService.toDate(budgetEndDate);
      if (!endDate) {
        return 0;
      }
      filteredTransactions = filteredTransactions.filter(t => {
        const txDate = this.dateService.toDate(t.date);
        return txDate && txDate <= endDate;
      });
    }

    return filteredTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }

  /**
   * Calculate budget progress percentage for a category
   */
  public calculateBudgetProgressPercentage(category: Category): number {
    if (!category.budget?.hasBudget || !category.budget?.budgetAmount) {
      return 0;
    }

    const spent = this.calculateBudgetSpent(category);
    const budgetAmount = category.budget.budgetAmount || 0;

    if (budgetAmount === 0) return 0;

    return Math.min(100, (spent / budgetAmount) * 100);
  }

  public getBudgetProgressColor(category: Category, budgetProgressPercentage?: number, budgetAlertThreshold?: number): string {
    const progress = budgetProgressPercentage ?? this.calculateBudgetProgressPercentage(category);
    const threshold = budgetAlertThreshold ?? (category.budget?.budgetAlertThreshold || 80);
    return this.budgetService.getBudgetProgressColor(category, progress, threshold);
  }

  public formatBudgetPeriod(period: string | undefined): string {
    return this.budgetService.formatBudgetPeriod(period);
  }







  public toggleListViewMode(): void {
    this.isListViewMode = !this.isListViewMode;

    // Save the preference to user profile
    this.store.select(ProfileSelectors.selectUserPreferences).pipe(takeUntil(this.destroy$)).subscribe(preferences => {
      if (preferences) {
        const updatedPreferences = {
          ...preferences,
          categoryListViewMode: this.isListViewMode
        };
        this.store.dispatch(ProfileActions.updatePreferences({
          userId: this.userId,
          preferences: updatedPreferences
        }));
      }
    });
  }

  /**
   * Get recent transactions for a category
   */
  public getRecentTransactions(category: Category): Transaction[] {
    if (!category || !category.name) return [];

    return this.transactions
      .filter(transaction =>
        transaction.categoryId === category.id &&
        moment(this.dateService.toDate(transaction.date)).isSame(moment(), 'month')
      )
  }

  /**
   * Get category statistics
   */
  public getCategoryStats(category: Category): any {
    if (!category || !category.name) {
      return {
        totalTransactions: 0,
        totalSpent: 0,
        averageTransaction: 0,
        largestTransaction: 0,
        thisMonth: 0,
        lastMonth: 0
      };
    }

    const categoryTransactions = this.transactions.filter(t => t.categoryId === category.id);

    if (categoryTransactions.length === 0) {
      return {
        totalTransactions: 0,
        totalSpent: 0,
        averageTransaction: 0,
        largestTransaction: 0,
        thisMonth: 0,
        lastMonth: 0
      };
    }

    // Calculate basic stats
    const totalTransactions = categoryTransactions.length;
    const totalSpent = categoryTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const averageTransaction = totalSpent / totalTransactions;
    const largestTransaction = Math.max(...categoryTransactions.map(t => Math.abs(t.amount)));

    // Calculate monthly stats
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const lastYear = thisMonth === 0 ? thisYear - 1 : thisYear;

    const thisMonthTransactions = categoryTransactions.filter(t => {
      const txDate = this.dateService.toDate(t.date) || new Date();
      return txDate.getMonth() === thisMonth && txDate.getFullYear() === thisYear;
    });

    const lastMonthTransactions = categoryTransactions.filter(t => {
      const txDate = this.dateService.toDate(t.date) || new Date();
      return txDate.getMonth() === lastMonth && txDate.getFullYear() === lastYear;
    });

    const thisMonthTotal = thisMonthTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const lastMonthTotal = lastMonthTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return {
      totalTransactions,
      totalSpent,
      averageTransaction,
      largestTransaction,
      thisMonth: thisMonthTotal,
      lastMonth: lastMonthTotal
    };
  }

  /**
   * Get budget status class for styling
   */
  public getBudgetStatusClass(category: Category, budgetProgressPercentage?: number): string {
    if (!category.budget?.hasBudget) return '';

    const percentage = budgetProgressPercentage ?? this.calculateBudgetProgressPercentage(category);
    if (percentage >= 90) return 'danger';
    if (percentage >= 75) return 'warning';
    return 'safe';
  }

  /**
   * Get remaining budget class for styling
   */
  public getRemainingBudgetClass(category: Category, budgetSpent?: number): string {
    if (!category.budget?.hasBudget) return '';

    const spent = budgetSpent ?? this.calculateBudgetSpent(category);
    const remaining = (category.budget?.budgetAmount || 0) - spent;
    if (remaining <= 0) return 'danger';
    if (remaining < (category.budget?.budgetAmount || 0) * 0.1) return 'warning';
    return 'safe';
  }

  public calculateTotalSpentPerMonth(category: Category): number {
    const categoryTransactions = this.transactions.filter(t => t.categoryId === category.id);
    const totalSpent = categoryTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    return totalSpent;
  }

  public calculateTotalIncomePerMonth(category: Category): number {
    const categoryTransactions = this.transactions.filter(t => t.categoryId === category.id);
    const totalIncome = categoryTransactions.reduce((sum, t) => sum + t.amount, 0);
    return totalIncome;
  }



  public deleteCategory(category: Category): void {
    this.categoryService.performDelete(category, this.userId);
  }
}
