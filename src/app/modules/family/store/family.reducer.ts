import { createReducer, on } from '@ngrx/store';
import { initialFamilyState } from './family.state';
import * as FamilyActions from './family.actions';

export const familyReducer = createReducer(
  initialFamilyState,

  // Load my family
  on(FamilyActions.loadMyFamily, state => ({ ...state, loading: true, error: null })),
  on(FamilyActions.loadFamily, state => ({ ...state, loading: true, error: null })),
  on(FamilyActions.loadMyFamilySuccess, (state, { family }) => ({ ...state, loading: false, family })),
  on(FamilyActions.loadMyFamilyFailure, (state, { error }) => ({ ...state, loading: false, error })),

  // Load user families
  on(FamilyActions.loadUserFamilies, state => ({ ...state, userFamiliesLoading: true, error: null })),
  on(FamilyActions.loadUserFamiliesSuccess, (state, { families }) => ({ ...state, userFamiliesLoading: false, userFamilies: families })),
  on(FamilyActions.loadUserFamiliesFailure, (state, { error }) => ({ ...state, userFamiliesLoading: false, error })),

  // Create family
  on(FamilyActions.createFamily, state => ({ ...state, loading: true, error: null })),
  on(FamilyActions.createFamilySuccess, (state, { family }) => ({ ...state, loading: false, family })),
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
    members: state.members.filter(m => m.id !== memberId)
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
  on(FamilyActions.deleteTransactionSuccess, (state, { txId }) => ({
    ...state,
    transactions: state.transactions.filter(tx => tx.id !== txId)
  })),

  // Clear error
  on(FamilyActions.clearError, state => ({ ...state, error: null })),

  // Settlements
  on(FamilyActions.loadSettlements, state => ({ ...state, settlementsLoading: true })),
  on(FamilyActions.loadSettlementsSuccess, (state, { settlements }) => ({ ...state, settlementsLoading: false, settlements })),
  on(FamilyActions.loadSettlementsFailure, (state, { error }) => ({ ...state, settlementsLoading: false, error })),
  on(FamilyActions.addSettlementSuccess, (state, { settlement }) => ({
    ...state,
    settlements: [settlement, ...state.settlements],
  })),
);
