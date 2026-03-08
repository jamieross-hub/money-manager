import { Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { 
  Firestore, 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  Timestamp,
  onSnapshot,
  query,
  orderBy,
  where
} from '@angular/fire/firestore';
import { Store } from '@ngrx/store';
import { Observable, of, from } from 'rxjs';
import { map, catchError, tap, timeout, switchMap } from 'rxjs/operators';
import { CommonSyncService, SyncItem } from '../common-sync.service';

import { AppState } from 'src/app/store/app.state';
import * as BudgetsActions from 'src/app/store/budgets/budgets.actions';
import * as BudgetsSelectors from 'src/app/store/budgets/budgets.selectors';
import { LocalStorageKeyHelper } from '../../models/local-storage.model';
import { LocalIndexDBStorageService } from '../indexdb-storage.service';
import { DateService } from '../date.service';

/**
 * Represents a user's budget for a specific category and time period
 */
export interface Budget {
  budgetId: string;
  userId: string;
  category: string;      // e.g. "Groceries", "Entertainment"
  limit: number;         // Total allowed spending limit
  spent: number;         // Accumulated spent amount
  startDate: Timestamp;  // Start of the budget period
  endDate: Timestamp;    // End of the budget period
}

@Injectable({
  providedIn: 'root'
})
export class BudgetsService {
  private readonly GUEST_USER_ID = 'offline-guest';
  private readonly COLLECTION_NAME = 'budgets';

  constructor(
    private readonly firestore: Firestore,
    private readonly auth: Auth,
    private readonly dateService: DateService,
    private readonly localStorageUtility: LocalIndexDBStorageService,
    private readonly store: Store<AppState>,
    private readonly commonSyncService: CommonSyncService
  ) {}

  // ==========================================
  // READ OPERATIONS
  // ==========================================

  /**
   * Retrieves all budgets for a user with real-time sync.
   */
  getBudgets(userId: string): Observable<Budget[]> {
    if (this.isGuest(userId)) {
      const budgets = this.localStorageUtility.getEntities<Budget>(this.COLLECTION_NAME);
      return of(budgets);
    }

    return this.localStorageUtility.isReady$.pipe(
      switchMap(() => {
        return new Observable<Budget[]>(observer => {
          // 1. Try cache first
          const cacheKey = LocalStorageKeyHelper.getBudgetsCacheKey(userId);
          const cachedBudgets = this.localStorageUtility.getItem<Budget[]>(cacheKey) || [];
          observer.next(cachedBudgets);

          // 2. Setup real-time listener
          const budgetsRef = query(
            collection(this.firestore, `users/${userId}/${this.COLLECTION_NAME}`),
            orderBy('category', 'asc')
          );

          const unsubscribe = onSnapshot(budgetsRef, (snap) => {
            const budgets: Budget[] = [];
            snap.forEach(docSnap => budgets.push(docSnap.data() as Budget));

            this.localStorageUtility.setItem(cacheKey, budgets);
            this.store.dispatch(BudgetsActions.loadBudgetsSuccess({ budgets }));
            observer.next(budgets);
          }, (error) => {
            console.error('[BudgetsService] Real-time listener failed:', error);
            observer.next(cachedBudgets);
          });

          return () => unsubscribe();
        });
      })
    );
  }

  /**
   * Retrieves a single budget by ID.
   */
  async getBudget(userId: string, budgetId: string): Promise<Budget | undefined> {
    const isGuest = this.isGuest(userId);
    const cacheKey = LocalStorageKeyHelper.getBudgetsCacheKey(userId);
    
    // 1. Try reading from local cache first
    let cachedBudgets: Budget[] = [];
    if (isGuest) {
      cachedBudgets = this.localStorageUtility.getEntities<Budget>(this.COLLECTION_NAME);
    } else {
      cachedBudgets = this.localStorageUtility.getItem<Budget[]>(cacheKey) || [];
    }
    
    const cachedBudget = cachedBudgets.find(b => b.budgetId === budgetId);
    if (cachedBudget) return cachedBudget;

    if (isGuest) return undefined;

    // 2. Fallback to Firestore if not found in cache
    try {
      const budgetRef = this.getBudgetDocRef(userId, budgetId);
      const budgetSnap = await getDoc(budgetRef);
      
      if (budgetSnap.exists()) {
        const budget = budgetSnap.data() as Budget;
        // Update cache
        cachedBudgets.push(budget);
        this.localStorageUtility.setItem(cacheKey, cachedBudgets);
        return budget;
      }
    } catch (error) {
      console.error('[BudgetsService] Error fetching budget from Firestore:', error);
    }
    
    return undefined;
  }

  // ==========================================
  // WRITE OPERATIONS
  // ==========================================

  /**
   * Creates a new budget.
   */
  async createBudget(userId: string, budget: Budget): Promise<void> {
    const newBudget = { ...budget, spent: 0 };
    
    // 1. Optimistic Update (Cache & NgRx)
    if (this.isGuest(userId)) {
      this.localStorageUtility.saveEntity(this.COLLECTION_NAME, newBudget, 'budgetId');
    } else {
      const cacheKey = LocalStorageKeyHelper.getBudgetsCacheKey(userId);
      const budgets = this.localStorageUtility.getItem<Budget[]>(cacheKey) || [];
      budgets.push(newBudget);
      this.localStorageUtility.setItem(cacheKey, budgets);
    }
    
    this.store.dispatch(BudgetsActions.createBudgetSuccess({ budget: newBudget }));

    if (this.isGuest(userId)) return;

    // 2. Queue for Sync
    await this.addToSyncQueue('create', {
      ...newBudget,
      startDate: this.dateService.toTimestamp(newBudget.startDate)?.toMillis() ?? Date.now(),
      endDate: this.dateService.toTimestamp(newBudget.endDate)?.toMillis() ?? Date.now(),
    }, userId);
  }

  /**
   * Updates an existing budget.
   */
  async updateBudget(userId: string, budgetId: string, updatedBudget: Partial<Budget>): Promise<void> {
    // 1. Optimistic Update
    let currentBudget: Budget | undefined;
    if (this.isGuest(userId)) {
      const budgets = this.localStorageUtility.getEntities<Budget>(this.COLLECTION_NAME);
      const index = budgets.findIndex(b => b.budgetId === budgetId);
      if (index !== -1) {
        budgets[index] = { ...budgets[index], ...updatedBudget };
        currentBudget = budgets[index];
        this.localStorageUtility.saveEntities(this.COLLECTION_NAME, budgets);
      }
    } else {
      const cacheKey = LocalStorageKeyHelper.getBudgetsCacheKey(userId);
      const budgets = this.localStorageUtility.getItem<Budget[]>(cacheKey) || [];
      const index = budgets.findIndex(b => b.budgetId === budgetId);
      if (index !== -1) {
        budgets[index] = { ...budgets[index], ...updatedBudget };
        currentBudget = budgets[index];
        this.localStorageUtility.setItem(cacheKey, budgets);
      }
    }

    if (currentBudget) {
      this.store.dispatch(BudgetsActions.updateBudgetSuccess({ budget: currentBudget }));
    }

    if (this.isGuest(userId)) return;

    // 2. Queue for Sync
    const syncData: any = { budgetId, ...updatedBudget };
    if (updatedBudget.startDate) syncData.startDate = this.dateService.toTimestamp(updatedBudget.startDate)?.toMillis();
    if (updatedBudget.endDate) syncData.endDate = this.dateService.toTimestamp(updatedBudget.endDate)?.toMillis();

    await this.addToSyncQueue('update', syncData, userId);
  }

  /**
   * Deletes a budget by ID.
   */
  async deleteBudget(userId: string, budgetId: string): Promise<void> {
    // 1. Optimistic Update
    if (this.isGuest(userId)) {
      this.localStorageUtility.deleteEntity(this.COLLECTION_NAME, budgetId, 'budgetId');
    } else {
      const cacheKey = LocalStorageKeyHelper.getBudgetsCacheKey(userId);
      const budgets = this.localStorageUtility.getItem<Budget[]>(cacheKey) || [];
      const filtered = budgets.filter(b => b.budgetId !== budgetId);
      this.localStorageUtility.setItem(cacheKey, filtered);
    }
    
    this.store.dispatch(BudgetsActions.deleteBudgetSuccess({ budgetId }));

    if (this.isGuest(userId)) return;

    // 2. Queue for Sync
    await this.addToSyncQueue('delete', { budgetId }, userId);
  }

  /**
   * Increments the spent amount for a specific budget.
   */
  async updateSpent(userId: string, budgetId: string, amount: number): Promise<void> {
    // 1. Optimistic Update
    let currentSpent = 0;
    let budgetToUpdate: Budget | undefined;

    if (this.isGuest(userId)) {
      const budgets = this.localStorageUtility.getEntities<Budget>(this.COLLECTION_NAME);
      const index = budgets.findIndex(b => b.budgetId === budgetId);
      if (index !== -1) {
        budgets[index].spent = (budgets[index].spent || 0) + amount;
        currentSpent = budgets[index].spent;
        budgetToUpdate = budgets[index];
        this.localStorageUtility.saveEntities(this.COLLECTION_NAME, budgets);
      }
    } else {
      const cacheKey = LocalStorageKeyHelper.getBudgetsCacheKey(userId);
      const budgets = this.localStorageUtility.getItem<Budget[]>(cacheKey) || [];
      const index = budgets.findIndex(b => b.budgetId === budgetId);
      if (index !== -1) {
        budgets[index].spent = (budgets[index].spent || 0) + amount;
        currentSpent = budgets[index].spent;
        budgetToUpdate = budgets[index];
        this.localStorageUtility.setItem(cacheKey, budgets);
      }
    }

    if (budgetToUpdate) {
      this.store.dispatch(BudgetsActions.updateBudgetSuccess({ budget: budgetToUpdate }));
    }

    if (this.isGuest(userId)) return;

    // 2. Queue for Sync
    await this.addToSyncQueue('update', { budgetId, spent: currentSpent }, userId);
  }

  // ==========================================
  // SYNC OPERATIONS
  // ==========================================

  /**
   * Pulls all budgets from Firestore to update local cache and NgRx Store.
   */
  pullFromFirestore(userId: string): Observable<void> {
    if (this.isGuest(userId)) return of(undefined);

    // Ensure we have an active auth user before attempting pull
    const currentUser = this.auth.currentUser;
    if (!currentUser || currentUser.uid !== userId) {
      console.warn(`[BudgetsService] Pull skipped: Auth user mismatch or not logged in (UID: ${currentUser?.uid}, expected: ${userId})`);
      return of(undefined);
    }

    const budgetsRef = collection(this.firestore, `users/${userId}/${this.COLLECTION_NAME}`);
    console.log(`[BudgetsService] Pulling budgets for user: ${userId}`);

    return from(getDocs(budgetsRef)).pipe(
      timeout(15000), // Slightly increased timeout
      tap((querySnapshot) => {
        const budgets: Budget[] = [];
        querySnapshot.forEach(docSnap => budgets.push(docSnap.data() as Budget));

        console.log(`[BudgetsService] Pulled ${budgets.length} budgets from Firestore`);

        // Update local cache
        this.localStorageUtility.setItem(LocalStorageKeyHelper.getBudgetsCacheKey(userId), budgets);
        
        // Update NgRx state
        this.store.dispatch(BudgetsActions.loadBudgetsSuccess({ budgets }));
      }),
      map(() => undefined),
      catchError(error => {
        if (error.code === 'permission-denied') {
          console.error(`[BudgetsService] Permission Denied for user ${userId}. Ensure Firestore rules allow access to users/${userId}/${this.COLLECTION_NAME}`);
        } else {
          console.error('[BudgetsService] Pull failed:', error);
        }
        return of(undefined);
      })
    );
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  /**
   * Checks if the user is in guest mode.
   */
  private isGuest(userId: string): boolean {
    return userId === this.GUEST_USER_ID;
  }

  /**
   * Add budget to sync queue
   */
  private async addToSyncQueue(operation: 'create' | 'update' | 'delete', data: any, userId: string): Promise<void> {
    const syncItem: Omit<SyncItem, 'timestamp' | 'retryCount'> = {
      id: data.budgetId,
      type: 'budget',
      operation: operation,
      data: data,
      maxRetries: 3,
      collectionPath: `users/${userId}/${this.COLLECTION_NAME}`
    };

    const result = await this.commonSyncService.registerSyncItem(syncItem);
    if (!result.success) {
      console.error('Failed to register budget for sync:', result.errors);
    }
  }

  /**
   * Generates a Firestore DocumentReference for a specific budget.
   */
  private getBudgetDocRef(userId: string, budgetId: string) {
    return doc(this.firestore, `users/${userId}/${this.COLLECTION_NAME}/${budgetId}`);
  }
}
