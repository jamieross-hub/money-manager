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
  Timestamp 
} from '@angular/fire/firestore';
import { Store } from '@ngrx/store';
import { Observable, of, from } from 'rxjs';
import { map, catchError, tap, timeout } from 'rxjs/operators';

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
    private readonly store: Store<AppState>
  ) {}

  // ==========================================
  // READ OPERATIONS
  // ==========================================

  /**
   * Retrieves all budgets for a user.
   * For guests, it reads from IndexedDB.
   * For authenticated users, it selects from the NgRx Store.
   */
  getBudgets(userId: string): Observable<Budget[]> {
    if (this.isGuest(userId)) {
      const budgets = this.localStorageUtility.getEntities<Budget>(this.COLLECTION_NAME);
      return of(budgets);
    }
    return this.store.select(BudgetsSelectors.selectAllBudgets);
  }

  /**
   * Retrieves a single budget by ID.
   */
  async getBudget(userId: string, budgetId: string): Promise<Budget | undefined> {
    if (this.isGuest(userId)) {
      const budgets = this.localStorageUtility.getEntities<Budget>(this.COLLECTION_NAME);
      return budgets.find(b => b.budgetId === budgetId);
    }

    const budgetRef = this.getBudgetDocRef(userId, budgetId);
    const budgetSnap = await getDoc(budgetRef);
    
    return budgetSnap.exists() ? (budgetSnap.data() as Budget) : undefined;
  }

  // ==========================================
  // WRITE OPERATIONS
  // ==========================================

  /**
   * Creates a new budget.
   */
  async createBudget(userId: string, budget: Budget): Promise<void> {
    if (this.isGuest(userId)) {
      const newBudget = { ...budget, spent: 0 };
      this.localStorageUtility.saveEntity(this.COLLECTION_NAME, newBudget, 'budgetId');
      return;
    }

    const budgetRef = this.getBudgetDocRef(userId, budget.budgetId);
    await setDoc(budgetRef, {
      ...budget,
      startDate: this.dateService.toTimestamp(budget.startDate),
      endDate: this.dateService.toTimestamp(budget.endDate),
      spent: 0,
    });
  }

  /**
   * Updates an existing budget.
   */
  async updateBudget(userId: string, budgetId: string, updatedBudget: Partial<Budget>): Promise<void> {
    if (this.isGuest(userId)) {
      const budgets = this.localStorageUtility.getEntities<Budget>(this.COLLECTION_NAME);
      const index = budgets.findIndex(b => b.budgetId === budgetId);
      
      if (index !== -1) {
        budgets[index] = { ...budgets[index], ...updatedBudget };
        this.localStorageUtility.saveEntities(this.COLLECTION_NAME, budgets);
      }
      return;
    }

    const budgetRef = this.getBudgetDocRef(userId, budgetId);
    await updateDoc(budgetRef, updatedBudget);
  }

  /**
   * Deletes a budget by ID.
   */
  async deleteBudget(userId: string, budgetId: string): Promise<void> {
    if (this.isGuest(userId)) {
      this.localStorageUtility.deleteEntity(this.COLLECTION_NAME, budgetId, 'budgetId');
      return;
    }

    const budgetRef = this.getBudgetDocRef(userId, budgetId);
    await deleteDoc(budgetRef);
  }

  /**
   * Increments the spent amount for a specific budget.
   */
  async updateSpent(userId: string, budgetId: string, amount: number): Promise<void> {
    if (this.isGuest(userId)) {
      const budgets = this.localStorageUtility.getEntities<Budget>(this.COLLECTION_NAME);
      const index = budgets.findIndex(b => b.budgetId === budgetId);
      
      if (index !== -1) {
        budgets[index].spent = (budgets[index].spent || 0) + amount;
        this.localStorageUtility.saveEntities(this.COLLECTION_NAME, budgets);
      }
      return;
    }

    const budgetRef = this.getBudgetDocRef(userId, budgetId);
    const budgetSnap = await getDoc(budgetRef);
    
    if (budgetSnap.exists()) {
      const currentSpent = budgetSnap.data()?.['spent'] || 0;
      await updateDoc(budgetRef, { spent: currentSpent + amount });
    }
  }

  // ==========================================
  // SYNC OPERATIONS
  // ==========================================

  /**
   * Pulls all budgets from Firestore to update local cache and NgRx Store.
   */
  pullFromFirestore(userId: string): Observable<void> {
    if (this.isGuest(userId)) return of(undefined);

    const budgetsRef = collection(this.firestore, `users/${userId}/${this.COLLECTION_NAME}`);
    console.log(`[BudgetsService] Pulling budgets for user: ${userId}`);

    return from(getDocs(budgetsRef)).pipe(
      timeout(10000),
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
        console.error('[BudgetsService] Pull failed:', error);
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
   * Generates a Firestore DocumentReference for a specific budget.
   */
  private getBudgetDocRef(userId: string, budgetId: string) {
    return doc(this.firestore, `users/${userId}/${this.COLLECTION_NAME}/${budgetId}`);
  }
}
