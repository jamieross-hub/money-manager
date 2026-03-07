import { Injectable } from '@angular/core';
import { Firestore, collection, doc, updateDoc, deleteDoc, getDoc, addDoc, onSnapshot, setDoc, query, orderBy, getDocs } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, from, of, BehaviorSubject } from 'rxjs';
import { map, tap, catchError, timeout, switchMap } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { BaseService } from '../base.service';
import { Transaction } from '../../models/transaction.model';
import { RecurringInterval, SyncStatus, TransactionStatus } from '../../config/enums';
import { DateService } from '../date.service';
import { CurrencyService } from '../currency.service';
import { TransactionsService } from './transactions.service';
import { LocalIndexDBStorageService } from '../indexdb-storage.service';
import { UserService } from './user.service';
import { LocalStorageKeyHelper } from '../../models/local-storage.model';
import * as TransactionsActions from '../../../store/transactions/transactions.actions';
import * as TransactionsSelectors from '../../../store/transactions/transactions.selectors';

@Injectable({
  providedIn: 'root'
})
export class RecurringService extends BaseService {
  private recurringTemplatesSubject = new BehaviorSubject<Transaction[]>([]);
  public recurringTemplates$ = this.recurringTemplatesSubject.asObservable();

  constructor(
    firestore: Firestore,
    auth: Auth,
    currencyService: CurrencyService,
    protected store: Store<AppState>,
    private dateService: DateService,
    private transactionsService: TransactionsService,
    private localStorageUtility: LocalIndexDBStorageService,
    protected userService: UserService
  ) {
    super(firestore, auth, currencyService);
  }

  protected getRecurringPath(userId: string): string {
    return `users/${userId}/recurring`;
  }

  protected getRecurringTemplatePath(userId: string, templateId: string): string {
    return `${this.getRecurringPath(userId)}/${templateId}`;
  }

  private isGuest(): boolean {
    return this.userService.getCurrentUserId() === 'offline-guest';
  }

  /**
   * Create a new recurring transaction template
   */
  createRecurringTemplate(userId: string, template: Omit<Transaction, 'id'>): Observable<string> {
    const templateId = this.generateId();
    const now = new Date();
    
    // Calculate next occurrence if not provided
    let nextOccurrence = template.nextOccurrence;
    if (!nextOccurrence && template.recurringInterval) {
      const baseDate = (template.date ? this.dateService.toDate(template.date) : now) || now;
      nextOccurrence = this.calculateNextOccurrence(template.recurringInterval, baseDate);
    }

    const templateData: Transaction = this.scrubUndefined({
      ...template,
      id: templateId,
      nextOccurrence,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId,
      isRecurring: true,
      syncStatus: SyncStatus.SYNCED // Templates are primarily server-side for now
    });

    if (this.isGuest()) {
      const templates = this.localStorageUtility.getItem<Transaction[]>(LocalStorageKeyHelper.getTransactionsCacheKey(userId)) || [];
      templates.push(templateData);
      this.localStorageUtility.setItem(LocalStorageKeyHelper.getTransactionsCacheKey(userId), templates);
      this.recurringTemplatesSubject.next(templates.filter(t => t.isRecurring));
      return of(templateId);
    }

    return from(setDoc(doc(this.firestore, this.getRecurringTemplatePath(userId, templateId)), templateData)).pipe(
      map(() => templateId),
      catchError(err => this.handleError(err, 'createRecurringTemplate'))
    );
  }

  /**
   * Update a recurring transaction template
   */
  updateRecurringTemplate(userId: string, templateId: string, updates: Partial<Transaction>): Observable<void> {
    const now = new Date();
    const updateData = this.scrubUndefined({
      ...updates,
      updatedAt: now,
      updatedBy: userId
    });

    if (this.isGuest()) {
      const templates = this.localStorageUtility.getItem<Transaction[]>(LocalStorageKeyHelper.getTransactionsCacheKey(userId)) || [];
      const index = templates.findIndex(t => t.id === templateId);
      if (index !== -1) {
        templates[index] = { ...templates[index], ...updateData };
        this.localStorageUtility.setItem(LocalStorageKeyHelper.getTransactionsCacheKey(userId), templates);
        this.recurringTemplatesSubject.next(templates.filter(t => t.isRecurring));
      }
      return of(undefined);
    }

    return from(updateDoc(doc(this.firestore, this.getRecurringTemplatePath(userId, templateId)), updateData)).pipe(
      catchError(err => this.handleError(err, 'updateRecurringTemplate'))
    );
  }

