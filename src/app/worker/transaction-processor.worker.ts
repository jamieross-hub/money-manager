/// <reference lib="webworker" />

import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import { DateUtil } from '../util/helpers/date.util';

dayjs.extend(isBetween);
dayjs.extend(weekOfYear);

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

addEventListener('message', ({ data }) => {
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
    isFamilyMode,
    isDeletedMode,
    currentUserId,
    fingerprint,
    familyId,
    familyMembers,
    currentPage = 0,
    pageSize = 100
  } = data;

  // Pre-compute admin status once (O(m)) instead of per-transaction O(n×m)
  const isCurrentUserAdmin = isFamilyMode && currentUserId
    ? (familyMembers || []).some((m: any) => m.userId === currentUserId && m.role === 'admin')
    : false;

  const canPerformAction = (tx: any): boolean => {
    if (tx.syncStatus === 'PENDING' || tx.syncStatus === 'pending') return false;
    if (!isFamilyMode) return true;
    if (!currentUserId) return false;
    if (tx.createdBy === currentUserId || tx.userId === currentUserId) return true;
    return isCurrentUserAdmin;
  };

  if (!transactions) {
    postMessage({ flattenedTransactions: [], totalIncome: 0, totalExpenses: 0, filteredCount: 0 });
    return;
  }

  // Cleanup Detection: soft-deleted older than 30 days
  const thirtyDaysAgo = dayjs().subtract(30, 'day').startOf('day');
  const cleanupIds: string[] = [];

  transactions.forEach((tx: any) => {
    if (tx.status === 'deleted') {
      const updatedAt = tx.updatedAt;
      if (updatedAt) {
        let updateTime = dayjs(updatedAt);
        if (updatedAt && typeof updatedAt === 'object' && 'seconds' in updatedAt) {
            const seconds = Number(updatedAt.seconds);
            const nanoseconds = Number(updatedAt.nanoseconds || 0);
            updateTime = dayjs(seconds * 1000 + Math.floor(nanoseconds / 1000000));
        } else if (updatedAt instanceof Date) {
            updateTime = dayjs(updatedAt);
        } else {
            updateTime = dayjs(updatedAt as any);
        }
        
        if (updateTime.isValid() && updateTime.isBefore(thirtyDaysAgo)) {
            cleanupIds.push(tx.id);
        }
      }
    }
  });

  if (cleanupIds.length > 0) {
    console.log(`[Worker] Found ${cleanupIds.length} soft-deleted transactions older than 30 days for cleanup.`);
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
    return DateUtil.toDate(val);
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
    
    // Optimization: Pre-process existing transactions into a lookup map for faster collision detection
    // Key: categoryId|amount|accountId|type
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
        
        // Use the map to quickly check for existing transactions in same period
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
        
        break; // Only generate one occurrence per recurring transaction
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
      sourceData = (recurringTemplates || [])
        .filter((t: any) => t.isActive === true)
        .map((t: any) => ({
          ...t,
          date: t.nextOccurrence || t.createdAt || new Date()
        }));
    } else {
      sourceData = transactions; // SelectAllTransactions already filtered for !isDeleted
    }
  }

  // 4. Filtering Logic
  let filtered = sourceData ? [...sourceData] : [];
  
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

  // Type
  if (filters.selectedType && filters.selectedType !== 'all') {
    filtered = filtered.filter((t: any) => t.type === filters.selectedType);
  }

  // Date Range (Skip if source is upcoming, as it's already range-limited)
  if (range !== 'upcoming' && !isRecurringMode) {
    if (filters.selectedDateRange) {
      const start = dayjs(filters.selectedDateRange.startDate).startOf('day');
      const end = dayjs(filters.selectedDateRange.endDate).endOf('day');
      filtered = filtered.filter((t: any) => {
        const d = DateUtil.toDate(t.date);
        return d && dayjs(d).isBetween(start, end, 'day', '[]');
      });
    } else if (filters.selectedDate) {
      const target = dayjs(filters.selectedDate).startOf('day');
      filtered = filtered.filter((t: any) => {
        const d = DateUtil.toDate(t.date);
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
    const mId = filters.selectedMember;
    filtered = filtered.filter((t: any) => {
      if (t.settlementFromUserId === mId || t.settlementToUserId === mId) return true;
      if (t.splitData) {
        const sd = t.splitData;
        const isPayer = sd.paidByUserId === mId || (sd.paidBy && sd.paidBy.some((p: any) => p.userId === mId)) || (!sd.paidByUserId && t.userId === mId);
        const isInSplit = sd.splitBetween && sd.splitBetween.some((s: any) => s.userId === mId);
        return isPayer || isInSplit;
      }
      return t.userId === mId || t.createdBy === mId;
    });
  }

  // --- Capture Used Categories BEFORE Category selection filter ---
  const usedCategoryIds = Array.from(new Set(filtered.map((t: any) => t.categoryId).filter(Boolean)));

  // Finally Apply Category selection filter
  if (filters.selectedCategory && !filters.selectedCategory.includes('all')) {
    filtered = filtered.filter((t: any) => filters.selectedCategory.includes(t.categoryId));
  }

  // Merging Logic (Ported from component)
  let mergedData = filtered;
  if (range !== 'upcoming' && range !== 'settlement' && range !== null && !isRecurringMode && !isDeletedMode && !isFamilyMode) {
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
        return sorted.sort((a, b) => {
          const diff = (toDate(b.date)?.getTime() || 0) - (toDate(a.date)?.getTime() || 0);
          if (diff !== 0) return diff;
          return (b.id || '').localeCompare(a.id || '');
        });
      case 'date-asc':
        return sorted.sort((a, b) => {
          const diff = (toDate(a.date)?.getTime() || 0) - (toDate(b.date)?.getTime() || 0);
          if (diff !== 0) return diff;
          return (a.id || '').localeCompare(b.id || '');
        });
      case 'amount-desc':
        return sorted.sort((a, b) => {
          const diff = b.amount - a.amount;
          if (diff !== 0) return diff;
          return (b.id || '').localeCompare(a.id || '');
        });
      case 'amount-asc':
        return sorted.sort((a, b) => {
          const diff = a.amount - b.amount;
          if (diff !== 0) return diff;
          return (a.id || '').localeCompare(b.id || '');
        });
      case 'category-asc':
        // Handle name comparison if available, otherwise fallback to id
        return sorted.sort((a, b) => {
          const nameA = categoryMap.get(a.categoryId)?.name || a.categoryId || '';
          const nameB = categoryMap.get(b.categoryId)?.name || b.categoryId || '';
          const diff = nameA.localeCompare(nameB);
          if (diff !== 0) return diff;
          return (a.id || '').localeCompare(b.id || '');
        });
      default:
        return sorted;
    }
  };

  const finalSortedTransactions = sortTransactions(mergedData, sort);

  // 6. Totals (settlement transactions are excluded from both income and expense totals)
  const memberId = filters.selectedMember;
  
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

  // 6. Grouping and View Models
  interface Group {
    date: string;
    dateHeader: string;
    transactions: any[];
    isUpcomingGroup?: boolean;
    totalIncome: number;
    totalExpenses: number;
    totalShare: number;
    totalCost: number;
  }

  const groupsMap = new Map<string, Group>();
  const dateHeaderCache = new Map<string, string>();
  const today = dayjs().startOf('day');
  const yesterday = dayjs().subtract(1, 'day').startOf('day');
  const isDateSort = sort === 'date-desc' || sort === 'date-asc';

  const paginatedTransactions = finalSortedTransactions.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  paginatedTransactions.forEach((tx: any) => {
    const txDate = toDate(tx.date);
    const dateObj = dayjs(txDate);
    
    const category = categoryMap.get(tx.categoryId || '');
    const account = accountMap.get(tx.accountId || '');

    const createdAt = tx.createdAt; 
    const createdAtDate = createdAt ? toDate(createdAt) : null;

    const _isUpcoming = !!tx.isPending && (tx.id?.startsWith('upcoming-') || false);
    const _isSummary = !!(tx as any)._isSummary;

    // Permission flags — computed once here, read O(1) in template per CD cycle
    const _canEdit = (() => {
      if (_isSummary) return false;
      if (!isFamilyMode) return tx.syncStatus !== 'PENDING' && tx.syncStatus !== 'pending';
      if (tx.settlementId || tx.categoryId === 'adjustment' || tx.status === 'pending' || tx.syncStatus === 'PENDING' || tx.syncStatus === 'pending') return false;
      return canPerformAction(tx);
    })();

    const _canDelete = (() => {
      if (_isSummary) return false;
      if (tx.settlementId) {
        if (!currentUserId) return false;
        if (tx.createdBy === currentUserId || tx.userId === currentUserId ||
            tx.settlementFromUserId === currentUserId || tx.settlementToUserId === currentUserId) return true;
        return isCurrentUserAdmin;
      }
      return canPerformAction(tx);
    })();

    const _canAdjust = (() => {
      if (_isSummary) return false;
      return !_canEdit &&
             !tx.settlementId &&
             tx.categoryId !== 'adjustment' &&
             isFamilyMode &&
             tx.syncStatus !== 'PENDING' && tx.syncStatus !== 'pending';
    })();

    const txView = {
      ...tx,
      _categoryColor: category?.color || '#46777f',
      _categoryIcon: category?.icon || 'category',
      _categoryName: category?.name || tx.categoryId || 'Unknown',
      _accountName: account?.name || 'Unknown Account',
      _fromAccountName: tx.type === 'transfer' ? (accountMap.get(tx.fromAccountId || tx.accountId)?.name || 'Unknown Account') : undefined,
      _toAccountName: tx.type === 'transfer' ? (accountMap.get(tx.toAccountId)?.name || 'Unknown Account') : undefined,
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
      _isUpcoming,
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
      _isHeader: false,
      _canEdit,
      _canDelete,
      _canAdjust
    };

    let dateKey: string;
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
      dateKey = involvementPrefix + (tx.categoryId || 'unknown');
    } else if (memberId) {
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
    }
  });

  let finalGroups = groups;
  if (isDateSort || range === 'category') {
    finalGroups = groups.sort((a, b) => {
      if (a.dateHeader === 'Overdue Recurring' && b.dateHeader !== 'Overdue Recurring') return -1;
      if (b.dateHeader === 'Overdue Recurring' && a.dateHeader !== 'Overdue Recurring') return 1;
      if (a.dateHeader === 'Upcoming' && b.dateHeader !== 'Upcoming') return -1; 
      if (b.dateHeader === 'Upcoming' && a.dateHeader !== 'Upcoming') return 1;

      // Involvement sorting
      if (a.date.startsWith('direct_') && b.date.startsWith('involved_')) return -1;
      if (a.date.startsWith('involved_') && b.date.startsWith('direct_')) return 1;

      if (range === 'category') {
        const volA = a.totalIncome + a.totalExpenses;
        const volB = b.totalIncome + b.totalExpenses;
        return volB - volA; // Highest volume first
      }

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
      flattened.push(tx); // refs
    });
  });

  postMessage({
    filteredTransactions: mergedData,
    flattenedTransactions: flattened,
    groupedTransactions: finalGroups,
    totalIncome,
    totalExpenses,
    totalSettlement,
    filteredCount,
    userIncome,
    userExpenses,
    userPaid,
    fingerprint,
    currentUserId,
    isFamilyMode,
    familyId,
    cleanupIds,
    usedCategoryIds
  });
});
