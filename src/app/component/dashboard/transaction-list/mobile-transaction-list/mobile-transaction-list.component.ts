import {
  Component,
  OnInit,
  OnDestroy,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  signal,
  computed,
  WritableSignal,
  Signal,
  effect,
  input,
  inject,
  ViewChild,
  ElementRef,
  AfterViewInit
} from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';
import { TranslateModule } from '@ngx-translate/core';
import { CurrencyPipe } from 'src/app/util/pipes/currency.pipe';
import { IncludesPipe } from 'src/app/util/pipes/includes.pipe';
import { AppDatePipe } from 'src/app/util/pipes/date.pipe';
import { ImageFallbackDirective } from 'src/app/util/directives/image-fallback.directive';


import { MatDialog } from '@angular/material/dialog';
import { Transaction } from '../../../../util/models/transaction.model';
import { Subject, Subscription, Observable } from 'rxjs';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import { Auth } from '@angular/fire/auth';
import { Account, Category, User } from 'src/app/util/models';
import { Router } from '@angular/router';
import { ConfirmDialogComponent } from '../../../../util/components/confirm-dialog/confirm-dialog.component';
import {
  CustomDateRangeDialogComponent,
  CustomDateRangeData,
} from '../../../../util/components/custom-date-range-dialog';
import { DateService } from 'src/app/util/service/date.service';
import { selectAllAccounts } from 'src/app/store/accounts/accounts.selectors';
import { selectSortedAllTransactions, selectSortedDeletedTransactions, selectRecurringTemplates } from 'src/app/store/transactions/transactions.selectors';
import { AppState } from 'src/app/store/app.state';
import { Store } from '@ngrx/store';
import { selectAllCategories } from 'src/app/store/categories/categories.selectors';
import { RecurringInterval, SyncStatus } from 'src/app/util/config/enums';
import { FilterService } from 'src/app/util/service/filter.service';
import { CategoryService } from 'src/app/util/service/db/category.service';
import { CurrencyService } from 'src/app/util/service/currency.service';
import { ThemeSwitchingService } from 'src/app/util/service/theme-switching.service';
import { AppViewService } from 'src/app/util/service/app-view.service';
import { UserService } from 'src/app/util/service/db/user.service';

import { TransactionsService } from 'src/app/util/service/db/transactions.service';
import { RecurringService } from 'src/app/util/service/db/recurring.service';
import { TransactionProcessorService } from 'src/app/util/service/transaction-processor.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, distinctUntilChanged } from 'rxjs/operators';
import * as ProfileSelectors from 'src/app/store/profile/profile.selectors';
import * as FamilySelectors from 'src/app/modules/family/store/family.selectors';
import { FamilyMember, Family } from 'src/app/util/models/family.model';
import { AppView } from 'src/app/util/service/app-view.service';
import { RecurringTemplate } from 'src/app/util/models/recurring.model';

dayjs.extend(weekOfYear);

