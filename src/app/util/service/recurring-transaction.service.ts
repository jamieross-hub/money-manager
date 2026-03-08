import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { TransactionsService } from './db/transactions.service';
import { RecurringService } from './db/recurring.service';
import { UserService } from './db/user.service';
import { DateService } from './date.service';
import { NotificationService } from './notification.service';
import { Transaction } from '../models/transaction.model';
import { RecurringTemplate } from '../models/recurring.model';

@Injectable({
  providedIn: 'root'
})
export class RecurringTransactionService {

  constructor(
    private transactionsService: TransactionsService,
    private recurringService: RecurringService,
    private userService: UserService,
    private dateService: DateService,
    private notificationService: NotificationService,
    private dialog: MatDialog
  ) {}

  /**
   * Check for due recurring transactions
   * Note: Confirmation popup removed in favor of inline list display in mobile-transaction-list
   */
  checkDueRecurringTransactions(): Observable<void> {
    return of(void 0);
  }

  /**
   * Get all recurring transactions for a user
   */
  getRecurringTransactions(userId: string): Observable<RecurringTemplate[]> {
    return this.recurringService.getRecurringTemplates(userId);
  }

  /**
   * Get recurring transactions summary
   */
  getRecurringTransactionsSummary(userId: string): Observable<{
    total: number;
    due: number;
    upcoming: number;
  }> {
    return this.recurringService.getRecurringTemplates(userId).pipe(
      map(transactions => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dueCount = transactions.filter(t => {
          if (!t.nextOccurrence) return false;
          const nextOccurrence = this.dateService.toDate(t.nextOccurrence);
          if (!nextOccurrence) return false;
          
          const normalizedNextOccurrence = new Date(nextOccurrence);
          normalizedNextOccurrence.setHours(0, 0, 0, 0);
          return normalizedNextOccurrence <= today;
        }).length;

        const upcomingCount = transactions.filter(t => {
          if (!t.nextOccurrence) return false;
          const nextOccurrence = this.dateService.toDate(t.nextOccurrence);
          if (!nextOccurrence) return false;
          
          const normalizedNextOccurrence = new Date(nextOccurrence);
          normalizedNextOccurrence.setHours(0, 0, 0, 0);
          return normalizedNextOccurrence > today;
        }).length;

        return {
          total: transactions.length,
          due: dueCount,
          upcoming: upcomingCount
        };
      })
    );
  }
}