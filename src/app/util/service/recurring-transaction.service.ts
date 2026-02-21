import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable, of } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { TransactionsService } from './db/transactions.service';
import { UserService } from './db/user.service';
import { DateService } from './date.service';
import { NotificationService } from './notification.service';
import { Transaction } from '../models/transaction.model';
import { RecurringTransactionConfirmationDialogComponent } from '../../util/components/recurring-transaction-confirmation-dialog/recurring-transaction-confirmation-dialog.component';

@Injectable({
  providedIn: 'root'
})
export class RecurringTransactionService {

  constructor(
    private transactionsService: TransactionsService,
    private userService: UserService,
    private dateService: DateService,
    private notificationService: NotificationService,
    private dialog: MatDialog
  ) {}

  /**
   * Check for due recurring transactions and show confirmation dialog
   */
  checkDueRecurringTransactions(): Observable<void> {
    const userId = this.userService.userAuth$.value?.uid;
    if (!userId) {
      return of(void 0);
    }

    console.log('Checking for due recurring transactions...');

    return this.transactionsService.getDueRecurringTransactions(userId).pipe(
      switchMap(dueTransactions => {
        console.log(`Found ${dueTransactions.length} due recurring transactions:`, dueTransactions.map(t => ({ id: t.id, payee: t.payee, nextOccurrence: t.nextOccurrence })));
        
        if (dueTransactions.length === 0) {
          console.log('No due recurring transactions found');
          return of(void 0);
        }

        // Show confirmation dialog for each due transaction
        return this.showRecurringTransactionConfirmation(dueTransactions);
      })
    );
  }

  /**
   * Show confirmation dialog for recurring transactions
   */
  private showRecurringTransactionConfirmation(transactions: Transaction[]): Observable<void> {
    return new Observable<void>(observer => {
      const dialogRef = this.dialog.open(RecurringTransactionConfirmationDialogComponent, {
        width: '400px',
        data: { transactions },
        disableClose: true
      });

      dialogRef.afterClosed().subscribe(result => {
        console.log('Recurring transaction confirmation dialog result:', result);
        
        if (result && result.action === 'confirm') {
          console.log(`User confirmed processing of ${result.transactions.length} transactions`);
          // Process confirmed transactions
          this.processConfirmedTransactions(result.transactions).subscribe({
            next: () => {
              console.log('All recurring transactions processed successfully');
              this.notificationService.success('Recurring transactions processed successfully');
              observer.next();
              observer.complete();
            },
            error: (error) => {
              console.error('Failed to process recurring transactions:', error);
              this.notificationService.error('Failed to process recurring transactions');
              observer.error(error);
            }
          });
        } else {
          console.log('User cancelled or skipped recurring transaction processing');
          // User cancelled or skipped
          observer.next();
          observer.complete();
        }
      });
    });
  }

  /**
   * Process confirmed recurring transactions
   */
  private processConfirmedTransactions(transactions: Transaction[]): Observable<void> {
    const userId = this.userService.userAuth$.value?.uid;
    if (!userId) {
      return of(void 0);
    }

    // Process each transaction sequentially
    return new Observable<void>(observer => {
      let processedCount = 0;
      const totalCount = transactions.length;

      const processNext = () => {
        if (processedCount >= totalCount) {
          observer.next();
          observer.complete();
          return;
        }

        const transaction = transactions[processedCount];
        console.log(`Processing transaction ${processedCount + 1}/${totalCount}: ${transaction.id} (${transaction.payee})`);
        
        this.transactionsService.processRecurringTransaction(userId, transaction).subscribe({
          next: () => {
            console.log(`Successfully processed transaction ${transaction.id}`);
            processedCount++;
            processNext();
          },
          error: (error) => {
            console.error(`Failed to process transaction ${transaction.id}:`, error);
            processedCount++;
            processNext(); // Continue with next transaction even if one fails
          }
        });
      };

      processNext();
    });
  }

  /**
   * Get all recurring transactions for a user
   */
  getRecurringTransactions(userId: string): Observable<Transaction[]> {
    return this.transactionsService.getRecurringTransactions(userId);
  }

  /**
   * Get recurring transactions summary
   */
  getRecurringTransactionsSummary(userId: string): Observable<{
    total: number;
    due: number;
    upcoming: number;
  }> {
    return this.transactionsService.getRecurringTransactions(userId).pipe(
      map(transactions => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const due = transactions.filter(t => {
          if (!t.isRecurring || !t.nextOccurrence) return false;
          const nextOccurrence = this.dateService.toDate(t.nextOccurrence);
          if (!nextOccurrence) return false;
          
          const normalizedNextOccurrence = new Date(nextOccurrence);
          normalizedNextOccurrence.setHours(0, 0, 0, 0);
          return normalizedNextOccurrence <= today;
        }).length;

        const upcoming = transactions.filter(t => {
          if (!t.isRecurring || !t.nextOccurrence) return false;
          const nextOccurrence = this.dateService.toDate(t.nextOccurrence);
          if (!nextOccurrence) return false;
          
          const normalizedNextOccurrence = new Date(nextOccurrence);
          normalizedNextOccurrence.setHours(0, 0, 0, 0);
          return normalizedNextOccurrence > today;
        }).length;

        return {
          total: transactions.length,
          due,
          upcoming
        };
      })
    );
  }
} 