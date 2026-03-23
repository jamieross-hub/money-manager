import { Injectable, signal, computed, inject } from '@angular/core';
import { Transaction } from '../models/transaction.model';
import { TransactionsService } from './db/transactions.service';
import { RecurringTemplate } from '../models/recurring.model';
import { Category, Account } from '../models';
import { UserService } from './db/user.service';
import { CurrencyService } from './currency.service';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import weekOfYear from 'dayjs/plugin/weekOfYear';

dayjs.extend(isBetween);
dayjs.extend(weekOfYear);

export interface ProcessorOutput {
  filteredTransactions: any[];
  flattenedTransactions: any[];
  groupedTransactions: any[];
  totalIncome: number;
  totalExpenses: number;
  totalSettlement: number;
  filteredCount: number;
  userIncome?: number;
  userExpenses?: number;
  userPaid?: number;
}

@Injectable({
  providedIn: 'root'
})
export class TransactionProcessorService {
  private readonly userService = inject(UserService);
  private readonly currencyService = inject(CurrencyService);
  private readonly transactionsService = inject(TransactionsService);
  
  private worker: Worker | null = null;

  constructor() {
    if (typeof Worker !== 'undefined') {
      this.worker = new Worker(new URL('../../worker/transaction-processor.worker', import.meta.url));
      this.worker.onmessage = ({ data }) => {
        if (data.groupedTransactions) {
          data.groupedTransactions.forEach((group: any) => {
            if (group.totalIncome > 0) {
              group.incomeFormatted = this.currencyService.formatAmount(group.totalIncome, { round: true });
            }
            if (group.totalExpenses > 0) {
              group.expenseFormatted = this.currencyService.formatAmount(group.totalExpenses, { round: true });
            }
            if (group.totalShare > 0 && group.date.startsWith('direct_')) {
              group.dateHeader += ` (Share: ${this.currencyService.formatAmount(group.totalShare, { round: true })})`;
            }
            if (group.totalShare > 0 && group.date.startsWith('involved_')) {
              group.dateHeader += ` (Share: ${this.currencyService.formatAmount(group.totalShare, { round: true })})`;
            }
          });
        }

        if (data.flattenedTransactions) {
          data.flattenedTransactions.forEach((item: any) => {
            if (item._isHeader) {
              const group = data.groupedTransactions.find((g: any) => g.date === item.id.replace('header-', ''));
              if (group) {
                item.incomeFormatted = group.incomeFormatted;
                item.expenseFormatted = group.expenseFormatted;
                item.dateHeader = group.dateHeader;
              }
            }
          });
        }

        this._output.set(data);
        this._isProcessing.set(false);
        
        if (data.cleanupIds && data.cleanupIds.length > 0) {
          const userId = this.userService.getCurrentUserId();
          if (userId) {
            this.transactionsService.cleanupOldDeletedTransactions(userId, data.cleanupIds, data.familyId);
          }
        }
      };
    }
  }

  // Output Signals
  private _output = signal<ProcessorOutput>({
    filteredTransactions: [],
    flattenedTransactions: [],
    groupedTransactions: [],
    totalIncome: 0,
    totalExpenses: 0,
    totalSettlement: 0,
    filteredCount: 0,
    userIncome: 0,
    userExpenses: 0,
    userPaid: 0
  });

  private readonly _isProcessing = signal<boolean>(false);

  public filteredTransactions = computed(() => this._output().filteredTransactions);
  public flattenedTransactions = computed(() => this._output().flattenedTransactions);
  public groupedTransactions = computed(() => this._output().groupedTransactions);
  public totalIncome = computed(() => this._output().totalIncome);
  public totalExpenses = computed(() => this._output().totalExpenses);
  public totalSettlement = computed(() => this._output().totalSettlement);
  public filteredCount = computed(() => this._output().filteredCount);
  public userIncome = computed(() => this._output().userIncome || 0);
  public userExpenses = computed(() => this._output().userExpenses || 0);
  public userPaid = computed(() => this._output().userPaid || 0);
  public isProcessing = computed(() => this._isProcessing());

  private debounceTimer: any;

  /**
   * WeakMap cache: Transaction object reference → enriched view-model.
   * Unchanged tx refs (from our incremental onSnapshot fix) get zero-cost cache hits,
   * eliminating ~390 redundant dayjs.format() calls per incremental update.
   */
  private txViewCache = new WeakMap<object, any>();

  /** Memoised category/account maps — rebuilt only when array reference changes. */
  private _lastCategories: Category[] = [];
  private _lastAccounts: Account[] = [];
  private _categoryMap = new Map<string, any>();
  private _accountMap = new Map<string, any>();

