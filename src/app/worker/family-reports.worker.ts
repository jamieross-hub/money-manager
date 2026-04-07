/// <reference lib="webworker" />

import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';

dayjs.extend(isBetween);

import { Transaction } from '../util/models/transaction.model';
import { FamilyMember, FamilyStats, FamilyMemberStats } from '../util/models/family.model';
import { TransactionStatus, TransactionType } from '../util/config/enums';
import { DateUtil } from '../util/helpers/date.util';

// ─── Shared Types (re-exported for consumers) ─────────────────────────────────

export interface CategoryBreakdownItem {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  amount: number;
  percentage: number;
  transactionCount: number;
}

export interface MonthlySummary {
  month: number;      // 0-11
  year: number;
  label: string;      // "Jan 2025"
  income: number;
  expense: number;
  savings: number;
  savingsRate: number; // %
  categoryBreakdown: CategoryBreakdownItem[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ─── Message Handler ─────────────────────────────────────────────────────────

addEventListener('message', ({ data }) => {
  const { type, payload } = data;

  if (type === 'PROCESS_FAMILY_REPORTS') {
    const {
      allTransactions, members, categories, mode, settlements, fingerprint, fid,
      selectedPeriod, selectedYear, selectedMonth, selectedWeekOffset,
      categoryViewMode, currentUserId
    } = payload;

    const startTime = performance.now();

    // 1. Available Years (always from full set)
    const availableYears = Array.from(new Set(allTransactions.map((t: Transaction) => {
      const d = DateUtil.toDate(t.date);
      return d ? d.getFullYear() : null;
    }).filter(Boolean) as number[])).sort((a, b) => b - a);

    // 2. Filter transactions for the current period
    const periodTransactions = mode === 'split' 
      ? allTransactions 
      : filterTransactions(
          allTransactions, 
          selectedPeriod || 'monthly', 
          selectedYear || new Date().getFullYear(), 
          selectedMonth ?? null, 
          selectedWeekOffset || 0
        );

    // 3. Compute stats from period-filtered transactions
    const stats = computeStats(periodTransactions, members || [], mode || 'common', settlements || []);
    
    // 4. Date Range Label
    stats.dateRangeLabel = generateDateRangeLabel(
      selectedPeriod || 'monthly', 
      selectedYear || new Date().getFullYear(), 
      selectedMonth ?? null, 
      selectedWeekOffset || 0,
      mode
    );
    stats.availableYears = availableYears;

    // 5. Monthly Summaries (Full History)
    const monthlySummaries = buildMonthlySummaries(allTransactions);

    // 6. Filtered History (for the table)
    const { filteredMonthlySummaries } = computePeriodSummaries(
      allTransactions,
      monthlySummaries,
      selectedPeriod    || 'monthly',
      selectedYear      || new Date().getFullYear(),
      selectedMonth     ?? null,
      selectedWeekOffset || 0
    );

    // 7. Total History Header Sums
    stats.totalHistory = filteredMonthlySummaries.reduce((acc, curr) => ({
      income:  acc.income  + (curr.income  || 0),
      expense: acc.expense + (curr.expense || 0),
      savings: acc.savings + (curr.savings || 0),
    }), { income: 0, expense: 0, savings: 0 });

    // 8. Grouped Category Breakdown
    stats.groupedCategoryBreakdown = computeGroupedCategoryBreakdown(
      periodTransactions, 
      categories || [], 
      categoryViewMode || 'group',
      currentUserId,
      mode || 'common',
      members || []
    );

    const durationMs = performance.now() - startTime;

    postMessage({
      type: 'FAMILY_REPORTS_PROCESSED',
      payload: {
        stats,
        monthlySummaries,
        filteredMonthlySummaries,
        fingerprint,
        fid,
        durationMs
      }
    });
  }
});

function filterTransactions(txns: Transaction[], period: string, year: number, month: number | null, offset: number): Transaction[] {
    if (period === 'monthly') {
      const targetMonth = month ?? new Date().getMonth();
      return txns.filter(t => {
        const d = dayjs(DateUtil.toDate(t.date));
        return d.year() === year && d.month() === targetMonth;
      });
    } else if (period === 'yearly') {
      return txns.filter(t => {
        const d = dayjs(DateUtil.toDate(t.date));
        return d.year() === year;
      });
    } else if (period === 'weekly') {
      const startOfWeek = dayjs().add(offset, 'week').startOf('week');
      const endOfWeek = dayjs().add(offset, 'week').endOf('week');
      return txns.filter(t => {
        const d = dayjs(DateUtil.toDate(t.date));
        return d.isAfter(startOfWeek.subtract(1, 'ms')) && d.isBefore(endOfWeek.add(1, 'ms'));
      });
    }
    return txns;
}

function generateDateRangeLabel(period: string, year: number, month: number | null, offset: number, mode?: string): string {
    if (mode === 'split') return 'All Time';
    if (period === 'monthly') {
      return dayjs().month(month || 0).year(year).format('MMMM YYYY');
    } else if (period === 'yearly') {
      return year.toString();
    } else if (period === 'weekly') {
      const start = dayjs().add(offset, 'week').startOf('week');
      const end = dayjs().add(offset, 'week').endOf('week');
      return `${start.format('DD MMM')} - ${end.format('DD MMM YYYY')}`;
    }
    return '';
}

function computeGroupedCategoryBreakdown(
  txns: Transaction[], 
  allCats: any[], 
  viewMode: 'single' | 'group',
  uid: string | undefined,
  mode: 'common' | 'split',
  members: FamilyMember[]
) {
  let baseBreakdown: { category: string; amount: number; transactionCount: number }[] = [];
  const activeMembers = members.filter(m => m.isActive);

  if (viewMode === 'single' && uid) {
    const categoryMap = new Map<string, { amount: number; count: number }>();
    for (const t of txns) {
      if (t.status === TransactionStatus.DELETED || t.category === 'Settlement' || t.type === TransactionType.TRANSFER) continue;
      if (t.type === TransactionType.INCOME) continue;

      const amount = Number(t.amount) || 0;
      let shareAmt = 0;

      if (t.splitData?.splitBetween?.length) {
        const share = t.splitData.splitBetween.find(s => s.userId === uid);
        if (share) shareAmt = Number(share.amount) || 0;
      } else {
        if (mode === 'common') {
          shareAmt = Math.round((amount / (activeMembers.length || 1)) * 100) / 100;
        } else if (t.userId === uid) {
          shareAmt = amount;
        }
      }

      if (shareAmt > 0) {
        const cat = t.category || 'Uncategorized';
        const entry = categoryMap.get(cat) || { amount: 0, count: 0 };
        entry.amount += shareAmt;
        entry.count += 1;
        categoryMap.set(cat, entry);
      }
    }
    baseBreakdown = Array.from(categoryMap.entries()).map(([category, data]) => ({ 
      category, 
      amount: data.amount, 
      transactionCount: data.count 
    }));
  } else {
    const categoryMap = new Map<string, { amount: number; count: number }>();
    for (const t of txns) {
      if (t.status === TransactionStatus.DELETED || t.category === 'Settlement' || t.type === TransactionType.TRANSFER) continue;
      if (t.type === TransactionType.INCOME) continue;
      const cat = t.category || 'Uncategorized';
      const entry = categoryMap.get(cat) || { amount: 0, count: 0 };
      entry.amount += (Number(t.amount) || 0);
      entry.count += 1;
      categoryMap.set(cat, entry);
    }
    baseBreakdown = Array.from(categoryMap.entries()).map(([category, data]) => ({ 
      category, 
      amount: data.amount, 
      transactionCount: data.count 
    }));
  }

  const groupMap = new Map<string, any>();
  for (const b of baseBreakdown) {
    const catObj = allCats.find((c: any) => c.name.toLowerCase() === b.category.toLowerCase());
    if (catObj?.isSystem) continue;

    const group = catObj?.group;
    if (group) {
        if (!groupMap.has(group)) {
            groupMap.set(group, {
                categoryId: 'group_' + group,
                categoryName: group,
                amount: 0,
                percentage: 0,
                isGroup: true,
                groupIcon: catObj?.groupIcon,
                categoryColor: catObj?.color || stringToColorWorker(group),
                transactionCount: 0
            });
        }
        const g = groupMap.get(group);
        g.amount += b.amount;
        g.transactionCount += b.transactionCount;
    } else {
        groupMap.set(b.category, {
            categoryId: b.category,
            categoryName: b.category,
            amount: b.amount,
            percentage: 0,
            isGroup: false,
            categoryIcon: catObj?.icon,
            categoryColor: catObj?.color || stringToColorWorker(b.category),
            transactionCount: b.transactionCount
        });
    }
  }

  const result = Array.from(groupMap.values());
  const maxAmount = result.length > 0 ? Math.max(...result.map(r => r.amount)) : 0;
  result.forEach(r => {
    r.percentage = maxAmount > 0 ? (r.amount / maxAmount) * 100 : 0;
  });

  return result.sort((a, b) => b.amount - a.amount);
}

function stringToColorWorker(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
}

// ─── Stats ───────────────────────────────────────────────────────────────────

function computeStats(
  transactions: Transaction[],
  members: FamilyMember[],
  mode: 'common' | 'split',
  settlements: any[] = []
): FamilyStats {
  let totalIncome  = 0;
  let totalExpense = 0;
  const memberMap   = new Map<string, FamilyMemberStats>();
  const categoryMap = new Map<string, number>();

  members.forEach(m => {
    memberMap.set(m.userId, {
      userId: m.userId,
      displayName: m.displayName,
      photoURL: m.photoURL,
      totalIncome: 0,
      totalExpense: 0,
      totalPaid: 0,
      netBalance: 0,
      transactionCount: 0,
      paidCount: 0,
      isActive: m.isActive,
    });
  });

  const activeMembers  = members.filter(m => m.isActive);
  let transactionCount = 0;

  transactions.forEach(tx => {
    if (tx.status === TransactionStatus.DELETED) return;
    if (tx.category === 'Settlement' || tx.type === TransactionType.TRANSFER) return;

    const amount = Number(tx.amount) || 0;
    if (amount <= 0) return;

    transactionCount++;
    if (tx.type === TransactionType.INCOME) {
      totalIncome += amount;
    } else {
      totalExpense += amount;
      categoryMap.set(tx.category, (categoryMap.get(tx.category) || 0) + amount);
    }

    const isIncome = tx.type === TransactionType.INCOME;

    // Payment credit / debit
    if (tx.splitData?.paidByUserId === 'multiple' && tx.splitData.paidBy?.length) {
      tx.splitData.paidBy.forEach(p => {
        const mStats = memberMap.get(p.userId);
        if (mStats) {
          const pAmt = Number(p.amount) || 0;
          mStats.totalPaid += isIncome ? -pAmt : pAmt;
          mStats.paidCount++;
        }
      });
    } else {
      const payerId = tx.splitData?.paidByUserId || tx.userId;
      const mStats  = memberMap.get(payerId);
      if (mStats) {
        mStats.totalPaid += isIncome ? -amount : amount;
        mStats.paidCount++;
      }
    }

    // Share (who consumes)
    if (tx.splitData?.splitBetween && tx.splitData.splitBetween.length > 0) {
      tx.splitData.splitBetween.forEach(share => {
        const mStats   = memberMap.get(share.userId);
        const shareAmt = Number(share.amount) || 0;
        if (mStats) {
          if (isIncome) mStats.totalIncome += shareAmt;
          else          mStats.totalExpense += shareAmt;
        }
      });
    } else {
      if (mode === 'common') {
        const shareAmt = Math.round((amount / (activeMembers.length || 1)) * 100) / 100;
        activeMembers.forEach(m => {
          const mStats = memberMap.get(m.userId);
          if (mStats) {
            if (isIncome) mStats.totalIncome += shareAmt;
            else          mStats.totalExpense += shareAmt;
          }
        });
      } else {
        const mStats = memberMap.get(tx.userId);
        if (mStats) {
          if (isIncome) mStats.totalIncome += amount;
          else          mStats.totalExpense += amount;
        }
      }
    }

    const recorderStats = memberMap.get(tx.userId);
    if (recorderStats) recorderStats.transactionCount++;
  });

  // ─── Process Settlements ───
  settlements.forEach(s => {
    const amount = Number(s.amount) || 0;
    if (amount <= 0) return;

    transactionCount++;

    const fromStats = memberMap.get(s.fromUserId);
    if (fromStats) {
      fromStats.totalPaid += amount;
      fromStats.paidCount++;
      fromStats.transactionCount++;
    }

    const toStats = memberMap.get(s.toUserId);
    if (toStats) {
      toStats.totalPaid -= amount;
      // We don't increment toStats.transactionCount here as they didn't "record" it usually,
      // but they are a participant. For reports, counting it for the payer is enough.
    }
  });

  const memberBreakdown = Array.from(memberMap.values()).map(m => ({
    ...m,
    netBalance: Math.round((m.totalPaid + m.totalIncome - m.totalExpense) * 100) / 100
  }));

  const categoryBreakdown = Array.from(categoryMap.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: totalExpense > 0 ? (amount / totalExpense) * 100 : 0
    }))
    .sort((a, b) => b.amount - a.amount);

