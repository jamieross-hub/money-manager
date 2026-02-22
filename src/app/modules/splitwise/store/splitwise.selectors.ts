import { createFeatureSelector, createSelector } from '@ngrx/store';
import { SplitwiseState } from './splitwise.state';

export const selectSplitwiseFeature = createFeatureSelector<SplitwiseState>('splitwise');

export const selectSplitwiseState = createSelector(
  selectSplitwiseFeature,
  (state: SplitwiseState) => state
);

export const selectGroups = createSelector(
  selectSplitwiseFeature,
  (state: SplitwiseState) => state?.groups || []
);

export const selectInvitations = createSelector(
  selectSplitwiseFeature,
  (state: SplitwiseState) => state?.invitations || []
);

export const selectTransactions = createSelector(
  selectSplitwiseFeature,
  (state: SplitwiseState) => state?.transactions || []
);

export const selectSettlements = createSelector(
  selectSplitwiseFeature,
  (state: SplitwiseState) => state?.settlements || []
);

export const selectSelectedGroup = createSelector(
  selectSplitwiseFeature,
  (state: SplitwiseState) => state?.selectedGroup || null
);

export const selectLoading = createSelector(
  selectSplitwiseFeature,
  (state: SplitwiseState) => state?.loading || false
);

export const selectError = createSelector(
  selectSplitwiseFeature,
  (state: SplitwiseState) => state?.error || null
);

// Computed selectors
export const selectActiveGroups = createSelector(
  selectGroups,
  (groups) => groups.filter(group => group.isActive)
);

export const selectPendingInvitations = createSelector(
  selectInvitations,
  (invitations) => invitations.filter(invitation => invitation.status === 'pending')
);

export const selectGroupTransactions = createSelector(
  selectTransactions,
  selectSelectedGroup,
  (transactions, selectedGroup) => {
    if (!selectedGroup) return [];
    return transactions.filter(t => t.groupId === selectedGroup.id);
  }
);

export const selectGroupSettlements = createSelector(
  selectSettlements,
  selectSelectedGroup,
  (settlements, selectedGroup) => {
    if (!selectedGroup) return [];
    return settlements.filter(s => s.groupId === selectedGroup.id);
  }
);

export const selectGroupMemberCount = createSelector(
  selectSelectedGroup,
  (group) => group?.members.filter(member => member.isActive).length || 0
);

export const selectCurrentUserRole = createSelector(
  selectSelectedGroup,
  (group) => {
    // This would need to be enhanced to get the current user from auth state
    // For now, returning empty string
    return '';
  }
); 