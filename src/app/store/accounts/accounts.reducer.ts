import { createReducer, on } from '@ngrx/store';
import { AccountsState, initialState } from './accounts.state';
import * as AccountsActions from './accounts.actions';

export const accountsReducer = createReducer(
  initialState,
  
  // Load Accounts
  on(AccountsActions.loadAccounts, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  
  on(AccountsActions.loadAccountsSuccess, (state, { accounts }) => {
    const entities = accounts.reduce((acc, account) => {
      acc[account.accountId] = account;
      return acc;
    }, {} as { [id: string]: any });
    
    const ids = accounts.map(a => a.accountId);
    
    return {
      ...state,
      entities,
      ids,
      loading: false,
      error: null
    };
  }),
  
  on(AccountsActions.loadAccountsFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),
  
  // Create Account
  on(AccountsActions.createAccount, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  
  on(AccountsActions.createAccountSuccess, (state, { account }) => {
    return {
      ...state,
      entities: {
        ...state.entities,
        [account.accountId]: account
      },
      ids: [...state.ids, account.accountId],
      loading: false,
      error: null
    };
  }),
  
  on(AccountsActions.createAccountFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),
  
  // Update Account
  on(AccountsActions.updateAccount, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  
  on(AccountsActions.updateAccountSuccess, (state, { account }) => {
    return {
      ...state,
      entities: {
        ...state.entities,
        [account.accountId]: account
      },
      loading: false,
      error: null
    };
  }),
  
  on(AccountsActions.updateAccountFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),
  
  // Delete Account
  on(AccountsActions.deleteAccount, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  
  on(AccountsActions.deleteAccountSuccess, (state, { accountId }) => {
    const { [accountId]: removed, ...remainingEntities } = state.entities;
    
    return {
      ...state,
      entities: remainingEntities,
      ids: state.ids.filter(id => id !== accountId),
      loading: false,
      error: null
    };
  }),
  
  on(AccountsActions.deleteAccountFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),
  
  // Get Single Account
  on(AccountsActions.getAccount, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  
  on(AccountsActions.getAccountSuccess, (state, { account }) => {
    return {
      ...state,
      entities: {
        ...state.entities,
        [account.accountId]: account
      },
      ids: state.ids.includes(account.accountId) ? state.ids : [...state.ids, account.accountId],
      selectedAccountId: account.accountId,
      loading: false,
      error: null
    };
  }),
  
  on(AccountsActions.getAccountFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),
  
  // Update Account Balance for Transaction (Optimistic Reducer Logic)
  on(AccountsActions.updateAccountBalanceForTransaction, (state, { accountId, transactionType, oldTransaction, newTransaction }) => {
    const account = state.entities[accountId];
    if (!account) return { ...state, loading: true };

    let balanceChange = 0;

    const getEffect = (t: any) => {
      const amount = Number(t.amount) || 0;
      return t.type === 'income' ? amount : -amount;
    };

    if (transactionType === 'create' && newTransaction) {
      balanceChange = getEffect(newTransaction);
    } else if (transactionType === 'update' && oldTransaction && newTransaction) {
      balanceChange = getEffect(newTransaction) - getEffect(oldTransaction);
    } else if (transactionType === 'delete' && oldTransaction) {
      balanceChange = -getEffect(oldTransaction);
    }

    const updatedAccount = {
      ...account,
      balance: (Number(account.balance) || 0) + balanceChange,
      updatedAt: new Date()
    };

    if (account.type === 'loan' && account.loanDetails) {
      const loanRemainingBalanceChange = -balanceChange;
      updatedAccount.loanDetails = {
        ...account.loanDetails,
        remainingBalance: Math.max(0, (Number(account.loanDetails.remainingBalance) || 0) + loanRemainingBalanceChange)
      };
    }

    return {
      ...state,
      entities: {
        ...state.entities,
        [accountId]: updatedAccount
      },
      loading: true,
      error: null
    };
  }),
  
  on(AccountsActions.updateAccountBalanceForTransactionSuccess, (state, { accountId, newBalance }) => ({
    ...state,
    loading: false,
    error: null
  })),
  
  on(AccountsActions.updateAccountBalanceForTransactionFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),
  
  // Update Account Balance for Multiple Transactions (Optimistic Reducer Logic)
  on(AccountsActions.updateAccountBalanceForTransactions, (state, { transactions }) => {
    const updatedEntities = { ...state.entities };
    
    transactions.forEach(t => {
      const account = updatedEntities[t.accountId];
      if (account) {
        const amount = Number(t.amount) || 0;
        const balanceChange = t.type === 'income' ? amount : -amount;
        
        let updatedAccount = {
          ...account,
          balance: (Number(account.balance) || 0) + balanceChange,
          updatedAt: new Date()
        };

        if (account.type === 'loan' && account.loanDetails) {
          const loanRemainingBalanceChange = -balanceChange;
          updatedAccount.loanDetails = {
            ...account.loanDetails,
            remainingBalance: Math.max(0, (Number(account.loanDetails.remainingBalance) || 0) + loanRemainingBalanceChange)
          };
        }
        
        updatedEntities[t.accountId] = updatedAccount;
      }
    });

    return {
      ...state,
      entities: updatedEntities,
      loading: true,
      error: null
    };
  }),

  on(AccountsActions.updateAccountBalanceForTransactionsSuccess, (state) => ({
    ...state,
    loading: false,
    error: null
  })),
  
  on(AccountsActions.updateAccountBalanceForTransactionsFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),
  
  // Update Account Balance for Account Transfer (Optimistic Reducer Logic)
  on(AccountsActions.updateAccountBalanceForAccountTransfer, (state, { oldAccountId, newAccountId, transaction }) => {
    const oldAccount = state.entities[oldAccountId];
    const newAccount = state.entities[newAccountId];
    
    if (!oldAccount || !newAccount) return { ...state, loading: true };

    const amount = Number(transaction.amount) || 0;
    const transactionEffect = transaction.type === 'income' ? amount : -amount;

    // Update old account (remove transaction effect)
    const updatedOldAccount = {
      ...oldAccount,
      balance: (Number(oldAccount.balance) || 0) - transactionEffect,
      updatedAt: new Date()
    };
    if (oldAccount.type === 'loan' && oldAccount.loanDetails) {
      updatedOldAccount.loanDetails = {
        ...oldAccount.loanDetails,
        remainingBalance: (Number(oldAccount.loanDetails.remainingBalance) || 0) + transactionEffect
      };
    }

    // Update new account (add transaction effect)
    const updatedNewAccount = {
      ...newAccount,
      balance: (Number(newAccount.balance) || 0) + transactionEffect,
      updatedAt: new Date()
    };
    if (newAccount.type === 'loan' && newAccount.loanDetails) {
      updatedNewAccount.loanDetails = {
        ...newAccount.loanDetails,
        remainingBalance: Math.max(0, (Number(newAccount.loanDetails.remainingBalance) || 0) - transactionEffect)
      };
    }

    return {
      ...state,
      entities: {
        ...state.entities,
        [oldAccountId]: updatedOldAccount,
        [newAccountId]: updatedNewAccount
      },
      loading: true,
      error: null
    };
  }),

  on(AccountsActions.updateAccountBalanceForAccountTransferSuccess, (state) => ({
    ...state,
    loading: false,
    error: null
  })),
  
  on(AccountsActions.updateAccountBalanceForAccountTransferFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),
  
  // Clear State
  on(AccountsActions.clearAccounts, () => initialState)
); 