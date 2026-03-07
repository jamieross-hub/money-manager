import { createReducer, on } from '@ngrx/store';
import { TransactionsState, initialState } from './transactions.state';
import * as TransactionsActions from './transactions.actions';
import { TransactionStatus } from '../../util/config/enums';

export const transactionsReducer = createReducer(
  initialState,
  
  // Load Transactions
  on(TransactionsActions.loadTransactions, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  
  on(TransactionsActions.loadTransactionsSuccess, (state, { transactions }) => {
    const filteredTransactions = transactions.filter(t => !t.familyId && !t.splitData);
    
    const entities = filteredTransactions.reduce((acc, transaction) => {
      if (transaction.id) {
        acc[transaction.id] = transaction;
      }
      return acc;
    }, {} as { [id: string]: any });
    
    const ids = filteredTransactions.map(t => t.id).filter(id => id) as string[];
    
    return {
      ...state,
      entities,
      ids,
      loading: false,
      error: null
    };
  }),
  
  on(TransactionsActions.loadTransactionsFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),
  
  // Create Transaction
  on(TransactionsActions.createTransaction, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  
  on(TransactionsActions.createTransactionSuccess, (state, { transaction }) => {
    if (!transaction.id || transaction.familyId || transaction.splitData) return state;
    
    return {
      ...state,
      entities: {
        ...state.entities,
        [transaction.id]: transaction
      },
      ids: [...state.ids, transaction.id],
      loading: false,
      error: null
    };
  }),
  
  on(TransactionsActions.createTransactionFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),
  
  // Update Transaction
  on(TransactionsActions.updateTransaction, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  
  on(TransactionsActions.updateTransactionSuccess, (state, { transaction }) => {
    if (!transaction.id || transaction.familyId || transaction.splitData) return state;
    
    return {
      ...state,
      entities: {
        ...state.entities,
        [transaction.id]: {
          ...state.entities[transaction.id],
          ...transaction
        }
      },
      loading: false,
      error: null
    };
  }),
  
  on(TransactionsActions.updateTransactionFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),
  
  // Delete Transaction
  on(TransactionsActions.deleteTransaction, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  
  on(TransactionsActions.deleteTransactionSuccess, (state, { transactionId, transaction }) => {
    return {
      ...state,
      entities: {
        ...state.entities,
        [transactionId]: {
          ...state.entities[transactionId],
          ...transaction,
          status: TransactionStatus.DELETED,
          updatedAt: new Date()
        }
      },
      loading: false,
      error: null
    };
  }),
  
  on(TransactionsActions.deleteTransactionFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),
  
  // Get Single Transaction
  on(TransactionsActions.getTransaction, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  
  on(TransactionsActions.getTransactionSuccess, (state, { transaction }) => {
    if (!transaction.id || transaction.familyId || transaction.splitData) return state;
    
    return {
      ...state,
      entities: {
        ...state.entities,
        [transaction.id]: transaction
      },
      ids: state.ids.includes(transaction.id) ? state.ids : [...state.ids, transaction.id],
      selectedTransactionId: transaction.id,
      loading: false,
      error: null
    };
  }),
  
  on(TransactionsActions.getTransactionFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),
  
  // Clear State
  on(TransactionsActions.clearTransactions, () => initialState),

  // Load Recurring Templates
  on(TransactionsActions.loadRecurringTemplates, (state) => ({
    ...state,
    recurringLoading: true,
    error: null
  })),

  on(TransactionsActions.loadRecurringTemplatesSuccess, (state, { templates }) => ({
    ...state,
    recurringTemplates: templates,
    recurringLoading: false,
    error: null
  })),

  on(TransactionsActions.loadRecurringTemplatesFailure, (state, { error }) => ({
    ...state,
    recurringLoading: false,
    error
  })),

  // Update Recurring Template
  on(TransactionsActions.updateRecurringTemplateSuccess, (state, { template }) => ({
    ...state,
    recurringTemplates: state.recurringTemplates.map(t => 
      t.id === template.id ? { ...t, ...template } : t
    ),
    recurringLoading: false,
    error: null
  })),

  on(TransactionsActions.updateRecurringTemplateFailure, (state, { error }) => ({
    ...state,
    recurringLoading: false,
    error
  })),

  // Delete Recurring Template
  on(TransactionsActions.deleteRecurringTemplateSuccess, (state, { templateId }) => ({
    ...state,
    recurringTemplates: state.recurringTemplates.filter(t => t.id !== templateId),
    recurringLoading: false,
    error: null
  })),

  on(TransactionsActions.deleteRecurringTemplateFailure, (state, { error }) => ({
    ...state,
    recurringLoading: false,
    error
  }))
); 