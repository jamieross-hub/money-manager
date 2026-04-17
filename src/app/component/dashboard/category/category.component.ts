import { Component, OnInit, OnDestroy, Input, ChangeDetectionStrategy } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { UserService } from 'src/app/util/service/db/user.service';
import { MatDialog } from '@angular/material/dialog';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Subject, Observable, BehaviorSubject, combineLatest } from 'rxjs';
import { take, takeUntil, map, startWith, distinctUntilChanged, debounceTime, switchMap } from 'rxjs/operators';
import { NotificationService } from 'src/app/util/service/notification.service';
import { MobileCategoryAddEditPopupComponent } from './mobile-category-add-edit-popup/mobile-category-add-edit-popup.component';
import { EditCategoryGroupDialogComponent } from './edit-category-group-dialog/edit-category-group-dialog.component';

import { Category, Budget } from 'src/app/util/models';
import { CategoryBudgetService } from 'src/app/util/service/category-budget.service';
import { AppViewService, AppView } from 'src/app/util/service/app-view.service';
import { CategoryBudgetDialogComponent } from './category-budget-dialog/category-budget-dialog.component';
import { OpenaiService } from 'src/app/util/service/ai-chat/openai.service';
import { ParentCategorySelectorDialogComponent } from './parent-category-selector-dialog/parent-category-selector-dialog.component';
import { ConfirmDialogComponent } from 'src/app/util/components/confirm-dialog/confirm-dialog.component';
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
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';
import { CategoryService } from 'src/app/util/service/db/category.service';
import { Router } from '@angular/router';
import { FormControl } from '@angular/forms';
import { FooterService } from 'src/app/component/dashboard/footer/footer.service';

import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslateModule } from '@ngx-translate/core';
import { CurrencyPipe } from 'src/app/util/pipes/currency.pipe';
import { CategorySummaryCardComponent } from 'src/app/util/components/cards/category-summary-card/category-summary-card.component';

dayjs.extend(isBetween);

@Component({
  selector: 'user-category',
  templateUrl: './category.component.html',
  styleUrls: ['./category.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    MatListModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatTabsModule,
    TranslateModule,
    CurrencyPipe,
    CategorySummaryCardComponent
  ]
})
export class CategoryComponent implements OnInit, OnDestroy {

  @Input() isChildView: boolean = false;

  public isLoading$: Observable<boolean>;
  public transactions$: Observable<Transaction[]>;
  public Math = Math;

  // Reactive State
  public searchText$ = new BehaviorSubject<string>('');
  public filterType$ = new BehaviorSubject<'all' | 'expense' | 'income'>('all');
  public selectedGroup$ = new BehaviorSubject<string | null>(null);

  // Derived Streams
  public vm$: Observable<{
    categories: (Category & {
      totalSpent: number;
      budgetProgress: number;
      budgetColor: string;
      budgetStatusClass: string;
      stats: any;
    })[];
    summary: {
      totalExpense: number;
      totalIncome: number;
      expenseCount: number;
      incomeCount: number;
      expenseChange: number;
      incomeChange: number;
    };
    availableGroups: { name: string, count: number, icon: string }[];
    hasUngroupedCategories: boolean;
    isFamilyMode: boolean;
  }>;

  public searchControl = new FormControl('');
  public userId: string = '';
  private destroy$ = new Subject<void>();
  public userCurrency$: Observable<string | undefined>;

  // UI State
  public isListViewMode: boolean = false;
  public selectedCategoryId: string | null = null;
  public errorMessage: string = '';
  private longPressTimer: any;

  // Local snapshot for dialogs and helpers
  private _categoriesSnapshot: any[] = [];
  public isAutoCategorizing: boolean = false;

