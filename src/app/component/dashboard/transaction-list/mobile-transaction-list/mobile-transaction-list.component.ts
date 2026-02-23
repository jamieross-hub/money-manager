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
  input
} from '@angular/core';
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

import { MatDialog } from '@angular/material/dialog';
import { Transaction } from '../../../../util/models/transaction.model';
import { Subject, Subscription, Observable } from 'rxjs';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import { Auth } from '@angular/fire/auth';
import { Account, Category } from 'src/app/util/models';
import { Router } from '@angular/router';
import { ConfirmDialogComponent } from '../../../../util/components/confirm-dialog/confirm-dialog.component';
import {
  CustomDateRangeDialogComponent,
  CustomDateRangeData,
} from '../../../../util/components/custom-date-range-dialog';
import { DateService } from 'src/app/util/service/date.service';
import { selectAllAccounts } from 'src/app/store/accounts/accounts.selectors';
import { selectAllTransactions } from 'src/app/store/transactions/transactions.selectors';
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
    FormsModule,
    MatDividerModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MobileTransactionListComponent
  implements OnInit, OnDestroy {
  @Output() editTransaction = new EventEmitter<Transaction>();
  @Output() deleteTransaction = new EventEmitter<Transaction>();
  @Output() addTransaction = new EventEmitter<void>();
  @Output() importTransactions = new EventEmitter<void>();

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
  categories = signal<Category[]>([]);
  accounts = signal<Account[]>([]);
  private availableCategories: (Category & { id: string })[] = [];

  // Store observables
  transactions$: Observable<Transaction[]> = this.store.select(selectAllTransactions);
  public selectedRange = signal<string | null>(null);

  // Optimization: Maps for O(1) access
  private categoryMap = new Map<string, Category>();
  private accountMap = new Map<string, Account>();

  // Signals
  allTransactions = signal<Transaction[]>([]);
  upcomingTransactions = signal<Transaction[]>([]);
  filteredTransactions = signal<Transaction[]>([]);

  // Filter Signals
  searchTerm = signal<string>('');
  selectedCategory = signal<string[]>(['all']);
  selectedType = signal<string>('all');
  selectedDate = signal<Date | null>(null);
  selectedDateRange = signal<{ startDate: Date; endDate: Date } | null>(null);
  selectedSort = signal<string>('date-desc');
  isRecurringFilter = signal<boolean | null>(null);

  // Computed View Models
  groupedTransactions = computed(() => {
    const transactions = this.filteredTransactions();
    const range = this.selectedRange();
    const sort = this.selectedSort();
    const isDateSort = sort === 'date-desc' || sort === 'date-asc';
    const groups: { date: string; dateHeader: string; transactions: any[]; isUpcomingGroup?: boolean }[] = [];
    const dateHeaderCache = new Map<string, string>();
    const today = dayjs().startOf('day');
    const yesterday = dayjs().subtract(1, 'day').startOf('day');

    // Separate upcoming/due transactions to show them first if needed or within groups
    const sortedTransactions = [...transactions];
    
    sortedTransactions.forEach(tx => {
      const txDate = this.dateService.toDate(tx.date);
      const dateObj = dayjs(txDate);
      
      let dateKey: string;
      if (range === 'this-year' || range === null) {
        dateKey = dateObj.format('YYYY-MM');
      } else {
        dateKey = dateObj.format('YYYY-MM-DD');
      }

      // Pre-calculate view properties (logic preserved)
      const categoryId = tx.categoryId || '';
      const category = this.categoryMap.get(categoryId);
      const accountId = tx.accountId || '';
      const account = this.accountMap.get(accountId);

      const createdDate = tx.createdAt || tx.date;
      const createdDateObj = dayjs(this.dateService.toDate(createdDate));

      const txView = {
        ...tx,
        _categoryColor: category?.color || '#46777f',
        _categoryIcon: category?.icon || 'category',
        _categoryName: category?.name || categoryId || 'Unknown',
        _accountName: account?.name || 'Unknown Account',
        _accountType: account?.type || 'Unknown',
        _dateDisplay: dateObj.format('dd MMM '),
        _timeDisplay: dateObj.format('hh:mm a'),
        _fullDateDisplay: createdDateObj.format('DD MMM YYYY, hh:mm a'), 
        _syncStatusColor: this.getSyncStatusColor(tx),
        _syncStatusIcon: this.getSyncStatusIcon(tx),
        _syncStatusInfo: this.getSyncStatusInfo(tx),
        _recurringInfo: this.getRecurringInfo(tx),
        _isIncome: tx.type === 'income',
        _categoryBgColor: (category?.color || '#46777f') + '20',
        _updatedDisplay: tx.updatedAt ? dayjs(this.dateService.toDate(tx.updatedAt)).format('DD MMM YYYY, hh:mm a') : 
                        (tx.createdAt ? dayjs(this.dateService.toDate(tx.createdAt)).format('DD MMM YYYY, hh:mm a') : 'N/A'),
        _isUpcoming: !!tx.isPending && (tx.id?.startsWith('upcoming-') || false),
        _dueStatus: tx.date ? this.getDueStatus(this.dateService.toDate(tx.date)!) : '',
        _isOverdue: tx.date ? dayjs(this.dateService.toDate(tx.date)).isBefore(today, 'day') : false
      };

      let group = groups.find(g => g.date === dateKey);
      if (!group) {
        let header = dateHeaderCache.get(dateKey);
        if (!header) {
          if (txView._isUpcoming && txView._isOverdue) {
            header = 'Overdue Recurring';
          } else if (range === 'this-year' || range === null) {
            header = dateObj.format('MMMM YYYY');
          } else if (isDateSort) {
            // Relative labels only when sorted by date
            if (dateObj.isSame(today, 'day')) {
              header = 'Today';
            } else if (dateObj.isSame(yesterday, 'day')) {
              header = 'Yesterday';
            } else {
              header = dateObj.format('dddd, DD MMM YYYY');
            }
          } else {
            // Non-date sorts: always show explicit date
            header = dateObj.format('DD MMM YYYY');
          }
          dateHeaderCache.set(dateKey, header);
        }
        group = { date: dateKey, dateHeader: header, transactions: [], isUpcomingGroup: txView._isUpcoming };
        groups.push(group);
      }
      group.transactions.push(txView);
    });

    // Re-order groups by date only when sorting by date; otherwise preserve insertion order (= sort order)
    if (isDateSort) {
      return groups.sort((a, b) => {
        if (a.dateHeader === 'Overdue Recurring') return -1;
        if (b.dateHeader === 'Overdue Recurring') return 1;
        return sort === 'date-asc'
          ? a.date.localeCompare(b.date)
          : b.date.localeCompare(a.date);
      });
    }

    return groups;
  });

  // Cached view properties (Computed)
  totalIncome = computed(() =>
    this.filteredTransactions()
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0)
  );

  totalExpenses = computed(() =>
    this.filteredTransactions()
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)
  );

  netAmount = computed(() => this.totalIncome() - this.totalExpenses());
  filteredCount = computed(() => this.filteredTransactions().length);
  totalCount = computed(() => this.allTransactions().length);
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

  isGuest = computed(() => this.userService.isGuestUser());

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

  constructor(
    private readonly auth: Auth,
    private readonly route: Router,
    private readonly dialog: MatDialog,
    public readonly dateService: DateService,
    private readonly store: Store<AppState>,
    private readonly filterService: FilterService,
    private readonly categoryService: CategoryService,
    private readonly currencyService: CurrencyService,
    private readonly themeService: ThemeSwitchingService,
    private readonly appViewService: AppViewService,
    public readonly userService: UserService,
    private readonly transactionsService: TransactionsService,
    private readonly cdr: ChangeDetectorRef
  ) {
    // Watch for Input changes and hook into filterService
    // Effect removed because the parent TransactionListComponent already calls filterService.setIsRecurring() directly.
  }

  ngOnInit() {
    this.setupFilterServiceSubscriptions();
    this.setupTransactionSubscriptions();
    this.loadUserCategories();
    this.loadUserAccounts();
    if (this.route.url.includes('transactions')) {
      this.showFilters = true;
    }

    // Set initial date range based on App View preference
    this.subscription.add(
      this.appViewService.appView$.subscribe(view => {
        let range = 'this-month';
        if (view === 'WEEKLY') {
          range = 'this-week';
        } else if (view === 'YEARLY') {
          range = 'this-year';
        }
        this.onDateRangeChange(range);
      })
    );

    // Subscribe to theme changes
    this.subscription.add(
      this.themeService.currentTheme.subscribe(() => {
        // if (this.showChart) { // showChart is not defined
        //   this.renderChart();
        // }
      })
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
    // this.disposeChart(); // disposeChart is not defined
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupTransactionSubscriptions() {
    // Subscribe to transactions from store
    this.subscription.add(
      this.store.select(selectAllTransactions).subscribe(transactions => {
        const sorted = transactions.sort((a: any, b: any) => {
          const dateA = this.dateService.toDate(a.date);
          const dateB = this.dateService.toDate(b.date);
          return (dateB?.getTime() ?? 0) - (dateA?.getTime() ?? 0);
        });

        this.allTransactions.set(sorted);
        // Refresh upcoming transactions if we are in upcoming range
        if (this.selectedRange() === 'upcoming') {
          this.onDateRangeChange('upcoming');
        }
        this.updateAvailableCategories();
        this.filterTransactions();
      })
    );
  }

  private setupFilterServiceSubscriptions() {
    // Subscribe to FilterService state changes and update signals
    this.subscription.add(
      this.filterService.searchTerm$.subscribe(term => {
        this.searchTerm.set(term);
        this.filterTransactions();
      })
    );

    this.subscription.add(
      this.filterService.selectedCategory$.subscribe(cats => {
        this.selectedCategory.set(cats);
        this.filterTransactions();
      })
    );

    this.subscription.add(
      this.filterService.selectedType$.subscribe(type => {
        this.selectedType.set(type);
        this.filterTransactions();
      })
    );

    this.subscription.add(
      this.filterService.selectedDate$.subscribe(date => {
        this.selectedDate.set(date);
        this.filterTransactions();
      })
    );

    this.subscription.add(
      this.filterService.selectedDateRange$.subscribe(range => {
        this.selectedDateRange.set(range);
        this.filterTransactions();
      })
    );

    this.subscription.add(
      this.filterService.isRecurring$.subscribe(isRec => {
        this.isRecurringFilter.set(isRec);
        this.filterTransactions();
      })
    );
  }

  // NOTE: We could use effects() instead of manual subscription + filterTransactions call,
  // but to keep logic similar and controllable, we just ensure signals are updated.
  // The 'filterTransactions' method updates 'filteredTransactions' signal which drives everything else.

  // Removed updateGroupedTransactions() - now a computed signal

  filterTransactions() {
    // Determine source data based on selected range
    let sourceData = this.allTransactions();
    if (this.selectedRange() === 'upcoming') {
      sourceData = this.upcomingTransactions();
    }

    // Use FilterService to filter transactions
    const filteredData = this.filterService.filterTransactions(
      sourceData,
      {
        searchTerm: this.searchTerm(),
        selectedCategory: this.selectedCategory(),
        selectedType: this.selectedType(),
        selectedDate: this.selectedDate(),
        selectedDateRange: this.selectedDateRange(),
        selectedYear: null,
        categoryFilter: null,
        accountFilter: [],
        amountRange: { min: null, max: null },
        statusFilter: [],
        tags: [],
        isRecurring: this.isRecurringFilter(),
      }
    );

    // Merge in due recurring transactions if not in 'upcoming' view specifically
    // but only if we are in 'Today', 'This Week' or 'This Month' or 'All'
    let mergedData = filteredData;
    if (this.selectedRange() !== 'upcoming') {
      const endOfCheck = dayjs().add(3, 'day').endOf('day').toDate();
      const recurring = this.allTransactions().filter(t => t.isRecurring);
      const dueSoon = this.generateUpcomingTransactions(recurring, dayjs().subtract(1, 'year').toDate(), endOfCheck);

      // Filter out pure pending templates exclusively if their virtual duplicate is already in dueSoon
      const actualData = filteredData.filter(t => {
        if (t.isPending && t.isRecurring && !t.id?.startsWith('upcoming-')) {
          const hasDuplicate = dueSoon.some(v => v.id?.startsWith(`upcoming-${t.id}-`) && dayjs(this.dateService.toDate(v.date)).isSame(this.dateService.toDate(t.date), 'day'));
          return !hasDuplicate;
        }
        return true;
      });

      // Merge: avoid duplicates (upcoming-ids should be unique)
      const existingIds = new Set(actualData.map(t => t.id));
      const filteredDueSoon = dueSoon.filter(t => !existingIds.has(t.id));

      mergedData = [...filteredDueSoon, ...actualData];
    } else {
      // In upcoming view, remove raw pending templates (replaced by virtual upcoming-* items)
      mergedData = filteredData.filter(t => !(t.isPending && t.isRecurring && !t.id?.startsWith('upcoming-')));
    }

    // Sort after merging so the selected sort applies to ALL transactions (including virtual upcoming ones)
    const finalData = this.filterService.sortTransactions(mergedData, this.selectedSort());

    this.filteredTransactions.set(finalData);
    this.cdr.markForCheck();

    if (this.showChart) {
      setTimeout(() => this.renderChart(), 50);
    }
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
    this.filterTransactions();
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

      this.upcomingTransactions.set(this.generateUpcomingTransactions(recurring, startDate, endDate));
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

  private generateUpcomingTransactions(recurringTransactions: Transaction[], startDate: Date, endDate: Date): Transaction[] {
    const upcoming: Transaction[] = [];

    recurringTransactions.forEach(rt => {
      if (!rt.nextOccurrence || !rt.isRecurring) return;

      let nextDate = this.dateService.toDate(rt.nextOccurrence);
      if (!nextDate) return;

      const baseTransaction = { ...rt };
      const allTxs = this.allTransactions();

      while (nextDate <= endDate) {
        if (nextDate >= startDate) {
          // Check if a real transaction already exists for this period to avoid duplicates
          const exists = allTxs.some(t => {
            if (t.id?.startsWith('upcoming-')) return false;

            // Template transaction itself pending execution shouldn't count as existing fulfilled transaction
            if (t.id === rt.id && t.isPending) return false;

            if (t.categoryId !== baseTransaction.categoryId) return false;
            if (t.amount !== baseTransaction.amount) return false;
            if (t.accountId !== baseTransaction.accountId) return false;
            if (t.type !== baseTransaction.type) return false;
            
            const txDate = this.dateService.toDate(t.date);
            if (!(txDate instanceof Date)) return false;
            // Use non-null assertion or local constant as nextDate is narrowed above
            return this.isSamePeriod(txDate, nextDate!, rt.recurringInterval!);
          });

          if (!exists) {
            const occurrence: Transaction = {
              ...baseTransaction,
              id: `upcoming-${baseTransaction.id}-${nextDate.getTime()}`,
              date: new Date(nextDate),
              status: SyncStatus.PENDING as any,
              syncStatus: SyncStatus.PENDING,
              isPending: true
            };
            upcoming.push(occurrence);
            // Only show one upcoming occurrence per recurring transaction
            break;
          }
        }
        nextDate = this.calculateNextDate(nextDate, rt.recurringInterval!);
      }
    });

    return upcoming;
  }

  private calculateNextDate(currentDate: Date, interval: RecurringInterval): Date {
    const nextDate = new Date(currentDate);
    switch (interval) {
      case RecurringInterval.DAILY:
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case RecurringInterval.WEEKLY:
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case RecurringInterval.MONTHLY:
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case RecurringInterval.YEARLY:
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
    }
    return nextDate;
  }

  private isSamePeriod(date1: Date, date2: Date, interval: RecurringInterval): boolean {
    const d1 = dayjs(date1).startOf('day');
    const d2 = dayjs(date2).startOf('day');

    switch (interval) {
      case RecurringInterval.DAILY:
        return d1.isSame(d2, 'day');
      case RecurringInterval.WEEKLY:
        return d1.isSame(d2, 'week');
      case RecurringInterval.MONTHLY:
        return d1.isSame(d2, 'month');
      case RecurringInterval.YEARLY:
        return d1.isSame(d2, 'year');
      default:
        return false;
    }
  }

  private getDueStatus(date: Date): string {
    const today = dayjs().startOf('day');
    const targetDate = dayjs(date).startOf('day');
    const diffDays = targetDate.diff(today, 'day');

    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Due today';
    if (diffDays === 1) return 'Due tomorrow';
    if (diffDays <= 7) return `Due in ${diffDays} days`;
    return '';
  }

  onConfirmRecurring(tx: Transaction) {
    const userId = this.userService.getCurrentUserId();
    if (!userId || userId === 'offline-guest') return;

    // The 'tx' is a virtual transaction (upcoming-X-timestamp)
    // Robust parsing for originalId which might contain dashes
    const parts = tx.id?.split('-');
    if (!parts || parts.length < 3) return;
    const originalId = parts.slice(1, -1).join('-');
    const originalTx = this.allTransactions().find(t => t.id === originalId);

    if (originalTx) {
      const confirmedDate = this.dateService.toDate(tx.date);
      if (!confirmedDate) return;

      this.subscription.add(
        this.transactionsService.processRecurringTransaction(userId, originalTx, confirmedDate).subscribe(() => {
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
    const originalTx = this.allTransactions().find(t => t.id === originalId);

    if (originalTx) {
       const skippedDate = this.dateService.toDate(tx.date);
       if (!skippedDate) return;

       this.subscription.add(
        this.transactionsService.skipRecurringTransaction(userId, originalTx, skippedDate).subscribe(() => {
          // Success handled by store update
        })
      );
    }
  }

  isCurrentMonth(): boolean {
    const currentMonth = dayjs().month();
    const currentYear = dayjs().year();
    return this.filteredTransactions().some(tx => {
      const txDate = dayjs(this.dateService.toDate(tx.date));
      return txDate.month() === currentMonth && txDate.year() === currentYear;
    });
  }

  isCurrentWeek(): boolean {
    const currentWeek = dayjs().week();
    const currentYear = dayjs().year();
    return this.filteredTransactions().some(tx => {
      const txDate = dayjs(this.dateService.toDate(tx.date));
      return txDate.week() === currentWeek && txDate.year() === currentYear;
    });
  }

  isLastMonth(): boolean {
    const lastMonth = dayjs().subtract(1, 'month').month();
    const lastMonthYear = dayjs().subtract(1, 'month').year();
    return this.filteredTransactions().some(tx => {
      const txDate = dayjs(this.dateService.toDate(tx.date));
      return txDate.month() === lastMonth && txDate.year() === lastMonthYear;
    });
  }

  isCurrentYear(): boolean {
    const currentYear = dayjs().year();
    return this.filteredTransactions().some(tx => {
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

  onLongPress(transaction: Transaction) {
    if (transaction.id?.startsWith('upcoming-')) return;

    if (this.selectedTx?.id == transaction.id) {
      this.selectedTx = null;
    } else {
      this.selectedTx = transaction;
    }
  }

  onEditTransaction(transaction: Transaction) {
    this.editTransaction.emit(transaction);
  }

  onDeleteTransaction(transaction: Transaction) {
    this.dialog
      .open(ConfirmDialogComponent, {
        width: '300px',
        data: {
          title: 'Delete Transaction',
          message: 'Are you sure you want to delete this transaction?',
          confirmText: 'Delete',
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

  onAddTransaction() {
    this.addTransaction.emit();
  }

  onImportTransactions() {
    this.importTransactions.emit();
  }

  getCategoriesList(): (Category & { id: string })[] {
    return this.availableCategories;
  }

  private updateAvailableCategories() {
    const cats = this.categories();
    const txs = this.allTransactions();

    if (!cats || !txs) return;

    const usedCategoryIds = new Set<string>();

    txs.forEach(tx => {
      if (tx.categoryId) {
        usedCategoryIds.add(tx.categoryId);
      }

      if (tx.isCategorySplit && tx.categorySplits) {
        tx.categorySplits.forEach(split => {
          if (split.categoryId) {
            usedCategoryIds.add(split.categoryId);
          }
        });
      }
    });

    this.availableCategories = cats
      .filter(category => usedCategoryIds.has(category.id || ''))
      .map(category => ({
        ...category,
        id: category.id || ''
      }));
  }

  getCurrentYear(): number {
    return dayjs().year();
  }

  isCategorySelected(categoryId: string): boolean {
    const selected = this.selectedCategory();
    return selected.includes(categoryId);
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
    const category = this.categoryMap.get(categoryId);
    return category?.icon || 'category';
  }

  getCategoryColor(categoryId: string): string {
    const category = this.categoryMap.get(categoryId);
    return category?.color || '#46777f';
  }

  private async loadUserCategories(): Promise<void> {
    this.subscription.add(
      this.store.select(selectAllCategories).subscribe((categories: Category[]) => {
        this.categories.set(categories);
        this.categoryMap.clear();
        categories.forEach(cat => {
          if (cat.id) this.categoryMap.set(cat.id, cat);
        });
        this.updateAvailableCategories();
        this.filterTransactions();
        this.cdr.markForCheck();
      })
    );
  }

  private async loadUserAccounts(): Promise<void> {
    this.subscription.add(
      this.store.select(selectAllAccounts).subscribe((accounts: Account[]) => {
        this.accounts.set(accounts);
        this.accountMap.clear();
        accounts.forEach(acc => {
          this.accountMap.set(acc.accountId, acc);
        });
        this.filterTransactions();
        this.cdr.markForCheck();
      })
    );
  }

  getAccountName(accountId: string): string {
    const account = this.accountMap.get(accountId);
    return account?.name || 'Unknown Account';
  }

  getAccountType(accountId: string): string {
    const account = this.accountMap.get(accountId);
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
}