  process(data: {
    transactions: Transaction[];
    recurringTemplates: RecurringTemplate[];
    categories: Category[];
    accounts: Account[];
    filters: any;
    sort: string;
    range: string | null;
    sessionStartTime: number;
    appView: string;
    isRecurringMode: boolean;
    isFamilyMode: boolean;
    isDeletedMode?: boolean;
    currentUserId?: string;
    familyId?: string;
  }) {
    if (this.debounceTimer) {
      cancelAnimationFrame(this.debounceTimer);
      clearTimeout(this.debounceTimer);
    }

    this._isProcessing.set(true);

    const run = () => {
      if (this.worker) {
        this.worker.postMessage({
          ...data,
          currentUserId: this.userService.getCurrentUserId()
        });
      } else {
        const result = this.executeLogic(data);
        this._output.set(result);
        this._isProcessing.set(false);
      }
      this.debounceTimer = null;
    };

    if (typeof requestIdleCallback !== 'undefined') {
      this.debounceTimer = requestIdleCallback(run, { timeout: 150 });
    } else {
      this.debounceTimer = setTimeout(run, 150);
    }
  }

  private executeLogic(data: any): ProcessorOutput {
    const { 
      transactions, 
      recurringTemplates,
      categories, 
      accounts, 
      filters, 
      sort, 
      range,
      sessionStartTime,
      appView,
      isRecurringMode,
      isDeletedMode,
      isFamilyMode,
      currentUserId
    } = data;
    const memberId = filters.selectedMember;

    if (!transactions) {
      return { filteredTransactions: [], flattenedTransactions: [], groupedTransactions: [], totalIncome: 0, totalExpenses: 0, totalSettlement: 0, filteredCount: 0 };
    }

    // 1. Helper: Map creation — memoised by array reference so we only iterate
    const getMemberAmount = (tx: any, mId: string, type: 'paid' | 'share'): number => {
      const amount = Number(tx.amount) || 0;
      const sd = tx.splitData;
      if (!sd) {
        return (tx.userId === mId || tx.createdBy === mId) ? amount : 0;
      }
      if (type === 'paid') {
        if (sd.paidByUserId === 'multiple' && sd.paidBy?.length) {
          return Number(sd.paidBy.find((p: any) => p.userId === mId)?.amount) || 0;
        }
        const payerId = sd.paidByUserId || tx.userId;
        return (payerId === mId) ? amount : 0;
      } else {
        if (sd.splitBetween && sd.splitBetween.length > 0) {
          return Number(sd.splitBetween.find((s: any) => s.userId === mId)?.amount) || 0;
        }
        return (tx.userId === mId) ? amount : 0;
      }
    };

    // categories/accounts when they actually change (rare vs. transaction updates).
    if (categories !== this._lastCategories) {
      this._categoryMap = new Map();
      categories.forEach((cat: any) => {
        if (cat.id) this._categoryMap.set(cat.id, cat);
      });
      this._lastCategories = categories;
      // Invalidate tx view cache when category data changes (colors/icons may differ)
      this.txViewCache = new WeakMap();
    }
    if (accounts !== this._lastAccounts) {
      this._accountMap = new Map();
      accounts.forEach((acc: any) => {
        this._accountMap.set(acc.accountId, acc);
      });
      this._lastAccounts = accounts;
      // Invalidate tx view cache when account data changes
      this.txViewCache = new WeakMap();
    }
    const categoryMap = this._categoryMap;
    const accountMap = this._accountMap;

    // 2. Helper: Date conversion
    const toDate = (val: any): Date | null => {
      if (!val) return null;
      if (val instanceof Date) return val;
      if (val && typeof val === 'object' && val.seconds) return new Date(val.seconds * 1000);
      if (typeof val === 'number') return new Date(val);
      if (typeof val === 'string') {
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
      }
      if (val && typeof val.toDate === 'function') return val.toDate();
      return null;
    };

    const calculateNextDate = (currentDate: Date, interval: string): Date => {
      const nextDate = new Date(currentDate);
      switch (interval?.toLowerCase()) {
        case 'daily':
          nextDate.setDate(nextDate.getDate() + 1);
          break;
        case 'weekly':
          nextDate.setDate(nextDate.getDate() + 7);
          break;
        case 'monthly':
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
        case 'yearly':
          nextDate.setFullYear(nextDate.getFullYear() + 1);
          break;
      }
      return nextDate;
    };

    const isSamePeriod = (date1: Date, date2: Date, interval: string): boolean => {
      const d1 = dayjs(date1).startOf('day');
      const d2 = dayjs(date2).startOf('day');
      switch (interval?.toLowerCase()) {
        case 'daily': return d1.isSame(d2, 'day');
        case 'weekly': return d1.isSame(d2, 'week');
        case 'monthly': return d1.isSame(d2, 'month');
        case 'yearly': return d1.isSame(d2, 'year');
        default: return false;
      }
    };

    /**
     * Build the existMap once — shared between both generateUpcomingTransactions
     * calls below (upcoming range AND due-soon merge). Previously it was rebuilt
     * inside the function on every call, scanning all transactions twice.
     */
    const buildExistMap = (allTxs: any[]): Map<string, Date[]> => {
      const map = new Map<string, Date[]>();
      allTxs.forEach(t => {
        if (t.id?.startsWith('upcoming-') || (t.id === t.templateId && t.isPending)) return;
        const key = `${t.categoryId}|${t.amount}|${t.accountId}|${t.type}`;
        const tDate = toDate(t.date);
        if (!tDate) return;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(tDate);
      });
      return map;
    };

    // Pre-built once, reused in both upcoming and merge call sites
    const sharedExistMap = buildExistMap(transactions);

    const generateUpcomingTransactions = (recurringTransactions: any[], startDate: Date, endDate: Date, existMap: Map<string, Date[]>): any[] => {
      const upcoming: any[] = [];

      recurringTransactions.forEach(rt => {
        if (!rt.nextOccurrence || !rt.isRecurring) return;
        let nextDate = toDate(rt.nextOccurrence);
        if (!nextDate) return;

        const baseTransaction = { ...rt };
        const key = `${rt.categoryId}|${rt.amount}|${rt.accountId}|${rt.type}`;
        const relevantDates = existMap.get(key) || [];

        let safetyCounter = 0;
        const MAX_ITERATIONS = 50;

        while (nextDate <= endDate && safetyCounter < MAX_ITERATIONS) {
          safetyCounter++;

          const exists = relevantDates.some(txDate => isSamePeriod(txDate, nextDate as Date, rt.recurringInterval));

          if (exists) {
            nextDate = calculateNextDate(nextDate, rt.recurringInterval);
            continue;
          }

          upcoming.push({
            ...baseTransaction,
            id: `upcoming-${baseTransaction.id}-${nextDate.getTime()}`,
            date: new Date(nextDate),
            status: 'PENDING',
            syncStatus: 'PENDING',
            isPending: true
          });

          break;
        }
      });
      return upcoming;
    };

    // 3. Logic: Determine Source Data
    let sourceData = transactions;
    if (range === 'upcoming') {
      const templates = recurringTemplates || [];
      const today = dayjs().startOf('day').toDate();
      let startDate = today;
      let endDate;
      if (appView === 'WEEKLY') endDate = dayjs().add(1, 'week').endOf('day').toDate();
      else if (appView === 'YEARLY') endDate = dayjs().add(1, 'year').endOf('day').toDate();
      else endDate = dayjs().add(1, 'month').endOf('day').toDate();
      sourceData = generateUpcomingTransactions(
        templates.map((t: any) => ({ ...t, isRecurring: true })),
        startDate,
        endDate,
        sharedExistMap  // reuse pre-built map
      );
    } else {
      if (isRecurringMode) {
        sourceData = (recurringTemplates || []).map((t: any) => ({
          ...t,
          date: t.nextOccurrence || t.createdAt || new Date()
        }));
      } else {
        sourceData = transactions;
      }
    }

    // 4. Filtering Logic
    let filtered = [...sourceData];
    
    // Search
    if (filters.searchTerm && filters.searchTerm.trim()) {
      const searchLower = filters.searchTerm.toLowerCase().trim();
      filtered = filtered.filter((t: any) =>
        t.payee?.toLowerCase().includes(searchLower) ||
        t.category?.toLowerCase().includes(searchLower) ||
        t.notes?.toLowerCase().includes(searchLower) ||
        t.amount?.toString().includes(searchLower)
      );
    }

    // Category
    if (filters.selectedCategory && !filters.selectedCategory.includes('all')) {
      filtered = filtered.filter((t: any) => filters.selectedCategory.includes(t.categoryId));
    }

    // Type
    if (filters.selectedType && filters.selectedType !== 'all') {
      filtered = filtered.filter((t: any) => t.type === filters.selectedType);
    }

    // Date Range
    if (range !== 'upcoming' && !isRecurringMode) {
      if (filters.selectedDateRange) {
        const start = dayjs(filters.selectedDateRange.startDate).startOf('day');
        const end = dayjs(filters.selectedDateRange.endDate).endOf('day');
        filtered = filtered.filter((t: any) => {
          const d = toDate(t.date);
          return d && dayjs(d).isBetween(start, end, 'day', '[]');
        });
      } else if (filters.selectedDate) {
        const target = dayjs(filters.selectedDate).startOf('day');
        filtered = filtered.filter((t: any) => {
          const d = toDate(t.date);
          return d && dayjs(d).isSame(target, 'day');
        });
      }
    }

    // Recurring filter
    if (filters.isRecurring !== null && filters.isRecurring !== undefined) {
      filtered = filtered.filter((t: any) => !!t.isRecurring === filters.isRecurring);
    }

    // Account filter
    if (filters.accountFilter && filters.accountFilter.length > 0) {
      filtered = filtered.filter((t: any) => filters.accountFilter.includes(t.accountId));
    }

    // Account Type filter
    if (filters.accountTypeFilter && filters.accountTypeFilter.length > 0) {
      filtered = filtered.filter((t: any) => {
        const account = accountMap.get(t.accountId);
        return account && filters.accountTypeFilter.includes(account.type);
      });
    }

    // Settlement range filter
    if (range === 'settlement') {
      filtered = filtered.filter((t: any) => !!t.settlementId);
    } else if (range === 'no-settlement' || range === 'category') {
      filtered = filtered.filter((t: any) => !t.settlementId);
    }

    // Member filter (family split mode)
    if (filters.selectedMember) {
      const memberId = filters.selectedMember;
      filtered = filtered.filter((t: any) => {
        // 1. Part of a settlement (Sender or Receiver)
        if (t.settlementFromUserId === memberId || t.settlementToUserId === memberId) return true;

        // 2. Split Transaction: ONLY include if they paid or are in the split
        if (t.splitData) {
          const sd = t.splitData;
          const isPayer = sd.paidByUserId === memberId || (sd.paidBy && sd.paidBy.some((p: any) => p.userId === memberId));
          const isInSplit = sd.splitBetween && sd.splitBetween.some((s: any) => s.userId === memberId);
          return isPayer || isInSplit;
        }

        // 3. Normal Transaction: check owner/creator
        return t.userId === memberId || t.createdBy === memberId;
      });
    }

    // Merging Logic
    let mergedData = filtered;
    if (range !== 'upcoming' && range !== 'settlement' && range !== null && !isRecurringMode && !isDeletedMode && !isFamilyMode) {
      const endOfCheck = dayjs().add(3, 'day').endOf('day').toDate();
      const templates = (recurringTemplates || []).map((t: any) => ({ ...t, isRecurring: true }));
      const dueSoon = generateUpcomingTransactions(
        templates,
        dayjs().subtract(1, 'year').toDate(),
        endOfCheck,
        sharedExistMap  // reuse pre-built map — no second full scan
      );

      const actualData = filtered.filter((t: any) => {
        if (t.isPending && t.isRecurring && !t.id?.startsWith('upcoming-')) {
          const hasDuplicate = dueSoon.some(v => v.id?.startsWith(`upcoming-${t.id}-`) && dayjs(toDate(v.date)).isSame(toDate(t.date), 'day'));
          return !hasDuplicate;
        }
        return true;
      });

      const existingIds = new Set(actualData.map((t: any) => t.id));
      const filteredDueSoon = dueSoon.filter((t: any) => !existingIds.has(t.id));
      mergedData = [...filteredDueSoon, ...actualData];
    } else if (range === 'upcoming') {
      mergedData = filtered.filter((t: any) => !(t.isPending && t.isRecurring && !t.id?.startsWith('upcoming-')));
    }

    const filteredCount = mergedData.length;

    // 5. Sorting logic
    const sortTransactions = (list: any[], sortBy: string) => {
      const sorted = [...list];
      switch (sortBy) {
        case 'date-desc':
          return sorted.sort((a, b) => (toDate(b.date)?.getTime() || 0) - (toDate(a.date)?.getTime() || 0));
        case 'date-asc':
          return sorted.sort((a, b) => (toDate(a.date)?.getTime() || 0) - (toDate(b.date)?.getTime() || 0));
        case 'amount-desc':
          return sorted.sort((a, b) => b.amount - a.amount);
        case 'amount-asc':
          return sorted.sort((a, b) => a.amount - b.amount);
        case 'category-asc':
          return sorted.sort((a, b) => {
            const nameA = categoryMap.get(a.categoryId)?.name || a.categoryId || '';
            const nameB = categoryMap.get(b.categoryId)?.name || b.categoryId || '';
            return nameA.localeCompare(nameB);
          });
        default:
          return sorted;
      }
    };

    const finalSortedTransactions = sortTransactions(mergedData, sort);

    // 6. Totals (settlement transactions are excluded from both income and expense totals)
    const totalIncome = mergedData
      .filter((t: any) => t.type === 'income' && !t.id?.startsWith('upcoming-') && !t.settlementId)
      .reduce((sum: number, t: any) => sum + (memberId ? getMemberAmount(t, memberId, 'share') : t.amount), 0);
    const totalExpenses = mergedData
      .filter((t: any) => t.type === 'expense' && !t.id?.startsWith('upcoming-') && !t.settlementId)
      .reduce((sum: number, t: any) => sum + (memberId ? getMemberAmount(t, memberId, 'share') : t.amount), 0);
    const totalSettlement = mergedData
      .filter((t: any) => !!t.settlementId && !t.id?.startsWith('upcoming-'))
      .reduce((sum: number, t: any) => sum + t.amount, 0);

    const userIncome = currentUserId ? mergedData
      .filter((t: any) => t.type === 'income' && !t.id?.startsWith('upcoming-') && !t.settlementId)
      .reduce((sum: number, t: any) => sum + getMemberAmount(t, currentUserId, 'share'), 0) : 0;
    
    const userExpenses = currentUserId ? mergedData
      .filter((t: any) => t.type === 'expense' && !t.id?.startsWith('upcoming-') && !t.settlementId)
      .reduce((sum: number, t: any) => sum + getMemberAmount(t, currentUserId, 'share'), 0) : 0;

    const userPaidIncome = currentUserId ? mergedData
      .filter((t: any) => t.type === 'income' && !t.id?.startsWith('upcoming-') && !t.settlementId)
      .reduce((sum: number, t: any) => sum + getMemberAmount(t, currentUserId, 'paid'), 0) : 0;

    const userPaidExpense = currentUserId ? mergedData
      .filter((t: any) => t.type === 'expense' && !t.id?.startsWith('upcoming-') && !t.settlementId)
      .reduce((sum: number, t: any) => sum + getMemberAmount(t, currentUserId, 'paid'), 0) : 0;

    const userPaid = userPaidExpense - userPaidIncome;

    // 7. Grouping and View Models
    interface Group {
      date: string;
      dateHeader: string;
      transactions: any[];
      isUpcomingGroup?: boolean;
      totalIncome: number;
      totalExpenses: number;
      totalShare: number;
      totalCost: number;
      incomeFormatted?: string;
      expenseFormatted?: string;
    }

    const groupsMap = new Map<string, Group>();
    const dateHeaderCache = new Map<string, string>();
    const today = dayjs().startOf('day');
    const yesterday = dayjs().subtract(1, 'day').startOf('day');
    const isDateSort = sort === 'date-desc' || sort === 'date-asc';

    finalSortedTransactions.forEach((tx: any) => {
      const txDate = toDate(tx.date);
      const dateObj = dayjs(txDate);
      
      const category = categoryMap.get(tx.categoryId || '');
      const account = accountMap.get(tx.accountId || '');

      const createdAt = tx.createdAt; 
      const createdAtDate = createdAt ? toDate(createdAt) : null;

      // ── WeakMap cache for view-model enrichment ────────────────────────────
      // If the transaction object reference hasn't changed (unchanged tx after
      // our incremental onSnapshot fix), return the cached view immediately
      // — skipping all dayjs.format() and string allocations.
      const cached = this.txViewCache.get(tx);
      if (cached) {
        // Still need to recompute group key (depends on today/range context) but
        // the expensive object creation is skipped.
        const txView = cached;
        let dateKey: string;
        const memberId = filters.selectedMember;
        let involvementPrefix = '';
        if (memberId) {
          const isDirect = tx.splitData 
            ? (tx.splitData.paidByUserId === memberId || (tx.splitData.paidBy && tx.splitData.paidBy.some((p: any) => p.userId === memberId)))
            : (tx.settlementFromUserId === memberId || tx.settlementToUserId === memberId || tx.userId === memberId || tx.createdBy === memberId);
          involvementPrefix = isDirect ? 'direct_' : 'involved_';
        }

        if (txView._isUpcoming && txView._isOverdue) {
          dateKey = involvementPrefix + 'overdue';
        } else if (txView._isUpcoming && range !== 'upcoming') {
          dateKey = involvementPrefix + 'upcoming';
        } else if (range === 'category') {
          // Group by Category ID
          dateKey = involvementPrefix + (tx.categoryId || 'unknown');
        } else if (memberId) {
          // Flatten into one group per involvement type
          dateKey = involvementPrefix + 'flat';
        } else if ((range === 'this-year' || range === null) && !dayjs(toDate(tx.date)).isAfter(today, 'day') && !dayjs(toDate(tx.date)).isSame(today, 'day') && !dayjs(toDate(tx.date)).isSame(yesterday, 'day')) {
          dateKey = involvementPrefix + dayjs(toDate(tx.date)).format('YYYY-MM');
        } else {
          dateKey = involvementPrefix + dayjs(toDate(tx.date)).format('YYYY-MM-DD');
        }

        const pureDateKey = involvementPrefix ? dateKey.replace(involvementPrefix, '') : dateKey;

        if (isRecurringMode && txView._isUpcoming) return;
        let group = groupsMap.get(dateKey);
        if (!group) {
          let header = dateHeaderCache.get(dateKey);
          if (!header) {
            // Base header logic
            let baseHeader = '';
            const dObj = dayjs(toDate(tx.date));
            
            if (pureDateKey === 'overdue') baseHeader = 'Overdue Recurring';
            else if (pureDateKey === 'upcoming') baseHeader = 'Upcoming';
            else if (memberId && pureDateKey === 'flat') {
              baseHeader = involvementPrefix === 'direct_' ? 'Direct Involvement' : 'Part of Transactions';
            }
            else if (dObj.isSame(today, 'day')) baseHeader = 'Today';
            else if (dObj.isSame(yesterday, 'day')) baseHeader = 'Yesterday';
            else if (dObj.isAfter(today, 'day')) {
              if (dObj.isSame(today.add(1, 'day'), 'day')) baseHeader = 'Tomorrow';
              else baseHeader = dObj.format('dddd, DD MMM YYYY');
            }
            else if (range === 'this-year' || range === null) baseHeader = dObj.format('MMMM YYYY');
            else if (isDateSort) baseHeader = dObj.format('dddd, DD MMM YYYY');
            else baseHeader = dObj.format('DD MMM YYYY');

            header = baseHeader;
            dateHeaderCache.set(dateKey, header);
          }
          group = { 
            date: dateKey, 
            dateHeader: header, 
            transactions: [], 
            isUpcomingGroup: txView._isUpcoming,
            totalIncome: 0,
            totalExpenses: 0,
            totalShare: 0,
            totalCost: 0
          };
          groupsMap.set(dateKey, group);
        }
        if (range === 'category') {
          // In category view, we only want ONE summary transaction per group
          let summaryTx = group.transactions[0];
          if (!summaryTx) {
            summaryTx = {
              ...txView,
              id: `summary-${pureDateKey}`,
              notes: 'Multiple transactions',
              _isSummary: true,
              _txCount: 0,
              amount: 0
            };
            group.transactions.push(summaryTx);
          }
          summaryTx.amount += tx.amount;
          summaryTx._txCount++;
          summaryTx.notes = `${summaryTx._txCount} transactions`;
        } else {
          group.transactions.push(txView);
        }
        
        if (!txView._isUpcoming && !tx.settlementId) {
          let amt = tx.amount;
          let shareAmt = 0;
          if (memberId) {
            amt = getMemberAmount(tx, memberId, involvementPrefix === 'direct_' ? 'paid' : 'share');
            shareAmt = getMemberAmount(tx, memberId, 'share');
          }
          if (txView._isIncome) group.totalIncome += amt;
          else {
            group.totalExpenses += amt;
            group.totalShare += shareAmt;
            group.totalCost += tx.amount;
          }
        }
        return;
      }
      // ── Full enrichment (only for new/changed transactions) ─────────────────
      const txView = {
        ...tx,
        _categoryColor: category?.color || '#46777f',
        _categoryIcon: category?.icon || 'category',
        _categoryName: category?.name || tx.categoryId || 'Unknown',
        _accountName: account?.name || 'Unknown Account',
        _accountType: account?.type || 'Unknown',
        _dateDisplay: dateObj.format('DD MMM HH:mm'),
        _timeDisplay: dateObj.format('hh:mm a'),
        _fullTransactionDateDisplay: dateObj.format('DD MMM YYYY, hh:mm a'),
        _syncStatusColor: tx.syncStatus === 'failed' ? 'red' : (tx.syncStatus === 'pending' ? 'orange' : 'green'),
        _syncStatusIcon: tx.syncStatus === 'failed' ? 'error' : (tx.syncStatus === 'pending' ? 'schedule' : 'check_circle'),
        _syncStatusInfo: tx.syncStatus === 'failed' ? 'Sync failed' : (tx.syncStatus === 'pending' ? 'Pending sync' : 'Synced'),
        _recurringInfo: tx.isRecurring ? `Repeats ${tx.recurringInterval?.toLowerCase()}` : '',
        _isIncome: (() => {
          const targetId = memberId || currentUserId;
          if (tx.settlementId) {
            if (targetId === tx.settlementToUserId) return true;
            if (targetId === tx.settlementFromUserId) return false;
          }
          return tx.type === 'income';
        })(),
        _categoryBgColor: (category?.color || '#46777f') + '20',
        _createdAtDisplay: tx.createdAt ? dayjs(toDate(tx.createdAt)).format('DD MMM YYYY, hh:mm a') : 'N/A',
        _updatedAtDisplay: tx.updatedAt ? dayjs(toDate(tx.updatedAt)).format('DD MMM YYYY, hh:mm a') : 
                          (tx.createdAt ? dayjs(toDate(tx.createdAt)).format('DD MMM YYYY, hh:mm a') : 'N/A'),
        _isUpcoming: !!tx.isPending && (tx.id?.startsWith('upcoming-') || false),
        _dueStatus: (() => {
          const diffDays = dateObj.diff(today, 'day');
          if (diffDays < 0) return 'Overdue';
          if (diffDays === 0) return 'Due today';
          if (diffDays === 1) return 'Due tomorrow';
          if (diffDays <= 7) return `Due in ${diffDays} days`;
          return '';
        })(),
        _isOverdue: txDate ? dateObj.isBefore(today, 'day') : false,
        _isDeleted: tx.status === 'deleted',
        _popState: (createdAtDate && createdAtDate.getTime() > sessionStartTime) ? 'new' : 'old',
        _isHeader: false  // baked in here so flatten step pushes refs not copies
      };
      // Store in cache for next run
      this.txViewCache.set(tx, txView);

      let dateKey: string;
      
      // When filtering by a member, we group by "Direct" involvement vs "Involved in"
      let involvementPrefix = '';
      if (memberId) {
        const isDirect = tx.splitData 
          ? (tx.splitData.paidByUserId === memberId || (tx.splitData.paidBy && tx.splitData.paidBy.some((p: any) => p.userId === memberId)) || (!tx.splitData.paidByUserId && tx.userId === memberId))
          : (tx.settlementFromUserId === memberId || tx.settlementToUserId === memberId || tx.userId === memberId || tx.createdBy === memberId);
        involvementPrefix = isDirect ? 'direct_' : 'involved_';
      }

      if (txView._isUpcoming && txView._isOverdue) {
        dateKey = involvementPrefix + 'overdue';
      } else if (txView._isUpcoming && range !== 'upcoming') {
        dateKey = involvementPrefix + 'upcoming';
      } else if (range === 'category') {
        // Group by Category ID
        dateKey = involvementPrefix + (tx.categoryId || 'unknown');
      } else if (memberId) {
        // Flatten into one group per involvement type
        dateKey = involvementPrefix + 'flat';
      } else if ((range === 'this-year' || range === null) && !dateObj.isAfter(today, 'day') && !dateObj.isSame(today, 'day') && !dateObj.isSame(yesterday, 'day')) {
        dateKey = involvementPrefix + dateObj.format('YYYY-MM');
      } else {
        dateKey = involvementPrefix + dateObj.format('YYYY-MM-DD');
      }

      const pureDateKey = involvementPrefix ? dateKey.replace(involvementPrefix, '') : dateKey;

      if (isRecurringMode && txView._isUpcoming) {
        return; 
      }

      let group = groupsMap.get(dateKey);
      if (!group) {
        let header = dateHeaderCache.get(dateKey);
        if (!header) {
          // Base header logic
          let baseHeader = '';
          
          if (pureDateKey === 'overdue') baseHeader = 'Overdue Recurring';
          else if (pureDateKey === 'upcoming') baseHeader = 'Upcoming';
          else if (range === 'category') {
            const cat = categoryMap.get(pureDateKey);
            baseHeader = cat ? cat.name : 'Unknown Category';
          }
          else if (memberId && pureDateKey === 'flat') {
            baseHeader = involvementPrefix === 'direct_' ? 'Direct Involvement' : 'Part of Transactions';
          }
          else if (dateObj.isSame(today, 'day')) baseHeader = 'Today';
          else if (dateObj.isSame(yesterday, 'day')) baseHeader = 'Yesterday';
          else if (dateObj.isAfter(today, 'day')) {
            if (dateObj.isSame(today.add(1, 'day'), 'day')) baseHeader = 'Tomorrow';
            else baseHeader = dateObj.format('dddd, DD MMM YYYY');
          }
          else if (range === 'this-year' || range === null) baseHeader = dateObj.format('MMMM YYYY');
          else if (isDateSort) baseHeader = dateObj.format('dddd, DD MMM YYYY');
          else baseHeader = dateObj.format('DD MMM YYYY');

          header = baseHeader;
          dateHeaderCache.set(dateKey, header);
        }
        group = { 
          date: dateKey, 
          dateHeader: header, 
          transactions: [], 
          isUpcomingGroup: txView._isUpcoming,
          totalIncome: 0,
          totalExpenses: 0,
          totalShare: 0,
          totalCost: 0
        };
        groupsMap.set(dateKey, group);
      }
      if (range === 'category') {
        // In category view, we only want ONE summary transaction per group
        let summaryTx = group.transactions[0];
        if (!summaryTx) {
          summaryTx = {
            ...txView,
            id: `summary-${pureDateKey}`,
            notes: 'Multiple transactions',
            _isSummary: true,
            _txCount: 0,
            amount: 0
          };
          group.transactions.push(summaryTx);
        }
        summaryTx.amount += tx.amount;
        summaryTx._txCount++;
        summaryTx.notes = `${summaryTx._txCount} transactions`;
      } else {
        group.transactions.push(txView);
      }

      if (!txView._isUpcoming && !tx.settlementId) {
        let amt = tx.amount;
        let shareAmt = 0;
        if (memberId) {
          amt = getMemberAmount(tx, memberId, involvementPrefix === 'direct_' ? 'paid' : 'share');
          shareAmt = getMemberAmount(tx, memberId, 'share');
        }
        if (txView._isIncome) group.totalIncome += amt;
        else {
          group.totalExpenses += amt;
          group.totalShare += shareAmt;
          group.totalCost += tx.amount;
        }
      }
    });

    const groups = Array.from(groupsMap.values());

    // Set totals and classes (except upcoming)
    groups.forEach(group => {
      if (!group.isUpcomingGroup && group.transactions.length > 0) {
        if (group.date.startsWith('involved_') && group.totalCost > 0) {
          group.totalExpenses = group.totalCost;
        }

        if (group.totalIncome > 0) {
          group.incomeFormatted = this.currencyService.formatAmount(group.totalIncome, { round: true });
        }
        if (group.totalExpenses > 0) {
          group.expenseFormatted = this.currencyService.formatAmount(group.totalExpenses, { round: true });
        }
        if (group.totalShare > 0 && group.date.startsWith('direct_')) {
          group.dateHeader += ` (Share: ${this.currencyService.formatAmount(group.totalShare, { round: true })})`;
        }
        if (group.totalShare > 0 && group.date.startsWith('involved_')) {
          group.dateHeader += ` (Share: ${this.currencyService.formatAmount(group.totalShare, { round: true })})`;
        }
      }
    });

    let finalGroups = groups;
    if (isDateSort || range === 'category') {
      finalGroups = groups.sort((a, b) => {
        if (a.dateHeader === 'Overdue Recurring' && b.dateHeader !== 'Overdue Recurring') return -1;
        if (b.dateHeader === 'Overdue Recurring' && a.dateHeader !== 'Overdue Recurring') return 1;
        if (a.dateHeader === 'Upcoming' && b.dateHeader !== 'Upcoming') return -1; 
        if (b.dateHeader === 'Upcoming' && a.dateHeader !== 'Upcoming') return 1;

        // Involvement sorting (Direct first, then Involved/Part of)
        if (a.date.startsWith('direct_') && b.date.startsWith('involved_')) return -1;
        if (a.date.startsWith('involved_') && b.date.startsWith('direct_')) return 1;

        if (range === 'category') {
          // Sort by highest absolute volume (Income + Expense)
          const volA = a.totalIncome + a.totalExpenses;
          const volB = b.totalIncome + b.totalExpenses;
          return volB - volA; // Highest volume first
        }

        return sort === 'date-asc'
          ? a.date.localeCompare(b.date)
          : b.date.localeCompare(a.date);
      });
    }

    // 8. Flatten for Virtual Scroll
    // _isHeader is pre-set on each view-model so we push by reference, not copy.
    const flattened: any[] = [];
    finalGroups.forEach((group: any) => {
      flattened.push({
        _isHeader: true,
        dateHeader: group.dateHeader,
        id: `header-${group.date}`,
        incomeFormatted: group.incomeFormatted,
        expenseFormatted: group.expenseFormatted
      });
      group.transactions.forEach((tx: any) => {
        flattened.push(tx);  // reference, no spread alloc
      });
    });

    return {
      filteredTransactions: mergedData,
      flattenedTransactions: flattened,
      groupedTransactions: finalGroups,
      totalIncome,
      totalExpenses,
      totalSettlement,
      filteredCount,
      userIncome,
      userExpenses,
      userPaid
    };
  }

  destroy() {
    if (this.debounceTimer) {
      if (typeof cancelIdleCallback !== 'undefined') {
        cancelIdleCallback(this.debounceTimer);
      } else {
        clearTimeout(this.debounceTimer);
      }
    }
  }
}
