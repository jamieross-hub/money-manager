import { createReducer, on } from '@ngrx/store';
import { initialFamilyState } from './family.state';
import * as FamilyActions from './family.actions';
import * as TransactionsActions from 'src/app/store/transactions/transactions.actions';
import { TransactionStatus } from 'src/app/util/config/enums';

export const familyReducer = createReducer(
  initialFamilyState,

  // Load my family
  on(FamilyActions.loadMyFamily, state => ({ ...state, loading: true, error: null })),
  on(FamilyActions.loadFamily, state => ({ ...state, loading: true, error: null })),
  on(FamilyActions.loadMyFamilySuccess, (state, { family }) => ({ ...state, loading: false, family })),
  on(FamilyActions.loadMyFamilyFailure, (state, { error }) => ({ ...state, loading: false, error })),
  on(FamilyActions.updateFamilyBannerSuccess, (state, { banner }) => ({
    ...state,
    family: state.family ? { ...state.family, banner } : null
  })),

  // Load user families
  on(FamilyActions.loadUserFamilies, state => ({ 
    ...state, 
    userFamiliesLoading: true, 
    userFamiliesLoaded: state.userFamilies.length > 0, 
    error: null 
  })),
  on(FamilyActions.loadUserFamiliesSuccess, (state, { families }) => ({ ...state, userFamiliesLoading: false, userFamiliesLoaded: true, userFamilies: families })),
  on(FamilyActions.loadUserFamiliesFailure, (state, { error }) => ({ ...state, userFamiliesLoading: false, userFamiliesLoaded: true, error })),

  // Create family
  on(FamilyActions.createFamily, state => ({ ...state, loading: true, error: null })),
  on(FamilyActions.createFamilySuccess, (state, { family }) => ({ 
    ...state, 
    loading: false, 
    family,
    userFamilies: [family, ...state.userFamilies]
  })),
  on(FamilyActions.createFamilyFailure, (state, { error }) => ({ ...state, loading: false, error })),

  // Join family
  on(FamilyActions.joinFamily, state => ({ ...state, loading: true, error: null })),
  on(FamilyActions.joinFamilySuccess, (state, { family }) => ({ ...state, loading: false, family })),
  on(FamilyActions.joinFamilyFailure, (state, { error }) => ({ ...state, loading: false, error })),

  // Members
  on(FamilyActions.loadMembers, state => ({ ...state, loading: true })),
  on(FamilyActions.loadMembersSuccess, (state, { members }) => ({ ...state, loading: false, members })),
  on(FamilyActions.removeMemberSuccess, (state, { memberId }) => ({
    ...state,
    members: state.members.map(m => m.userId === memberId ? { ...m, isActive: false } : m)
  })),
  on(FamilyActions.updateMemberRoleSuccess, (state, { memberId, role }) => ({
    ...state,
    members: state.members.map(m => m.userId === memberId ? { ...m, role } : m)
  })),

  // Transactions
  on(FamilyActions.loadTransactions, state => ({ ...state, loading: true })),
  on(FamilyActions.loadTransactionsSuccess, (state, { transactions }) => ({ ...state, loading: false, transactions })),
  on(FamilyActions.addTransactionSuccess, (state, { transaction }) => ({
    ...state,
    transactions: [transaction, ...state.transactions]
  })),
  on(FamilyActions.updateTransactionSuccess, (state, { txId, request }) => ({
    ...state,
    transactions: state.transactions.map(tx =>
      tx.id === txId ? { ...tx, ...request, updatedAt: new Date() } : tx
    )
  })),
  on(FamilyActions.deleteTransactionSuccess, (state, { txId, transaction }) => ({
    ...state,
    transactions: state.transactions.map(tx => 
      tx.id === txId ? { ...tx, ...transaction, status: TransactionStatus.DELETED, updatedAt: new Date() } : tx
    )
  })),

  // Handle standard transactions store actions for instant family updates
  on(TransactionsActions.createTransactionSuccess, (state, { transaction }) => {
    // If we're in Family Mode and the transaction appears to be a family/split one, add it
    if (transaction.splitData || transaction.familyId) {
      // Avoid duplicate if it was already added by a family listener or something
      const exists = state.transactions.some(tx => tx.id === transaction.id);
      if (!exists) {
        return {
          ...state,
          transactions: [transaction, ...state.transactions]
        };
      }
    }
    return state;
  }),
  on(TransactionsActions.updateTransactionSuccess, (state, { transaction }) => {
    if (transaction.id) {
       return {
         ...state,
         transactions: state.transactions.map(tx => tx.id === transaction.id ? { ...tx, ...transaction } : tx)
       };
    }
    return state;
  }),
  on(TransactionsActions.deleteTransactionSuccess, (state, { transactionId, transaction }) => ({
    ...state,
    transactions: state.transactions.map(tx => 
      tx.id === transactionId ? { ...tx, ...transaction, status: TransactionStatus.DELETED, updatedAt: new Date() } : tx
    )
  })),

  // Clear error
  on(FamilyActions.clearError, state => ({ ...state, error: null })),

  // Settlements
  on(FamilyActions.loadSettlements, state => ({ ...state, settlementsLoading: true })),
  on(FamilyActions.loadSettlementsSuccess, (state, { settlements }) => ({ ...state, settlementsLoading: false, settlements })),
  on(FamilyActions.loadSettlementsFailure, (state, { error }) => ({ ...state, settlementsLoading: false, error })),
  
  // Optimistically add settlement to UI instantly, using a temporary ID
  on(FamilyActions.addSettlement, (state, { request }) => {
    const tempSettlement: any = {
      id: 'temp_' + Date.now(),
      ...request,
      settledAt: new Date(),
      createdAt: new Date()
    };
    return {
      ...state,
      settlements: [tempSettlement, ...state.settlements],
    };
  }),

  // Replace temporary UI settlement with real one once confirmed from API
  on(FamilyActions.addSettlementSuccess, (state, { settlement }) => {
    const existingIndex = state.settlements.findIndex(s => 
      s.id && s.id.startsWith('temp_') && s.fromUserId === settlement.fromUserId && s.amount === settlement.amount
    );
    
    let nextSettlements = [...state.settlements];
    if (existingIndex !== -1) {
      // Replace the temp one with the actual confirmed one
      nextSettlements[existingIndex] = settlement;
    } else {
      // If no temp found, just push it or ignore if it's already there from onSnapshot
      const alreadyExists = nextSettlements.some(s => s.id === settlement.id);
      if (!alreadyExists) {
        nextSettlements = [settlement, ...nextSettlements];
      }
    }

    return {
      ...state,
      settlements: nextSettlements,
    };
  }),
  on(FamilyActions.deleteSettlementSuccess, (state, { settlementId, deletedTxIds }) => ({
    ...state,
    settlements: state.settlements.filter(s => s.id !== settlementId),
    transactions: state.transactions.map(tx => 
      (deletedTxIds?.includes(tx.id || '') || tx.settlementId === settlementId)
        ? { ...tx, status: TransactionStatus.DELETED, updatedAt: new Date() }
        : tx
    )
  })),
);
