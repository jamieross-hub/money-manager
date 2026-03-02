import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, mergeMap, catchError, switchMap } from 'rxjs/operators';
import { TransactionsService } from '../../util/service/db/transactions.service';
import * as TransactionsActions from './transactions.actions';
import * as FamilyActions from '../../modules/family/store/family.actions';
import { UserService } from '../../util/service/db/user.service';

@Injectable()
export class TransactionsEffects {
  
  loadTransactions$ = createEffect(() => this.actions$.pipe(
    ofType(TransactionsActions.loadTransactions),
    switchMap(({ userId }) => this.transactionsService.getTransactions(userId)
      .pipe(
        map(transactions => TransactionsActions.loadTransactionsSuccess({ transactions })),
        catchError(error => of(TransactionsActions.loadTransactionsFailure({ error })))
      ))
  ));

  createTransaction$ = createEffect(() => this.actions$.pipe(
    ofType(TransactionsActions.createTransaction),
    mergeMap(({ userId, transaction }) => 
      this.transactionsService.createTransaction(userId, transaction)
        .pipe(
          map(() => ({ type: '[Transactions] Create Transaction Success (Handled by Service)' })),
          catchError(error => of(TransactionsActions.createTransactionFailure({ error })))
        ))
  ));

  updateTransaction$ = createEffect(() => this.actions$.pipe(
    ofType(TransactionsActions.updateTransaction),
    mergeMap(({ userId, transactionId, transaction }) => 
      this.transactionsService.updateTransaction(userId, transactionId, transaction)
        .pipe(
          map(() => ({ type: '[Transactions] Update Transaction Success (Handled by Service)' })),
          catchError(error => of(TransactionsActions.updateTransactionFailure({ error })))
        ))
  ));

  deleteTransaction$ = createEffect(() => this.actions$.pipe(
    ofType(TransactionsActions.deleteTransaction),
    mergeMap(({ userId, transactionId }) => 
      this.transactionsService.deleteTransaction(userId, transactionId)
        .pipe(
          map(() => ({ type: '[Transactions] Delete Transaction Success (Handled by Service)' })),
          catchError(error => of(TransactionsActions.deleteTransactionFailure({ error })))
        ))
  ));

  cascadeDeleteSettlement$ = createEffect(() => this.actions$.pipe(
    ofType(TransactionsActions.deleteTransactionSuccess),
    mergeMap(({ transaction }) => {
      // If the deleted personal transaction was linked to a settlement, delete the settlement too.
      // E.g., user deletes the "Settlement" transfer from their transaction list.
      if (transaction.settlementId && transaction.settlementFamilyId) {
        return of(FamilyActions.deleteSettlement({
          familyId: transaction.settlementFamilyId,
          settlementId: transaction.settlementId
        }));
      }
      return of({ type: '[Transactions] No Cascade Actions Needed' });
    })
  ));
  
  refreshOnSettlementDelete$ = createEffect(() => this.actions$.pipe(
    ofType(FamilyActions.deleteSettlementSuccess),
    mergeMap(() => {
        const userId = this.userService.getCurrentUserId();
        if (userId && userId !== 'offline-guest') {
            return of(TransactionsActions.loadTransactions({ userId }));
        }
        return of({ type: '[Transactions] No Personal Refresh Needed' });
    })
  ));

  getTransaction$ = createEffect(() => this.actions$.pipe(
    ofType(TransactionsActions.getTransaction),
    mergeMap(({ userId, transactionId }) => 
      this.transactionsService.getTransaction(userId, transactionId)
        .pipe(
          map(transaction => {
            if (transaction) {
              return TransactionsActions.getTransactionSuccess({ transaction });
            } else {
              return TransactionsActions.getTransactionFailure({ error: 'Transaction not found' });
            }
          }),
          catchError(error => of(TransactionsActions.getTransactionFailure({ error })))
        ))
  ));

  constructor(
    private actions$: Actions,
    private transactionsService: TransactionsService,
    private userService: UserService
  ) {}
}