  constructor(
    private auth: Auth,
    private dialog: MatDialog,
    private notificationService: NotificationService,
    private breakpointObserver: BreakpointObserver,
    private store: Store<AppState>,
    private budgetService: CategoryBudgetService,
    public dateService: DateService,
    public breakpointService: BreakpointService,
    private categoryService: CategoryService,
    private userService: UserService,
    public appViewService: AppViewService,
    private openaiService: OpenaiService,
    private footerService: FooterService
  ) {

    this.isLoading$ = this.store.select(CategoriesSelectors.selectCategoriesLoading);
    this.transactions$ = this.store.select(TransactionsSelectors.selectAllTransactions);
    this.userCurrency$ = this.store.select(ProfileSelectors.selectUserCurrency);

    const categories$ = this.store.select(ProfileSelectors.selectIsFamilyMode).pipe(
      switchMap(isFamilyMode => this.store.select(CategoriesSelectors.selectAllCategoriesByContext(isFamilyMode)))
    );

    // Main ViewModel Stream
    this.vm$ = combineLatest([
      categories$,
      this.transactions$,
      this.appViewService.appView$,
      this.searchText$,
      this.filterType$,
      this.selectedGroup$,
      this.store.select(ProfileSelectors.selectIsFamilyMode)
    ]).pipe(
      map(([categories, transactions, appView, searchText, filterType, selectedGroup, isFamilyMode]: [Category[], any[], any, any, any, any, any]) => {
        // ... existing processing ...
        // (skipped for brevity but included in full replacement)
        const processedCategories = categories.map(cat => {
          const catTransactions = transactions.filter(t => t.categoryId === cat.id);
          const viewTransactions = catTransactions.filter(t => this.appViewService.isDateInView(t.date));
          const totalSpent = viewTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
          let budgetProgress = 0;
          let budgetColor = 'primary';
          let budgetStatusClass = '';

          if (cat.budget?.hasBudget) {
            const budgetSpent = this.calculateBudgetSpentInternal(cat, transactions);
            const budgetAmount = cat.budget.budgetAmount || 0;
            budgetProgress = budgetAmount > 0 ? Math.min(100, (budgetSpent / budgetAmount) * 100) : 0;
            const threshold = cat.budget.budgetAlertThreshold || 80;
            budgetColor = this.budgetService.getBudgetProgressColor(cat, budgetProgress, threshold);
            if (budgetProgress >= 90) budgetStatusClass = 'danger';
            else if (budgetProgress >= 75) budgetStatusClass = 'warning';
            else budgetStatusClass = 'safe';
          }
          const stats = this.calculateCategoryStatsInternal(cat, catTransactions);
          return { ...cat, totalSpent, budgetProgress, budgetColor, budgetStatusClass, stats };
        });

        const filtered = processedCategories.filter(category => {
          if (category.isSystem || (category.name.toLowerCase() === 'loan payment' && category.type === TransactionType.INCOME)) return false;
          const matchesSearch = !searchText || category.name.toLowerCase().includes(searchText.toLowerCase());
          const matchesType = filterType === 'all' || category.type.toLowerCase() === filterType;
          const matchesGroup = !selectedGroup || category.group === selectedGroup;
          
          // Added Family Mode context layout filter
          const matchesContext = isFamilyMode ? !!category.familyId : !category.familyId;

          return matchesSearch && matchesType && matchesGroup && matchesContext;
        }).sort((a, b) => {
          const aHasBudget = a.budget?.hasBudget ?? false;
          const bHasBudget = b.budget?.hasBudget ?? false;
          if (aHasBudget !== bHasBudget) return aHasBudget ? -1 : 1;
          return b.totalSpent - a.totalSpent;
        });

        const viewTransactions = transactions.filter(t => this.appViewService.isDateInView(t.date));
        const totalExpense = viewTransactions.filter(t => t.type === TransactionType.EXPENSE).reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const totalIncome = viewTransactions.filter(t => t.type === TransactionType.INCOME).reduce((sum, t) => sum + Math.abs(t.amount), 0);
        let prevExpense = 0;
        let prevIncome = 0;
        let prevStart: dayjs.Dayjs;
        let prevEnd: dayjs.Dayjs;
        if (appView === 'WEEKLY') {
          prevStart = dayjs().subtract(1, 'week').startOf('week');
          prevEnd = dayjs().subtract(1, 'week').endOf('week');
        } else if (appView === 'YEARLY') {
          prevStart = dayjs().subtract(1, 'year').startOf('year');
          prevEnd = dayjs().subtract(1, 'year').endOf('year');
        } else {
          prevStart = dayjs().subtract(1, 'month').startOf('month');
          prevEnd = dayjs().subtract(1, 'month').endOf('month');
        }
        const prevTransactions = transactions.filter(t => {
          const tDate = dayjs(this.dateService.toDate(t.date));
          return tDate.isBetween(prevStart, prevEnd, undefined, '[]');
        });
        prevExpense = prevTransactions.filter(t => t.type === TransactionType.EXPENSE).reduce((sum, t) => sum + Math.abs(t.amount), 0);
        prevIncome = prevTransactions.filter(t => t.type === TransactionType.INCOME).reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const calculateChange = (current: number, previous: number) => {
          if (previous === 0) return current > 0 ? 100 : 0;
          return ((current - previous) / previous) * 100;
        };
        const expenseChange = calculateChange(totalExpense, prevExpense);
        const incomeChange = calculateChange(totalIncome, prevIncome);
        const expenseCount = categories.filter(c => c.type === 'expense').length;
        const incomeCount = categories.filter(c => c.type === 'income').length;
        
        const availableGroups = [...new Set(categories.map(c => c.group).filter(g => !!g))].map(groupName => {
          const matchingCategories = categories.filter(c => c.group === groupName);
          return {
            name: groupName as string,
            count: matchingCategories.length,
            icon: matchingCategories.find(c => c.groupIcon)?.groupIcon || 'category'
          };
        });
        
        const hasUngroupedCategories = processedCategories.some(c => !c.group && !c.isSystem && !c.isSubCategory);
        
        this._categoriesSnapshot = processedCategories;

        return {
          categories: filtered,
          summary: {
            totalExpense,
            totalIncome,
            expenseCount,
            incomeCount,
            expenseChange,
            incomeChange
          },
          availableGroups,
          hasUngroupedCategories,
          isFamilyMode
        };
      })
    );
  }

