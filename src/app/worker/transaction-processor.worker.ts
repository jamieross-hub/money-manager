/// <reference lib="webworker" />

import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import weekOfYear from 'dayjs/plugin/weekOfYear';

dayjs.extend(isBetween);
dayjs.extend(weekOfYear);

addEventListener('message', ({ data }) => {
  const { 
    transactions, 
    categories, 
    accounts, 
    filters, 
    sort, 
    range,
    sessionStartTime,
    appView,
    isRecurringMode,
    isFamilyMode,
    isDeletedMode
  } = data;

  if (!transactions) {
    postMessage({ flattenedTransactions: [], totalIncome: 0, totalExpenses: 0, filteredCount: 0 });
    return;
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
    switch (interval) {
      case 'DAILY':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'WEEKLY':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'MONTHLY':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'YEARLY':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
    }
    return nextDate;
  };

  const isSamePeriod = (date1: Date, date2: Date, interval: string): boolean => {
    const d1 = dayjs(date1).startOf('day');
    const d2 = dayjs(date2).startOf('day');
    switch (interval) {
      case 'DAILY': return d1.isSame(d2, 'day');
      case 'WEEKLY': return d1.isSame(d2, 'week');
      case 'MONTHLY': return d1.isSame(d2, 'month');
      case 'YEARLY': return d1.isSame(d2, 'year');
      default: return false;
    }
  };

  const generateUpcomingTransactions = (recurringTransactions: any[], startDate: Date, endDate: Date, allTxs: any[]): any[] => {
    const upcoming: any[] = [];
    recurringTransactions.forEach(rt => {
      if (!rt.nextOccurrence || !rt.isRecurring) return;
      let nextDate = toDate(rt.nextOccurrence);
      if (!nextDate) return;
      const baseTransaction = { ...rt };
      while (nextDate <= endDate) {
        if (nextDate >= startDate) {
          const exists = allTxs.some(t => {
            if (t.id?.startsWith('upcoming-')) return false;
            if (t.id === rt.id && t.isPending) return false;
            if (t.categoryId !== baseTransaction.categoryId) return false;
            if (t.amount !== baseTransaction.amount) return false;
            if (t.accountId !== baseTransaction.accountId) return false;
            if (t.type !== baseTransaction.type) return false;
            const txDate = toDate(t.date);
            if (!txDate) return false;
            return isSamePeriod(txDate, nextDate as Date, rt.recurringInterval);
          });
          if (!exists) {
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
        }
        nextDate = calculateNextDate(nextDate, rt.recurringInterval);
      }
    });
    return upcoming;
  };

  // 3. Logic: Determine Source Data
  let sourceData = transactions;
  if (range === 'upcoming') {
    const recurring = transactions.filter((t: any) => t.isRecurring);
    const today = dayjs().startOf('day').toDate();
    let startDate = today;
    let endDate;
    if (appView === 'WEEKLY') endDate = dayjs().add(1, 'week').endOf('day').toDate();
    else if (appView === 'YEARLY') endDate = dayjs().add(1, 'year').endOf('day').toDate();
    else endDate = dayjs().add(1, 'month').endOf('day').toDate();
    sourceData = generateUpcomingTransactions(recurring, startDate, endDate, transactions);
  }

  // 4. Filtering Logic
  let filtered = [...sourceData];
  
  // Search
  if (filters.searchTerm && filters.searchTerm.trim()) {
    const searchLower = filters.searchTerm.toLowerCase().trim();
    filtered = filtered.filter((t: any) =>
      t.payee?.toLowerCase().includes(searchLower) ||
      t.category?.toLowerCase().includes(searchLower) ||
      t.notes?.toLowerCase().includes(searchLower)
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

  // Date Range (Skip if source is upcoming, as it's already range-limited)
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

  // Merging Logic (Ported from component)
  let mergedData = filtered;
  if (range !== 'upcoming' && !isRecurringMode && !isDeletedMode) {
    const endOfCheck = dayjs().add(3, 'day').endOf('day').toDate();
    const recurring = transactions.filter((t: any) => t.isRecurring);
    const dueSoon = generateUpcomingTransactions(recurring, dayjs().subtract(1, 'year').toDate(), endOfCheck, transactions);

    const actualData = filtered.filter((t: any) => {
      if (t.isPending && t.isRecurring && !t.id?.startsWith('upcoming-')) {
        const hasDuplicate = dueSoon.some(v => v.id?.startsWith(`upcoming-${t.id}-`) && dayjs(toDate(v.date)).isSame(toDate(t.date), 'day'));
        return !hasDuplicate;
      }
      return true;
    });

    const existingIds = new Set(actualData.map((t: any) => t.id));
    const filteredDueSoon = dueSoon.filter(t => !existingIds.has(t.id));
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
        // Handle name comparison if available, otherwise fallback to id
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

  // 6. Totals
  const totalIncome = mergedData.filter((t: any) => t.type === 'income').reduce((sum: number, t: any) => sum + t.amount, 0);
  const totalExpenses = mergedData.filter((t: any) => t.type === 'expense').reduce((sum: number, t: any) => sum + t.amount, 0);

  // 6. Grouping and View Models
  interface Group {
    date: string;
    dateHeader: string;
    transactions: any[];
    isUpcomingGroup?: boolean;
  }

  const groups: Group[] = [];
  const dateHeaderCache = new Map<string, string>();
  const today = dayjs().startOf('day');
  const yesterday = dayjs().subtract(1, 'day').startOf('day');
  const isDateSort = sort === 'date-desc' || sort === 'date-asc';

  finalSortedTransactions.forEach((tx: any) => {
    const txDate = toDate(tx.date);
    const dateObj = dayjs(txDate);
    
    let dateKey: string;
    if (range === 'this-year' || range === null) {
      dateKey = dateObj.format('YYYY-MM');
    } else {
      dateKey = dateObj.format('YYYY-MM-DD');
    }

    const category = categoryMap.get(tx.categoryId || '');
    const account = accountMap.get(tx.accountId || '');

    const createdAt = tx.createdAt || tx.date;
    const createdAtDate = toDate(createdAt);

    // Build txView (Full set of view properties to avoid template errors)
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
      _isIncome: tx.type === 'income',
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

    if (isRecurringMode && txView._isUpcoming) {
      return; // Skip upcoming transactions when isRecurring is true
    }

    let group = groups.find(g => g.date === dateKey);
    if (!group) {
      let header = dateHeaderCache.get(dateKey);
      if (!header) {
        if (txView._isUpcoming && txView._isOverdue) {
          header = 'Overdue Recurring';
        } else if (range === 'this-year' || range === null) {
          header = dateObj.format('MMMM YYYY');
        } else if (isDateSort) {
          if (dateObj.isSame(today, 'day')) {
            header = 'Today';
          } else if (dateObj.isSame(yesterday, 'day')) {
            header = 'Yesterday';
          } else {
            header = dateObj.format('dddd, DD MMM YYYY');
          }
        } else {
          header = dateObj.format('DD MMM YYYY');
        }
        dateHeaderCache.set(dateKey, header);
      }
      group = { date: dateKey, dateHeader: header, transactions: [], isUpcomingGroup: txView._isUpcoming };
      groups.push(group);
    }
    group.transactions.push(txView);
  });

  // Re-order groups if needed
  let finalGroups = groups;
  if (isDateSort) {
    finalGroups = groups.sort((a, b) => {
      if (a.dateHeader === 'Overdue Recurring') return -1;
      if (b.dateHeader === 'Overdue Recurring') return 1;
      return sort === 'date-asc'
        ? a.date.localeCompare(b.date)
        : b.date.localeCompare(a.date);
    });
  }

  // 7. Flatten for Virtual Scroll
  const flattened: any[] = [];
  finalGroups.forEach(group => {
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

  postMessage({
    filteredTransactions: mergedData,
    flattenedTransactions: flattened,
    totalIncome,
    totalExpenses,
    filteredCount
  });
});
