import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { from, of } from 'rxjs';
import { switchMap, map, catchError, mergeMap } from 'rxjs/operators';
import { FamilyService } from '../services/family.service';
import * as FamilyActions from './family.actions';
import { NotificationService } from 'src/app/util/service/notification.service';

@Injectable()
export class FamilyEffects {

  constructor(
    private actions$: Actions,
    private familyService: FamilyService,
    private notificationService: NotificationService,
  ) {}

  loadMyFamily$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FamilyActions.loadMyFamily),
      switchMap(() =>
        from(this.familyService.getMyFamily()).pipe(
          map(family => FamilyActions.loadMyFamilySuccess({ family })),
          catchError(err => of(FamilyActions.loadMyFamilyFailure({ error: err.message })))
        )
      )
    )
  );

  createFamily$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FamilyActions.createFamily),
      switchMap(({ request }) =>
        from(this.familyService.createFamily(request)).pipe(
          map(family => {
            this.notificationService.success('Family created! Share your invite code with family members.');
            return FamilyActions.createFamilySuccess({ family });
          }),
          catchError(err => {
            this.notificationService.error(err.message || 'Failed to create family');
            return of(FamilyActions.createFamilyFailure({ error: err.message }));
          })
        )
      )
    )
  );

  joinFamily$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FamilyActions.joinFamily),
      switchMap(({ inviteCode }) =>
        from(this.familyService.joinByCode(inviteCode)).pipe(
          map(family => {
            this.notificationService.success(`Joined "${family.name}" family!`);
            return FamilyActions.joinFamilySuccess({ family });
          }),
          catchError(err => {
            this.notificationService.error(err.message || 'Failed to join family');
            return of(FamilyActions.joinFamilyFailure({ error: err.message }));
          })
        )
      )
    )
  );

  loadMembers$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FamilyActions.loadMembers),
      switchMap(({ familyId }) =>
        this.familyService.getMembers(familyId).pipe(
          map(members => FamilyActions.loadMembersSuccess({ members })),
          catchError(() => of(FamilyActions.loadMembersSuccess({ members: [] })))
        )
      )
    )
  );

  removeMember$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FamilyActions.removeMember),
      mergeMap(({ familyId, memberId }) =>
        from(this.familyService.removeMember(familyId, memberId)).pipe(
          map(() => FamilyActions.removeMemberSuccess({ memberId })),
          catchError(err => {
            this.notificationService.error('Failed to remove member');
            return of(FamilyActions.clearError());
          })
        )
      )
    )
  );

  loadTransactions$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FamilyActions.loadTransactions),
      switchMap(({ familyId }) =>
        this.familyService.getTransactions(familyId).pipe(
          map(transactions => FamilyActions.loadTransactionsSuccess({ transactions })),
          catchError(() => of(FamilyActions.loadTransactionsSuccess({ transactions: [] })))
        )
      )
    )
  );

  addTransaction$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FamilyActions.addTransaction),
      mergeMap(({ request }) =>
        from(this.familyService.addTransaction(request)).pipe(
          map(transaction => {
            this.notificationService.success('Transaction added');
            return FamilyActions.addTransactionSuccess({ transaction });
          }),
          catchError(err => {
            this.notificationService.error('Failed to add transaction');
            return of(FamilyActions.clearError());
          })
        )
      )
    )
  );

  updateTransaction$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FamilyActions.updateTransaction),
      mergeMap(({ txId, request }) =>
        from(this.familyService.updateTransaction(txId, request)).pipe(
          map(() => {
            this.notificationService.success('Transaction updated');
            return FamilyActions.updateTransactionSuccess({ txId, request });
          }),
          catchError(err => {
            this.notificationService.error('Failed to update transaction');
            return of(FamilyActions.clearError());
          })
        )
      )
    )
  );

  deleteTransaction$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FamilyActions.deleteTransaction),
      mergeMap(({ txId }) =>
        from(this.familyService.deleteTransaction(txId)).pipe(
          map(() => {
            this.notificationService.success('Transaction deleted');
            return FamilyActions.deleteTransactionSuccess({ txId });
          }),
          catchError(err => {
            this.notificationService.error('Failed to delete transaction');
            return of(FamilyActions.clearError());
          })
        )
      )
    )
  );
}
