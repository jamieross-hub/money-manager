import { Component, OnInit, OnDestroy , ChangeDetectionStrategy} from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { UserService } from 'src/app/util/service/db/user.service';
import { Router } from '@angular/router';
import { Timestamp } from '@angular/fire/firestore';
import { Budget } from 'src/app/util/service/db/budgets.service';
import { NotificationService } from 'src/app/util/service/notification.service';
import { Store } from '@ngrx/store';
import { AppState } from '../../../../store/app.state';
import * as BudgetsActions from '../../../../store/budgets/budgets.actions';
import * as BudgetsSelectors from '../../../../store/budgets/budgets.selectors';
import * as CategoriesActions from '../../../../store/categories/categories.actions';
import * as CategoriesSelectors from '../../../../store/categories/categories.selectors';
import * as ProfileSelectors from '../../../../store/profile/profile.selectors';
import { Observable, Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DateService } from 'src/app/util/service/date.service';
import { Category } from 'src/app/util/models';
import { TransactionType } from 'src/app/util/config/enums';

// Interfaces for yearly budget structure
interface SavingsGoal {
  name: string;
  targetAmount: number;
  monthlyContribution: number;
}

interface Debt {
  name: string;
  currentBalance: number;
  monthlyPayment: number;
  interestRate: number;
}

interface YearlyBudget {
  totalIncome: number;
  splitByMonth: boolean;
  savingsGoals: SavingsGoal[];
  debts: Debt[];
}

interface MonthlyBreakdown {
  income: number;
  expenses: number;
  savings: number;
  debt: number;
  balance: number;
}

