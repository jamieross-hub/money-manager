import { createReducer, on } from '@ngrx/store';
import { AccountsState, AccountsBucket, initialState } from './accounts.state';
import * as AccountsActions from './accounts.actions';
import { AccountsContext } from './accounts.state';

// Helper: get the target context bucket key from an action's optional context field,
// falling back to the current activeContext in state.
function ctx(state: AccountsState, actionCtx?: AccountsContext): AccountsContext {
  return actionCtx ?? state.activeContext;
}

function updateBucket(
  state: AccountsState,
  context: AccountsContext,
  patch: Partial<AccountsBucket>
): AccountsState {
  return {
    ...state,
    [context]: { ...state[context], ...patch }
  };
}

export const accountsReducer = createReducer(
  initialState,

  // ── Context switch (personal ↔ family) ─────────────────────────────────────
  on(AccountsActions.setAccountsContext, (state, { context }) => ({
    ...state,
    activeContext: context
  })),

  // ── Load Accounts ───────────────────────────────────────────────────────────
  on(AccountsActions.loadAccounts, (state) => ({
    ...state,
    loading: true,
    error: null
  })),

  on(AccountsActions.loadAccountsSuccess, (state, { accounts, context }) => {
    const target = ctx(state, context);
    const entities = accounts.reduce((acc, account) => {
      acc[account.accountId] = account;
      return acc;
    }, {} as { [id: string]: any });
    const ids = accounts.map(a => a.accountId);
    return updateBucket({ ...state, loading: false, error: null }, target, { entities, ids });
  }),

  on(AccountsActions.loadAccountsFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),

  // ── Create Account ──────────────────────────────────────────────────────────
  on(AccountsActions.createAccount, (state) => ({
    ...state,
    loading: true,
    error: null
  })),

  on(AccountsActions.createAccountSuccess, (state, { account, context }) => {
    const target = ctx(state, context);
    const bucket = state[target];
    return updateBucket({ ...state, loading: false, error: null }, target, {
      entities: { ...bucket.entities, [account.accountId]: account },
      ids: bucket.ids.includes(account.accountId)
        ? bucket.ids
        : [...bucket.ids, account.accountId]
    });
  }),

  on(AccountsActions.createAccountFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),

  // ── Update Account ──────────────────────────────────────────────────────────
  on(AccountsActions.updateAccount, (state) => ({
    ...state,
    loading: true,
    error: null
  })),

  on(AccountsActions.updateAccountSuccess, (state, { account, context }) => {
    const target = ctx(state, context);
    const bucket = state[target];
    // If it's an account that doesn't exist yet, no-op
    if (!bucket.entities[account.accountId]) return { ...state, loading: false };
    return updateBucket({ ...state, loading: false, error: null }, target, {
      entities: {
        ...bucket.entities,
        [account.accountId]: { ...bucket.entities[account.accountId], ...account }
      }
    });
  }),

  on(AccountsActions.updateAccountFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),

  // ── Delete Account ──────────────────────────────────────────────────────────
  on(AccountsActions.deleteAccount, (state) => ({
    ...state,
    loading: true,
    error: null
  })),

  on(AccountsActions.deleteAccountSuccess, (state, { accountId, context }) => {
    const target = ctx(state, context);
    const bucket = state[target];
    const { [accountId]: _removed, ...remainingEntities } = bucket.entities;
    return updateBucket({ ...state, loading: false, error: null }, target, {
      entities: remainingEntities,
      ids: bucket.ids.filter(id => id !== accountId)
    });
  }),

  on(AccountsActions.deleteAccountFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),

  // ── Get Single Account ──────────────────────────────────────────────────────
  on(AccountsActions.getAccount, (state) => ({
    ...state,
    loading: true,
    error: null
  })),

  on(AccountsActions.getAccountSuccess, (state, { account }) => {
    const target = state.activeContext;
    const bucket = state[target];
    return updateBucket({
      ...state,
      loading: false,
      error: null,
      selectedAccountId: account.accountId
    }, target, {
      entities: { ...bucket.entities, [account.accountId]: account },
      ids: bucket.ids.includes(account.accountId)
        ? bucket.ids
        : [...bucket.ids, account.accountId]
    });
  }),

  on(AccountsActions.getAccountFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),

  // ── Update Account Balance for Transaction ──────────────────────────────────
  on(AccountsActions.updateAccountBalanceForTransaction, (state, { accountId, transactionType, oldTransaction, newTransaction }) => {
    const bucket = state[state.activeContext];
    const account = bucket.entities[accountId];
    if (!account) return { ...state, loading: true };

    const getEffect = (t: any) => {
      if (t.isPending || t.status === 'pending') return 0;
      const amount = Number(t.amount) || 0;
      return t.type === 'income' ? amount : -amount;
    };

    let balanceChange = 0;
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

    return updateBucket({ ...state, loading: true, error: null }, state.activeContext, {
      entities: { ...bucket.entities, [accountId]: updatedAccount }
    });
  }),

  on(AccountsActions.updateAccountBalanceForTransactionSuccess, (state) => ({
    ...state,
    loading: false,
    error: null
  })),

  on(AccountsActions.updateAccountBalanceForTransactionFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),

  // ── Update Account Balance for Multiple Transactions ────────────────────────
  on(AccountsActions.updateAccountBalanceForTransactions, (state, { transactions }) => {
    const bucket = state[state.activeContext];
    const updatedEntities = { ...bucket.entities };

    transactions.forEach((t: any) => {
      const account = updatedEntities[t.accountId];
      if (account && !t.isPending && t.status !== 'pending') {
        const amount = Number(t.amount) || 0;
        const balanceChange = t.type === 'income' ? amount : -amount;
        updatedEntities[t.accountId] = {
          ...account,
          balance: (Number(account.balance) || 0) + balanceChange,
          updatedAt: new Date()
        };
      }
    });

    return updateBucket({ ...state, loading: true, error: null }, state.activeContext, {
      entities: updatedEntities
    });
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

  // ── Update Account Balance for Account Transfer ─────────────────────────────
  on(AccountsActions.updateAccountBalanceForAccountTransfer, (state, { oldAccountId, newAccountId, transaction }) => {
    const bucket = state[state.activeContext];
    const oldAccount = bucket.entities[oldAccountId];
    const newAccount = bucket.entities[newAccountId];
    if (!oldAccount || !newAccount) return { ...state, loading: true };

    const amount = Number(transaction.amount) || 0;
    const transactionEffect = transaction.type === 'income' ? amount : -amount;

    return updateBucket({ ...state, loading: true, error: null }, state.activeContext, {
      entities: {
        ...bucket.entities,
        [oldAccountId]: {
          ...oldAccount,
          balance: (Number(oldAccount.balance) || 0) - transactionEffect,
          updatedAt: new Date()
        },
        [newAccountId]: {
          ...newAccount,
          balance: (Number(newAccount.balance) || 0) + transactionEffect,
          updatedAt: new Date()
        }
      }
    });
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

  // ── Clear State ─────────────────────────────────────────────────────────────
  // clearAccounts only clears the ACTIVE context bucket, preserving the other
  on(AccountsActions.clearAccounts, (state) =>
    updateBucket({ ...state }, state.activeContext, {
      entities: {},
      ids: []
    })
  )
);