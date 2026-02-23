import { createFeatureSelector, createSelector } from '@ngrx/store';
import { TransactionsState } from './transactions.state';
import { Timestamp } from '@angular/fire/firestore';
import { TransactionType, TransactionStatus } from '../../util/config/enums';

export const selectTransactionsState = createFeatureSelector<TransactionsState>('transactions');

// Base selectors
export const selectAllTransactions = createSelector(
  selectTransactionsState,
  (state) => state.ids.map(id => state.entities[id]).filter(Boolean)
);

export const selectTransactionsLoading = createSelector(
  selectTransactionsState,
  (state) => state.loading
);

export const selectTransactionsError = createSelector(
  selectTransactionsState,
  (state) => state.error
);

export const selectSelectedTransactionId = createSelector(
  selectTransactionsState,
  (state) => state.selectedTransactionId
);

export const selectSelectedTransaction = createSelector(
  selectTransactionsState,
  selectSelectedTransactionId,
  (state, selectedId) => selectedId ? state.entities[selectedId] : null
);

export const selectTransactionById = (transactionId: string) => createSelector(
  selectTransactionsState,
  (state) => state.entities[transactionId]
);

// Helper function to convert Timestamp to Date
const convertToDate = (date: Date | Timestamp): Date => {
  if (date instanceof Timestamp) {
    return new Date(date.seconds * 1000);
  }
  return date instanceof Date ? date : new Date(date);
};

// Helper function to check if date is within range
const isDateInRange = (transactionDate: Date | Timestamp, startDate: Date | Timestamp, endDate: Date | Timestamp): boolean => {
  const txDate = convertToDate(transactionDate);
  const start = convertToDate(startDate);
  const end = convertToDate(endDate);
  return txDate >= start && txDate <= end;
};

// Helper function to check if date is in specific month/year
const isDateInMonth = (transactionDate: Date | Timestamp, month: number, year: number): boolean => {
  const txDate = convertToDate(transactionDate);
  return txDate.getMonth() === month && txDate.getFullYear() === year;
};

// Filtered selectors with proper typing
export const selectTransactionsByAccount = (accountId: string) => createSelector(
  selectAllTransactions,
  (transactions) => transactions.filter(t => t.accountId === accountId)
);

export const selectTransactionsByCategory = (category: string) => createSelector(
  selectAllTransactions,
  (transactions) => transactions.filter(t => t.category === category)
);

export const selectTransactionsByType = (type: TransactionType) => createSelector(
  selectAllTransactions,
  (transactions) => transactions.filter(t => t.type === type)
);

export const selectTransactionsByDateRange = (startDate: Date | Timestamp, endDate: Date | Timestamp) => createSelector(
  selectAllTransactions,
  (transactions) => transactions.filter(t => {
    if (!t.date) return false;
    return isDateInRange(t.date, startDate, endDate);
  })
);

// Income selectors
export const selectIncomeTransactions = createSelector(
  selectAllTransactions,
  (transactions) => transactions.filter(t => t.type === TransactionType.INCOME)
);

export const selectTotalIncome = createSelector(
  selectIncomeTransactions,
  (transactions) => transactions.reduce((sum, t) => sum + t.amount, 0)
);

export const selectTotalIncomeByMonth = (month: number, year: number) => createSelector(
  selectIncomeTransactions,
  (transactions) => transactions
    .filter(t => t.date && isDateInMonth(t.date, month, year))
    .reduce((sum, t) => sum + t.amount, 0)
);

// Expense selectors
export const selectExpenseTransactions = createSelector(
  selectAllTransactions,
  (transactions) => transactions.filter(t => t.type === TransactionType.EXPENSE)
);

export const selectTotalExpenses = createSelector(
  selectExpenseTransactions,
  (transactions) => transactions.reduce((sum, t) => sum + t.amount, 0)
);

export const selectTotalExpensesByMonth = (month: number, year: number) => createSelector(
  selectExpenseTransactions,
  (transactions) => transactions
    .filter(t => t.date && isDateInMonth(t.date, month, year))
    .reduce((sum, t) => sum + t.amount, 0)
);

