import { createReducer, on } from '@ngrx/store';
import { ProfileState, initialState } from './profile.state';
import * as ProfileActions from './profile.actions';

export const profileReducer = createReducer(
  initialState,
  
  // Load profile
  on(ProfileActions.loadProfile, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  
  on(ProfileActions.loadProfileSuccess, (state, { profile }) => ({
    ...state,
    profile,
    loading: false,
    error: null
  })),
  
  on(ProfileActions.loadProfileFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),
  
  // Update profile
  on(ProfileActions.updateProfile, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  
  on(ProfileActions.updateProfileSuccess, (state, { profile }) => ({
    ...state,
    profile: state.profile ? { ...state.profile, ...profile } : profile,
    loading: false,
    error: null
  })),
  
  on(ProfileActions.updateProfileFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),
  
  // Create profile
  on(ProfileActions.createProfile, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  
  on(ProfileActions.createProfileSuccess, (state, { profile }) => ({
    ...state,
    profile,
    loading: false,
    error: null
  })),
  
  on(ProfileActions.createProfileFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),
  
  // Delete profile
  on(ProfileActions.deleteProfile, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  
  on(ProfileActions.deleteProfileSuccess, (state) => ({
    ...state,
    profile: null,
    loading: false,
    error: null
  })),
  
  on(ProfileActions.deleteProfileFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),
  
  // Update preferences
  on(ProfileActions.updatePreferences, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  
  on(ProfileActions.updatePreferencesSuccess, (state, { profile }) => ({
    ...state,
    profile: state.profile ? { ...state.profile, ...profile } : profile,
    loading: false,
    error: null
  })),
  
  on(ProfileActions.updatePreferencesFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  }))
); 