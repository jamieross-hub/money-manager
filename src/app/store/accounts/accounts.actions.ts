import { createAction, props } from '@ngrx/store';
import { Account, CreateAccountRequest, UpdateAccountRequest } from '../../util/models/account.model';
import { Transaction } from '../../util/models/transaction.model';
import { AccountsContext } from './accounts.state';

// Load Accounts
export const loadAccounts = createAction(
  '[Accounts] Load Accounts',
  props<{ userId: string }>()
);

export const loadAccountsSuccess = createAction(
  '[Accounts] Load Accounts Success',
  props<{ accounts: Account[]; context?: AccountsContext }>()
);

export const loadAccountsFailure = createAction(
  '[Accounts] Load Accounts Failure',
  props<{ error: any }>()
);

// Create Account
export const createAccount = createAction(
  '[Accounts] Create Account',
  props<{ userId: string; accountData: CreateAccountRequest }>()
);

export const createAccountSuccess = createAction(
  '[Accounts] Create Account Success',
  props<{ account: Account; context?: AccountsContext }>()
);

export const createAccountFailure = createAction(
  '[Accounts] Create Account Failure',
  props<{ error: any }>()
);

// Update Account
export const updateAccount = createAction(
  '[Accounts] Update Account',
  props<{ userId: string; accountId: string; accountData: UpdateAccountRequest }>()
);

export const updateAccountSuccess = createAction(
  '[Accounts] Update Account Success',
  props<{ account: Account; context?: AccountsContext }>()
);

export const updateAccountFailure = createAction(
  '[Accounts] Update Account Failure',
  props<{ error: any }>()
);

// Delete Account
export const deleteAccount = createAction(
  '[Accounts] Delete Account',
  props<{ userId: string; accountId: string }>()
);

export const deleteAccountSuccess = createAction(
  '[Accounts] Delete Account Success',
  props<{ accountId: string; context?: AccountsContext }>()
);

export const deleteAccountFailure = createAction(
  '[Accounts] Delete Account Failure',
  props<{ error: any }>()
);

// Get Single Account
export const getAccount = createAction(
  '[Accounts] Get Account',
  props<{ userId: string; accountId: string }>()
);

export const getAccountSuccess = createAction(
  '[Accounts] Get Account Success',
  props<{ account: Account }>()
);

export const getAccountFailure = createAction(
  '[Accounts] Get Account Failure',
  props<{ error: any }>()
);

// Update Account Balance for Transaction
export const updateAccountBalanceForTransaction = createAction(
  '[Accounts] Update Account Balance For Transaction',
  props<{ 
    userId: string; 
    accountId: string; 
    transactionType: 'create' | 'update' | 'delete';
    oldTransaction?: Transaction;
    newTransaction?: Transaction;
  }>()
);

export const updateAccountBalanceForTransactionSuccess = createAction(
  '[Accounts] Update Account Balance For Transaction Success',
  props<{ accountId: string; newBalance: number }>()
);

export const updateAccountBalanceForTransactionFailure = createAction(
  '[Accounts] Update Account Balance For Transaction Failure',
  props<{ error: any }>()
);

// Update Account Balance for Multiple Transactions
export const updateAccountBalanceForTransactions = createAction(
  '[Accounts] Update Account Balance For Transactions',
  props<{ 
    userId: string; 
    transactions: { accountId: string; type: 'income' | 'expense'; amount: number }[];
  }>()
);

export const updateAccountBalanceForTransactionsSuccess = createAction(
  '[Accounts] Update Account Balance For Transactions Success'
);

export const updateAccountBalanceForTransactionsFailure = createAction(
  '[Accounts] Update Account Balance For Transactions Failure',
  props<{ error: any }>()
);

// Update Account Balance for Account Transfer
export const updateAccountBalanceForAccountTransfer = createAction(
  '[Accounts] Update Account Balance For Account Transfer',
  props<{ 
    userId: string; 
    oldAccountId: string;
    newAccountId: string;
    transaction: Transaction;
  }>()
);

export const updateAccountBalanceForAccountTransferSuccess = createAction(
  '[Accounts] Update Account Balance For Account Transfer Success'
);

export const updateAccountBalanceForAccountTransferFailure = createAction(
  '[Accounts] Update Account Balance For Account Transfer Failure',
  props<{ error: any }>()
);

// Clear State
export const clearAccounts = createAction('[Accounts] Clear Accounts');

// Switch active context (personal ↔ family) without clearing data
export const setAccountsContext = createAction(
  '[Accounts] Set Context',
  props<{ context: AccountsContext }>()
);