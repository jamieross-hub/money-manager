import { createFeatureSelector, createSelector } from '@ngrx/store';
import { TransactionsState } from './transactions.state';
import { Timestamp } from '@angular/fire/firestore';
import { TransactionType, TransactionStatus, SyncStatus } from '../../util/config/enums';
import * as ProfileSelectors from '../profile/profile.selectors';
import * as FamilySelectors from '../../modules/family/store/family.selectors';
import { Transaction } from '../../util/models/transaction.model';
import { RecurringTemplate } from '../../util/models/recurring.model';
import { DateService } from '../../util/service/date.service';

const dateService = new DateService();

export const selectTransactionsState = createFeatureSelector<TransactionsState>('transactions');

// Base selectors
export const selectAllTransactions = createSelector(
  selectTransactionsState,
  ProfileSelectors.selectIsFamilyMode,
  FamilySelectors.selectFamilyTransactions,
  FamilySelectors.selectFamily,
  (state, isFamilyMode, familyTransactions, activeFamily) => {
    if (isFamilyMode) {
      // In family mode, we trust the familyTransactions slice which is populated 
      // via the efficient familyId index in the service layer.
      const seenSettlements = new Set();
      return (familyTransactions || []).filter(t => {
        if (t.settlementId) {
          if (seenSettlements.has(t.settlementId)) return false;
          seenSettlements.add(t.settlementId);
        }
        return true;
      });
    }

    // Personal mode: Return personal entities (already userId-filtered by service)
    return state.ids
      .map(id => state.entities[id])
      .filter(Boolean)
      .filter(t => t.status !== TransactionStatus.DELETED || t.syncStatus === SyncStatus.PENDING);
  }
);

export const selectDeletedTransactions = createSelector(
  selectTransactionsState,
  ProfileSelectors.selectIsFamilyMode,
  FamilySelectors.selectRawFamilyTransactions,
  FamilySelectors.selectFamily,
  (state, isFamilyMode, familyTransactions, activeFamily) => {
    if (isFamilyMode) {
      return (familyTransactions || []).filter(t => t.status === TransactionStatus.DELETED);
    }
    
    return state.ids
      .map(id => state.entities[id])
      .filter(Boolean)
      .filter(t => t.status === TransactionStatus.DELETED);
  }
);

export const selectSortedDeletedTransactions = createSelector(
  selectDeletedTransactions,
  (transactions) => dateService.sortByDate(transactions, 'date', false)
);

export const selectSortedAllTransactions = createSelector(
  selectAllTransactions,
  (transactions) => dateService.sortByDate(transactions, 'date', false)
);

export const selectTransactionsLoading = createSelector(
  selectTransactionsState,
  ProfileSelectors.selectIsFamilyMode,
  FamilySelectors.selectFamilyLoading,
  (state, isFamilyMode, familyLoading) => isFamilyMode ? familyLoading : state.loading
);

export const selectTransactionsError = createSelector(
  selectTransactionsState,
  ProfileSelectors.selectIsFamilyMode,
  FamilySelectors.selectFamilyError,
  (state, isFamilyMode, familyError) => isFamilyMode ? familyError : state.error
);

export const selectSelectedTransactionId = createSelector(
  selectTransactionsState,
  (state) => state.selectedTransactionId
);

export const selectSelectedTransaction = createSelector(
  selectAllTransactions,
  selectSelectedTransactionId,
  (transactions, selectedId) => selectedId ? transactions.find(t => t.id === selectedId) || null : null
);

export const selectTransactionById = (transactionId: string) => createSelector(
  selectAllTransactions,
  (transactions) => transactions.find(t => t.id === transactionId)
);

// Helper function to convert Timestamp to Date
const convertToDate = (date: any): Date => {
  return dateService.toDate(date) || new Date(0);
};

// Helper function to check if date is within range
const isDateInRange = (transactionDate: Date | Timestamp, startDate: Date | Timestamp, endDate: Date | Timestamp): boolean => {
  return dateService.isInRange(transactionDate, startDate, endDate);
};

// Helper function to check if date is in specific month/year
const isDateInMonth = (transactionDate: Date | Timestamp, month: number, year: number): boolean => {
  return dateService.isInMonth(transactionDate, month, year);
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
    const completed = transactions.filter(t => t.date && t.status === TransactionStatus.COMPLETED);
    return dateService.sortByDate(completed, 'date', false)[0] || null;
  }
);

// Latest transaction with proper sorting (any status)
export const selectLatestTransaction = createSelector(
  selectAllTransactions,
  (transactions) => {
    const withDate = transactions.filter(t => t.date);
    return dateService.sortByDate(withDate, 'date', false)[0] || null;
  }
);

// Recent transactions (last N days)
export const selectRecentTransactions = (days: number = 30) => createSelector(
  selectAllTransactions,
  (transactions) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const recent = transactions.filter(t => t.date && convertToDate(t.date) >= cutoffDate);
    return dateService.sortByDate(recent, 'date', false);
  }
);

// Category summaries
export const selectCategorySummaries = createSelector(
  selectAllTransactions,
  (transactions) => {
    const categoryMap = new Map<string, { categoryId: string; categoryName: string; totalAmount: number; transactionCount: number }>();
    
    transactions.forEach((t) => {
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
    
    transactions.forEach((t) => {
      const key = t.accountId || 'unassigned';
      if (!accountMap.has(key)) {
        accountMap.set(key, {
          accountId: key,
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

// Recurring templates
export const selectRecurringTemplates = createSelector(
  selectTransactionsState,
  (state) => state.recurringTemplates || []
);

export const selectRecurringLoading = createSelector(
  selectTransactionsState,
  (state) => state.recurringLoading
);

// Combined Recurring transactions (template + any marked in regular tx)
export const selectRecurringTransactions = createSelector(
  selectRecurringTemplates,
  (templates) => {
    return templates;
  }
);