  ngOnInit(): void {
    this.initializeComponent();
    this.setupSearch();
    this.setupFooter();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.footerService.resetConfig();
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

  private setupSearch(): void {
    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(value => {
      this.searchText$.next((value as string) || '');
    });
  }

  private setupFooter(): void {
    this.vm$.pipe(takeUntil(this.destroy$)).subscribe(vm => {
      this.footerService.patchConfig({
        hideFab: true,
        items: [
          {
            id: 'home',
            icon: 'home',
            label: 'Home'
          },
          
          {
          id: 'fab',
          icon: 'add',
          label: 'Add Category',
          bgClass: 'bg-primary-500',
          isFab: true,
          action: () => this.openAddMobileDialog()
        },{
            id: 'category-count',
            icon: 'category',
            label: `${vm.categories.length} Category`,
            action: () => {} // informational button
          },
          // {
          //   id: 'group-count',
          //   icon: 'folder',
          //   label: `${vm.availableGroups.length} Groups`,
          //   action: () => {} // informational button
          // }
        ]
      });
    });
  }

  public setFilterType(type: string): void {
    if (type === 'all' || type === 'expense' || type === 'income') {
      this.filterType$.next(type as 'all' | 'expense' | 'income');
      this.selectedGroup$.next(null);
    } else {
      this.selectedGroup$.next(type);
      this.filterType$.next('all'); // Reset type filter when a group is selected
    }
  }

  // --- Calculation Helpers ---

  private calculateBudgetSpentInternal(category: Category, transactions: Transaction[]): number {
    if (!category.budget?.hasBudget) return 0;
    const categoryTransactions = transactions.filter(t =>
      t.categoryId === category.id &&
      t.type === TransactionType.EXPENSE
    );

    const budgetStartDate = category.budget.budgetStartDate;
    const budgetEndDate = category.budget.budgetEndDate;
    let filteredTransactions = categoryTransactions;

    if (budgetStartDate) {
      const startDate = this.dateService.toDate(budgetStartDate);
      if (startDate) {
        filteredTransactions = filteredTransactions.filter(t => {
          const txDate = this.dateService.toDate(t.date);
          return txDate && txDate >= startDate;
        });
      }
    }

    if (budgetEndDate) {
      const endDate = this.dateService.toDate(budgetEndDate);
      if (endDate) {
        filteredTransactions = filteredTransactions.filter(t => {
          const txDate = this.dateService.toDate(t.date);
          return txDate && txDate <= endDate;
        });
      }
    }
    return filteredTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }

  private calculateCategoryStatsInternal(category: Category, categoryTransactions: Transaction[]): any {
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

    const totalTransactions = categoryTransactions.length;
    const totalSpent = categoryTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const averageTransaction = totalSpent / totalTransactions;
    const largestTransaction = Math.max(...categoryTransactions.map(t => Math.abs(t.amount)));

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

  // --- UI Action Methods ---

  public trackByCategoryId(index: number, category: Category): string | number {
    return category.id || index;
  }

  public clearError(): void {
    this.errorMessage = '';
  }

  public onGroupPointerDown(event: PointerEvent, groupName: string): void {
    if (this.longPressTimer) clearTimeout(this.longPressTimer);
    this.longPressTimer = setTimeout(() => {
      this.openEditCategoryGroupDialog(groupName);
      this.longPressTimer = null;
    }, 600);
  }

  public onGroupPointerUp(event: PointerEvent): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  public openEditCategoryGroupDialog(groupName: string): void {
    if (this.breakpointService.device.isMobile) {
      this.notificationService.lightVibration();
    }
    const matchingCategories = this._categoriesSnapshot.filter(c => c.group === groupName);
    const currentIcon = matchingCategories.find(c => c.groupIcon)?.groupIcon || 'category';
    const allUserCategories = this._categoriesSnapshot.filter(c => !c.isSystem && !c.isSubCategory);

    const dialogRef = this.dialog.open(EditCategoryGroupDialogComponent, {
      panelClass: 'responsive-dialog',
      closeOnNavigation: false,
      data: { groupName, groupIcon: currentIcon, categories: matchingCategories, allCategories: allUserCategories }
    });

    dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe(result => {
      if (!result) return;
      
      if (result.action === 'save') {
        const newGroupName = result.groupName;
        const newGroupIcon = result.groupIcon;
        
        // 1. Update Added and Existing Categories
        const toSave = [...(result.added || []), ...(result.updated || [])];
        toSave.forEach(cat => {
          this.store.dispatch(CategoriesActions.updateCategory({
            userId: this.userId,
            categoryId: cat.id!,
            name: cat.name,
            categoryType: cat.type,
            icon: cat.icon,
            color: cat.color,
            budgetData: cat.budget,
            parentCategoryId: cat.parentCategoryId,
            isSubCategory: cat.isSubCategory,
            group: newGroupName,
            groupIcon: newGroupIcon
          }));
        });

        // 2. Clear Group for Removed Categories
        const toRemove = result.removed || [];
        toRemove.forEach((cat: any) => {
          this.store.dispatch(CategoriesActions.updateCategory({
            userId: this.userId,
            categoryId: cat.id!,
            name: cat.name,
            categoryType: cat.type,
            icon: cat.icon,
            color: cat.color,
            budgetData: cat.budget,
            parentCategoryId: cat.parentCategoryId,
            isSubCategory: cat.isSubCategory,
            group: '',
            groupIcon: ''
          }));
        });
        
        this.notificationService.success(`Group "${groupName}" updated successfully`);
      } else if (result.action === 'delete') {
         // Ungroup
         matchingCategories.forEach(cat => {
           this.store.dispatch(CategoriesActions.updateCategory({
             userId: this.userId,
             categoryId: cat.id!,
             name: cat.name,
             categoryType: cat.type,
             icon: cat.icon,
             color: cat.color,
             budgetData: cat.budget,
             parentCategoryId: cat.parentCategoryId,
             isSubCategory: cat.isSubCategory,
             group: '', // Clear group name
             groupIcon: '' // Clear group icon
           }));
         });
         this.notificationService.success(`Group "${groupName}" deleted (Categories ungrouped)`);
      }
    });
  }

  public openMobileDialog(category?: Category): void {
    const dialogRef = this.dialog.open(MobileCategoryAddEditPopupComponent, {
      panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : 'desktop-dialog',
      closeOnNavigation: false,
      data: {
        category: category ? { ...category } : null,
        isEdit: category ? true : false,
        allCategories: this._categoriesSnapshot // Use snapshot
      }
    });
    dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe(result => {
      if (result) {
        this.store.dispatch(CategoriesActions.loadCategories({ userId: this.userId }));
      }
    });
  }

  public openAddMobileDialog(): void {
    if (this.breakpointService.device.isMobile) {
      this.notificationService.lightVibration();
    }
    this.openMobileDialog();
  }

  public getSubCategoriesForCategory(categoryId: string | null | undefined): any[] {
    // Return enhanced items from snapshot
    if (!categoryId || !this._categoriesSnapshot) return [];
    return this._categoriesSnapshot.filter(cat =>
      cat.isSubCategory && cat.parentCategoryId === categoryId
    );
  }

  public toggleExpandCategory(category: Category, event: Event): void {
    event.stopPropagation();
    if (this.selectedCategoryId === category.id) {
      this.selectedCategoryId = null;
    } else {
      this.selectedCategoryId = category.id || null;
      if (this.selectedCategoryId && this.breakpointService.device.isMobile) {
        this.notificationService.lightVibration();
      }
    }
  }

  public isCategoryExpanded(categoryId: string | undefined): boolean {
    return this.selectedCategoryId === categoryId;
  }

  public toggleListViewMode(): void {
    this.isListViewMode = !this.isListViewMode;
    this.store.select(ProfileSelectors.selectUserPreferences).pipe(takeUntil(this.destroy$), take(1)).subscribe(preferences => {
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

  public deleteCategory(category: Category): void {
    this.categoryService.performDelete(category, this.userId);
  }

  public openBudgetDialog(category: Category): void {
    const dialogRef = this.dialog.open(CategoryBudgetDialogComponent, {
      panelClass: 'responsive-dialog',
      closeOnNavigation: false,
      data: {
        category: category,
        isEdit: category.budget?.hasBudget || false
      }
    });

    dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe(result => {
      if (result) {
        this.store.dispatch(CategoriesActions.updateCategory({
          userId: this.userId,
          categoryId: category.id!,
          name: category.name,
          categoryType: category.type,
          icon: category.icon,
          color: category.color,
          budgetData: result,
          parentCategoryId: category.parentCategoryId,
          isSubCategory: category.isSubCategory
        }));
        // Note: ViewModel automatically updates via store effect -> selector -> combineLatest
      }
    });
  }

  public openParentCategorySelector(category: Category): void {
    const dialogRef = this.dialog.open(ParentCategorySelectorDialogComponent, {
      panelClass: 'responsive-dialog',
      closeOnNavigation: false,
      data: {
        category: category,
        allCategories: this._categoriesSnapshot
      }
    });

    dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe(result => {
    });
  }

  public removeFromParentCategory(category: Category): void {
    if (!category.parentCategoryId && !category.isSubCategory) return;
    const updatedCategory = { ...category };
    this.store.dispatch(CategoriesActions.updateCategory({
      userId: this.userId,
      categoryId: category.id!,
      name: category.name,
      categoryType: category.type,
      icon: category.icon,
      color: category.color,
      budgetData: category.budget,
      parentCategoryId: null,
      isSubCategory: false
    }));
  }

  public removeBudget(category: Category): void {
    if (!category.budget) return;
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      closeOnNavigation: false,
      data: {
        title: 'Remove Budget',
        message: `Are you sure you want to remove the budget for "${category.name}"?`,
        confirmText: 'Remove',
        cancelText: 'Cancel',
        confirmColor: 'warn'
      }
    });

    dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe(result => {
      if (result) {
        const updatedBudget: any = { ...category.budget, hasBudget: false, budgetAmount: 0 };
        this.store.dispatch(CategoriesActions.updateCategory({
          userId: this.userId,
          categoryId: category.id!,
          name: category.name,
          categoryType: category.type,
          icon: category.icon,
          color: category.color,
          budgetData: updatedBudget,
          parentCategoryId: category.parentCategoryId,
          isSubCategory: category.isSubCategory
        }));
        this.notificationService.success('Budget removed successfully');
      }
    });
  }

  public autoCategorize(): void {
    const ungrouped = this._categoriesSnapshot.filter(c => !c.group && !c.isSystem && !c.isSubCategory);
    
    if (ungrouped.length === 0) {
      this.notificationService.info('No ungrouped categories found.');
      return;
    }

    this.isAutoCategorizing = true;
    const items = ungrouped.map(c => ({ id: c.id!, name: c.name }));
    const existingGroups = [...new Set(this._categoriesSnapshot.map(c => c.group).filter(g => !!g))] as string[];

    this.openaiService.categorizeCategories(items, existingGroups).subscribe({
      next: (results) => {
        let updatedCount = 0;
        results.forEach(res => {
          if (res.group) {
            const cat = ungrouped.find(c => c.id === res.id);
            if (cat) {
              const existingGroupIcon = this._categoriesSnapshot.find(c => c.group === res.group)?.groupIcon;
              this.store.dispatch(CategoriesActions.updateCategory({
                userId: this.userId,
                categoryId: cat.id!,
                name: cat.name,
                categoryType: cat.type,
                icon: cat.icon,
                color: cat.color,
                budgetData: cat.budget,
                parentCategoryId: cat.parentCategoryId,
                isSubCategory: cat.isSubCategory,
                group: res.group,
                groupIcon: res.groupIcon || existingGroupIcon || 'category'
              }));
              updatedCount++;
            }
          }
        });

        this.isAutoCategorizing = false;
        if (updatedCount > 0) {
          this.notificationService.success(`Successfully categorized ${updatedCount} categories.`);
        } else {
          this.notificationService.info('No categories could be mapped to existing groups.');
        }
      },
      error: (err) => {
        this.isAutoCategorizing = false;
        this.notificationService.error(err.message || 'Failed to auto categorize');
      }
    });
  }
}
