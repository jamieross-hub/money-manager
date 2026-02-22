import { createFeatureSelector, createSelector } from '@ngrx/store';
import { FamilyState } from './family.state';

export const selectFamilyState = createFeatureSelector<FamilyState>('family');

export const selectFamily = createSelector(selectFamilyState, s => s.family);
export const selectFamilyMembers = createSelector(selectFamilyState, s => s.members);
export const selectFamilyTransactions = createSelector(selectFamilyState, s => s.transactions);
export const selectFamilyLoading = createSelector(selectFamilyState, s => s.loading);
export const selectFamilyError = createSelector(selectFamilyState, s => s.error);

export const selectRecentTransactions = createSelector(
  selectFamilyTransactions,
  txs => txs.slice(0, 5)
);
