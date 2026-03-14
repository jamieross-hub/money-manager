import { Injectable } from '@angular/core';
import { Firestore, collection, doc, updateDoc, deleteDoc, getDoc, addDoc, onSnapshot, setDoc, query, orderBy, getDocs, Timestamp } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, from, of, BehaviorSubject } from 'rxjs';
import { map, tap, catchError, timeout, switchMap } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { BaseService } from '../base.service';
import { Transaction } from '../../models/transaction.model';
import { RecurringTemplate } from '../../models/recurring.model';
import { RecurringInterval, SyncStatus, TransactionStatus } from '../../config/enums';
import { DateService } from '../date.service';
import { CurrencyService } from '../currency.service';
import { TransactionsService } from './transactions.service';
import { LocalIndexDBStorageService } from '../indexdb-storage.service';
import { UserService } from './user.service';
import { LocalStorageKeyHelper } from '../../models/local-storage.model';

@Injectable({
  providedIn: 'root'
})
export class RecurringService extends BaseService {
  private recurringTemplatesSubject = new BehaviorSubject<RecurringTemplate[]>([]);
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
  createRecurringTemplate(userId: string, template: Omit<RecurringTemplate, 'id'>, id?: string): Observable<string> {
    const templateId = id || this.generateId();
    const now = new Date();
    
    // Calculate next occurrence if not provided
    let nextOccurrence = template.nextOccurrence;
    if (!nextOccurrence && template.recurringInterval) {
      const baseDate = this.dateService.toDate(now) || now;
      nextOccurrence = this.calculateNextOccurrence(template.recurringInterval, baseDate);
    }

    const templateData: RecurringTemplate = this.scrubUndefined({
      ...template,
      id: templateId,
      nextOccurrence,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId,
      isActive: template.isActive !== undefined ? template.isActive : true
    });

    if (this.isGuest()) {
      const cacheKey = LocalStorageKeyHelper.getRecurringCacheKey(userId);
      const templates = this.localStorageUtility.getItem<RecurringTemplate[]>(cacheKey) || [];
      templates.push(templateData);
      this.localStorageUtility.setItem(cacheKey, templates);
      this.recurringTemplatesSubject.next(templates);
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
  updateRecurringTemplate(userId: string, templateId: string, updates: Partial<RecurringTemplate>): Observable<void> {
    const now = new Date();
    const updateData = this.scrubUndefined({
      ...updates,
      updatedAt: now,
      updatedBy: userId
    });

    if (this.isGuest()) {
      const cacheKey = LocalStorageKeyHelper.getRecurringCacheKey(userId);
      const templates = this.localStorageUtility.getItem<RecurringTemplate[]>(cacheKey) || [];
      const index = templates.findIndex(t => t.id === templateId);
      if (index !== -1) {
        templates[index] = { ...templates[index], ...updateData };
        this.localStorageUtility.setItem(cacheKey, templates);
        this.recurringTemplatesSubject.next(templates);
      }
      return of(undefined);
    }

    return from(setDoc(doc(this.firestore, this.getRecurringTemplatePath(userId, templateId)), updateData, { merge: true })).pipe(
      catchError(err => this.handleError(err, 'updateRecurringTemplate'))
    );
  }

  /**
   * Delete a recurring transaction template
   */
  deleteRecurringTemplate(userId: string, templateId: string): Observable<void> {
    if (this.isGuest()) {
      const cacheKey = LocalStorageKeyHelper.getRecurringCacheKey(userId);
      const templates = this.localStorageUtility.getItem<RecurringTemplate[]>(cacheKey) || [];
      const filtered = templates.filter(t => t.id !== templateId);
      this.localStorageUtility.setItem(cacheKey, filtered);
      this.recurringTemplatesSubject.next(filtered);
      return of(undefined);
    }

    return from(deleteDoc(doc(this.firestore, this.getRecurringTemplatePath(userId, templateId)))).pipe(
      catchError(err => this.handleError(err, 'deleteRecurringTemplate'))
    );
  }

  /**
   * Fetch all recurring templates for a user
   */
  getRecurringTemplates(userId: string): Observable<RecurringTemplate[]> {
    return this.localStorageUtility.isReady$.pipe(
      switchMap(() => {
        const cacheKey = LocalStorageKeyHelper.getRecurringCacheKey(userId);
        const templates = this.localStorageUtility.getItem<RecurringTemplate[]>(cacheKey) || [];
        
        // 1. Emit cached templates immediately
        if (templates.length > 0) {
          this.recurringTemplatesSubject.next(templates);
        }

        // 2. Fetch from Firestore in the background if not guest
        if (!this.isGuest()) {
          const recurringRef = query(collection(this.firestore, this.getRecurringPath(userId)));
          from(getDocs(recurringRef)).pipe(
            timeout(15000)
          ).subscribe({
            next: (snapshot) => {
              const fetchedTemplates: RecurringTemplate[] = [];
              snapshot.forEach(doc => fetchedTemplates.push({ id: doc.id, ...doc.data() } as RecurringTemplate));
              
              this.localStorageUtility.setItem(cacheKey, fetchedTemplates);
              this.recurringTemplatesSubject.next(fetchedTemplates);
            },
            error: (err) => {
              console.warn(`[RecurringService] ⚠️ Fetch failed for ${userId} (may be offline):`, err);
            }
          });
        }

        // 3. Return reactive subject
        return this.recurringTemplatesSubject.asObservable();
      })
    );
  }

  /**
   * Process a recurring transaction
   */
  processRecurringTransaction(userId: string, template: RecurringTemplate, confirmedDate?: Date): Observable<void> {
    const creationDate = confirmedDate || new Date();
    
    // 1. Map template to concrete transaction
    const newTransaction = this.mapTemplateToTransaction(userId, template, creationDate);

    return this.transactionsService.createTransaction(userId, newTransaction).pipe(
      switchMap(() => {
        // 2. Update the template's next occurrence
        const nextOccurrence = this.calculateNextOccurrence(template.recurringInterval, creationDate);
        const updates: Partial<RecurringTemplate> = {
          nextOccurrence,
          lastProcessedAt: new Date(),
          updatedAt: new Date(),
          updatedBy: userId
        };

        if (template.recurringEndDate && nextOccurrence > this.dateService.toDate(template.recurringEndDate)!) {
           // If we've reached the end date, deactivate the template
           return this.updateRecurringTemplate(userId, template.id!, { ...updates, isActive: false });
        }

        return this.updateRecurringTemplate(userId, template.id!, updates);
      })
    );
  }

  /**
   * Skip an occurrence
   */
  skipRecurringTransaction(userId: string, template: RecurringTemplate, skippedDate?: Date): Observable<void> {
    const baseDate = skippedDate || (template.nextOccurrence 
        ? this.dateService.toDate(template.nextOccurrence)
        : new Date());
    
    const nextOccurrence = this.calculateNextOccurrence(template.recurringInterval, baseDate || new Date());

    const updates: Partial<RecurringTemplate> = {
      nextOccurrence,
      updatedAt: new Date(),
      updatedBy: userId
    };

    if (template.recurringEndDate && nextOccurrence > this.dateService.toDate(template.recurringEndDate)!) {
        return this.updateRecurringTemplate(userId, template.id!, { ...updates, isActive: false });
    }

    return this.updateRecurringTemplate(userId, template.id!, updates);
  }

  /**
   * Helper to map a RecurringTemplate to a concrete Transaction
   */
  private mapTemplateToTransaction(userId: string, template: RecurringTemplate, date: Date): Omit<Transaction, 'id'> {
    const now = new Date();
    return {
      userId,
      accountId: template.accountId,
      categoryId: template.categoryId,
      category: template.category,
      payee: template.payee,
      amount: template.amount,
      type: template.type,
      date: date,
      notes: template.notes,
      paymentMethod: template.paymentMethod,
      tags: template.tags,
      status: TransactionStatus.COMPLETED,
      syncStatus: SyncStatus.SYNCED,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId,
      familyId: template.familyId || '',
      // Metadata to track its origin
      isRecurring: false // The concrete transaction itself is not recurring
    };
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
