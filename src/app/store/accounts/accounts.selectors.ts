import { createFeatureSelector, createSelector } from '@ngrx/store';
import { AccountsState } from './accounts.state';
import { AccountType, TransactionType } from 'src/app/util/config/enums';
import { Account } from 'src/app/util/models/account.model';
import * as TransactionsSelectors from '../transactions/transactions.selectors';

export const selectAccountsState = createFeatureSelector<AccountsState>('accounts');

/** Active context (personal | family) */
export const selectActiveContext = createSelector(
  selectAccountsState,
  (state) => state.activeContext
);

/** Active bucket (the personal or family entity map, depending on mode) */
export const selectActiveBucket = createSelector(
  selectAccountsState,
  (state) => state[state.activeContext]
);

export const selectAllAccountsRaw = createSelector(
  selectActiveBucket,
  (bucket): Account[] => {
    if (!bucket.ids || bucket.ids.length === 0) return [];
    return bucket.ids
      .map(id => bucket.entities[id])
      .filter((a): a is Account => !!a);
  }
);

/**
 * Memoized loan impact map: accountId → net balance impact from all completed transactions.
 * Split from selectAllAccounts so the O(N) transaction scan is only re-run when
 * transactions actually change — NOT on every account update (e.g. mode switch).
 */
export const selectLoanImpactMap = createSelector(
  TransactionsSelectors.selectAllTransactions,
  (allTransactions): Map<string, number> => {
    const loanImpacts = new Map<string, number>();
    allTransactions.forEach(t => {
      if (t.isPending || t.status === 'pending' || !t.accountId) return;
      const current = loanImpacts.get(t.accountId) || 0;
      const amount = Number(t.amount) || 0;
      const impact = t.type === TransactionType.INCOME ? amount : -amount;
      loanImpacts.set(t.accountId, current + impact);
    });
    return loanImpacts;
  }
);

/**
 * Enhanced selector that returns all accounts with derived loan logic applied.
 * Uses the memoized selectLoanImpactMap — the transaction scan is NOT repeated
 * when only accounts change (e.g. after a mode switch).
 */
export const selectAllAccounts = createSelector(
  selectAllAccountsRaw,
  selectLoanImpactMap,
  (accounts, loanImpacts): Account[] => {
    return accounts.map(account => {
      if (account.type !== AccountType.LOAN || !account.loanDetails) {
        return account;
      }

      const loanAmount = account.loanDetails.loanAmount || 0;
      const netImpact = loanImpacts.get(account.accountId) || 0;
      const derivedBalance = -loanAmount - netImpact;
      const remainingBalance = Math.abs(derivedBalance);

      return {
        ...account,
        balance: derivedBalance,
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
  selectActiveBucket,
  selectSelectedAccountId,
  (bucket, selectedId) => selectedId ? bucket.entities[selectedId] : null
);

export const selectAccountById = (accountId: string) => createSelector(
  selectActiveBucket,
  (bucket) => bucket.entities[accountId]
);

export const selectAccountsByType = (type: 'bank' | 'cash' | 'credit' | 'loan') => createSelector(
  selectAllAccounts,
  (accounts) => accounts.filter(a => a.type === type)
);

export const selectActiveAccounts = createSelector(
  selectAllAccounts,
  (accounts) => accounts.filter(a => a.isActive !== false)
);

export const selectTotalBalance = createSelector(
  selectAllAccounts,
  (accounts) => accounts.reduce((sum, account) => sum + (Number(account.balance) || 0), 0)
);

export const selectTotalBalanceByType = (type: AccountType) => createSelector(
  selectAllAccounts,
  (accounts) => accounts
    .filter(a => a.type === type)
    .reduce((sum, account) => sum + (Number(account.balance) || 0), 0)
);

export const selectTotalAssets = createSelector(
  selectAllAccounts,
  (accounts) => accounts.reduce((sum, account) => {
    if (account.type === AccountType.LOAN) return sum;
    if (account.type === AccountType.CREDIT) {
      return sum + (account.balance > 0 ? account.balance : 0);
    }
    return sum + account.balance;
  }, 0)
);

export const selectTotalLiabilities = createSelector(
  selectAllAccounts,
  (accounts) => accounts.reduce((sum, account) => {
    if (account.type === AccountType.LOAN || account.type === AccountType.CREDIT) {
      const balance = Number(account.balance) || 0;
      return sum + (balance < 0 ? Math.abs(balance) : 0);
    }
    return sum;
  }, 0)
);

export const selectAccountsByInstitution = (institution: string) => createSelector(
  selectAllAccounts,
  (accounts) => accounts.filter(a => a.institution === institution)
);

export const selectLoanWithDerivedDetails = (accountId: string) => createSelector(
  selectAllAccounts,
  (accounts) => accounts.find(a => a.accountId === accountId)
);