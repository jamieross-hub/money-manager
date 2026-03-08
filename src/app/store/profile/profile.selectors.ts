import { createFeatureSelector, createSelector } from '@ngrx/store';
import { ProfileState } from './profile.state';

export const selectProfileState = createFeatureSelector<ProfileState>('profile');

export const selectProfile = createSelector(
  selectProfileState,
  (state: ProfileState) => state.profile
);

export const selectUserId = createSelector(
  selectProfile,
  (profile) => profile?.uid || null
);

export const selectProfileLoading = createSelector(
  selectProfileState,
  (state: ProfileState) => state.loading
);

export const selectProfileError = createSelector(
  selectProfileState,
  (state: ProfileState) => state.error
);

export const selectUserPreferences = createSelector(
  selectProfile,
  (profile) => profile?.preferences
);

export const selectIsFamilyMode = createSelector(
  selectUserPreferences,
  (preferences) => !!preferences?.isFamilyMode
);

export const selectUserCurrency = createSelector(
  selectUserPreferences,
  (preferences) => preferences?.defaultCurrency
);

export const selectUserLanguage = createSelector(
  selectUserPreferences,
  (preferences) => preferences?.language
);

export const selectUserTimezone = createSelector(
  selectUserPreferences,
  (preferences) => preferences?.timezone
);

export const selectUserNotifications = createSelector(
  selectUserPreferences,
  (preferences) => preferences?.notifications
);

export const selectUserEmailUpdates = createSelector(
  selectUserPreferences,
  (preferences) => preferences?.emailUpdates
);

export const selectUserBudgetAlerts = createSelector(
  selectUserPreferences,
  (preferences) => preferences?.budgetAlerts
);

export const selectUserMonthlyIncome = createSelector(
  selectProfile,
  (profile) => profile?.monthlyIncome || 0
); 