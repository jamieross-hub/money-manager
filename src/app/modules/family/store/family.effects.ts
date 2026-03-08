import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { from, of } from 'rxjs';
import { switchMap, map, catchError, mergeMap } from 'rxjs/operators';
import { FamilyService } from '../services/family.service';
import * as FamilyActions from './family.actions';
import { UserService } from 'src/app/util/service/db/user.service';
import { NotificationService } from 'src/app/util/service/notification.service';
import * as ProfileActions from 'src/app/store/profile/profile.actions';
import { filter } from 'rxjs';
import { TransactionsFacadeService } from 'src/app/util/service/db/transactions-facade.service';
import { SyncStatus } from 'src/app/util/config/enums';

@Injectable()
export class FamilyEffects {

  constructor(
    private actions$: Actions,
    private familyService: FamilyService,
    private userService: UserService,
    private transactionsFacade: TransactionsFacadeService,
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
  
  loadFamily$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FamilyActions.loadFamily),
      switchMap(({ familyId }) =>
        from(this.familyService.getFamily(familyId)).pipe(
          map(family => FamilyActions.loadMyFamilySuccess({ family })),
          catchError(err => of(FamilyActions.loadMyFamilyFailure({ error: err.message })))
        )
      )
    )
  );

  updateFamilyBanner$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FamilyActions.updateFamilyBanner),
      switchMap(({ familyId, banner }) =>
        from(this.familyService.updateFamilyBanner(familyId, banner)).pipe(
          map(() => FamilyActions.updateFamilyBannerSuccess({ banner })),
          catchError(err => of(FamilyActions.updateFamilyBannerFailure({ error: err.message })))
        )
      )
    )
  );

  loadUserFamilies$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FamilyActions.loadUserFamilies),
      switchMap(() =>
        this.familyService.getMyFamilies().pipe(
          map(families => FamilyActions.loadUserFamiliesSuccess({ families })),
          catchError(err => of(FamilyActions.loadUserFamiliesFailure({ error: err.message })))
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

  updateFamily$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FamilyActions.updateFamily),
      switchMap(({ familyId, request }) =>
        from(this.familyService.updateFamily(familyId, request)).pipe(
          map(() => {
            this.notificationService.success('Group updated successfully');
            return FamilyActions.updateFamilySuccess({ familyId, request });
          }),
          catchError(err => {
            this.notificationService.error(err.message || 'Failed to update group');
            return of(FamilyActions.updateFamilyFailure({ error: err.message }));
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

  refreshUserFamilies$ = createEffect(() =>
    this.actions$.pipe(
      ofType(
        FamilyActions.createFamilySuccess, 
        FamilyActions.updateFamilySuccess,
        FamilyActions.joinFamilySuccess,
        ProfileActions.setProfile
      ),
      filter(action => {
        if (action.type === ProfileActions.setProfile.type) {
          return !!(action as any).profile;
        }
        return true;
      }),
      map(() => FamilyActions.loadUserFamilies())
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

  updateMemberRole$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FamilyActions.updateMemberRole),
      mergeMap(({ familyId, memberId, role }) =>
        from(this.familyService.updateMemberRole(familyId, memberId, role)).pipe(
          map(() => FamilyActions.updateMemberRoleSuccess({ memberId, role })),
          catchError(err => {
            this.notificationService.error('Failed to update member role');
            return of(FamilyActions.clearError());
          })
        )
      )
    )
  );

  loadTransactions$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FamilyActions.loadTransactions),
      switchMap(({ familyId }) => {
        const userId = this.userService.getCurrentUserId() || '';
        // TransactionsFacadeService.getTransactions handles familyId internally via activeService
        return this.transactionsFacade.getTransactions(userId).pipe(
          map(transactions => FamilyActions.loadTransactionsSuccess({ transactions })),
          catchError(() => of(FamilyActions.loadTransactionsSuccess({ transactions: [] })))
        );
      })
    )
  );

  addTransaction$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FamilyActions.addTransaction),
      mergeMap(({ request }) => {
        const userId = this.userService.getCurrentUserId() || '';
        const transaction: any = {
           ...request,
           userId: userId,
           familyId: request.familyId,
           syncStatus: SyncStatus.PENDING
        };
        return this.transactionsFacade.createTransaction(userId, transaction).pipe(
          map(() => {
            this.notificationService.success('Transaction added');
            // TransactionsService creates its own ID, so we might not have it here 
            // but the real-time listener will pick it up.
            // For the action, we can use the optimistic one or just success.
            return FamilyActions.addTransactionSuccess({ transaction: transaction as any });
          }),
          catchError(err => {
            this.notificationService.error('Failed to add transaction');
            return of(FamilyActions.clearError());
          })
        );
      })
    )
  );

  updateTransaction$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FamilyActions.updateTransaction),
      mergeMap(({ familyId, txId, request }) => {
        const userId = this.userService.getCurrentUserId() || '';
        return this.transactionsFacade.updateTransaction(userId, txId, request).pipe(
          map(() => {
            this.notificationService.success('Transaction updated');
            return FamilyActions.updateTransactionSuccess({ txId, request });
          }),
          catchError(err => {
            this.notificationService.error('Failed to update transaction');
            return of(FamilyActions.clearError());
          })
        );
      })
    )
  );

  deleteTransaction$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FamilyActions.deleteTransaction),
      mergeMap(({ familyId, txId }) => {
        const userId = this.userService.getCurrentUserId() || '';
        // We need the transaction for cascade settlement logic
        return this.transactionsFacade.getTransaction(userId, txId).pipe(
          switchMap(transaction => {
            if (!transaction) throw new Error('Transaction not found');
            return this.transactionsFacade.deleteTransaction(userId, txId).pipe(
              map(() => {
                if (!transaction.settlementId) {
                  this.notificationService.success('Transaction deleted');
                }
                return FamilyActions.deleteTransactionSuccess({ txId, transaction });
              })
            );
          }),
          catchError(err => {
            this.notificationService.error('Failed to delete transaction');
            return of(FamilyActions.clearError());
          })
        );
      })
    )
  );

  loadSettlements$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FamilyActions.loadSettlements),
      switchMap(({ familyId }) =>
        this.familyService.getSettlements(familyId).pipe(
          map(settlements => FamilyActions.loadSettlementsSuccess({ settlements })),
          catchError(err => of(FamilyActions.loadSettlementsFailure({ error: err.message })))
        )
      )
    )
  );

  addSettlement$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FamilyActions.addSettlement),
      mergeMap(({ request }) =>
        from(this.familyService.addSettlement(request)).pipe(
          map(settlement => {
            this.notificationService.success('Settlement recorded ✔️');
            return FamilyActions.addSettlementSuccess({ settlement });
          }),
          catchError(err => {
            this.notificationService.error('Failed to record settlement');
            return of(FamilyActions.addSettlementFailure({ error: err.message }));
          })
        )
      )
    )
  );

  deleteSettlement$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FamilyActions.deleteSettlement),
      mergeMap(({ familyId, settlementId }) =>
        from(this.familyService.deleteSettlement(familyId, settlementId)).pipe(
          map((deletedTxIds) => {
            this.notificationService.success('Settlement reverted');
            return FamilyActions.deleteSettlementSuccess({ settlementId, deletedTxIds });
          }),
          catchError(err => {
            this.notificationService.error('Failed to revert settlement');
            return of(FamilyActions.clearError());
          })
        )
      )
    )
  );
  
  cascadeDeleteSettlement$ = createEffect(() => this.actions$.pipe(
    ofType(FamilyActions.deleteTransactionSuccess),
    mergeMap(({ transaction }) => {
      const settlementId = transaction.settlementId;
      const familyId = transaction.settlementFamilyId || transaction.familyId;
      if (settlementId && familyId) {
        return of(FamilyActions.deleteSettlement({
          familyId,
          settlementId
        }));
      }
      return of({ type: '[Family] No Cascade Actions Needed' });
    })
  ));
}
