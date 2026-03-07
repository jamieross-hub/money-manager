import { createAction, props } from '@ngrx/store';
import { Transaction } from 'src/app/util/models/transaction.model';

// Load Transactions
export const loadTransactions = createAction(
  '[Transactions] Load Transactions',
  props<{ userId: string }>()
);

export const loadTransactionsSuccess = createAction(
  '[Transactions] Load Transactions Success',
  props<{ transactions: Transaction[] }>()
);

export const loadTransactionsFailure = createAction(
  '[Transactions] Load Transactions Failure',
  props<{ error: any }>()
);

// Create Transaction
export const createTransaction = createAction(
  '[Transactions] Create Transaction',
  props<{ userId: string; transaction: Omit<Transaction, 'id'> }>()
);

export const createTransactionSuccess = createAction(
  '[Transactions] Create Transaction Success',
  props<{ transaction: Transaction }>()
);

export const createTransactionFailure = createAction(
  '[Transactions] Create Transaction Failure',
  props<{ error: any }>()
);

// Update Transaction
export const updateTransaction = createAction(
  '[Transactions] Update Transaction',
  props<{ userId: string; transactionId: string; transaction: Partial<Transaction> }>()
);

export const updateTransactionSuccess = createAction(
  '[Transactions] Update Transaction Success',
  props<{ transaction: Transaction }>()
);

export const updateTransactionFailure = createAction(
  '[Transactions] Update Transaction Failure',
  props<{ error: any }>()
);

// Delete Transaction
export const deleteTransaction = createAction(
  '[Transactions] Delete Transaction',
  props<{ userId: string; transactionId: string }>()
);

export const deleteTransactionSuccess = createAction(
  '[Transactions] Delete Transaction Success',
  props<{ transactionId: string; transaction: Transaction }>()
);

export const deleteTransactionFailure = createAction(
  '[Transactions] Delete Transaction Failure',
  props<{ error: any }>()
);

// Get Single Transaction
export const getTransaction = createAction(
  '[Transactions] Get Transaction',
  props<{ userId: string; transactionId: string }>()
);

export const getTransactionSuccess = createAction(
  '[Transactions] Get Transaction Success',
  props<{ transaction: Transaction }>()
);

export const getTransactionFailure = createAction(
  '[Transactions] Get Transaction Failure',
  props<{ error: any }>()
);

// Clear State
export const clearTransactions = createAction('[Transactions] Clear Transactions');

// Load Recurring Templates
export const loadRecurringTemplates = createAction(
  '[Transactions] Load Recurring Templates',
  props<{ userId: string }>()
);

export const loadRecurringTemplatesSuccess = createAction(
  '[Transactions] Load Recurring Templates Success',
  props<{ templates: Transaction[] }>()
);

export const loadRecurringTemplatesFailure = createAction(
  '[Transactions] Load Recurring Templates Failure',
  props<{ error: any }>()
);

// Update Recurring Template
export const updateRecurringTemplate = createAction(
  '[Transactions] Update Recurring Template',
  props<{ userId: string; templateId: string; template: Partial<Transaction> }>()
);

export const updateRecurringTemplateSuccess = createAction(
  '[Transactions] Update Recurring Template Success',
  props<{ template: Transaction }>()
);

export const updateRecurringTemplateFailure = createAction(
  '[Transactions] Update Recurring Template Failure',
  props<{ error: any }>()
);

// Delete Recurring Template
export const deleteRecurringTemplate = createAction(
  '[Transactions] Delete Recurring Template',
  props<{ userId: string; templateId: string }>()
);

export const deleteRecurringTemplateSuccess = createAction(
  '[Transactions] Delete Recurring Template Success',
  props<{ templateId: string }>()
);

export const deleteRecurringTemplateFailure = createAction(
  '[Transactions] Delete Recurring Template Failure',
  props<{ error: any }>()
);
 