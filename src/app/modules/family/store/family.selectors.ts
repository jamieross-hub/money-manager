import { createFeatureSelector, createSelector } from '@ngrx/store';
import { FamilyState } from './family.state';
import { TransactionStatus } from 'src/app/util/config/enums';

export const selectFamilyState = createFeatureSelector<FamilyState>('family');

export const selectFamily = createSelector(selectFamilyState, s => s?.family || null);
export const selectFamilyMembers = createSelector(selectFamilyState, s => s?.members || []);
export const selectRawTransactions = createSelector(selectFamilyState, s => s?.transactions || []);

export const selectFamilyTransactions = createSelector(
  selectRawTransactions,
  txs => txs.filter(tx => tx.status !== TransactionStatus.DELETED)
);

export const selectRawFamilyTransactions = createSelector(
  selectRawTransactions,
  txs => txs
);
export const selectFamilyLoading = createSelector(selectFamilyState, s => s?.loading || false);
export const selectFamilyError = createSelector(selectFamilyState, s => s?.error || null);

export const selectUserFamilies = createSelector(selectFamilyState, s => s?.userFamilies || []);
export const selectUserFamiliesLoading = createSelector(selectFamilyState, s => s?.userFamiliesLoading || false);
export const selectUserFamiliesLoaded = createSelector(selectFamilyState, s => s?.userFamiliesLoaded || false);

export const selectSettlements = createSelector(selectFamilyState, s => s?.settlements || []);
export const selectSettlementsLoading = createSelector(selectFamilyState, s => s?.settlementsLoading || false);

// NOTE: selectRecentTransactions has been removed — use TransactionsSelectors.selectRecentTransactions(n)
// which is family-mode aware via selectAllTransactions.
