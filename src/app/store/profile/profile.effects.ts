import { Injectable } from '@angular/core';
import { Action, Store } from '@ngrx/store';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of, from } from 'rxjs';
import { map, mergeMap, catchError, concatMap, withLatestFrom } from 'rxjs/operators';
import { UserService } from '../../util/service/db/user.service';
import * as ProfileActions from './profile.actions';
import * as ProfileSelectors from './profile.selectors';
import { AppState } from '../app.state';

@Injectable()
export class ProfileEffects {
  loadProfile$ = createEffect(() => this.actions$.pipe(
    ofType(ProfileActions.loadProfile),
    mergeMap(({ userId }) => from(this.userService.getCurrentUser())
      .pipe(
        map(profile => {
          if (profile) {
            return ProfileActions.loadProfileSuccess({ profile });
          } else {
            throw new Error('Profile not found');
          }
        }),
        catchError(error => of(ProfileActions.loadProfileFailure({ error })))
      ))
  ));

  updateProfile$ = createEffect(() => this.actions$.pipe(
    ofType(ProfileActions.updateProfile),
    concatMap(({ userId, profile }) => from(this.userService.createOrUpdateUser(profile as any))
      .pipe(
        map(() => ProfileActions.updateProfileSuccess({ profile: profile as any })),
        catchError(error => of(ProfileActions.updateProfileFailure({ error })))
      ))
  ));

  createProfile$ = createEffect(() => this.actions$.pipe(
    ofType(ProfileActions.createProfile),
    mergeMap(({ userId, profile }) => from(this.userService.createOrUpdateUser(profile))
      .pipe(
        map(() => ProfileActions.createProfileSuccess({ profile })),
        catchError(error => of(ProfileActions.createProfileFailure({ error })))
      ))
  ));

  deleteProfile$ = createEffect(() => this.actions$.pipe(
    ofType(ProfileActions.deleteProfile),
    mergeMap(({ userId }) => from(this.userService.signOut())
      .pipe(
        map(() => ProfileActions.deleteProfileSuccess()),
        catchError(error => of(ProfileActions.deleteProfileFailure({ error })))
      ))
  ));

  updatePreferences$ = createEffect(() => this.actions$.pipe(
    ofType(ProfileActions.updatePreferences),
    withLatestFrom(this.store.select(ProfileSelectors.selectProfile)),
    concatMap(([{ userId, preferences }, currentUser]) => {
      if (currentUser) {
        const updatedUser = { 
          ...currentUser, 
          preferences: {
            ...currentUser.preferences,
            ...preferences
          } 
        };
        return from(this.userService.createOrUpdateUser(updatedUser)).pipe(
          map(() => ProfileActions.updatePreferencesSuccess({ profile: updatedUser })),
          catchError(error => of(ProfileActions.updatePreferencesFailure({ error })))
        );
      } else {
        return of(ProfileActions.updatePreferencesFailure({ error: new Error('User not found') }));
      }
    })
  ));

  constructor(
    private actions$: Actions,
    private userService: UserService,
    private store: Store<AppState>
  ) {}
} 