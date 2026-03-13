import { Component, Input, Output, EventEmitter , ChangeDetectionStrategy} from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Category, Budget } from 'src/app/util/models';
import { Transaction } from 'src/app/util/models/transaction.model';
import { DateService } from 'src/app/util/service/date.service';
import { TransactionType } from 'src/app/util/config/enums';
import { CategoryDetailsDialogComponent, CategoryDetailsDialogData } from '../category-details-dialog/category-details-dialog.component';
import { CategoryBudgetDialogComponent } from '../category-budget-dialog/category-budget-dialog.component';
import { MobileCategoryAddEditPopupComponent } from '../mobile-category-add-edit-popup/mobile-category-add-edit-popup.component';
import { ConfirmDialogComponent } from 'src/app/util/components/confirm-dialog/confirm-dialog.component';
import { NotificationService } from 'src/app/util/service/notification.service';
import { CategoryService } from 'src/app/util/service/db/category.service';
import { CategoryBudgetService } from 'src/app/util/service/category-budget.service';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import * as CategoriesActions from 'src/app/store/categories/categories.actions';
import * as CategoriesSelectors from 'src/app/store/categories/categories.selectors';
import { Auth } from '@angular/fire/auth';
import { UserService } from 'src/app/util/service/db/user.service';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';

import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { CurrencyPipe } from 'src/app/util/pipes/currency.pipe';
import { TranslateModule } from '@ngx-translate/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSortModule } from '@angular/material/sort';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';

