import { createFeatureSelector, createSelector } from '@ngrx/store';
import { AccountsState } from './accounts.state';
import { AccountType, TransactionType } from 'src/app/util/config/enums';
import { LoanDetails } from 'src/app/util/models';

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
  (state: any) => state.transactions?.entities || {},
  (accounts, transactionEntities) => {
    const allTransactions = Object.values(transactionEntities) as any[];
    
    return accounts.map(account => {
      if (account.type !== AccountType.LOAN || !account.loanDetails) {
        return account;
      }

      // Find all transactions where this account is involved (source, destination, or primary account)
      const accountTransactions = allTransactions.filter(t => 
        t.accountId === account.accountId || 
        t.toAccountId === account.accountId || 
        t.fromAccountId === account.accountId
      );

      const loanAmount = account.loanDetails.loanAmount || 0;

      // Repayments: Income to this account OR transfers TO this account
      const repayments = accountTransactions.filter((t: any) => 
        (t.type === TransactionType.INCOME && t.accountId === account.accountId) || 
        (t.type === TransactionType.TRANSFER && t.toAccountId === account.accountId)
      );
      const totalPaid = repayments.reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);

      // Additional Borrowing: Expenses from this account OR transfers FROM this account
      const borrowing = accountTransactions.filter((t: any) => 
        (t.type === TransactionType.EXPENSE && t.accountId === account.accountId) || 
        (t.type === TransactionType.TRANSFER && t.fromAccountId === account.accountId)
      );
      const additionalBorrowing = borrowing.reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);

      const remainingBalance = Math.max(0, loanAmount - totalPaid + additionalBorrowing);

      return {
        ...account,
        loanDetails: {
          ...account.loanDetails,
          remainingBalance,
          totalPaid
        },
        // Also update the general balance for consistency across UI (e.g. Liability lists)
        balance: -remainingBalance
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
    const totalBalance = accounts.reduce((sum, account) => {
      if (account.type === AccountType.LOAN) {
        const loanDetails = account.loanDetails;
        return sum - (loanDetails?.remainingBalance || 0);
      }
      return sum + (account.balance || 0);
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

// Derived Loan Selectors
export const selectLoanWithDerivedDetails = (accountId: string) => createSelector(
  selectAllAccounts,
  (accounts) => accounts.find(a => a.accountId === accountId)
);