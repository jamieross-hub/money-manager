/// <reference lib="webworker" />

import { Transaction } from '../util/models/transaction.model';
import { FamilyMember, FamilyStats, FamilyMemberStats, Settlement, BalanceEntry } from '../util/models/family.model';
import { TransactionStatus, TransactionType } from '../util/config/enums';
import { DateUtil } from '../util/helpers/date.util';

// ─── Message Handler ─────────────────────────────────────────────────────────

addEventListener('message', ({ data }) => {
  const { type, payload } = data;

  if (type === 'PROCESS_FAMILY_DASHBOARD') {
    const {
      transactions, members, settlements, currentUserId,
      sessionStartTime, fingerprint, fid, mode
    } = payload;

    const startTime = performance.now();

    const stats            = computeStats(transactions, members, mode || 'common');
    const balances         = computeBalances(transactions, members, settlements, mode || 'common');
    const activities       = processActivities(transactions, settlements, members, currentUserId, sessionStartTime);
    const currentUserStats = computeCurrentUserStats(stats, balances, currentUserId);

    const durationMs = performance.now() - startTime;

    postMessage({
      type: 'FAMILY_DASHBOARD_PROCESSED',
      payload: { stats, balances, activities, currentUserStats, fingerprint, fid, durationMs }
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
  const memberMap  = new Map<string, FamilyMemberStats>();
  const categoryMap = new Map<string, number>();

  members.forEach(m => {
    memberMap.set(m.userId, {
      userId: m.userId,
      displayName: m.displayName,
      photoURL: m.photoURL,
      totalIncome: 0,
      totalExpense: 0,
      totalPaid: 0,
      actualPaid: 0,
      netBalance: 0,
      transactionCount: 0,
      paidCount: 0,
      isActive: m.isActive,
    });
  });

  const activeMembers = members.filter(m => m.isActive);
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

    // Payment credit / debit
    const isIncome = tx.type === TransactionType.INCOME;
    if (tx.splitData?.paidByUserId === 'multiple' && tx.splitData.paidBy?.length) {
      tx.splitData.paidBy.forEach(p => {
        const mStats = memberMap.get(p.userId);
        if (mStats) {
          const pAmt = Number(p.amount) || 0;
          const finalAmt = isIncome ? -pAmt : pAmt;
          mStats.totalPaid += finalAmt;
          mStats.actualPaid += finalAmt;
          mStats.paidCount++;
        }
      });
    } else {
      const payerId = tx.splitData?.paidByUserId || tx.userId;
      const mStats  = memberMap.get(payerId);
      if (mStats) {
        const finalAmt = isIncome ? -amount : amount;
        mStats.totalPaid += finalAmt;
        mStats.actualPaid += finalAmt;
        mStats.paidCount++;
      }
    }

    // Share (who consumes the benefit)
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
        const shareAmt = Math.round((amount / activeMembers.length) * 100) / 100;
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

// ─── Balances ────────────────────────────────────────────────────────────────

function computeBalances(
  transactions: Transaction[],
  members: FamilyMember[],
  settlements: Settlement[],
  mode: 'common' | 'split'
): BalanceEntry[] {
  const netBalances   = new Map<string, number>();
  const activeMembers = members.filter(m => m.isActive);

  for (const m of members) netBalances.set(m.userId, 0);

  const updateBalance = (userId: string, amount: number) => {
    const current = netBalances.get(userId) || 0;
    netBalances.set(userId, Math.round((current + amount) * 100) / 100);
  };

  for (const tx of transactions) {
    if (tx.status === TransactionStatus.DELETED) continue;
    if (tx.category === 'Settlement' || tx.type === TransactionType.TRANSFER) continue;

    const txAmount   = Number(tx.amount) || 0;
    if (txAmount <= 0) continue;
    const multiplier = tx.type === TransactionType.INCOME ? -1 : 1;

    if (tx.splitData?.splitBetween && tx.splitData.splitBetween.length > 0) {
      for (const share of tx.splitData.splitBetween) {
        updateBalance(share.userId, -(Number(share.amount) || 0) * multiplier);
      }
    } else if (mode === 'common') {
      const shareAmt = Math.round((txAmount / activeMembers.length) * 100) / 100;
      activeMembers.forEach(m => updateBalance(m.userId, -shareAmt * multiplier));
    } else {
      updateBalance(tx.userId, -txAmount * multiplier);
    }

    if (tx.splitData?.paidByUserId === 'multiple' && tx.splitData.paidBy?.length) {
      for (const payer of tx.splitData.paidBy) {
        updateBalance(payer.userId, (Number(payer.amount) || 0) * multiplier);
      }
    } else {
      const payerId = tx.splitData?.paidByUserId || tx.userId;
      updateBalance(payerId, txAmount * multiplier);
    }
  }

  for (const s of settlements) {
    const settleAmt = Number(s.amount) || 0;
    if (settleAmt <= 0) continue;
    updateBalance(s.fromUserId,  settleAmt);
    updateBalance(s.toUserId,   -settleAmt);
  }

  const creditors: { id: string; amount: number }[] = [];
  const debtors:   { id: string; amount: number }[] = [];

  for (const [userId, amount] of netBalances.entries()) {
    const rounded = Math.round(amount * 100) / 100;
    if (rounded >=  0.01) creditors.push({ id: userId, amount:  rounded });
    if (rounded <= -0.01) debtors.push(  { id: userId, amount:  Math.abs(rounded) });
  }

  const result:    BalanceEntry[] = [];
  const memberMap  = new Map(members.map(m => [m.userId, m]));

  while (debtors.length > 0 && creditors.length > 0) {
    debtors.sort  ((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const debtor   = debtors[0];
    const creditor = creditors[0];
    const rounded  = Math.round(Math.min(debtor.amount, creditor.amount) * 100) / 100;

    if (rounded < 0.01) break;

    result.push({
      fromUserId:      debtor.id,
      fromDisplayName: memberMap.get(debtor.id)?.displayName   ?? debtor.id,
      fromPhotoURL:    memberMap.get(debtor.id)?.photoURL,
      toUserId:        creditor.id,
      toDisplayName:   memberMap.get(creditor.id)?.displayName ?? creditor.id,
      toPhotoURL:      memberMap.get(creditor.id)?.photoURL,
      amount:          rounded,
    });

    debtor.amount   = Math.round((debtor.amount   - rounded) * 100) / 100;
    creditor.amount = Math.round((creditor.amount - rounded) * 100) / 100;

    if (debtor.amount   < 0.01) debtors.shift();
    if (creditor.amount < 0.01) creditors.shift();
  }

  return result;
}

// ─── Activities ──────────────────────────────────────────────────────────────

function processActivities(
  txns: Transaction[],
  settlements: Settlement[],
  mems: FamilyMember[],
  currentUid: string | undefined,
  sessionStartTime: number
): any[] {
  const memberMap = new Map(mems.map(m => [m.userId, m]));
  const all: any[] = [];

  const getTime = (val: any) => {
    const d = DateUtil.toDate(val);
    return d ? d.getTime() : 0;
  };

  // Transactions
  for (const tx of txns) {
    if (tx.category === 'Settlement' || tx.status === TransactionStatus.DELETED) continue;

    let payerId   = tx.userId;
    let payerName = tx.userDisplayName || 'Unknown';
    let payerPhoto = tx.userPhotoURL;

    if (tx.splitData) {
      const pd = tx.splitData;
      if (pd.paidByUserId === 'multiple' || (pd.paidBy && pd.paidBy.length > 1)) {
        payerId   = 'multiple';
        payerName = 'Multiple';
        payerPhoto = undefined;
      } else {
        payerId = (pd.paidBy && pd.paidBy.length === 1) ? pd.paidBy[0].userId : (pd.paidByUserId || tx.userId);
        const sm = memberMap.get(payerId);
        if (sm) {
          payerName  = sm.displayName;
          payerPhoto = sm.photoURL;
        } else {
          payerName  = pd.paidByDisplayName || tx.userDisplayName || 'Unknown';
          payerPhoto = pd.paidByPhotoURL    || tx.userPhotoURL;
        }
      }
    }

    const sortTime    = getTime(tx.createdAt);
    const createdTime = getTime(tx.createdAt);

    all.push({
      ...tx,
      payerId,
      payerName,
      payerPhoto,
      payerLabel:    payerId === currentUid ? 'You' : payerName,
      _isIncome:     tx.type === 'income' || (tx as any).type === 1,
      _sortTime:     sortTime,
      _createdTime:  createdTime || sortTime,
      _trackId:      tx.id || `tx_${payerId}_${sortTime}`,
      _popState:     (createdTime > sessionStartTime && (Date.now() - createdTime) < 10000) ? 'new' : 'old'
    });
  }

  // Settlements
  for (const s of settlements) {
    const date        = s.settledAt || s.createdAt;
    const sortTime    = getTime(date);
    const createdTime = getTime(s.createdAt);

    let _isIncome = false;
    if (currentUid === s.toUserId)        _isIncome = true;
    else if (currentUid === s.fromUserId) _isIncome = false;
    else                                  _isIncome = (s as any).type === 'income';

    const sid = s.id || `set_${s.fromUserId}_${s.toUserId}_${sortTime}`;

    all.push({
      ...s,
      id:            sid,
      category:      'Settlement',
      type:          'settlement',
      date,
      payerId:       s.fromUserId,
      payerName:     s.fromDisplayName,
      payerPhoto:    s.fromPhotoURL,
      payerLabel:    s.fromUserId === currentUid ? 'You' : s.fromDisplayName,
      recipientId:   s.toUserId,
      recipientName: s.toDisplayName,
      recipientPhoto: s.toPhotoURL,
      note:          s.note || 'Settlement',
      _isIncome,
      _sortTime:     sortTime,
      _createdTime:  createdTime || sortTime,
      _trackId:      sid,
      _popState:     (createdTime > sessionStartTime && (Date.now() - createdTime) < 10000) ? 'new' : 'old'
    });
  }

  // Member Activities
  for (const m of mems) {
    const sortTime    = getTime(m.joinedAt);
    const createdTime = getTime(m.joinedAt);
    all.push({
      id:         `mem_${m.userId}_${m.isActive ? 'join' : 'leave'}`,
      category:   'MemberActivity',
      type:       m.isActive ? 'joined' : 'left',
      amount:     0,
      date:       m.joinedAt,
      payerId:    m.userId,
      payerName:  m.displayName,
      payerPhoto: m.photoURL,
      payerLabel: m.userId === currentUid ? 'You' : m.displayName,
      note:       `${m.userId === currentUid ? 'You' : m.displayName} ${m.isActive ? 'joined' : 'left'} the group`,
      _sortTime:    sortTime,
      _createdTime: createdTime || sortTime,
      _trackId:   `mem_${m.userId}_${m.isActive ? 'join' : 'leave'}_${sortTime}`,
      _popState:  (createdTime > sessionStartTime) ? 'new' : 'old'
    });
  }

  return all.sort((a, b) => {
    const diff = (b._sortTime || 0) - (a._sortTime || 0);
    return diff !== 0 ? diff : (b._createdTime || 0) - (a._createdTime || 0);
  });
}

// ─── Current-User Stats ───────────────────────────────────────────────────────

function computeCurrentUserStats(
  stats: FamilyStats,
  balances: BalanceEntry[],
  currentUserId?: string
) {
  if (!currentUserId) {
    return { currentUserExpense: 0, currentUserSharePercentage: 0, myNetSettleBalance: 0, currentUserPaid: 0 };
  }

  const memberStats             = stats.memberBreakdown.find(m => m.userId === currentUserId);
  const currentUserExpense      = memberStats?.totalExpense ?? 0;
  const currentUserPaid         = memberStats?.totalPaid    ?? 0;
  const currentUserSharePercentage =
    stats.totalExpense > 0 ? (currentUserExpense / stats.totalExpense) * 100 : 0;

  let owedByMe = 0;
  let owedToMe = 0;
  for (const b of balances) {
    if (b.fromUserId === currentUserId) owedByMe += b.amount;
    if (b.toUserId   === currentUserId) owedToMe += b.amount;
  }

  return {
    currentUserExpense,
    currentUserSharePercentage,
    myNetSettleBalance: owedToMe - owedByMe,
    currentUserPaid
  };
}