// Transfer selectors
export const selectTransferTransactions = createSelector(
  selectAllTransactions,
  (transactions) => transactions.filter(t => t.type === TransactionType.TRANSFER)
);

export const selectTotalTransfers = createSelector(
  selectTransferTransactions,
  (transactions) => transactions.reduce((sum, t) => sum + t.amount, 0)
);

// Balance calculations
export const selectNetBalance = createSelector(
  selectTotalIncome,
  selectTotalExpenses,
  (income, expenses) => income - expenses
);

export const selectNetBalanceByMonth = (month: number, year: number) => createSelector(
  selectTotalIncomeByMonth(month, year),
  selectTotalExpensesByMonth(month, year),
  (income, expenses) => income - expenses
);

// Latest completed transaction
export const selectLatestCompletedTransaction = createSelector(
  selectAllTransactions,
  (transactions) => {
    if (!transactions.length) return null;
    
    return transactions
      .filter(t => t.date && t.status === TransactionStatus.COMPLETED)
      .sort((a, b) => {
        const dateA = convertToDate(a.date!);
        const dateB = convertToDate(b.date!);
        return dateB.getTime() - dateA.getTime(); // Latest first
      })[0] || null;
  }
);

// Latest transaction with proper sorting (any status)
export const selectLatestTransaction = createSelector(
  selectAllTransactions,
  (transactions) => {
    if (!transactions.length) return null;
    
    return transactions
      .filter(t => t.date)
      .sort((a, b) => {
        const dateA = convertToDate(a.date!);
        const dateB = convertToDate(b.date!);
        return dateB.getTime() - dateA.getTime(); // Latest first
      })[0] || null;
  }
);

// Recent transactions (last N days)
export const selectRecentTransactions = (days: number = 30) => createSelector(
  selectAllTransactions,
  (transactions) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return transactions
      .filter(t => t.date && convertToDate(t.date) >= cutoffDate)
      .sort((a, b) => {
        const dateA = convertToDate(a.date!);
        const dateB = convertToDate(b.date!);
        return dateB.getTime() - dateA.getTime();
      });
  }
);

// Category summaries
export const selectCategorySummaries = createSelector(
  selectAllTransactions,
  (transactions) => {
    const categoryMap = new Map<string, { categoryId: string; categoryName: string; totalAmount: number; transactionCount: number }>();
    
    transactions.forEach(t => {
      const key = t.categoryId;
      if (!categoryMap.has(key)) {
        categoryMap.set(key, {
          categoryId: t.categoryId,
          categoryName: t.category,
          totalAmount: 0,
          transactionCount: 0
        });
      }
      
      const summary = categoryMap.get(key)!;
      summary.totalAmount += t.amount;
      summary.transactionCount += 1;
    });
    
    return Array.from(categoryMap.values())
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }
);

// Account summaries
export const selectAccountSummaries = createSelector(
  selectAllTransactions,
  (transactions) => {
    const accountMap = new Map<string, { accountId: string; totalAmount: number; transactionCount: number }>();
    
    transactions.forEach(t => {
      const key = t.accountId;
      if (!accountMap.has(key)) {
        accountMap.set(key, {
          accountId: t.accountId,
          totalAmount: 0,
          transactionCount: 0
        });
      }
      
      const summary = accountMap.get(key)!;
      summary.totalAmount += t.amount;
      summary.transactionCount += 1;
    });
    
    return Array.from(accountMap.values())
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }
);

// Tax calculations
export const selectTotalTaxAmount = createSelector(
  selectAllTransactions,
  (transactions) => transactions.reduce((sum, t) => sum + (t.taxAmount || 0), 0)
);

export const selectTaxAmountByMonth = (month: number, year: number) => createSelector(
  selectAllTransactions,
  (transactions) => transactions
    .filter(t => t.date && isDateInMonth(t.date, month, year))
    .reduce((sum, t) => sum + (t.taxAmount || 0), 0)
);

// Pending transactions
export const selectPendingTransactions = createSelector(
  selectAllTransactions,
  (transactions) => transactions.filter(t => t.status === 'pending')
);

// Recurring transactions
export const selectRecurringTransactions = createSelector(
  selectAllTransactions,
  (transactions) => transactions.filter(t => t.isRecurring === true)
);