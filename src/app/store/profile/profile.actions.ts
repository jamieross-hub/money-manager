import { createAction, props } from '@ngrx/store';
import { User } from '../../util/models';
// Set profile directly (used by UserService after auth state change)

export const setProfile = createAction(
  '[Profile] Set Profile',
  props<{ profile: User | null }>()
);

// Clear profile (logout)
export const clearProfile = createAction('[Profile] Clear Profile');

// Load profile
export const loadProfile = createAction(
  '[Profile] Load Profile',
  props<{ userId: string }>()
);

export const loadProfileSuccess = createAction(
  '[Profile] Load Profile Success',
  props<{ profile: User }>()
);

export const loadProfileFailure = createAction(
  '[Profile] Load Profile Failure',
  props<{ error: any }>()
);

// Update profile
export const updateProfile = createAction(
  '[Profile] Update Profile',
  props<{ userId: string; profile: Partial<User> }>()
);

export const updateProfileSuccess = createAction(
  '[Profile] Update Profile Success',
  props<{ profile: User }>()
);

export const updateProfileFailure = createAction(
  '[Profile] Update Profile Failure',
  props<{ error: any }>()
);

// Create profile
export const createProfile = createAction(
  '[Profile] Create Profile',
  props<{ userId: string; profile: User }>()
);

export const createProfileSuccess = createAction(
  '[Profile] Create Profile Success',
  props<{ profile: User }>()
);

export const createProfileFailure = createAction(
  '[Profile] Create Profile Failure',
  props<{ error: any }>()
);

// Delete profile
export const deleteProfile = createAction(
  '[Profile] Delete Profile',
  props<{ userId: string }>()
);

export const deleteProfileSuccess = createAction(
  '[Profile] Delete Profile Success'
);

export const deleteProfileFailure = createAction(
  '[Profile] Delete Profile Failure',
  props<{ error: any }>()
);

// Update preferences
export const updatePreferences = createAction(
  '[Profile] Update Preferences',
  props<{ userId: string; preferences: any }>()
);

export const updatePreferencesSuccess = createAction(
  '[Profile] Update Preferences Success',
  props<{ profile: User }>()
);

export const updatePreferencesFailure = createAction(
  '[Profile] Update Preferences Failure',
  props<{ error: any }>()
); 