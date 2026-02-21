import { Injectable } from '@angular/core';
import { Firestore, collection, doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, Timestamp, onSnapshot } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, of, from } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { DateService } from '../date.service';
import { LocalIndexDBStorageService } from '../indexdb-storage.service';
import { LocalStorageKeyHelper } from '../../models/local-storage.model';

import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import * as BudgetsActions from 'src/app/store/budgets/budgets.actions';
import * as BudgetsSelectors from 'src/app/store/budgets/budgets.selectors';

export interface Budget {
  budgetId: string;
  userId: string;
  category: string;   // "Groceries", "Entertainment", etc.
  limit: number;      // The budget limit
  spent: number;      // Total spent in this category (calculated field)
  startDate: Timestamp;  // Start date of the budget period
  endDate: Timestamp;    // End date of the budget period
}

@Injectable({
  providedIn: 'root'
})
export class BudgetsService {

  constructor(
    private firestore: Firestore,
    private auth: Auth,
    private dateService: DateService,
    private localStorageUtility: LocalIndexDBStorageService,
    private store: Store<AppState>
  ) { }

  // 🔹 Create a new budget
  async createBudget(userId: string, budget: Budget): Promise<void> {
    if (userId === 'offline-guest') {
      this.localStorageUtility.saveEntity('budgets', {
        ...budget,
        spent: 0
      }, 'budgetId');
      return;
    }

    const budgetRef = doc(this.firestore, `users/${userId}/budgets/${budget.budgetId}`);
    await setDoc(budgetRef, {
      ...budget,
      startDate: this.dateService.toTimestamp(budget.startDate),
      endDate: this.dateService.toTimestamp(budget.endDate),
      spent: 0, // Initialize spent to 0
    });
  }

  /** Get all budgets (Store-based) */
  getBudgets(userId: string): Observable<Budget[]> {
    if (userId === 'offline-guest') {
      const budgets = this.localStorageUtility.getEntities<Budget>('budgets');
      return of(budgets);
    }

    return this.store.select(BudgetsSelectors.selectAllBudgets);
  }

  // 🔹 Get a single budget by its ID
  async getBudget(userId: string, budgetId: string): Promise<Budget | undefined> {
    if (userId === 'offline-guest') {
      const budgets = this.localStorageUtility.getEntities<Budget>('budgets');
      return budgets.find(b => b.budgetId === budgetId);
    }

    const budgetRef = doc(this.firestore, `users/${userId}/budgets/${budgetId}`);
    const budgetSnap = await getDoc(budgetRef);
    if (budgetSnap.exists()) {
      return budgetSnap.data() as Budget;
    }
    return undefined;
  }

  // 🔹 Update an existing budget
  async updateBudget(userId: string, budgetId: string, updatedBudget: Partial<Budget>): Promise<void> {
    if (userId === 'offline-guest') {
      const budgets = this.localStorageUtility.getEntities<Budget>('budgets');
      const index = budgets.findIndex(b => b.budgetId === budgetId);
      if (index !== -1) {
        budgets[index] = { ...budgets[index], ...updatedBudget };
        this.localStorageUtility.saveEntities('budgets', budgets);
      }
      return;
    }

    const budgetRef = doc(this.firestore, `users/${userId}/budgets/${budgetId}`);
    await updateDoc(budgetRef, updatedBudget);
  }

  // 🔹 Delete a budget
  async deleteBudget(userId: string, budgetId: string): Promise<void> {
    if (userId === 'offline-guest') {
      this.localStorageUtility.deleteEntity('budgets', budgetId, 'budgetId');
      return;
    }

    const budgetRef = doc(this.firestore, `users/${userId}/budgets/${budgetId}`);
    await deleteDoc(budgetRef);
  }

  // 🔹 Update the spent amount for a budget
  async updateSpent(userId: string, budgetId: string, amount: number): Promise<void> {
    if (userId === 'offline-guest') {
      const budgets = this.localStorageUtility.getEntities<Budget>('budgets');
      const index = budgets.findIndex(b => b.budgetId === budgetId);
      if (index !== -1) {
        const currentSpent = budgets[index].spent || 0;
        budgets[index].spent = currentSpent + amount;
        this.localStorageUtility.saveEntities('budgets', budgets);
      }
      return;
    }

    const budgetRef = doc(this.firestore, `users/${userId}/budgets/${budgetId}`);
    const budgetSnap = await getDoc(budgetRef);
    if (budgetSnap.exists()) {
      const currentSpent = budgetSnap.data()?.['spent'] || 0;
      const newSpent = currentSpent + amount;
      await updateDoc(budgetRef, { spent: newSpent });
    }
  }

  /** Pull budgets from Firestore and update local cache */
  pullFromFirestore(userId: string): Observable<void> {
    if (userId === 'offline-guest') return of(undefined);

    const budgetsRef = collection(this.firestore, `users/${userId}/budgets`);

    console.log(`[BudgetsService] Pulling budgets for user: ${userId}`);

    return from(getDocs(budgetsRef)).pipe(
      tap(querySnapshot => {
        const budgets: Budget[] = [];
        querySnapshot.forEach(docSnap => {
          budgets.push(docSnap.data() as Budget);
        });

        console.log(`[BudgetsService] Pulled ${budgets.length} budgets from Firestore`);

        // Update cache
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
}
