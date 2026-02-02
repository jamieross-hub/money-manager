import { createFeatureSelector, createSelector } from '@ngrx/store';
import { AccountsState } from './accounts.state';
import { AccountType } from 'src/app/util/config/enums';
import { LoanDetails } from 'src/app/util/models';

export const selectAccountsState = createFeatureSelector<AccountsState>('accounts');

export const selectAllAccounts = createSelector(
  selectAccountsState,
  (state) => {
    // Only emit if there are actual accounts loaded
    if (!state.ids || state.ids.length === 0) {
      return [];
    }
    return state.ids.map(id => state.entities[id]).filter(account => account);
  }
);

export const selectAccountsLoading = createSelector(
  selectAccountsState,
  (state) => state.loading
);

export const selectAccountsError = createSelector(
  selectAccountsState,
  (state) => state.error
);

export const selectSelectedAccountId = createSelector(
  selectAccountsState,
  (state) => state.selectedAccountId
);

export const selectSelectedAccount = createSelector(
  selectAccountsState,
  selectSelectedAccountId,
  (state, selectedId) => selectedId ? state.entities[selectedId] : null
);

export const selectAccountById = (accountId: string) => createSelector(
  selectAccountsState,
  (state) => state.entities[accountId]
);

export const selectAccountsByType = (type: 'bank' | 'cash' | 'credit' | 'loan') => createSelector(
  selectAllAccounts,
  (accounts) => accounts?.filter(a => a.type === type) || []
);

export const selectActiveAccounts = createSelector(
  selectAllAccounts,
  (accounts) => accounts?.filter(a => a.isActive !== false) || []
);

export const selectTotalBalance = createSelector(
  selectAllAccounts,
  (accounts) => {
    if (!accounts) return 0;
    const totalBalance = accounts.reduce((sum, account) => {
      if (account.type === AccountType.LOAN) {
        const loanDetails = account.loanDetails as LoanDetails;
        return sum - loanDetails.remainingBalance;
      }
      return sum + account.balance;
    }, 0);
    return totalBalance;
  }
);

export const selectTotalBalanceByType = (type: AccountType) => createSelector(
  selectAllAccounts,
  (accounts) => {
    if (!accounts) return 0;
    const filteredAccounts = accounts.filter(a => a.type === type);
    return filteredAccounts.reduce((sum, account) => {
      if (account.type === AccountType.LOAN) {
        return sum + (account.loanDetails?.remainingBalance || 0);
      }
      return sum + account.balance;
    }, 0);
  }
);

export const selectTotalAssets = createSelector(
  selectAllAccounts,
  (accounts) => accounts
    // Include all accounts except LOAN. 
    // For CREDIT, only include if balance is positive (asset/overpayment).
    // For others (BANK, CASH, INVESTMENT), assume positive/negative reflects net worth directly (including negative bank balance as "debt" but technically it reduces asset total here or should move to liability? 
    // Standard approach: Sum of all positive asset-type accounts + positive credit accounts.
    ?.reduce((sum, account) => {
      if (account.type === AccountType.LOAN) return sum;
      if (account.type === AccountType.CREDIT) {
        return sum + (account.balance > 0 ? account.balance : 0);
      }
      return sum + account.balance;
    }, 0) || 0
);

export const selectTotalLiabilities = createSelector(
  selectAllAccounts,
  (accounts) => accounts
    ?.reduce((sum, account) => {
      if (account.type === AccountType.LOAN) {
        return sum + (account.loanDetails?.remainingBalance || 0);
      }
      if (account.type === AccountType.CREDIT) {
        // If balance is negative, it's a liability. Add absolute value to total liabilities.
        return sum + (account.balance < 0 ? Math.abs(account.balance) : 0);
      }
      return sum;
    }, 0) || 0
);

export const selectAccountsByInstitution = (institution: string) => createSelector(
  selectAllAccounts,
  (accounts) => accounts?.filter(a => a.institution === institution) || []
); 