@Component({
  selector: 'app-budgets',
  templateUrl: './budgets.component.html',
  styleUrls: ['./budgets.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BudgetsComponent implements OnInit, OnDestroy {
  // Observables from store
  budgets$: Observable<Budget[]>;
  budgetsLoading$: Observable<boolean>;
  budgetsError$: Observable<any>;
  categories$: Observable<Category[]>;
  categoriesLoading$: Observable<boolean>;
  monthlyIncome$: Observable<number>;

  userId: string = '';
  budgets: Budget[] = [];
  categories: Category[] = [];
  newBudget: Budget = {
    budgetId: '',
    userId: '',
    category: 'Groceries',
    limit: 0,
    spent: 0,
    startDate: Timestamp.fromDate(new Date()),
    endDate: Timestamp.fromDate(new Date()),
  };

  // Category budget sliders
  categoryBudgets: { [categoryId: string]: number } = {};
  showCategorySliders: boolean = true;

  // Date models for form
  startDateModel: Date = new Date();
  endDateModel: Date = new Date();

  // Yearly budget properties
  currentStep: number = 1;
  totalSteps: number = 6;
  showMonthlyView: boolean = false;
  inputMode: 'slider' | 'input' = 'slider';

  yearlyBudget: YearlyBudget = {
    totalIncome: 0,
    splitByMonth: false,
    savingsGoals: [],
    debts: []
  };

  // Math object for template access
  Math = Math;

  private destroy$ = new Subject<void>();
  private subscriptions = new Subscription();

  constructor(
    private auth: Auth,
    private router: Router,
    private notificationService: NotificationService,
    private store: Store<AppState>,
    public dateService: DateService,
    private userService: UserService
  ) {
    // Initialize selectors
    this.budgets$ = this.store.select(BudgetsSelectors.selectAllBudgets);
    this.budgetsLoading$ = this.store.select(BudgetsSelectors.selectBudgetsLoading);
    this.budgetsError$ = this.store.select(BudgetsSelectors.selectBudgetsError);
    this.categories$ = this.store.select(CategoriesSelectors.selectAllCategories);
    this.categoriesLoading$ = this.store.select(CategoriesSelectors.selectCategoriesLoading);
    this.monthlyIncome$ = this.store.select(ProfileSelectors.selectUserMonthlyIncome);
  }

  ngOnInit(): void {
    this.loadBudgets();
    this.loadCategories();
    this.subscribeToStoreData();
    this.loadProfileIncome();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Navigation methods
  nextStep(): void {
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
    }
  }

  previousStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  // Income methods
  calculateMonthlyIncome(): void {
    // This method can be used for additional calculations
  }

  // Update total income and ensure budget limits
  updateYearlyIncome(): void {
    this.ensureBudgetLimit();
  }

  // Savings methods
  addSavingsGoal(): void {
    this.yearlyBudget.savingsGoals.push({
      name: '',
      targetAmount: 0,
      monthlyContribution: 0
    });
  }

  removeSavingsGoal(index: number): void {
    this.yearlyBudget.savingsGoals.splice(index, 1);
  }

  getTotalSavings(): number {
    return this.yearlyBudget.savingsGoals.reduce((sum, goal) => sum + (goal.monthlyContribution * 12), 0);
  }

  // Debt methods
  addDebt(): void {
    this.yearlyBudget.debts.push({
      name: '',
      currentBalance: 0,
      monthlyPayment: 0,
      interestRate: 0
    });
  }

  removeDebt(index: number): void {
    this.yearlyBudget.debts.splice(index, 1);
  }

  getTotalDebtPayments(): number {
    return this.yearlyBudget.debts.reduce((sum, debt) => sum + (debt.monthlyPayment * 12), 0);
  }

  // Category budget methods
  getCategoryBudget(categoryId: string): number {
    return this.categoryBudgets[categoryId] || 0;
  }

  getCategoryPercentage(categoryId: string): number {
    if (this.yearlyBudget.totalIncome === 0) return 0;
    // Since categoryBudgets now stores monthly amounts, multiply by 12 for yearly comparison
    return (this.getCategoryBudget(categoryId) * 12 / this.yearlyBudget.totalIncome) * 100;
  }

  getCategoryMonthly(categoryId: string): number {
    // categoryBudgets now stores monthly amounts directly
    return this.getCategoryBudget(categoryId);
  }

  getTotalAllocated(): number {
    // Since categoryBudgets stores monthly amounts, multiply by 12 to get yearly total
    return Object.values(this.categoryBudgets).reduce((sum, budget) => sum + budget, 0) * 12;
  }

  // Ensure total allocated never exceeds yearly budget
  ensureBudgetLimit(): void {
    const totalAllocated = this.getTotalAllocated();
    if (totalAllocated > this.yearlyBudget.totalIncome) {
      const excess = totalAllocated - this.yearlyBudget.totalIncome;
      this.adjustAllCategories(excess);
    }
  }

  // Adjust all categories proportionally when total exceeds budget
  private adjustAllCategories(excessAmount: number) {
    const totalAllocated = this.getTotalAllocated();
    if (totalAllocated === 0) return;

    Object.keys(this.categoryBudgets).forEach(categoryId => {
      const currentBudget = this.categoryBudgets[categoryId] || 0;
      const reductionRatio = (currentBudget * 12) / totalAllocated; // Convert monthly to yearly for ratio calculation
      const reduction = (excessAmount * reductionRatio) / 12; // Convert yearly excess to monthly reduction

      this.categoryBudgets[categoryId] = Math.max(0, currentBudget - reduction);
    });
  }

  getRemainingBudget(): number {
    return this.yearlyBudget.totalIncome - this.getTotalAllocated() - this.getTotalSavings() - this.getTotalDebtPayments();
  }

  getNetBalance(): number {
    return this.yearlyBudget.totalIncome - this.getTotalAllocated() - this.getTotalSavings() - this.getTotalDebtPayments();
  }

  // Monthly breakdown methods
  getMonthlyBreakdown(): MonthlyBreakdown[] {
    const monthlyIncome = this.yearlyBudget.totalIncome / 12;
    const monthlyExpenses = this.getTotalAllocated() / 12; // getTotalAllocated() returns yearly, so divide by 12
    const monthlySavings = this.getTotalSavings() / 12;
    const monthlyDebt = this.getTotalDebtPayments() / 12;
    const monthlyBalance = monthlyIncome - monthlyExpenses - monthlySavings - monthlyDebt;

    return Array(12).fill(null).map(() => ({
      income: monthlyIncome,
      expenses: monthlyExpenses,
      savings: monthlySavings,
      debt: monthlyDebt,
      balance: monthlyBalance
    }));
  }

  getMonthName(index: number): string {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[index];
  }

  // Save yearly budget
  saveYearlyBudget(): void {
    // Create budgets for each expense category only
    this.getExpenseCategories().forEach(category => {
      const monthlyBudget = this.getCategoryBudget(category.id || '');
      if (monthlyBudget > 0) {
        // Convert monthly budget to yearly budget for storage
        const yearlyBudget = monthlyBudget * 12;
        this.createBudgetForCategory(category.name, yearlyBudget, category);
      }
    });

    // Save savings goals and debts (if any)
    // TODO: Implement savings and debt saving logic when those services are available

    this.notificationService.success('Yearly budget saved successfully!');
    this.currentStep = 1; // Reset to first step
  }

  // Load budgets for the logged-in user
  loadBudgets() {
    const userId = this.userService.getCurrentUserId();
    if (userId) {
      this.userId = userId;
      this.store.dispatch(BudgetsActions.loadBudgets({ userId: this.userId }));
    }
  }

  // Load categories for the logged-in user
  loadCategories() {
    const userId = this.userService.getCurrentUserId();
    if (userId) {
      this.store.dispatch(CategoriesActions.loadCategories({ userId }));
    }
  }

  // Subscribe to store data for backward compatibility
  subscribeToStoreData() {
    this.subscriptions.add(
      this.budgets$.subscribe(budgets => {
        this.budgets = budgets;
        this.updateCategoryBudgets();
      })
    );

    this.subscriptions.add(
      this.categories$.subscribe(categories => {
        this.categories = categories;
        this.initializeCategoryBudgets();
      })
    );

    this.subscriptions.add(
      this.budgetsError$.subscribe(error => {
        if (error) {
          console.error('Error loading budgets:', error);
          this.notificationService.error('Failed to load budgets');
        }
      })
    );
  }

  loadProfileIncome() {
    // Subscribe to monthly income from profile and set as yearly income if available
    this.subscriptions.add(
      this.monthlyIncome$.pipe(takeUntil(this.destroy$)).subscribe(monthlyIncome => {
        if (monthlyIncome > 0 && this.yearlyBudget.totalIncome === 0) {
          this.yearlyBudget.totalIncome = monthlyIncome * 12;
        }
      })
    );
  }

  useProfileIncome(monthlyIncome: number) {
    this.yearlyBudget.totalIncome = monthlyIncome * 12;
    this.notificationService.success('Profile income applied to yearly budget');
  }

  // Initialize category budgets from existing budgets
  initializeCategoryBudgets() {
    this.getExpenseCategories().forEach(category => {
      const existingBudget = this.budgets.find(budget => budget.category === category.name);
      // Convert yearly budget to monthly for slider
      this.categoryBudgets[category.id || ''] = existingBudget ? existingBudget.limit / 12 : 0;
    });
  }

  // Update category budgets when budgets change
  updateCategoryBudgets() {
    this.getExpenseCategories().forEach(category => {
      const existingBudget = this.budgets.find(budget => budget.category === category.name);
      if (existingBudget) {
        // Convert yearly budget to monthly for slider
        this.categoryBudgets[category.id || ''] = existingBudget.limit / 12;
      }
    });
  }

  // Handle slider change for category budget with smart allocation
  onCategoryBudgetChange(categoryId: string, newLimit: number) {
    // newLimit is now a monthly amount
    const currentTotal = this.getTotalAllocated();
    const currentCategoryBudget = this.categoryBudgets[categoryId] || 0;
    const difference = (newLimit - currentCategoryBudget) * 12; // Convert to yearly difference

    // If the new total would exceed yearly budget, adjust other categories
    if (currentTotal + difference > this.yearlyBudget.totalIncome) {
      const excess = currentTotal + difference - this.yearlyBudget.totalIncome;

      // Set the current category to the new limit
      this.categoryBudgets[categoryId] = newLimit;

      // Distribute the excess reduction across other categories proportionally
      this.adjustOtherCategories(categoryId, excess);
    } else {
      // Simple case: just update the category budget
      this.categoryBudgets[categoryId] = newLimit;
    }

    // Auto-save the category budget
    this.saveCategoryBudget(categoryId);
  }

  // Handle input field change for category budget
  onCategoryBudgetInputChange(categoryId: string, event: any) {
    const newLimit = Number(event.target.value) || 0;
    this.onCategoryBudgetChange(categoryId, newLimit);
    // Note: onCategoryBudgetChange already calls saveCategoryBudget, so no need to call it again here
  }

  // Handle input mode change
  onInputModeChange() {
    // This method can be used for any additional logic when switching between modes
    console.log('Input mode changed to:', this.inputMode);
  }

  // Adjust other categories when total exceeds budget
  private adjustOtherCategories(excludedCategoryId: string, excessAmount: number) {
    const otherCategories = Object.keys(this.categoryBudgets).filter(id => id !== excludedCategoryId);
    const otherCategoriesTotal = otherCategories.reduce((sum, id) => sum + (this.categoryBudgets[id] || 0), 0);

    if (otherCategoriesTotal === 0) {
      // If no other categories have budgets, reduce the current category
      // excessAmount is yearly, so divide by 12 to get monthly reduction
      this.categoryBudgets[excludedCategoryId] = Math.max(0, this.categoryBudgets[excludedCategoryId] - (excessAmount / 12));
      return;
    }

    // Reduce other categories proportionally
    otherCategories.forEach(categoryId => {
      const currentBudget = this.categoryBudgets[categoryId] || 0;
      const reductionRatio = currentBudget / otherCategoriesTotal;
      const reduction = (excessAmount * reductionRatio) / 12; // Convert yearly excess to monthly reduction

      this.categoryBudgets[categoryId] = Math.max(0, currentBudget - reduction);
    });
  }



  // Save category budget changes
  saveCategoryBudget(categoryId: string) {
    const category = this.categories.find(cat => cat.id === categoryId);
    if (!category) return;

    const monthlyLimit = this.categoryBudgets[categoryId];
    const yearlyLimit = monthlyLimit * 12; // Convert to yearly for storage
    const existingBudget = this.budgets.find(budget => budget.category === category.name);

    if (existingBudget) {
      // Update existing budget
      this.updateBudgetLimit(existingBudget.budgetId, yearlyLimit);
    } else {
      // Create new budget for this category
      this.createBudgetForCategory(category.name, yearlyLimit, category);
    }
  }

  // Create budget for a specific category
  createBudgetForCategory(categoryName: string, yearlyLimit: number, category: Category) {
    const userId = this.userService.getCurrentUserId();
    if (userId && yearlyLimit > 0) {
      const newBudget: Budget = {
        budgetId: `${userId}-${categoryName}-${new Date().getTime()}`,
        userId: userId,
        category: categoryName,
        limit: yearlyLimit,
        spent: 0,
        startDate: Timestamp.fromDate(new Date()),
        endDate: Timestamp.fromDate(new Date(new Date().getFullYear(), 11, 31)), // End of year
      };

      this.store.dispatch(BudgetsActions.createBudget({
        userId: userId,
        budget: newBudget
      }));

      if (category.id && category.type === TransactionType.EXPENSE) {
        this.store.dispatch(CategoriesActions.updateCategory({
          userId: this.userId,
          categoryId: category.id,
          name: category.name,
          categoryType: category.type,
          icon: category.icon,
          color: category.color,
          budgetData: {
            hasBudget: true,
            budgetAmount: yearlyLimit / 12,
            budgetPeriod: 'monthly',
            budgetStartDate: Timestamp.fromDate(new Date()),
            budgetEndDate: Timestamp.fromDate(new Date(new Date().getFullYear(), 11, 31)),
            budgetAlertThreshold: 80,
            budgetAlertEnabled: true
          }
        }));

      }

      this.notificationService.success(`Budget created for ${categoryName}`);
    }
  }

  // Update budget limit
  updateBudgetLimit(budgetId: string, newLimit: number) {
    const userId = this.userService.getCurrentUserId();
    if (userId) {
      const budget = this.budgets.find(b => b.budgetId === budgetId);
      if (budget) {
        const updatedBudget = { ...budget, limit: newLimit };
        this.store.dispatch(BudgetsActions.updateBudget({
          userId: userId,
          budgetId,
          budget: updatedBudget
        }));
        this.notificationService.success(`Budget limit updated for ${budget.category}`);
      }
    }
  }

  // Get budget for a category
  getBudgetForCategory(categoryName: string): Budget | undefined {
    return this.budgets.find(budget => budget.category === categoryName);
  }

  // Get spent amount for a category
  getSpentForCategory(categoryName: string): number {
    const budget = this.getBudgetForCategory(categoryName);
    return budget?.spent || 0;
  }

  // Calculate progress percentage for a category
  getProgressPercentage(categoryName: string): number {
    const budget = this.getBudgetForCategory(categoryName);
    if (!budget || budget.limit === 0) return 0;
    return Math.min((budget.spent / budget.limit) * 100, 100);
  }

  // Get progress color based on percentage
  getProgressColor(percentage: number): string {
    if (percentage >= 90) return 'warn'; // Red
    if (percentage >= 75) return 'accent'; // Orange
    return 'primary'; // Green
  }

  // Create a new budget
  createBudget() {
    if (!this.newBudget.category || !this.newBudget.limit) {
      this.notificationService.warning('Please fill in all required fields');
      return;
    }

    if (this.newBudget.limit <= 0) {
      this.notificationService.warning('Budget limit must be greater than 0');
      return;
    }

    const userId = this.userService.getCurrentUserId();
    if (userId) {
      this.newBudget.userId = userId;
      this.newBudget.budgetId = `${this.newBudget.userId}-${new Date().getTime()}`;
      this.newBudget.startDate = Timestamp.fromDate(this.startDateModel);
      this.newBudget.endDate = Timestamp.fromDate(this.endDateModel);

      this.store.dispatch(BudgetsActions.createBudget({
        userId: userId,
        budget: this.newBudget
      }));

      this.notificationService.success('Budget created successfully');

      // Reset form
      this.newBudget = {
        budgetId: '',
        userId: '',
        category: 'Groceries',
        limit: 0,
        spent: 0,
        startDate: Timestamp.fromDate(new Date()),
        endDate: Timestamp.fromDate(new Date()),
      };
      this.startDateModel = new Date();
      this.endDateModel = new Date();
    }
  }

  // Delete a budget
  deleteBudget(budgetId: string) {
    const userId = this.userService.getCurrentUserId();
    if (userId) {
      this.store.dispatch(BudgetsActions.deleteBudget({ userId, budgetId }));
      this.notificationService.success('Budget deleted successfully');
    }
  }

  // Update the spent amount for a budget
  updateSpent(budgetId: string, amount: number) {
    if (amount < 0) {
      this.notificationService.warning('Spent amount cannot be negative');
      return;
    }

    const userId = this.userService.getCurrentUserId();
    if (userId) {
      this.store.dispatch(BudgetsActions.updateSpent({ userId, budgetId, amount }));
      this.notificationService.success('Budget spent amount updated successfully');
    }
  }

  // Toggle category sliders view
  toggleCategorySliders() {
    this.showCategorySliders = !this.showCategorySliders;
  }

  // TrackBy functions for ngFor optimization
  trackByCategoryId(index: number, category: Category): string {
    return category.id || '';
  }

  trackByBudgetId(index: number, budget: Budget): string {
    return budget.budgetId;
  }

  // Get only expense categories (exclude income categories)
  getExpenseCategories(): Category[] {
    return this.categories.filter(category => category.type === TransactionType.EXPENSE);
  }

  // Update all category budgets at once
  updateAllCategoryBudgets(): void {
    this.getExpenseCategories().forEach(category => {
      const categoryId = category.id || '';
      const monthlyBudget = this.categoryBudgets[categoryId];
      if (monthlyBudget !== undefined && monthlyBudget > 0) {
        this.saveCategoryBudget(categoryId);
      }
    });
    this.notificationService.success('All category budgets updated successfully!');
  }

  // Reset all category budgets to zero
  resetAllCategoryBudgets(): void {
    this.getExpenseCategories().forEach(category => {
      const categoryId = category.id || '';
      this.categoryBudgets[categoryId] = 0;
    });
    this.updateAllCategoryBudgets();
    this.notificationService.info('All category budgets reset to zero');
  }

  // Distribute remaining budget equally among all categories
  distributeRemainingBudget(): void {
    const remainingBudget = this.getRemainingBudget();
    const expenseCategories = this.getExpenseCategories();

    if (remainingBudget <= 0 || expenseCategories.length === 0) {
      this.notificationService.warning('No remaining budget to distribute or no expense categories available');
      return;
    }

    const monthlyRemaining = remainingBudget / 12; // Convert to monthly
    const monthlyPerCategory = monthlyRemaining / expenseCategories.length;

    expenseCategories.forEach(category => {
      const categoryId = category.id || '';
      this.categoryBudgets[categoryId] = monthlyPerCategory;
    });

    this.updateAllCategoryBudgets();
    this.notificationService.success(`Distributed ${monthlyRemaining.toFixed(2)} monthly budget equally among ${expenseCategories.length} categories`);
  }
}
