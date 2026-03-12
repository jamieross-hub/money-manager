/// <reference lib="webworker" />

import { Transaction } from '../util/models/transaction.model';
import { FamilyMember, FamilyStats, FamilyMemberStats, Settlement, BalanceEntry } from '../util/models/family.model';
import { TransactionStatus, TransactionType } from '../util/config/enums';
import { DateUtil } from '../util/helpers/date.util';

addEventListener('message', ({ data }) => {
  const { type, payload } = data;

  if (type === 'PROCESS_FAMILY_DATA') {
    const { transactions, members, settlements, currentUserId, sessionStartTime, fingerprint, fid, mode } = payload;
    
    const stats = computeStats(transactions, members, mode || 'common');
    const balances = computeBalances(transactions, members, settlements, mode || 'common');
    const activities = processActivities(transactions, settlements, members, currentUserId, sessionStartTime);

    postMessage({
      type: 'FAMILY_DATA_PROCESSED',
      payload: { stats, balances, activities, fingerprint, fid }
    });
  }
});

function computeStats(transactions: Transaction[], members: FamilyMember[], mode: 'common' | 'split'): FamilyStats {
  let totalIncome = 0;
  let totalExpense = 0;
  const memberMap = new Map<string, FamilyMemberStats>();
  const categoryMap = new Map<string, number>();

  // Init member breakdown
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

    // 1. Payment credit/debit (who physically handled the money)
    // For INCOME, the receiver now "owes" the group their share, so totalPaid decreases.
    const isIncome = tx.type === TransactionType.INCOME;
    if (tx.splitData?.paidByUserId === 'multiple' && tx.splitData.paidBy?.length) {
      tx.splitData.paidBy.forEach(p => {
        const mStats = memberMap.get(p.userId);
        if (mStats) {
          const pAmt = Number(p.amount) || 0;
          mStats.totalPaid += isIncome ? -pAmt : pAmt;
        }
      });
    } else {
      const payerId = tx.splitData?.paidByUserId || tx.userId;
      const mStats = memberMap.get(payerId);
      if (mStats) {
        mStats.totalPaid += isIncome ? -amount : amount;
      }
    }

    // 2. Share (who consumes the benefit)
    if (tx.splitData?.splitBetween && tx.splitData.splitBetween.length > 0) {
      tx.splitData.splitBetween.forEach(share => {
        const mStats = memberMap.get(share.userId);
        if (mStats) {
          const shareAmt = Number(share.amount) || 0;
          if (isIncome) mStats.totalIncome += shareAmt;
          else mStats.totalExpense += shareAmt;
        }
      });
    } else {
      // Default fallback based on group mode
      if (mode === 'common') {
        const shareAmt = Math.round((amount / activeMembers.length) * 100) / 100;
        activeMembers.forEach(m => {
          const mStats = memberMap.get(m.userId);
          if (mStats) {
            if (isIncome) mStats.totalIncome += shareAmt;
            else mStats.totalExpense += shareAmt;
          }
        });
      } else {
        // 'split' mode fallback: 100% share to recorder
        const mStats = memberMap.get(tx.userId);
        if (mStats) {
          if (isIncome) mStats.totalIncome += amount;
          else mStats.totalExpense += amount;
        }
      }
    }

    // Always count for the recorder
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

function computeBalances(
  transactions: Transaction[],
  members: FamilyMember[],
  settlements: Settlement[],
  mode: 'common' | 'split'
): BalanceEntry[] {
  const netBalances = new Map<string, number>();
  const activeMembers = members.filter(m => m.isActive);

  for (const m of members) {
    netBalances.set(m.userId, 0);
  }

  const updateBalance = (userId: string, amount: number) => {
    const current = netBalances.get(userId) || 0;
    netBalances.set(userId, Math.round((current + amount) * 100) / 100);
  };

  for (const tx of transactions) {
    if (tx.status === TransactionStatus.DELETED) continue;
    if (tx.category === 'Settlement' || tx.type === TransactionType.TRANSFER) continue;

    const txAmount = Number(tx.amount) || 0;
    if (txAmount <= 0) continue;

    const multiplier = tx.type === TransactionType.INCOME ? -1 : 1;

    // 1. Handle Debits (Shares)
    if (tx.splitData?.splitBetween && tx.splitData.splitBetween.length > 0) {
      for (const share of tx.splitData.splitBetween) {
        const shareAmt = Number(share.amount) || 0;
        updateBalance(share.userId, -shareAmt * multiplier);
      }
    } else if (mode === 'common') {
      const shareAmt = Math.round((txAmount / activeMembers.length) * 100) / 100;
      activeMembers.forEach(m => updateBalance(m.userId, -shareAmt * multiplier));
    } else {
      updateBalance(tx.userId, -txAmount * multiplier);
    }

    // 2. Handle Credits (Payments)
    if (tx.splitData?.paidByUserId === 'multiple' && tx.splitData.paidBy?.length) {
      for (const payer of tx.splitData.paidBy) {
        const payerAmt = Number(payer.amount) || 0;
        updateBalance(payer.userId, payerAmt * multiplier);
      }
    } else {
      const payerId = tx.splitData?.paidByUserId || tx.userId;
      updateBalance(payerId, txAmount * multiplier);
    }
  }

  for (const s of settlements) {
    const settleAmt = Number(s.amount) || 0;
    if (settleAmt <= 0) continue;
    updateBalance(s.fromUserId, settleAmt);
    updateBalance(s.toUserId, -settleAmt);
  }

  const creditors: { id: string; amount: number }[] = [];
  const debtors: { id: string; amount: number }[] = [];

  for (const [userId, amount] of netBalances.entries()) {
    const roundedAmount = Math.round(amount * 100) / 100;
    if (roundedAmount >= 0.01) creditors.push({ id: userId, amount: roundedAmount });
    else if (roundedAmount <= -0.01) debtors.push({ id: userId, amount: Math.abs(roundedAmount) });
  }

  const result: BalanceEntry[] = [];
  const memberMap = new Map(members.map(m => [m.userId, m]));

  while (debtors.length > 0 && creditors.length > 0) {
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const debtor = debtors[0];
    const creditor = creditors[0];
    const settleAmt = Math.min(debtor.amount, creditor.amount);
    const roundedSettleAmt = Math.round(settleAmt * 100) / 100;

    if (roundedSettleAmt < 0.01) break;

    const fromMember = memberMap.get(debtor.id);
    const toMember = memberMap.get(creditor.id);

    result.push({
      fromUserId: debtor.id,
      fromDisplayName: fromMember?.displayName ?? debtor.id,
      fromPhotoURL: fromMember?.photoURL,
      toUserId: creditor.id,
      toDisplayName: toMember?.displayName ?? creditor.id,
      toPhotoURL: toMember?.photoURL,
      amount: roundedSettleAmt,
    });

    debtor.amount = Math.round((debtor.amount - roundedSettleAmt) * 100) / 100;
    creditor.amount = Math.round((creditor.amount - roundedSettleAmt) * 100) / 100;

    if (debtor.amount < 0.01) debtors.shift();
    if (creditor.amount < 0.01) creditors.shift();
  }

  return result;
}

function processActivities(
  txns: Transaction[],
  settlements: Settlement[],
  mems: FamilyMember[],
  currentUid: string | undefined,
  sessionStartTime: number
): any[] {
  const memberMap = new Map(mems.map(m => [m.userId, m]));
  const allActivities: any[] = [];


  const getTime = (val: any) => {
    const d = DateUtil.toDate(val);
    return d ? d.getTime() : 0;
  };

  // 1. Transactions
  for (const tx of txns) {
    if (tx.category === 'Settlement' || tx.status === TransactionStatus.DELETED) continue;

    let payerId = tx.userId;
    let payerName = tx.userDisplayName || 'Unknown';
    let payerPhoto = tx.userPhotoURL;

    if (tx.splitData) {
      const pd = tx.splitData;
      if (pd.paidByUserId === 'multiple' || (pd.paidBy && pd.paidBy.length > 1)) {
        payerId = 'multiple';
        payerName = 'Multiple';
        payerPhoto = undefined;
      } else {
        payerId = (pd.paidBy && pd.paidBy.length === 1) ? pd.paidBy[0].userId : (pd.paidByUserId || tx.userId);
        const splitMember = memberMap.get(payerId);
        if (splitMember) {
          payerName = splitMember.displayName;
          payerPhoto = splitMember.photoURL;
        } else {
          payerName = pd.paidByDisplayName || tx.userDisplayName || 'Unknown';
          payerPhoto = pd.paidByPhotoURL || tx.userPhotoURL;
        }
      }
    }

    const sortTime = getTime(tx.date);
    const createdTime = getTime(tx.createdAt);

    allActivities.push({
      ...tx,
      payerId,
      payerName,
      payerPhoto,
      payerLabel: payerId === currentUid ? 'You' : payerName,
      _isIncome: tx.type === 'income' || (tx as any).type === 1, // Handle both enum and string
      _sortTime: sortTime,
      _createdTime: createdTime || sortTime,
      _trackId: tx.id || `tx_${payerId}_${sortTime}`,
      _popState: (createdTime > sessionStartTime && (Date.now() - createdTime) < 10000) ? 'new' : 'old'
    });
  }

  // 2. Settlements
  for (const set of settlements) {
    const date = set.settledAt || set.createdAt;
    const sortTime = getTime(date);
    const createdTime = getTime(set.createdAt);
    
    let _isIncome = false;
    if (currentUid === set.toUserId) _isIncome = true;
    else if (currentUid === set.fromUserId) _isIncome = false;
    else _isIncome = (set as any).type === 'income';

    const settlementId = set.id || `set_${set.fromUserId}_${set.toUserId}_${sortTime}`;

    allActivities.push({
      ...set,
      id: settlementId,
      category: 'Settlement',
      type: 'settlement',
      date,
      payerId: set.fromUserId,
      payerName: set.fromDisplayName,
      payerPhoto: set.fromPhotoURL,
      payerLabel: set.fromUserId === currentUid ? 'You' : set.fromDisplayName,
      recipientId: set.toUserId,
      recipientName: set.toDisplayName,
      recipientPhoto: set.toPhotoURL,
      note: set.note || 'Settlement',
      _isIncome,
      _sortTime: sortTime,
      _createdTime: createdTime || sortTime,
      _trackId: settlementId,
      _popState: (createdTime > sessionStartTime && (Date.now() - createdTime) < 10000) ? 'new' : 'old'
    });
  }

  // 3. Member Activities
  for (const m of mems) {
    const sortTime = getTime(m.joinedAt);
    const createdTime = getTime(m.joinedAt);
    
    // Safety check: if time is missing from joinedAt (e.g. 00:00:00), 
    // it will sort below transactions that have real times.
    
    allActivities.push({
      id: `mem_${m.userId}_${m.isActive ? 'join' : 'leave'}`,
      category: 'MemberActivity',
      type: m.isActive ? 'joined' : 'left',
      amount: 0,
      date: m.joinedAt,
      payerId: m.userId,
      payerName: m.displayName,
      payerPhoto: m.photoURL,
      payerLabel: m.userId === currentUid ? 'You' : m.displayName,
      note: `${m.userId === currentUid ? 'You' : m.displayName} ${m.isActive ? 'joined' : 'left'} the group`,
      _sortTime: sortTime,
      _createdTime: createdTime || sortTime,
      _trackId: `mem_${m.userId}_${m.isActive ? 'join' : 'leave'}_${sortTime}`,
      _popState: (createdTime > sessionStartTime) ? 'new' : 'old'
    });
  }


  return allActivities.sort((a, b) => {
    // 1. Primary Sort: Day Group (Descending)
    const dayA = new Date(a._sortTime).setHours(0, 0, 0, 0);
    const dayB = new Date(b._sortTime).setHours(0, 0, 0, 0);

    if (dayB !== dayA) {
      return dayB - dayA;
    }
    
    // 2. Same Day Tie-break: Put Member Activities at the TOP of that day
    // (Join/Leave events are prioritized "announcements" for the day)
    if (a.category === 'MemberActivity' && b.category !== 'MemberActivity') return -1;
    if (b.category === 'MemberActivity' && a.category !== 'MemberActivity') return 1;

    // 3. Sort by Time within category groups (Descending)
    if (b._sortTime !== a._sortTime) {
      return b._sortTime - a._sortTime;
    }

    // 4. Last fallback: Database creation time
    return (b._createdTime || 0) - (a._createdTime || 0);
  });
}
