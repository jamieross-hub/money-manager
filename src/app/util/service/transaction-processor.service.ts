import { Injectable, signal, computed, inject } from '@angular/core';
import { Transaction } from '../models/transaction.model';
import { RecurringTemplate } from '../models/recurring.model';
import { Category, Account } from '../models';
import { UserService } from './db/user.service';
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
  filteredCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class TransactionProcessorService {
  private readonly userService = inject(UserService);
  
  // Output Signals
  private _output = signal<ProcessorOutput>({
    filteredTransactions: [],
    flattenedTransactions: [],
    groupedTransactions: [],
    totalIncome: 0,
    totalExpenses: 0,
    filteredCount: 0
  });

  private readonly _isProcessing = signal<boolean>(false);

  public filteredTransactions = computed(() => this._output().filteredTransactions);
  public flattenedTransactions = computed(() => this._output().flattenedTransactions);
  public groupedTransactions = computed(() => this._output().groupedTransactions);
  public totalIncome = computed(() => this._output().totalIncome);
  public totalExpenses = computed(() => this._output().totalExpenses);
  public filteredCount = computed(() => this._output().filteredCount);
  public isProcessing = computed(() => this._isProcessing());

  private debounceTimer: any;

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
      clearTimeout(this.debounceTimer);
    }
    
    this._isProcessing.set(true);
    this.debounceTimer = setTimeout(() => {
      const result = this.executeLogic(data);
      this._output.set(result);
      this._isProcessing.set(false);
      this.debounceTimer = null;
    }, 50);
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
      currentUserId
    } = data;

    if (!transactions) {
      return { filteredTransactions: [], flattenedTransactions: [], groupedTransactions: [], totalIncome: 0, totalExpenses: 0, filteredCount: 0 };
    }

    // 1. Helper: Map creation
    const categoryMap = new Map();
    categories.forEach((cat: any) => {
      if (cat.id) categoryMap.set(cat.id, cat);
    });

    const accountMap = new Map();
    accounts.forEach((acc: any) => {
      accountMap.set(acc.accountId, acc);
    });

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

    const generateUpcomingTransactions = (recurringTransactions: any[], startDate: Date, endDate: Date, allTxs: any[]): any[] => {
      const upcoming: any[] = [];
      
      const existMap = new Map<string, Date[]>();
      allTxs.forEach(t => {
        if (t.id?.startsWith('upcoming-') || (t.id === t.templateId && t.isPending)) return;
        
        const key = `${t.categoryId}|${t.amount}|${t.accountId}|${t.type}`;
        const tDate = toDate(t.date);
        if (!tDate) return;
        
        if (!existMap.has(key)) existMap.set(key, []);
        existMap.get(key)!.push(tDate);
      });

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
      sourceData = generateUpcomingTransactions(templates.map((t: any) => ({ ...t, isRecurring: true })), startDate, endDate, transactions);
    } else {
      if (isRecurringMode) {
        sourceData = recurringTemplates || [];
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
    if (range !== 'upcoming') {
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

    // Merging Logic
    let mergedData = filtered;
    if (range !== 'upcoming' && range !== null && !isRecurringMode && !isDeletedMode) {
      const endOfCheck = dayjs().add(3, 'day').endOf('day').toDate();
      const templates = (recurringTemplates || []).map((t: any) => ({ ...t, isRecurring: true }));
      const dueSoon = generateUpcomingTransactions(templates, dayjs().subtract(1, 'year').toDate(), endOfCheck, transactions);

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
      .reduce((sum: number, t: any) => sum + t.amount, 0);
    const totalExpenses = mergedData
      .filter((t: any) => t.type === 'expense' && !t.id?.startsWith('upcoming-') && !t.settlementId)
      .reduce((sum: number, t: any) => sum + t.amount, 0);

    // 7. Grouping and View Models
    interface Group {
      date: string;
      dateHeader: string;
      transactions: any[];
      isUpcomingGroup?: boolean;
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
          if (tx.settlementId) {
            if (currentUserId === tx.settlementToUserId) return true;
            if (currentUserId === tx.settlementFromUserId) return false;
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
        _popState: (createdAtDate && createdAtDate.getTime() > sessionStartTime) ? 'new' : 'old'
      };

      let dateKey: string;
      if (txView._isUpcoming && txView._isOverdue) {
        dateKey = 'overdue';
      } else if (txView._isUpcoming && range !== 'upcoming') {
        dateKey = 'upcoming';
      } else if ((range === 'this-year' || range === null) && !dateObj.isSame(today, 'day') && !dateObj.isSame(yesterday, 'day')) {
        dateKey = dateObj.format('YYYY-MM');
      } else {
        dateKey = dateObj.format('YYYY-MM-DD');
      }

      if (isRecurringMode && txView._isUpcoming) {
        return; 
      }

      let group = groupsMap.get(dateKey);
      if (!group) {
        let header = dateHeaderCache.get(dateKey);
        if (!header) {
          if (dateKey === 'overdue') header = 'Overdue Recurring';
          else if (dateKey === 'upcoming') header = 'Upcoming';
          else if (dateObj.isSame(today, 'day')) header = 'Today';
          else if (dateObj.isSame(yesterday, 'day')) header = 'Yesterday';
          else if (range === 'this-year' || range === null) header = dateObj.format('MMMM YYYY');
          else if (isDateSort) header = dateObj.format('dddd, DD MMM YYYY');
          else header = dateObj.format('DD MMM YYYY');
          dateHeaderCache.set(dateKey, header);
        }
        group = { date: dateKey, dateHeader: header, transactions: [], isUpcomingGroup: txView._isUpcoming };
        groupsMap.set(dateKey, group);
      }
      group.transactions.push(txView);
    });

    const groups = Array.from(groupsMap.values());

    let finalGroups = groups;
    if (isDateSort) {
      finalGroups = groups.sort((a, b) => {
        if (a.dateHeader === 'Overdue Recurring' && b.dateHeader !== 'Overdue Recurring') return -1;
        if (b.dateHeader === 'Overdue Recurring' && a.dateHeader !== 'Overdue Recurring') return 1;
        if (a.dateHeader === 'Upcoming' && b.dateHeader !== 'Upcoming') return -1; 
        if (b.dateHeader === 'Upcoming' && a.dateHeader !== 'Upcoming') return 1;

        return sort === 'date-asc'
          ? a.date.localeCompare(b.date)
          : b.date.localeCompare(a.date);
      });
    }

    // 8. Flatten for Virtual Scroll
    const flattened: any[] = [];
    finalGroups.forEach((group: any) => {
      flattened.push({ 
        _isHeader: true, 
        dateHeader: group.dateHeader,
        id: `header-${group.date}` 
      });
      group.transactions.forEach((tx: any) => {
        flattened.push({ 
          ...tx,
          _isHeader: false
        });
      });
    });

    return {
      filteredTransactions: mergedData,
      flattenedTransactions: flattened,
      groupedTransactions: finalGroups,
      totalIncome,
      totalExpenses,
      filteredCount
    };
  }

  destroy() {
    if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
    }
  }
}