@Component({
  selector: 'app-category-card',
  templateUrl: './category-card.component.html',
  styleUrls: ['./category-card.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    TranslateModule,

    // Material Modules
    MatCardModule,
    MatListModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSidenavModule,
    MatFormFieldModule,
    MatSelectModule,
    MatMenuModule,
    MatToolbarModule,
    MatButtonToggleModule,
    MatInputModule,
    MatDialogModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatTabsModule,
    MatCheckboxModule,
    MatTooltipModule,
    MatSlideToggleModule,
    MatAutocompleteModule,
    MatExpansionModule,
    MatDividerModule,
    MatChipsModule,
    MatSnackBarModule,
    MatSliderModule,
    MatStepperModule,
    MatBottomSheetModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CategoryCardComponent {
  @Input() category!: Category;

  @Input() isMobile: boolean = false;
  @Input() recentTransactions: Transaction[] = [];
  @Input() categoryStats: any;
  @Input() subCategoryCount: number = 0;
  @Input() Math: any;
  @Input() allTransactions: Transaction[] = [];
  @Input() subCategories: Category[] = [];



  private userId: string = '';

  constructor(
    public dateService: DateService,
    private dialog: MatDialog,
    private notificationService: NotificationService,
    private categoryService: CategoryService,
    private budgetService: CategoryBudgetService,
    private store: Store<AppState>,
    private auth: Auth,
    public breakpointService: BreakpointService,
    private userService: UserService
  ) {
    this.initializeUserId();
    this.subCategoryCount = this.subCategories.length || 0;
  }

  private async initializeUserId(): Promise<void> {
    const userId = this.userService.getCurrentUserId();
    if (userId) {
      this.userId = userId;
    }
  }

  /**
   * Calculate budget spent for a category based on transactions
   */
  public calculateBudgetSpent(category: Category): number {
    if (!category.budget?.hasBudget || !category.budget?.budgetAmount) {
      return 0;
    }

    const categoryTransactions = this.allTransactions.filter(t =>
      t.categoryId === category.id &&
      t.type === TransactionType.EXPENSE
    );

    // Get the dynamic budget period dates based on budgetPeriod
    const { startDate, endDate } = this.getDynamicBudgetPeriodDates(category.budget.budgetPeriod);

    if (!startDate || !endDate) {
      return 0;
    }

    // Filter transactions within the dynamic budget period
    const filteredTransactions = categoryTransactions.filter(t => {
      const txDate = this.dateService.toDate(t.date);
      return txDate && txDate >= startDate && txDate <= endDate;
    });

    return filteredTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }

  /**
   * Get dynamic budget period dates based on budget period type
   */
  private getDynamicBudgetPeriodDates(budgetPeriod?: string): { startDate: Date | null, endDate: Date | null } {
    if (!budgetPeriod) {
      return { startDate: null, endDate: null };
    }

    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (budgetPeriod) {
      case 'daily':
        // Today's budget
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;

      case 'weekly':
        // Current week (Monday to Sunday)
        const dayOfWeek = now.getDay();
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday is 0, so we treat it as 7
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysFromMonday);
        endDate = new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000); // Add 6 days
        endDate.setHours(23, 59, 59, 999);
        break;

      case 'monthly':
        // Current month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999); // Last day of current month
        break;

      case 'yearly':
        // Current year
        startDate = new Date(now.getFullYear(), 0, 1); // January 1st
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999); // December 31st
        break;

      default:
        return { startDate: null, endDate: null };
    }

    return { startDate, endDate };
  }

  /**
   * Get current budget period display text
   */
  public getCurrentBudgetPeriodText(budgetPeriod?: string): string {
    if (!budgetPeriod) {
      return '';
    }

    const { startDate, endDate } = this.getDynamicBudgetPeriodDates(budgetPeriod);

    if (!startDate || !endDate) {
      return this.formatBudgetPeriod(budgetPeriod);
    }

    const formatDate = (date: Date): string => {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: startDate.getFullYear() !== endDate.getFullYear() ? 'numeric' : undefined
      });
    };

    switch (budgetPeriod) {
      case 'daily':
        return `Day`;
      case 'weekly':
        return `Week`;
      case 'monthly':
        return `Month`;
      case 'yearly':
        return `Year`;
      default:
        return this.formatBudgetPeriod(budgetPeriod);
    }
  }

  /**
   * Calculate remaining days in current budget period
   */
  public getRemainingDaysInBudgetPeriod(budgetPeriod?: string): number {
    if (!budgetPeriod) {
      return 0;
    }

    const { endDate } = this.getDynamicBudgetPeriodDates(budgetPeriod);

    if (!endDate) {
      return 0;
    }

    const now = new Date();
    const timeDiff = endDate.getTime() - now.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    return Math.max(0, daysDiff);
  }

  /**
   * Calculate total days in current budget period
   */
  public getTotalDaysInBudgetPeriod(budgetPeriod?: string): number {
    if (!budgetPeriod) {
      return 0;
    }

    const { startDate, endDate } = this.getDynamicBudgetPeriodDates(budgetPeriod);

    if (!startDate || !endDate) {
      return 0;
    }

    const timeDiff = endDate.getTime() - startDate.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    return Math.max(1, daysDiff + 1); // +1 to include both start and end dates
  }

  /**
   * Calculate daily average spending rate for current budget period
   */
  public getDailyAverageSpending(category: Category): number {
    if (!category.budget?.budgetPeriod) {
      return 0;
    }

    const spent = this.calculateBudgetSpent(category);
    const { startDate } = this.getDynamicBudgetPeriodDates(category.budget.budgetPeriod);

    if (!startDate) {
      return 0;
    }

    const now = new Date();
    const timeDiff = now.getTime() - startDate.getTime();
    const daysElapsed = Math.max(1, Math.ceil(timeDiff / (1000 * 3600 * 24)));

    return spent / daysElapsed;
  }

  /**
   * Calculate projected spending for the entire budget period
   */
  public getProjectedSpending(category: Category): number {
    if (!category.budget?.budgetPeriod) {
      return 0;
    }

    const dailyAverage = this.getDailyAverageSpending(category);
    const totalDays = this.getTotalDaysInBudgetPeriod(category.budget.budgetPeriod);

    return dailyAverage * totalDays;
  }

  /**
   * Calculate if spending is on track for the budget period
   */
  public isSpendingOnTrack(category: Category): boolean {
    if (!category.budget?.budgetAmount || !category.budget?.budgetPeriod) {
      return true;
    }

    const projectedSpending = this.getProjectedSpending(category);
    const budgetAmount = category.budget.budgetAmount;

    return projectedSpending <= budgetAmount;
  }

  /**
   * Calculate time progress percentage for the current budget period
   */
  public getTimeProgressPercentage(budgetPeriod?: string): number {
    if (!budgetPeriod) {
      return 0;
    }

    const { startDate, endDate } = this.getDynamicBudgetPeriodDates(budgetPeriod);

    if (!startDate || !endDate) {
      return 0;
    }

    const now = new Date();
    const totalDuration = endDate.getTime() - startDate.getTime();
    const elapsedDuration = now.getTime() - startDate.getTime();

    if (totalDuration <= 0) {
      return 0;
    }

    const percentage = (elapsedDuration / totalDuration) * 100;
    return Math.min(100, Math.max(0, percentage));
  }

  /**
   * Get detailed tooltip text for time progress
   */
  public getTimeProgressTooltip(budgetPeriod?: string): string {
    if (!budgetPeriod) {
      return '';
    }

    const { startDate, endDate } = this.getDynamicBudgetPeriodDates(budgetPeriod);

    if (!startDate || !endDate) {
      return '';
    }

    const timeProgress = this.getTimeProgressPercentage(budgetPeriod);
    const remainingDays = this.getRemainingDaysInBudgetPeriod(budgetPeriod);
    const totalDays = this.getTotalDaysInBudgetPeriod(budgetPeriod);
    const elapsedDays = totalDays - remainingDays;

    const formatDate = (date: Date): string => {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: startDate.getFullYear() !== endDate.getFullYear() ? 'numeric' : undefined
      });
    };

    return `Time Progress: ${timeProgress.toFixed(1)}%
Period: ${formatDate(startDate)} - ${formatDate(endDate)}
Elapsed: ${elapsedDays} days
Remaining: ${remainingDays} days`;
  }

  /**
   * Get comprehensive progress comparison tooltip
   */
  public getProgressComparisonTooltip(category: Category): string {
    if (!category.budget?.budgetPeriod) {
      return '';
    }

    const spendingProgress = this.calculateBudgetProgressPercentage(category);
    const timeProgress = this.getTimeProgressPercentage(category.budget.budgetPeriod);
    const spent = this.calculateBudgetSpent(category);
    const budgetAmount = category.budget.budgetAmount || 0;
    const remainingDays = this.getRemainingDaysInBudgetPeriod(category.budget.budgetPeriod);

    let status = '';
    if (spendingProgress > timeProgress) {
      status = '⚠️ Spending  crossed';
    } else if (spendingProgress < timeProgress) {
      status = '✅ Spending on track';
    } else {
      status = '⚖️ Spending matches time';
    }

    return status;

    // ${status}

    // Spending: ${spendingProgress.toFixed(1)}% ($${spent.toFixed(2)} / $${budgetAmount.toFixed(2)})
    // Time: ${timeProgress.toFixed(1)}% (${remainingDays} days remaining)

    // ${this.getTimeProgressTooltip(category.budget.budgetPeriod)}`;
  }

  /**
   * Calculate budget remaining for a category
   */
  public calculateBudgetRemaining(category: Category): number {
    if (!category.budget?.hasBudget || !category.budget?.budgetAmount) {
      return 0;
    }

    const spent = this.calculateBudgetSpent(category);
    return Math.max(0, (category.budget.budgetAmount || 0) - spent);
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

  public calculateTotalSpentPerMonth(category: Category): number {
    if (!this.allTransactions || this.allTransactions.length === 0) {
      return 0;
    }

    const categoryTransactions = this.allTransactions.filter(t =>
      t.categoryId === category.id &&
      t.type === TransactionType.EXPENSE
    );

    // If category has a budget period, use dynamic calculation
    if (category.budget?.budgetPeriod) {
      const { startDate, endDate } = this.getDynamicBudgetPeriodDates(category.budget.budgetPeriod);

      if (startDate && endDate) {
        const filteredTransactions = categoryTransactions.filter(t => {
          const txDate = this.dateService.toDate(t.date);
          return txDate && txDate >= startDate && txDate <= endDate;
        });
        return filteredTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      }
    }

    // Fallback to current month calculation
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    return categoryTransactions
      .filter(transaction => {
        const transactionDate = this.dateService.toDate(transaction.date);
        if (!transactionDate) return false;
        return transactionDate.getMonth() === currentMonth &&
          transactionDate.getFullYear() === currentYear;
      })
      .reduce((total, transaction) => total + Math.abs(transaction.amount), 0);
  }

  public calculateTotalIncomePerMonth(category: Category): number {
    if (!this.allTransactions || this.allTransactions.length === 0) {
      return 0;
    }

    const categoryTransactions = this.allTransactions.filter(t =>
      t.categoryId === category.id &&
      t.type === TransactionType.INCOME
    );

    // If category has a budget period, use dynamic calculation
    if (category.budget?.budgetPeriod) {
      const { startDate, endDate } = this.getDynamicBudgetPeriodDates(category.budget.budgetPeriod);

      if (startDate && endDate) {
        const filteredTransactions = categoryTransactions.filter(t => {
          const txDate = this.dateService.toDate(t.date);
          return txDate && txDate >= startDate && txDate <= endDate;
        });
        return filteredTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      }
    }

    // Fallback to current month calculation
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    return categoryTransactions
      .filter(transaction => {
        const transactionDate = this.dateService.toDate(transaction.date);
        if (!transactionDate) return false;
        return transaction.amount > 0 &&
          transactionDate.getMonth() === currentMonth &&
          transactionDate.getFullYear() === currentYear;
      })
      .reduce((total, transaction) => total + transaction.amount, 0);
  }

  public getBudgetProgressColor(category: Category): string {
    const progress = this.calculateBudgetProgressPercentage(category);
    if (progress >= 100) return '#ef4444'; // Red
    if (progress >= 80) return '#f59e0b'; // Orange
    if (progress >= 60) return '#3b82f6'; // Blue
    return '#10b981'; // Green
  }

  public formatBudgetPeriod(period: string | undefined): string {
    if (!period) return '';
    return period.charAt(0).toUpperCase() + period.slice(1);
  }

  public getBudgetStatusClass(category: Category): string {
    const progress = this.calculateBudgetProgressPercentage(category);
    if (progress >= 100) return 'danger';
    if (progress >= 80) return 'warning';
    return 'safe';
  }

  public getRemainingBudgetClass(category: Category): string {
    const remaining = this.calculateBudgetRemaining(category);
    return remaining < 0 ? 'danger' : 'safe';
  }

  public onEditCategory(): void {
    if (this.isMobile) {
      this.openMobileEditDialog();
    } else {
      this.openEditDialog();
    }
  }

  public onDeleteCategory(): void {
    this.categoryService.performDelete(this.category, this.userId);
  }

  public onOpenBudgetDialog(): void {
    this.openBudgetDialog();
  }

  public onSelectParentCategory(): void {
    this.openParentCategorySelectorDialog();
  }

  public onRemoveFromParentCategory(): void {
    this.removeFromParentCategory();
  }



  public onOpenDetailsDialog(): void {
    const dialogData: CategoryDetailsDialogData = {
      category: this.category,
      subCategories: this.subCategories,
      recentTransactions: this.recentTransactions,
      categoryStats: this.categoryStats,
      allTransactions: this.allTransactions
    };

    this.dialog.open(CategoryDetailsDialogComponent, {
      data: dialogData,
      width: '90vw',
      maxWidth: '700px',
      height: '85vh',
      maxHeight: '85vh',
      disableClose: false,
      autoFocus: false,
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      panelClass: 'category-details-dialog-panel'
    });
  }

  private openMobileEditDialog(): void {
    const dialogRef = this.dialog.open(MobileCategoryAddEditPopupComponent, {
      width: '100vw',
      height: '100vh',
      maxWidth: '100vw',
      maxHeight: '100vh',
      data: {
        category: { ...this.category },
        isEdit: true
      },
      disableClose: false,
      autoFocus: false,
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      panelClass: 'mobile-category-dialog-panel'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.notificationService.success('Category updated successfully');
        this.notificationService.successVibration();
      }
    });
  }

  private openEditDialog(): void {
    const dialogRef = this.dialog.open(MobileCategoryAddEditPopupComponent, {
      width: '500px',
      maxWidth: '90vw',
      data: {
        category: { ...this.category },
        isEdit: true
      },
      disableClose: false
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.notificationService.success('Category updated successfully');
      }
    });
  }



  private openBudgetDialog(): void {
    const dialogRef = this.dialog.open(CategoryBudgetDialogComponent, {
      width: '500px',
      maxWidth: '90vw',
      data: {
        category: this.category,
        isEdit: this.category.budget?.hasBudget || false
      },
      disableClose: false
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.updateCategoryBudget(result);
      }
    });
  }

  private updateCategoryBudget(budgetData: Budget): void {
    if (!this.category.id) {
      this.notificationService.error('Category ID not found');
      return;
    }

    this.store.dispatch(CategoriesActions.updateCategory({
      userId: this.userId,
      categoryId: this.category.id,
      name: this.category.name,
      categoryType: this.category.type,
      icon: this.category.icon,
      color: this.category.color,
      budgetData: budgetData
    }));

    // Update local category object to reflect changes immediately
    this.category = {
      ...this.category,
      budget: budgetData
    };

    this.notificationService.success(
      budgetData.hasBudget
        ? 'Budget set successfully for ' + this.category.name
        : 'Budget removed from ' + this.category.name
    );
  }

  private openParentCategorySelectorDialog(): void {
    this.categoryService.openParentCategorySelectorDialog(this.category).subscribe(result => {
      if (result) {
        this.convertToSubCategory(result);
      }
    });
  }

  private convertToSubCategory(parentCategory: Category): void {
    if (!this.category.id || !parentCategory.id) {
      this.notificationService.error('Category ID not found');
      return;
    }

    // Update the current category to be a sub-category
    this.store.dispatch(CategoriesActions.updateCategory({
      userId: this.userId,
      categoryId: this.category.id,
      name: this.category.name,
      categoryType: this.category.type,
      icon: this.category.icon,
      color: this.category.color,
      parentCategoryId: parentCategory.id,
      isSubCategory: true
    }));

    // Note: The parent category's subCategories array would need to be updated separately
    // This is handled by the backend or through a separate action

    this.notificationService.success(`${this.category.name} is now a sub-category of ${parentCategory.name}`);
  }

  private removeFromParentCategory(): void {
    if (!this.category.id) {
      this.notificationService.error('Category ID not found');
      return;
    }

    // Remove from parent category
    this.store.dispatch(CategoriesActions.updateCategory({
      userId: this.userId,
      categoryId: this.category.id,
      name: this.category.name,
      categoryType: this.category.type,
      icon: this.category.icon,
      color: this.category.color,
      parentCategoryId: null,
      isSubCategory: false
    }));

    // If there's a parent category, remove this category from its subCategories array
    if (this.category.parentCategoryId) {
      // Note: This would require fetching the parent category first to get its current subCategories
      // For now, we'll just update the current category
      this.notificationService.success(`${this.category.name} is no longer a sub-category`);
    }
  }
} 