interface SortOption {
  value: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'mobile-transaction-list',
  templateUrl: './mobile-transaction-list.component.html',
  styleUrls: ['./mobile-transaction-list.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatDialogModule,
    MatMenuModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    TranslateModule,
    CurrencyPipe,
    IncludesPipe,
    AppDatePipe,
    FormsModule,
    MatDividerModule,
    ImageFallbackDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('popIn', [
      transition('void => new', [
        style({ 
          opacity: 0, 
          height: 0,
          marginBottom: 0,
          transform: 'scale(0.92) translateY(15px)',
          overflow: 'hidden'
        }),
        // First, expand the space for the card gracefully
        animate('350ms cubic-bezier(0.4, 0, 0.2, 1)', style({ 
          height: '*', 
          marginBottom: '8px' 
        })),
        // Then, pop the card content in with a natural bounce
        animate('650ms cubic-bezier(0.175, 0.885, 0.32, 1.275)', style({ 
          opacity: 1, 
          transform: 'scale(1) translateY(0)' 
        }))
      ])
    ])
  ]
})
export class MobileTransactionListComponent
  implements OnInit, OnDestroy {
  @Output() editTransaction = new EventEmitter<Transaction>();
  @Output() deleteTransaction = new EventEmitter<Transaction>();
  @Output() addTransaction = new EventEmitter<void>();
  @Output() importTransactions = new EventEmitter<void>();
  @Output() adjustTransaction = new EventEmitter<Transaction>();

  private readonly filterService = inject<FilterService>(FilterService);
  private readonly userService = inject<UserService>(UserService);
  private readonly store = inject(Store<AppState>);
  private readonly appViewService = inject<AppViewService>(AppViewService);
  private readonly dateService = inject<DateService>(DateService);
  private readonly categoryService = inject<CategoryService>(CategoryService);
  private readonly currencyService = inject<CurrencyService>(CurrencyService);
  private readonly themeService = inject<ThemeSwitchingService>(ThemeSwitchingService);
  private readonly transactionsService = inject<TransactionsService>(TransactionsService);
  private readonly recurringService = inject(RecurringService);
  private readonly processorService = inject(TransactionProcessorService);
  private readonly route = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly auth = inject(Auth);

  isRecurring = input<boolean>(false);

  selectedTx: Transaction | null = null;
  showFilters: boolean = false;

  // Signals defined below...

  sortOptions: SortOption[] = [
    { value: 'date-desc', label: 'Newest First', icon: 'schedule' },
    { value: 'date-asc', label: 'Oldest First', icon: 'schedule' },
    { value: 'amount-desc', label: 'Highest Amount', icon: 'trending_up' },
    { value: 'amount-asc', label: 'Lowest Amount', icon: 'trending_down' },

    { value: 'category-asc', label: 'Category A-Z', icon: 'category' },
  ];

  showChart: boolean = false;
  // private chartRoot: am5.Root | null = null;

  private subscription = new Subscription();
  destroy$: Subject<void> = new Subject<void>();
  
  // Base signals from Store
  allActiveTransactions = this.store.selectSignal<Transaction[]>(selectSortedAllTransactions);
  deletedTransactions = this.store.selectSignal<Transaction[]>(selectSortedDeletedTransactions);
  recurringTemplates = this.store.selectSignal<RecurringTemplate[]>(selectRecurringTemplates);
  
  allTransactions = computed(() => {
    if (this.selectedRange() === 'deleted') {
      return this.deletedTransactions();
    }
    return this.allActiveTransactions();
  });

  categories = toSignal(this.store.select(selectAllCategories), { initialValue: [] as Category[] });
  accounts = toSignal(this.store.select(selectAllAccounts), { initialValue: [] as Account[] });

  // Filter Signals
  searchTerm = this.filterService.searchTerm;
  selectedCategory = this.filterService.selectedCategory;
  selectedType = this.filterService.selectedType;
  selectedDate = this.filterService.selectedDate;
  selectedDateRange = this.filterService.selectedDateRange;
  isRecurringFilter = this.filterService.isRecurring;
  
  selectedSort = signal<string>('date-desc');
  showActiveFilterDetails = signal<boolean>(false);
  public selectedRange = signal<string | null>(null);
  private sessionStartTime = Date.now();

  // Scroll tracking signals
  public currentScrollHeader = signal<string>('');
  public showScrollIndicator = signal<boolean>(false);
  private scrollTimeout: any;

  @ViewChild('scrollContainer') scrollContainer!: ElementRef;

  /** True when the user's preferences have isFamilyMode enabled */
  isFamilyMode = toSignal(
    this.store.select(ProfileSelectors.selectProfile).pipe(
      map(profile => profile?.preferences?.isFamilyMode ?? false)
    ),
    { initialValue: false }
  );

  appView = toSignal(this.appViewService.appView$, { initialValue: 'MONTHLY' as AppView });

  /** Current active family */
  activeFamily = this.store.selectSignal<Family | null>(FamilySelectors.selectFamily);

  /** True when the current family is in 'split' mode */
  isSplitMode = computed(() => this.activeFamily()?.mode === 'split');

  categoryMap = computed(() => {
    const map = new Map<string, Category>();
    this.categories().forEach(cat => {
      if (cat.id) map.set(cat.id, cat);
    });
    return map;
  });

  // Processor Signals
  filteredTransactions = this.processorService.filteredTransactions;
  flattenedTransactions = this.processorService.flattenedTransactions;
  totalIncome = this.processorService.totalIncome;
  totalExpenses = this.processorService.totalExpenses;
  filteredCount = this.processorService.filteredCount;
  isProcessing = this.processorService.isProcessing;

  accountMap = computed(() => {
    const map = new Map<string, Account>();
    this.accounts().forEach(acc => {
      map.set(acc.accountId, acc);
    });
    return map;
  });

  // allTransactions now replaced by direct signal above

  trackById(index: number, item: any): string {
    return item.id;
  }

  isGuest = computed(() => this.userService.isGuestUser());
  activeFiltersCount = computed(() => {
    // We can rely on service or compute locally if needed, keeping service for now but wrapping in signal if needed or just property
    // But since `activeFiltersCount` was a property updated manually, let's use the service call inside an effect or just update it when filters change.
    // Actually, let's just use the service directly in the template or compute it from our signals?
    // The previous implementation updated `activeFiltersCount` property.
    // Let's make it a computed based on our local signals which mirror the service.

    // Simpler: use the existing method `this.filterService.getActiveFiltersCount()` but we need to know when to trigger.
    // Let's stick to updating a signal or just calling the service if using signals throughout.
    // Using a computed that depends on the filter signals is best.
    let count = 0;
    if (this.searchTerm()) count++;
    if (this.selectedType() !== 'all') count++;
    if (!this.selectedCategory().includes('all')) count++;
    if (this.selectedDate() || this.selectedDateRange()) count++;
    return count;
  });

  availableCategories = computed(() => {
    const cats = this.categories();
    const txs = this.allTransactions();
    if (!cats || !txs) return [];

    const usedCategoryIds = new Set<string>();
    txs.forEach(tx => {
      if (tx.categoryId) usedCategoryIds.add(tx.categoryId);
      if (tx.isCategorySplit && tx.categorySplits) {
        tx.categorySplits.forEach(split => {
          if (split.categoryId) usedCategoryIds.add(split.categoryId);
        });
      }
    });

    return cats
      .filter(category => usedCategoryIds.has(category.id || ''))
      .map(category => ({ ...category, id: category.id || '' }));
  });

  toggleFilterDetails(event: MouseEvent) {
    if ((event.target as HTMLElement).closest('.quick-clear-btn')) return;
    this.showActiveFilterDetails.set(!this.showActiveFilterDetails());
  }

  clearFilter(type: 'search' | 'category' | 'type' | 'date') {
    switch (type) {
      case 'search':
        this.onSearchChange('');
        break;
      case 'category':
        this.onCategoryChange('all');
        break;
      case 'type':
        this.onTypeChange('all');
        break;
      case 'date':
        this.onDateRangeChange(null);
        break;
    }
  }

  totalCount = computed(() => this.allTransactions().length);

  /** True when the user's preferences have isFamilyMode enabled */
  // isFamilyMode = toSignal(...) // Moved up

  /** Current active family */
  // activeFamily = this.store.selectSignal(FamilySelectors.selectFamily); // Moved up

  /** True when the current family is in 'split' mode */
  // isSplitMode = computed(() => this.activeFamily()?.mode === 'split'); // Moved up

  /** Current user's UID */
  private readonly currentUserProfile = this.store.selectSignal<User | null>(ProfileSelectors.selectProfile);
  get currentUserId(): string { return this.currentUserProfile()?.uid ?? ''; }

  /** Family members list (for role lookups) */
  familyMembers = toSignal(
    this.store.select(FamilySelectors.selectFamilyMembers),
    { initialValue: [] as FamilyMember[] }
  );

  /**
   * Returns true if the current user can edit the given transaction.
   * - Transactions linked to a settlement CANNOT be edited (to prevent data inconsistency).
   */
  canEdit(tx: Transaction): boolean {
      if (!this.isFamilyMode()) return true;
    if (tx.settlementId || tx.categoryId === 'adjustment' || tx.status === 'pending') return false;
    return this.canPerformAction(tx);
  }

  /**
   * Returns true if the current user can delete the given transaction.
   * - Settlement transactions can be deleted by: creator, sender, or receiver.
   */
  canDelete(tx: Transaction): boolean {
    if (tx.settlementId) {
      const uid = this.currentUserId;
      if (!uid) return false;
      // Creator, Sender, or Receiver can delete
      if (tx.createdBy === uid || tx.userId === uid || tx.settlementFromUserId === uid || tx.settlementToUserId === uid) {
        return true;
      }
      // Family Admin can also delete
      const me = this.familyMembers().find(m => m.userId === uid);
      return me?.role === 'admin';
    }
    return this.canPerformAction(tx);
  }

  private canPerformAction(tx: Transaction): boolean {
    if (!this.isFamilyMode()) return true;
    const uid = this.currentUserId;
    if (!uid) return false;
    // Creator can always edit/delete
    if (tx.createdBy === uid || tx.userId === uid) return true;
    // Admin can edit/delete
    const me = this.familyMembers().find(m => m.userId === uid);
    return me?.role === 'admin';
  }

  // Labels (Computed)
  currentSortLabel = computed(() => {
    const option = this.sortOptions.find(opt => opt.value === this.selectedSort());
    return option ? option.label : 'Sort';
  });

  currentTypeLabel = computed(() => {
    switch (this.selectedType()) {
      case 'income': return 'Income';
      case 'expense': return 'Expense';
      default: return 'All Types';
    }
  });

  currentCategoryLabel = computed(() => {
    const cats = this.selectedCategory();
    if (cats.includes('all')) return 'All Categories';
    if (cats.length === 1) {
      const category = this.categories().find(cat => cat.id === cats[0]);
      return category ? category.name : 'Unknown Category';
    }
    return `${cats.length} Categories`;
  });

  currentDateLabel = computed(() => {
    const date = this.selectedDate();
    const range = this.selectedDateRange();

    if (date) return dayjs(date).format('MMM DD, YYYY');
    if (range) {
      const start = dayjs(range.startDate).format('MMM DD');
      const end = dayjs(range.endDate).format('MMM DD, YYYY');
      return `${start} - ${end}`;
    }
    return 'All Dates';
  });



  constructor() {
    effect(() => {
      const transactions = this.allTransactions();
      const recurringTemplates = this.recurringTemplates();
      const categories = this.categories();
      const accounts = this.accounts();
      const searchTerm = this.searchTerm();
      const selectedCategory = this.selectedCategory();
      const selectedType = this.selectedType();
      const selectedDate = this.selectedDate();
      const selectedDateRange = this.selectedDateRange();
      const isRecurringFilter = this.isRecurringFilter();
      const selectedSort = this.selectedSort();
      const selectedRange = this.selectedRange();
      const appView = this.appView();
      const isRecurringMode = this.isRecurring();
      const isFamilyMode = this.isFamilyMode();

      this.processorService.process({
        transactions,
        recurringTemplates,
        categories,
        accounts,
        filters: {
          searchTerm,
          selectedCategory,
          selectedType,
          selectedDate,
          selectedDateRange,
          isRecurring: isRecurringFilter
        },
        sort: selectedSort,
        range: selectedRange,
        sessionStartTime: this.sessionStartTime,
        appView,
        isRecurringMode,
        isFamilyMode,
        isDeletedMode: selectedRange === 'deleted',
        currentUserId: this.currentUserId
      });
    });

    // Watch for Input changes and hook into filterService
    effect(() => {
      if (this.isRecurring() || this.isFamilyMode()) {
        this.onDateRangeChange(null);
      }
    });


    // React to theme changes (e.g., for charts)
    effect(() => {
      this.themeService.currentTheme();
      // if (this.showChart) {
      //   this.renderChart();
      // }
    });
  }

  ngOnInit() {
    if (this.route.url.includes('transactions') && !this.isRecurring()) {
      this.showFilters = true;
    }

    // Set initial date range based on App View preference and Family Mode
    this.subscription.add(
      this.store.select(ProfileSelectors.selectProfile).pipe(
        map(profile => ({
          view: profile?.preferences?.appView || 'MONTHLY',
          isFamilyMode: profile?.preferences?.isFamilyMode ?? false
        })),
        distinctUntilChanged((prev, curr) => prev.view === curr.view && prev.isFamilyMode === curr.isFamilyMode)
      ).subscribe(({ view, isFamilyMode }) => {
        if (this.isRecurring() || isFamilyMode) {
          this.onDateRangeChange(null);
        } else {
          let range = 'this-month';
          if (view === 'WEEKLY') {
            range = 'this-week';
          } else if (view === 'YEARLY') {
            range = 'this-year';
          }
          this.onDateRangeChange(range);
        }
      })
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
  }


  onCategoryChange(category: string) {
    let newCategories = this.selectedCategory();
    if (category === 'all') {
      newCategories = ['all'];
    } else {
      if (newCategories.includes('all')) {
        newCategories = [];
      }

      if (newCategories.includes(category)) {
        newCategories = newCategories.filter(c => c !== category);
      } else {
        newCategories = [...newCategories, category];
      }

      if (newCategories.length === 0) {
        newCategories = ['all'];
      }
    }
    this.filterService.setSelectedCategory(newCategories);
  }

  onSearchChange(term: string) {
    this.filterService.setSearchTerm(term);
  }

  onSortChange(sortValue: string) {
    this.selectedSort.set(sortValue);
  }

  onTypeChange(type: string) {
    this.filterService.setSelectedType(type);
  }

  onDateRangeChange(range: string | null) {
    this.selectedRange.set(range);
    if (!range) {
      this.filterService.clearSelectedDate();
      return;
    }

    let startDate: Date;
    let endDate: Date;
    this.selectedRange.set(range);

    if (range === 'upcoming') {
      const recurring = this.allTransactions().filter(t => t.isRecurring);
      const appView = this.appViewService.appView;
      const today = dayjs().startOf('day').toDate();

      if (appView === 'WEEKLY') {
        startDate = today;
        endDate = dayjs().add(1, 'week').endOf('day').toDate();
      } else if (appView === 'YEARLY') {
        startDate = today;
        endDate = dayjs().add(1, 'year').endOf('day').toDate();
      } else {
        startDate = today;
        endDate = dayjs().add(1, 'month').endOf('day').toDate();
      }

      this.filterService.setSelectedDateRange(startDate, endDate);
      return;
    }

    switch (range) {
      case 'today':
        startDate = dayjs().startOf('day').toDate();
        endDate = dayjs().endOf('day').toDate();
        break;
      case 'yesterday':
        startDate = dayjs().subtract(1, 'day').startOf('day').toDate();
        endDate = dayjs().subtract(1, 'day').endOf('day').toDate();
        break;
      case 'this-week':
        startDate = dayjs().startOf('week').toDate();
        endDate = dayjs().endOf('week').toDate();
        break;
      case 'last-week':
        startDate = dayjs().subtract(1, 'week').startOf('week').toDate();
        endDate = dayjs().subtract(1, 'week').endOf('week').toDate();
        break;
      case 'this-month':
        startDate = dayjs().startOf('month').toDate();
        endDate = dayjs().endOf('month').toDate();
        break;
      case 'last-month':
        startDate = dayjs().subtract(1, 'month').startOf('month').toDate();
        endDate = dayjs().subtract(1, 'month').endOf('month').toDate();
        break;
      case 'this-year':
        startDate = dayjs().startOf('year').toDate();
        endDate = dayjs().endOf('year').toDate();
        break;
      default:
        return;
    }

    this.filterService.setSelectedDateRange(startDate, endDate);
  }

  isCurrentMonth(): boolean {
    const currentMonth = dayjs().month();
    const currentYear = dayjs().year();
    return this.filteredTransactions().some((tx: Transaction) => {
      const txDate = dayjs(this.dateService.toDate(tx.date));
      return txDate.month() === currentMonth && txDate.year() === currentYear;
    });
  }

  isCurrentWeek(): boolean {
    const currentWeek = dayjs().week();
    const currentYear = dayjs().year();
    return this.filteredTransactions().some((tx: Transaction) => {
      const txDate = dayjs(this.dateService.toDate(tx.date));
      return txDate.week() === currentWeek && txDate.year() === currentYear;
    });
  }

  isLastMonth(): boolean {
    const lastMonth = dayjs().subtract(1, 'month').month();
    const lastMonthYear = dayjs().subtract(1, 'month').year();
    return this.filteredTransactions().some((tx: Transaction) => {
      const txDate = dayjs(this.dateService.toDate(tx.date));
      return txDate.month() === lastMonth && txDate.year() === lastMonthYear;
    });
  }

  isCurrentYear(): boolean {
    const currentYear = dayjs().year();
    return this.filteredTransactions().some((tx: Transaction) => {
      const txDate = dayjs(this.dateService.toDate(tx.date));
      return txDate.year() === currentYear;
    });
  }

  hasActiveFilters(): boolean {
    return this.filterService.hasActiveFilters();
  }

  getCurrentSortLabel(): string {
    return this.currentSortLabel();
  }

  getCurrentTypeLabel(): string {
    return this.currentTypeLabel();
  }

  getCurrentCategoryLabel(): string {
    return this.currentCategoryLabel();
  }

  getCurrentDateLabel(): string {
    return this.currentDateLabel();
  }

  onLongPress(transaction: Transaction, element: HTMLElement) {
    if (transaction.id?.startsWith('upcoming-')) return;

    if (this.selectedTx?.id === transaction.id) {
      this.selectedTx = null;
    } else {
      this.selectedTx = transaction;
      // Scroll into view with a slight delay to allow expansion rendering
      setTimeout(() => {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
    }
  }

  onEditTransaction(transaction: Transaction) {
    this.editTransaction.emit(transaction);
  }

  onAdjustTransaction(transaction: Transaction) {
    this.adjustTransaction.emit(transaction);
  }

  onDeleteTransaction(transaction: Transaction) {
    const isSettlement = !!transaction.settlementId;
    
    this.dialog
      .open(ConfirmDialogComponent, {
        width: '300px',
        data: {
          title: isSettlement ? 'Revert Settlement' : 'Delete Transaction',
          message: isSettlement 
                   ? 'Are you sure you want to revert this settlement? This will restore the previous balances between the members.' 
                   : 'Are you sure you want to delete this transaction?',
          confirmText: isSettlement ? 'Revert' : 'Delete',
          cancelText: 'Cancel',
        },
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.deleteTransaction.emit(transaction);
        }
      });
  }

  onConfirmRecurring(tx: Transaction) {
    const userId = this.userService.getCurrentUserId();
    if (!userId || userId === 'offline-guest') return;

    // The 'tx' is a virtual transaction (upcoming-X-timestamp)
    // Robust parsing for originalId which might contain dashes
    const parts = tx.id?.split('-');
    if (!parts || parts.length < 3) return;
    const originalId = parts.slice(1, -1).join('-');
    const originalTemplate = this.recurringTemplates().find(t => t.id === originalId);

    if (originalTemplate) {
      const confirmedDate = this.dateService.toDate(tx.date);
      if (!confirmedDate) return;

      this.subscription.add(
        this.recurringService.processRecurringTransaction(userId, originalTemplate, confirmedDate).subscribe(() => {
          // Success handled by store update
        })
      );
    }
  }

  onRejectRecurring(tx: Transaction) {
    const userId = this.userService.getCurrentUserId();
    if (!userId || userId === 'offline-guest') return;

    const parts = tx.id?.split('-');
    if (!parts || parts.length < 3) return;
    const originalId = parts.slice(1, -1).join('-');
    const originalTemplate = this.recurringTemplates().find(t => t.id === originalId);

    if (originalTemplate) {
       const skippedDate = this.dateService.toDate(tx.date);
       if (!skippedDate) return;

       this.subscription.add(
        this.recurringService.skipRecurringTransaction(userId, originalTemplate, skippedDate).subscribe(() => {
          // Success handled by store update
        })
      );
    }
  }

  onAddTransaction() {
    this.addTransaction.emit();
  }

  onImportTransactions() {
    this.importTransactions.emit();
  }

  getCategoriesList(): (Category & { id: string })[] {
    return this.availableCategories();
  }

  getCurrentYear(): number {
    return dayjs().year();
  }


  openCustomDateRangeDialog() {
    this.dialog.open(CustomDateRangeDialogComponent, {
      width: '90%',
      maxWidth: '400px',
      data: {
        startDate: this.selectedDateRange()?.startDate,
        endDate: this.selectedDateRange()?.endDate
      }
    }).afterClosed().subscribe((result: CustomDateRangeData) => {
      if (result && result.startDate && result.endDate) {
        this.filterService.setSelectedDateRange(result.startDate, result.endDate);
      }
    });
  }

  getCategoryIcon(categoryId: string): string {
    const category = this.categoryMap().get(categoryId);
    return category?.icon || 'category';
  }

  getCategoryColor(categoryId: string): string {
    const category = this.categoryMap().get(categoryId);
    return category?.color || '#46777f';
  }



  getAccountName(accountId: string): string {
    const account = this.accountMap().get(accountId);
    return account?.name || 'Unknown Account';
  }

  getAccountType(accountId: string): string {
    const account = this.accountMap().get(accountId);
    return account?.type || 'Unknown';
  }

  getRecurringInfo(transaction: Transaction): string {
    if (transaction.recurringInterval) {
      return `Repeats ${transaction.recurringInterval.toLowerCase()}`;
    }
    return '';
  }

  getSyncStatusInfo(transaction: Transaction): string {
    switch (transaction.syncStatus) {
      case SyncStatus.PENDING:
        return 'Pending sync';
      case SyncStatus.SYNCED:
        return 'Synced';
      case SyncStatus.FAILED:
        return 'Sync failed';
      default:
        return '';
    }
  }

  getSyncStatusIcon(transaction: Transaction): string {
    switch (transaction.syncStatus) {
      case SyncStatus.PENDING:
        return 'schedule';
      case SyncStatus.SYNCED:
        return 'check_circle';
      case SyncStatus.FAILED:
        return 'error';
      default:
        return 'help';
    }
  }

  getSyncStatusColor(transaction: Transaction): string {
    switch (transaction.syncStatus) {
      case SyncStatus.PENDING:
        return 'orange';
      case SyncStatus.SYNCED:
        return 'green';
      case SyncStatus.FAILED:
        return 'red';
      default:
        return 'gray';
    }
  }

  clearAllFilters() {
    this.filterService.clearAllFilters();
    this.selectedSort.set('date-desc');
  }

  quickClearFilters() {
    this.filterService.clearAllFilters();
  }

  // Placeholder for missing chart methods
  renderChart() {
    // Chart rendering logic removed
  }

  onScroll(event: Event) {
    const container = event.target as HTMLElement;
    if (!container) return;

    // Show indicator
    this.showScrollIndicator.set(true);
    
    // Clear previous timeout
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }

    // Hide indicator after 1.5s of no scrolling
    this.scrollTimeout = setTimeout(() => {
      this.showScrollIndicator.set(false);
      this.cdr.markForCheck();
    }, 1500);

    // Find the currently visible header
    this.updateCurrentHeader(container);
  }

  private updateCurrentHeader(container: HTMLElement) {
    const headers = container.querySelectorAll('.date-header-pill');
    let activeHeader = '';
    
    // Simple logic: find the header closest to the top but not past it
    for (let i = 0; i < headers.length; i++) {
      const rect = headers[i].getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      
      // If the header is near the top of the container
      if (rect.top <= containerRect.top + 100) {
        activeHeader = headers[i].getAttribute('data-header') || '';
      } else {
        break; 
      }
    }

    if (activeHeader && activeHeader !== this.currentScrollHeader()) {
      this.currentScrollHeader.set(activeHeader);
    }
  }
}