  // Identify Top Spender
  let topSpenderMember = memberBreakdown[0];
  for (const m of memberBreakdown) {
    if (m.totalPaid > (topSpenderMember?.totalPaid || 0)) {
      topSpenderMember = m;
    }
  }

  // Identify Largest Individual Expense
  let maxExpenseTx: Transaction | null = null;
  for (const tx of transactions) {
    if (tx.status === TransactionStatus.DELETED || tx.category === 'Settlement' || tx.type === TransactionType.TRANSFER) continue;
    if (tx.type === TransactionType.INCOME) continue;
    if (!maxExpenseTx || (Number(tx.amount) || 0) > (Number(maxExpenseTx.amount) || 0)) {
      maxExpenseTx = tx;
    }
  }

  return {
    totalIncome,
    totalExpense,
    netBalance: Math.round((totalIncome - totalExpense) * 100) / 100,
    transactionCount,
    memberBreakdown,
    categoryBreakdown,
    topSpender: topSpenderMember && topSpenderMember.totalPaid > 0 ? { name: topSpenderMember.displayName, amount: topSpenderMember.totalPaid } : undefined,
    topCategory: categoryBreakdown.length > 0 && categoryBreakdown[0].amount > 0 ? { name: categoryBreakdown[0].category, amount: categoryBreakdown[0].amount, percentage: categoryBreakdown[0].percentage } : undefined,
    largestExpense: maxExpenseTx ? { note: maxExpenseTx.note || maxExpenseTx.category, amount: Number(maxExpenseTx.amount) || 0 } : undefined
  };
}

