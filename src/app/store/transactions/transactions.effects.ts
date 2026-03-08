import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, mergeMap, catchError, switchMap } from 'rxjs/operators';
import { TransactionsService } from '../../util/service/db/transactions.service';
import * as TransactionsActions from './transactions.actions';
import { RecurringService } from '../../util/service/db/recurring.service';
import * as FamilyActions from '../../modules/family/store/family.actions';
import { UserService } from '../../util/service/db/user.service';
import { Transaction } from '../../util/models/transaction.model';
import { RecurringTemplate } from '../../util/models/recurring.model';

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

  loadRecurringTemplates$ = createEffect(() => this.actions$.pipe(
    ofType(TransactionsActions.loadRecurringTemplates),
    switchMap(({ userId }) => this.recurringService.getRecurringTemplates(userId)
      .pipe(
        map(templates => TransactionsActions.loadRecurringTemplatesSuccess({ templates })),
        catchError(error => of(TransactionsActions.loadRecurringTemplatesFailure({ error })))
      ))
  ));

  createRecurringTemplate$ = createEffect(() => this.actions$.pipe(
    ofType(TransactionsActions.createRecurringTemplate),
    mergeMap(({ userId, template, id }) => 
      this.recurringService.createRecurringTemplate(userId, template, id)
        .pipe(
          map(templateId => TransactionsActions.createRecurringTemplateSuccess({ 
            template: { ...template, id: templateId } as RecurringTemplate 
          })),
          catchError(error => of(TransactionsActions.createRecurringTemplateFailure({ error })))
        ))
  ));

  updateRecurringTemplate$ = createEffect(() => this.actions$.pipe(
    ofType(TransactionsActions.updateRecurringTemplate),
    mergeMap(({ userId, templateId, template }) => 
      this.recurringService.updateRecurringTemplate(userId, templateId, template)
        .pipe(
          map(() => TransactionsActions.updateRecurringTemplateSuccess({ 
            template: { ...template, id: templateId } as RecurringTemplate 
          })),
          catchError(error => of(TransactionsActions.updateRecurringTemplateFailure({ error })))
        ))
  ));

  deleteRecurringTemplate$ = createEffect(() => this.actions$.pipe(
    ofType(TransactionsActions.deleteRecurringTemplate),
    mergeMap(({ userId, templateId }) => 
      this.recurringService.deleteRecurringTemplate(userId, templateId)
        .pipe(
          map(() => TransactionsActions.deleteRecurringTemplateSuccess({ templateId })),
          catchError(error => of(TransactionsActions.deleteRecurringTemplateFailure({ error })))
        ))
  ));

  constructor(
    private actions$: Actions,
    private transactionsService: TransactionsService,
    private recurringService: RecurringService,
    private userService: UserService
  ) {}
}