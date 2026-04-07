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
      transactions, allTransactions, members, mode, fingerprint, fid,
      selectedPeriod, selectedYear, selectedMonth, selectedWeekOffset
    } = payload;

    const startTime = performance.now();

    // Compute stats from period-filtered transactions
    const stats = computeStats(transactions || [], members || [], mode || 'common');

    // Always build full history from all transactions
    const fullTransactions    = allTransactions || transactions;
    const monthlySummaries    = buildMonthlySummaries(fullTransactions);

    const { filteredMonthlySummaries } = computePeriodSummaries(
      fullTransactions,
      monthlySummaries,
      selectedPeriod    || 'monthly',
      selectedYear      || new Date().getFullYear(),
      selectedMonth     ?? null,
      selectedWeekOffset || 0
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

// ─── Stats ───────────────────────────────────────────────────────────────────

function computeStats(
  transactions: Transaction[],
  members: FamilyMember[],
  mode: 'common' | 'split'
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

  return {
    totalIncome,
    totalExpense,
    netBalance: Math.round((totalIncome - totalExpense) * 100) / 100,
    transactionCount,
    memberBreakdown,
    categoryBreakdown,
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
    filteredHistory = monthlySummaries.filter(m => m.year === selectedYear);
    if (selectedMonth !== null) {
      filteredHistory = filteredHistory.filter(m => m.month === selectedMonth);
    }
  }

  return { filteredMonthlySummaries: filteredHistory };
}