// ─── Monthly Summaries ────────────────────────────────────────────────────────

function buildMonthlySummaries(transactions: Transaction[]): MonthlySummary[] {
  const map = new Map<string, { income: number; expense: number; categories: Map<string, CategoryBreakdownItem> }>();

  for (const t of transactions) {
    if (t.status === TransactionStatus.DELETED) continue;
    const d = DateUtil.toDate(t.date);
    if (!d) continue;

    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!map.has(key)) {
      map.set(key, { income: 0, expense: 0, categories: new Map() });
    }
    const entry  = map.get(key)!;
    const amount = Number(t.amount) || 0;

    if (t.type === TransactionType.INCOME) {
      entry.income += amount;
    } else if (t.type === TransactionType.EXPENSE) {
      entry.expense += amount;

      const catKey = t.category || 'Uncategorized';
      if (!entry.categories.has(catKey)) {
        entry.categories.set(catKey, {
          categoryId: catKey, categoryName: catKey,
          categoryIcon: 'category', categoryColor: '#9ca3af',
          amount: 0, percentage: 0, transactionCount: 0
        });
      }
      const cat = entry.categories.get(catKey)!;
      cat.amount += amount;
      cat.transactionCount += 1;
    }
  }

  const summaries: MonthlySummary[] = [];
  for (const [key, val] of map) {
    const [yearStr, monthStr] = key.split('-');
    const year     = parseInt(yearStr);
    const month    = parseInt(monthStr);
    const savings  = val.income - val.expense;

    const categories = Array.from(val.categories.values());
    if (val.expense > 0) {
      categories.forEach(c => (c.percentage = (c.amount / val.expense) * 100));
    }
    categories.sort((a, b) => b.amount - a.amount);

    summaries.push({
      month, year,
      label:             `${MONTHS[month]} ${year}`,
      income:            val.income,
      expense:           val.expense,
      savings,
      savingsRate:       val.income > 0 ? (savings / val.income) * 100 : 0,
      categoryBreakdown: categories
    });
  }

  summaries.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });

  return summaries;
}