  /**
   * Delete a recurring transaction template
   */
  deleteRecurringTemplate(userId: string, templateId: string): Observable<void> {
    if (this.isGuest()) {
      const templates = this.localStorageUtility.getItem<Transaction[]>(LocalStorageKeyHelper.getTransactionsCacheKey(userId)) || [];
      const filtered = templates.filter(t => t.id !== templateId);
      this.localStorageUtility.setItem(LocalStorageKeyHelper.getTransactionsCacheKey(userId), filtered);
      this.recurringTemplatesSubject.next(filtered.filter(t => t.isRecurring));
      return of(undefined);
    }

    return from(deleteDoc(doc(this.firestore, this.getRecurringTemplatePath(userId, templateId)))).pipe(
      catchError(err => this.handleError(err, 'deleteRecurringTemplate'))
    );
  }

  /**
   * Fetch all recurring templates for a user
   */
  getRecurringTemplates(userId: string): Observable<Transaction[]> {
    if (this.isGuest()) {
      const templates = this.localStorageUtility.getItem<Transaction[]>(LocalStorageKeyHelper.getTransactionsCacheKey(userId)) || [];
      return of(templates.filter(t => t.isRecurring));
    }

    const recurringRef = query(collection(this.firestore, this.getRecurringPath(userId)));
    return from(getDocs(recurringRef)).pipe(
      map(snapshot => {
        const templates: Transaction[] = [];
        snapshot.forEach(doc => templates.push({ id: doc.id, ...doc.data() } as Transaction));
        this.recurringTemplatesSubject.next(templates);
        return templates;
      }),
      catchError(err => this.handleError(err, 'getRecurringTemplates'))
    );
  }

  /**
   * Process a recurring transaction (Moved from TransactionsService)
   */
  processRecurringTransaction(userId: string, template: Transaction, confirmedDate?: Date): Observable<void> {
    const creationDate = confirmedDate || new Date();
    
    // 1. Create the concrete transaction in /transactions
    const newTransaction: Omit<Transaction, 'id'> = {
      ...template,
      date: creationDate,
      nextOccurrence: null,
      isRecurring: false,
      recurringInterval: null,
      recurringEndDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
      updatedBy: userId,
      syncStatus: SyncStatus.SYNCED,
      isPending: false,
      lastSyncedAt: new Date(),
      status: TransactionStatus.COMPLETED
    };

    return this.transactionsService.createTransaction(userId, newTransaction).pipe(
      switchMap(() => {
        // 2. Update the template's next occurrence
        if (template.recurringInterval) {
          const nextOccurrence = this.calculateNextOccurrence(template.recurringInterval, creationDate);
          const updates: Partial<Transaction> = {
            nextOccurrence,
            updatedAt: new Date(),
            updatedBy: userId
          };

          if (template.recurringEndDate && nextOccurrence > this.dateService.toDate(template.recurringEndDate)!) {
             // If we've reached the end date, we could delete or deactivate the template
             return this.deleteRecurringTemplate(userId, template.id!);
          }

          return this.updateRecurringTemplate(userId, template.id!, updates);
        }
        return of(undefined);
      })
    );
  }

  /**
   * Skip an occurrence (Moved from TransactionsService)
   */
  skipRecurringTransaction(userId: string, template: Transaction, skippedDate?: Date): Observable<void> {
    if (!template.recurringInterval) return of(undefined);

    const baseDate = skippedDate || (template.nextOccurrence 
        ? this.dateService.toDate(template.nextOccurrence)
        : new Date());
    
    const nextOccurrence = this.calculateNextOccurrence(template.recurringInterval, baseDate || new Date());

    const updates: Partial<Transaction> = {
      nextOccurrence,
      updatedAt: new Date(),
      updatedBy: userId
    };

    if (template.recurringEndDate && nextOccurrence > this.dateService.toDate(template.recurringEndDate)!) {
        return this.deleteRecurringTemplate(userId, template.id!);
    }

    return this.updateRecurringTemplate(userId, template.id!, updates);
  }

  private calculateNextOccurrence(interval: RecurringInterval, baseDate: Date): Date {
    const nextDate = new Date(baseDate);
    switch (interval) {
      case RecurringInterval.DAILY:
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case RecurringInterval.WEEKLY:
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case RecurringInterval.MONTHLY:
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case RecurringInterval.YEARLY:
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
    }
    return nextDate;
  }
}
