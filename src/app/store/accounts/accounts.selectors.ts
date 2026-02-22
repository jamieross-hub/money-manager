import { createFeatureSelector, createSelector } from '@ngrx/store';
import { AccountsState } from './accounts.state';
import { AccountType, TransactionType } from 'src/app/util/config/enums';
import { LoanDetails } from 'src/app/util/models';
import * as TransactionsSelectors from '../transactions/transactions.selectors';

export const selectAccountsState = createFeatureSelector<AccountsState>('accounts');

export const selectAllAccountsRaw = createSelector(
  selectAccountsState,
  (state) => {
    // Only emit if there are actual accounts loaded
    if (!state.ids || state.ids.length === 0) {
      return [];
    }
    return state.ids.map(id => state.entities[id]).filter(account => account);
  }
);

/**
 * Enhanced selector that returns all accounts with derived loan logic applied.
 * This is the primary selector used by most components.
 */
export const selectAllAccounts = createSelector(
  selectAllAccountsRaw,
  TransactionsSelectors.selectAllTransactions,
  (accounts, allTransactions) => {
    return accounts.map(account => {
      if (account.type !== AccountType.LOAN || !account.loanDetails) {
        return account;
      }

      // Calculate balance strictly from transactions for loan accounts
      // to avoid issues with manual overwrites/mismatches.
      const loanAmount = account.loanDetails.loanAmount || 0;
      
      const accountTransactions = allTransactions.filter(t => 
        t.accountId === account.accountId && 
        !t.isPending && 
        t.status !== 'pending'
      );

      const netImpact = accountTransactions.reduce((sum, t) => {
        const amount = Number(t.amount) || 0;
        return sum + (t.type === TransactionType.INCOME ? amount : -amount);
      }, 0);

      const derivedBalance = -loanAmount + netImpact;
      const remainingBalance = Math.abs(derivedBalance);

      return {
        ...account,
        balance: derivedBalance, // Use the derived balance for display
        loanDetails: {
          ...account.loanDetails,
          remainingBalance,
          totalPaid: Math.max(0, loanAmount - remainingBalance)
        }
      };
    });
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
    return accounts.reduce((sum, account) => sum + (Number(account.balance) || 0), 0);
  }
);

export const selectTotalBalanceByType = (type: AccountType) => createSelector(
  selectAllAccounts,
  (accounts) => {
    if (!accounts) return 0;
    const filteredAccounts = accounts.filter(a => a.type === type);
    return filteredAccounts.reduce((sum, account) => sum + (Number(account.balance) || 0), 0);
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
      if (account.type === AccountType.LOAN || account.type === AccountType.CREDIT) {
        const balance = Number(account.balance) || 0;
        // Liability is the absolute value of the negative balance.
        return sum + (balance < 0 ? Math.abs(balance) : 0);
      }
      return sum;
    }, 0) || 0
);

export const selectAccountsByInstitution = (institution: string) => createSelector(
  selectAllAccounts,
  (accounts) => accounts?.filter(a => a.institution === institution) || []
);

// Derived Loan Selectors
export const selectLoanWithDerivedDetails = (accountId: string) => createSelector(
  selectAllAccounts,
  (accounts) => accounts.find(a => a.accountId === accountId)
);