// ─── Period Filtering ─────────────────────────────────────────────────────────

function computePeriodSummaries(
  transactions: Transaction[],
  monthlySummaries: MonthlySummary[],
  selectedPeriod: 'weekly' | 'monthly' | 'yearly',
  selectedYear: number,
  selectedMonth: number | null,
  selectedWeekOffset: number
) {
  let filteredHistory: MonthlySummary[] = [];

  if (selectedPeriod === 'yearly') {
    const yearGroups = new Map<number, MonthlySummary>();
    for (const m of monthlySummaries) {
      if (!yearGroups.has(m.year)) {
        yearGroups.set(m.year, {
          year: m.year, month: 0, label: m.year.toString(),
          income: 0, expense: 0, savings: 0, savingsRate: 0, categoryBreakdown: []
        });
      }
      const g = yearGroups.get(m.year)!;
      g.income  += m.income;
      g.expense += m.expense;
      g.savings += m.savings;
    }
    filteredHistory = Array.from(yearGroups.values())
      .map(g => ({ ...g, savingsRate: g.income > 0 ? (g.savings / g.income) * 100 : 0 }))
      .sort((a, b) => b.year - a.year);

  } else if (selectedPeriod === 'weekly') {
    const weekGroups = new Map<string, MonthlySummary & { date: Date }>();
    const yearTxns   = transactions.filter(t => {
      const d = DateUtil.toDate(t.date);
      return d && d.getFullYear() === selectedYear;
    });

    for (const t of yearTxns) {
      const d            = dayjs(DateUtil.toDate(t.date));
      const startOfWeek  = d.startOf('week');
      const key          = startOfWeek.format('YYYY-MM-DD');
      const amount       = Number(t.amount) || 0;

      if (!weekGroups.has(key)) {
        weekGroups.set(key, {
          label:             startOfWeek.format('D MMM'),
          income: 0, expense: 0, savings: 0, savingsRate: 0,
          categoryBreakdown: [],
          month:             startOfWeek.month(),
          year:              startOfWeek.year(),
          date:              startOfWeek.toDate()
        });
      }
      const g = weekGroups.get(key)!;
      if      (t.type === TransactionType.INCOME)  g.income  += amount;
      else if (t.type === TransactionType.EXPENSE)  g.expense += amount;
      g.savings = g.income - g.expense;
    }

    filteredHistory = Array.from(weekGroups.values())
      .map(g => ({ ...g, savingsRate: g.income > 0 ? (g.savings / g.income) * 100 : 0 }))
      .sort((a, b) => b.date.getTime() - a.date.getTime());

  } else {
    // monthly
    // We show all months of the selected year in the history table, even if a specific month is selected for summary cards.
    filteredHistory = monthlySummaries.filter(m => m.year === selectedYear);
  }

  return { filteredMonthlySummaries: filteredHistory };
}
