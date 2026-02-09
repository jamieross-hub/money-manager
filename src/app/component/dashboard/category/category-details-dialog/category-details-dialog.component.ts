import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Category } from 'src/app/util/models/category.model';
import { Transaction } from 'src/app/util/models/transaction.model';
import { DateService } from 'src/app/util/service/date.service';
import { TransactionType } from 'src/app/util/config/enums';
import { CommonModule } from '@angular/common';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSlideToggle, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSortModule } from '@angular/material/sort';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CategoryCardComponent } from '../category-card/category-card.component';
import { CurrencyPipe } from 'src/app/util/pipes/currency.pipe';
import { TranslateModule } from '@ngx-translate/core';

export interface CategoryDetailsDialogData {
  category: Category;
  subCategories: Category[];
  recentTransactions: Transaction[];
  categoryStats: any;
  allTransactions: Transaction[];
}

@Component({
  selector: 'app-category-details-dialog',
  templateUrl: './category-details-dialog.component.html',
  styleUrls: ['./category-details-dialog.component.scss'],
  standalone: true,
  imports: [
    CommonModule,

    MatSlideToggle,
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
    CategoryCardComponent,
    CurrencyPipe,
    TranslateModule,
  ]
})
export class CategoryDetailsDialogComponent implements OnInit {
  selectedTabIndex = 0;
  Math = Math;

  constructor(
    private dialogRef: MatDialogRef<CategoryDetailsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CategoryDetailsDialogData,
    public dateService: DateService
  ) { }

  ngOnInit(): void { }

  onClose(): void {
    this.dialogRef.close();
  }

  /**
   * Calculate budget spent for a category based on transactions
   */
  public calculateBudgetSpent(category: Category): number {
    if (!category.budget?.hasBudget || !category.budget?.budgetAmount) {
      return 0;
    }

    const categoryTransactions = this.data.allTransactions.filter(t =>
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

    return (spent / budgetAmount) * 100;
  }

  /**
   * Get budget progress color based on percentage
   */
  public getBudgetProgressColor(category: Category): string {
    const percentage = this.calculateBudgetProgressPercentage(category);
    const threshold = category.budget?.budgetAlertThreshold || 80;

    if (percentage >= 100) return '#f44336'; // Red
    if (percentage >= threshold) return '#ff9800'; // Orange
    return '#4caf50'; // Green
  }

  /**
   * Format budget period for display
   */
  public formatBudgetPeriod(period: string | undefined): string {
    if (!period) return '';

    const periodMap: { [key: string]: string } = {
      'daily': 'Day',
      'weekly': 'Week',
      'monthly': 'Month',
      'yearly': 'Year'
    };

    return periodMap[period] || period;
  }

  /**
   * Get budget status class for styling
   */
  public getBudgetStatusClass(category: Category): string {
    const percentage = this.calculateBudgetProgressPercentage(category);
    const threshold = category.budget?.budgetAlertThreshold || 80;

    if (percentage >= 100) return 'budget-exceeded';
    if (percentage >= threshold) return 'budget-warning';
    return 'budget-ok';
  }

  /**
   * Get remaining budget class for styling
   */
  public getRemainingBudgetClass(category: Category): string {
    const remaining = this.calculateBudgetRemaining(category);
    if (remaining <= 0) return 'budget-exceeded';
    return 'budget-ok';
  }

  /**
   * Calculate total spent per month for a category
   */
  public calculateTotalSpentPerMonth(category: Category): number {
    const categoryTransactions = this.data.allTransactions.filter(t =>
      t.categoryId === category.id &&
      t.type === TransactionType.EXPENSE
    );

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    return categoryTransactions
      .filter(t => {
        const txDate = this.dateService.toDate(t.date);
        return txDate && txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
      })
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }

  /**
   * Calculate total income per month for a category
   */
  public calculateTotalIncomePerMonth(category: Category): number {
    const categoryTransactions = this.data.allTransactions.filter(t =>
      t.categoryId === category.id &&
      t.type === TransactionType.INCOME
    );

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    return categoryTransactions
      .filter(t => {
        const txDate = this.dateService.toDate(t.date);
        return txDate && txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
      })
      .reduce((sum, t) => sum + t.amount, 0);
  }

  /**
   * Get subcategory stats
   */
  public getSubCategoryStats(subCategory: Category): any {
    const subCategoryTransactions = this.data.allTransactions.filter(t =>
      t.categoryId === subCategory.id
    );

    const totalTransactions = subCategoryTransactions.length;
    const totalSpent = subCategoryTransactions
      .filter(t => t.type === TransactionType.EXPENSE)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const averageTransaction = totalTransactions > 0 ? totalSpent / totalTransactions : 0;
    const largestTransaction = subCategoryTransactions.length > 0
      ? Math.max(...subCategoryTransactions.map(t => Math.abs(t.amount)))
      : 0;

    // This month
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const thisMonth = subCategoryTransactions
      .filter(t => {
        const txDate = this.dateService.toDate(t.date);
        return txDate && txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
      })
      .filter(t => t.type === TransactionType.EXPENSE)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Last month
    const lastMonth = subCategoryTransactions
      .filter(t => {
        const txDate = this.dateService.toDate(t.date);
        return txDate && txDate.getMonth() === (currentMonth - 1 + 12) % 12 && txDate.getFullYear() === currentYear;
      })
      .filter(t => t.type === TransactionType.EXPENSE)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return {
      totalTransactions,
      totalSpent,
      averageTransaction,
      largestTransaction,
      thisMonth,
      lastMonth
    };
  }
} 