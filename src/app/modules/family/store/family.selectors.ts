import { createFeatureSelector, createSelector } from '@ngrx/store';
import { FamilyState } from './family.state';

export const selectFamilyState = createFeatureSelector<FamilyState>('family');

export const selectFamily = createSelector(selectFamilyState, s => s?.family || null);
export const selectFamilyMembers = createSelector(selectFamilyState, s => s.members);
export const selectFamilyTransactions = createSelector(selectFamilyState, s => s.transactions);
export const selectFamilyLoading = createSelector(selectFamilyState, s => s.loading);
export const selectFamilyError = createSelector(selectFamilyState, s => s.error);

export const selectUserFamilies = createSelector(selectFamilyState, s => s.userFamilies);
export const selectUserFamiliesLoading = createSelector(selectFamilyState, s => s.userFamiliesLoading);

export const selectRecentTransactions = createSelector(
  selectFamilyTransactions,
  txs => txs.slice(0, 5)
);
