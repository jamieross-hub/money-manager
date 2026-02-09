import { Component, OnInit, OnDestroy, Input, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable, Subject, combineLatest } from 'rxjs';
import { takeUntil, map, distinctUntilChanged } from 'rxjs/operators';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CurrencyPipe } from 'src/app/util/pipes/currency.pipe';
import { AppState } from '../../../../store/app.state';
import * as CategoriesSelectors from '../../../../store/categories/categories.selectors';
import * as TransactionsSelectors from '../../../../store/transactions/transactions.selectors';
import { Category } from '../../../models/category.model';
import { Transaction } from '../../../models/transaction.model';
import { TransactionType } from '../../../config/enums';
import { DateService } from '../../../service/date.service';
import { BreakpointService } from '../../../service/breakpoint.service';

@Component({
  selector: 'app-budget-card',
  templateUrl: './budget-card.component.html',
  styleUrls: ['./budget-card.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatProgressBarModule,
    MatIconModule,
    MatCardModule,
    MatButtonModule,
    MatTooltipModule,
    CurrencyPipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BudgetCardComponent implements OnInit, OnDestroy {

  @Input() isHomeView: boolean = false;
  @Input() isChildView: boolean = false;

  // Observables from store
  categories$: Observable<Category[]>;
  transactions$: Observable<Transaction[]>;

  // Computed observables for dynamic calculations
  overallBudgetStats$!: Observable<any>;
  detailedBudgetStats$!: Observable<any>;
  overallBudgetProgressColor$!: Observable<string>;

  // Local properties
  isBudgetSummaryExpanded: boolean = false;
  Math = Math; // Make Math available in template

  private destroy$ = new Subject<void>();

  constructor(
    private store: Store<AppState>,
    public dateService: DateService,
    public breakpointService: BreakpointService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {
    // Initialize selectors
    this.categories$ = this.store.select(CategoriesSelectors.selectAllCategories);
    this.transactions$ = this.store.select(TransactionsSelectors.selectAllTransactions);

    // Create computed observables for dynamic calculations
    this.setupComputedObservables();
  }

  ngOnInit(): void {
    // No need for manual subscription since we're using computed observables
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupComputedObservables(): void {
    // Combine categories and transactions for dynamic calculations
    const data$ = combineLatest([
      this.categories$,
      this.transactions$
    ]).pipe(
      map(([categories, transactions]) => ({ categories, transactions })),
      distinctUntilChanged((prev, curr) =>
        JSON.stringify(prev) === JSON.stringify(curr)
      )
    );

    // Overall budget stats observable
    this.overallBudgetStats$ = data$.pipe(
      map(({ categories, transactions }) => {
        return this.calculateOverallBudgetStats(categories, transactions);
      })
    );

    // Detailed budget stats observable
    this.detailedBudgetStats$ = data$.pipe(
      map(({ categories, transactions }) => {
        return this.calculateDetailedBudgetStats(categories, transactions);
      })
    );

    // Overall budget progress color observable
    this.overallBudgetProgressColor$ = this.overallBudgetStats$.pipe(
      map(stats => {
        const progress = stats?.overallProgress || 0;

        if (progress >= 100) {
          return '#ef4444'; // red - over budget
        } else if (progress >= 80) {
          return '#f59e0b'; // amber - warning
        } else if (progress >= 60) {
          return '#3b82f6'; // blue - good progress
        } else {
          return '#10b981'; // green - safe
        }
      })
    );
  }

  /**
   * Get current budget period dates dynamically
   */
  private getCurrentBudgetPeriod(): { startDate: Date, endDate: Date } {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Start of current month
    const startDate = new Date(currentYear, currentMonth, 1);

    // End of current month
    const endDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);

    return { startDate, endDate };
  }

  /**
   * Check if a transaction falls within the current month only
   */
  private isTransactionInCurrentMonth(transaction: Transaction): boolean {
    const txDate = this.dateService.toDate(transaction.date);
    if (!txDate) return false;

    const { startDate, endDate } = this.getCurrentBudgetPeriod();

    const isInPeriod = txDate >= startDate && txDate <= endDate;

    return isInPeriod;
  }

  /**
   * Calculate budget spent for a category based on current month transactions only
   */
  private calculateBudgetSpent(category: Category, transactions: Transaction[]): number {
    if (!category.budget?.hasBudget || !category.budget?.budgetAmount) {
      return 0;
    }

    const categoryTransactions = transactions.filter(t =>
      t.categoryId === category.id &&
      t.type === TransactionType.EXPENSE &&
      this.isTransactionInCurrentMonth(t)
    );

    const totalSpent = categoryTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return totalSpent;
  }

  /**
   * Calculate budget remaining for a category (dynamic version)
   */
  private calculateBudgetRemaining(category: Category, transactions: Transaction[]): number {
    if (!category.budget?.hasBudget || !category.budget?.budgetAmount) {
      return 0;
    }

    const spent = this.calculateBudgetSpent(category, transactions);
    return Math.max(0, (category.budget.budgetAmount || 0) - spent);
  }

  /**
   * Calculate budget progress percentage for a category (dynamic version)
   */
  private calculateBudgetProgressPercentage(category: Category, transactions: Transaction[]): number {
    if (!category.budget?.hasBudget || !category.budget?.budgetAmount) {
      return 0;
    }

    const spent = this.calculateBudgetSpent(category, transactions);
    const budgetAmount = category.budget.budgetAmount || 0;

    if (budgetAmount === 0) return 0;

    return Math.min(100, (spent / budgetAmount) * 100);
  }

  /**
   * Calculate overall budget statistics for all categories (dynamic version)
   */
  private calculateOverallBudgetStats(categories: Category[], transactions: Transaction[]): any {
    // Check for categories with budgets
    const categoriesWithBudget = categories.filter(cat =>
      cat.budget?.hasBudget && cat.type === TransactionType.EXPENSE
    );

    // Also check for categories with budget amounts but no hasBudget flag
    const categoriesWithBudgetAmount = categories.filter(cat =>
      cat.budget?.budgetAmount && cat.type === TransactionType.EXPENSE
    );

    if (categoriesWithBudget.length === 0) {
      return {
        totalBudget: 0,
        totalSpent: 0,
        totalRemaining: 0,
        overallProgress: 0,
        categoriesWithBudget: 0,
        averageBudget: 0
      };
    }

    const totalBudget = categoriesWithBudget.reduce((sum, cat) =>
      sum + (cat.budget?.budgetAmount || 0), 0
    );

    const totalSpent = categoriesWithBudget.reduce((sum, cat) =>
      sum + this.calculateBudgetSpent(cat, transactions), 0
    );

    const totalRemaining = totalBudget - totalSpent;
    const overallProgress = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
    const averageBudget = totalBudget / categoriesWithBudget.length;

    return {
      totalBudget,
      totalSpent,
      totalRemaining,
      overallProgress,
      categoriesWithBudget: categoriesWithBudget.length,
      averageBudget
    };
  }

  /**
   * Get overall budget status class for styling
   */
  public getOverallBudgetStatusClass(): string {
    // This will be called from template, so we need to get current stats
    let currentStats: any = {};
    this.overallBudgetStats$.pipe(takeUntil(this.destroy$)).subscribe(stats => {
      currentStats = stats;
    });

    if (currentStats.overallProgress >= 90) return 'danger';
    if (currentStats.overallProgress >= 75) return 'warning';
    return 'safe';
  }



  /**
   * Calculate detailed budget statistics for expanded view (dynamic version)
   */
  private calculateDetailedBudgetStats(categories: Category[], transactions: Transaction[]): any {
    const categoriesWithBudget = categories.filter(cat =>
      cat.budget?.hasBudget && cat.type === TransactionType.EXPENSE
    );

    if (categoriesWithBudget.length === 0) {
      return {
        categories: [],
        totalCategories: 0,
        averageSpentPerCategory: 0,
        mostExpensiveCategory: null,
        leastExpensiveCategory: null
      };
    }

    const categoryStats = categoriesWithBudget.map(cat => ({
      id: cat.id,
      name: cat.name,
      budget: cat.budget?.budgetAmount || 0,
      spent: this.calculateBudgetSpent(cat, transactions),
      remaining: this.calculateBudgetRemaining(cat, transactions),
      progress: this.calculateBudgetProgressPercentage(cat, transactions),
      color: cat.color,
      icon: cat.icon
    }));

    const totalSpent = categoryStats.reduce((sum, cat) => sum + cat.spent, 0);
    const averageSpentPerCategory = totalSpent / categoryStats.length;

    const mostExpensiveCategory = categoryStats.reduce((max, cat) =>
      cat.spent > max.spent ? cat : max, categoryStats[0]);

    const leastExpensiveCategory = categoryStats.reduce((min, cat) =>
      cat.spent < min.spent ? cat : min, categoryStats[0]);

    return {
      categories: categoryStats.sort((a, b) => b.spent - a.spent),
      totalCategories: categoryStats.length,
      averageSpentPerCategory,
      mostExpensiveCategory,
      leastExpensiveCategory
    };
  }

  /**
   * Toggle budget summary expansion
   */
  public toggleBudgetSummaryExpansion(): void {
    this.isBudgetSummaryExpanded = !this.isBudgetSummaryExpanded;
    this.cdr.detectChanges();
  }

  /**
   * Navigate to budgets page
   */
  public navigateToBudgets(): void {
    this.router.navigate(['/dashboard/budgets']);
  }

  /**
   * Navigate to categories page
   */
  public navigateToCategories(): void {
    this.router.navigate(['/dashboard/category']);
  }

  // Legacy methods for backward compatibility with template
  public getOverallBudgetStats(): any {
    let stats: any = {};
    this.overallBudgetStats$.pipe(takeUntil(this.destroy$)).subscribe(s => stats = s);
    return stats;
  }

  public getDetailedBudgetStats(): any {
    let stats: any = {};
    this.detailedBudgetStats$.pipe(takeUntil(this.destroy$)).subscribe(s => stats = s);
    return stats;
  }
} 