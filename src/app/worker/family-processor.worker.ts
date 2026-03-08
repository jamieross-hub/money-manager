/// <reference lib="webworker" />

import { Transaction } from '../util/models/transaction.model';
import { FamilyMember, FamilyStats, FamilyMemberStats, Settlement, BalanceEntry } from '../util/models/family.model';
import { TransactionStatus, TransactionType } from '../util/config/enums';

addEventListener('message', ({ data }) => {
  const { type, payload } = data;

  if (type === 'PROCESS_FAMILY_DATA') {
    const { transactions, members, settlements, currentUserId, sessionStartTime, fingerprint } = payload;
    
    const stats = computeStats(transactions, members);
    const balances = computeBalances(transactions, members, settlements);
    const activities = processActivities(transactions, settlements, members, currentUserId, sessionStartTime);

    postMessage({
      type: 'FAMILY_DATA_PROCESSED',
      payload: { stats, balances, activities, fingerprint }
    });
  }
});

function computeStats(transactions: Transaction[], members: FamilyMember[]): FamilyStats {
  let totalIncome = 0;
  let totalExpense = 0;
  const memberMap = new Map<string, FamilyMemberStats>();

  // Init member breakdown
  members.forEach(m => {
    memberMap.set(m.userId, {
      userId: m.userId,
      displayName: m.displayName,
      photoURL: m.photoURL,
      totalIncome: 0,
      totalExpense: 0,
      netBalance: 0,
      transactionCount: 0,
      isActive: m.isActive,
    });
  });

  let transactionCount = 0;
  transactions.forEach(tx => {
    if (tx.status === TransactionStatus.DELETED) return;
    if (tx.category === 'Settlement') return;

    transactionCount++;
    if (tx.type === 'income') {
      totalIncome += tx.amount;
    } else {
      totalExpense += tx.amount;
    }

    if (tx.splitData?.splitBetween && tx.splitData.splitBetween.length > 0) {
      tx.splitData.splitBetween.forEach(share => {
        const mStats = memberMap.get(share.userId);
        if (mStats) {
          if (tx.type === 'income') mStats.totalIncome += share.amount;
          else mStats.totalExpense += share.amount;
        }
      });
      const recorderStats = memberMap.get(tx.userId);
      if (recorderStats) recorderStats.transactionCount++;
    } else {
      const memberStats = memberMap.get(tx.userId);
      if (memberStats) {
        if (tx.type === 'income') memberStats.totalIncome += tx.amount;
        else memberStats.totalExpense += tx.amount;
        memberStats.transactionCount++;
      }
    }
  });

  const memberBreakdown = Array.from(memberMap.values()).map(m => ({
    ...m,
    netBalance: m.totalIncome - m.totalExpense
  }));

  return {
    totalIncome,
    totalExpense,
    netBalance: totalIncome - totalExpense,
    transactionCount,
    memberBreakdown,
  };
}

function computeBalances(
  transactions: Transaction[],
  members: FamilyMember[],
  settlements: Settlement[]
): BalanceEntry[] {
  const netBalances = new Map<string, number>();

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
    if (!tx.splitData) continue;

    const { paidByUserId, splitBetween, paidBy } = tx.splitData;
    const multiplier = tx.type === TransactionType.INCOME ? -1 : 1;

    let totalSplit = 0;
    for (const share of splitBetween) {
      const shareAmt = Number(share.amount) || 0;
      totalSplit += shareAmt;
      updateBalance(share.userId, -shareAmt * multiplier);
    }

    if (paidByUserId === 'multiple' && paidBy?.length) {
      for (const payer of paidBy) {
        const payerAmt = Number(payer.amount) || 0;
        updateBalance(payer.userId, payerAmt * multiplier);
      }
    } else {
      updateBalance(paidByUserId, totalSplit * multiplier);
    }
  }

  for (const s of settlements) {
    const settleAmt = Number(s.amount) || 0;
    updateBalance(s.fromUserId, settleAmt);
    updateBalance(s.toUserId, -settleAmt);
  }

  const creditors: { id: string; amount: number }[] = [];
  const debtors: { id: string; amount: number }[] = [];

  for (const [userId, amount] of netBalances.entries()) {
    const roundedAmount = Math.round(amount * 100) / 100;
    if (roundedAmount >= 0.1) creditors.push({ id: userId, amount: roundedAmount });
    else if (roundedAmount <= -0.1) debtors.push({ id: userId, amount: Math.abs(roundedAmount) });
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
    if (!val) return 0;
    
    // Handle Firestore Timestamp
    if (typeof val === 'object' && 'seconds' in val) {
      return val.seconds * 1000;
    }
    
    // Handle Date object or ISO string
    const d = new Date(val);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  };

  // 1. Transactions
  for (const tx of txns) {
    if (tx.category === 'Settlement') continue;

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
      _isIncome: tx.type === TransactionType.INCOME,
      _sortTime: sortTime,
      _createdTime: createdTime,
      _trackId: tx.id || `tx_${Math.random()}_${sortTime}`,
      _popState: (createdTime > sessionStartTime) ? 'new' : 'old'
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

    allActivities.push({
      ...set,
      id: set.id || `set_${createdTime}`,
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
      _createdTime: createdTime,
      _trackId: set.id || `set_${Math.random()}_${sortTime}`,
      _popState: (createdTime > sessionStartTime) ? 'new' : 'old'
    });
  }

  // 3. Member Activities
  for (const m of mems) {
    const sortTime = getTime(m.joinedAt);
    const createdTime = getTime(m.joinedAt);
    
    allActivities.push({
      id: `mem_${m.userId}_${m.isActive ? 'join' : 'leave'}`,
      category: 'MemberActivity',
      type: m.isActive ? 'joined' : 'left',
      amount: 0,
      date: m.joinedAt,
      payerId: m.userId,
      payerName: m.displayName,
      payerPhoto: m.photoURL,
      payerLabel: m.displayName,
      note: `${m.displayName} ${m.isActive ? 'joined' : 'left'} the group`,
      _sortTime: sortTime,
      _createdTime: createdTime,
      _trackId: `mem_${m.userId}_${m.isActive ? 'join' : 'leave'}_${sortTime}`,
      _popState: (createdTime > sessionStartTime) ? 'new' : 'old'
    });
  }

  return allActivities.sort((a, b) => {
    if (b._sortTime !== a._sortTime) return b._sortTime - a._sortTime;
    return (b._createdTime || 0) - (a._createdTime || 0);
  });
}
