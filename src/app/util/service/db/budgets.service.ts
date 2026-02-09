import { Injectable } from '@angular/core';
import { Firestore, collection, doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, Timestamp, onSnapshot } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, of } from 'rxjs';
import { DateService } from '../date.service';
import { LocalIndexDBStorageService } from '../indexdb-storage.service';

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
    private localStorageUtility: LocalIndexDBStorageService
  ) { }

  // 🔹 Create a new budget
  async createBudget(userId: string, budget: Budget): Promise<void> {
    const budgetRef = doc(this.firestore, `users/${userId}/budgets/${budget.budgetId}`);
    await setDoc(budgetRef, {
      ...budget,
      startDate: this.dateService.toTimestamp(budget.startDate),
      endDate: this.dateService.toTimestamp(budget.endDate),
      spent: 0, // Initialize spent to 0
    });
  }

  // 🔹 Get all budgets for a user
  getBudgets(userId: string): Observable<Budget[]> {
    const budgetsRef = collection(this.firestore, `users/${userId}/budgets`);

    return new Observable<Budget[]>(observer => {
      // 1. Emit cached data immediately if available
      try {
        const cachedBudgets = this.localStorageUtility.getItem<Budget[]>(`budgets-cache-${userId}`);
        if (cachedBudgets && cachedBudgets.length > 0) {
          console.log(`[BudgetsService] Emitting ${cachedBudgets.length} cached budgets`);
          observer.next(cachedBudgets);
        }
      } catch (error) {
        console.warn('[BudgetsService] Failed to load cached budgets:', error);
      }

      // 2. Subscribe to realtime updates
      const unsubscribe = onSnapshot(budgetsRef,
        (querySnapshot) => {
          const budgets: Budget[] = [];
          querySnapshot.forEach(docSnap => {
            budgets.push(docSnap.data() as Budget);
          });

          console.log(`[BudgetsService] Received ${budgets.length} budgets from Firestore`);

          // Update cache for next time
          try {
            this.localStorageUtility.setItem(`budgets-cache-${userId}`, budgets);
          } catch (error) {
            console.warn('[BudgetsService] Failed to cache budgets:', error);
          }

          observer.next(budgets);
        },
        (error) => {
          console.error(`[BudgetsService] Error in onSnapshot for ${userId}:`, error);
          if (!observer.closed) {
            if (error.code === 'unavailable' || !navigator.onLine) {
              console.warn('[BudgetsService] Firestore unavailable, relying on cache');
            } else {
              observer.error(error);
            }
          }
        }
      );

      return () => unsubscribe();
    });
  }

  // 🔹 Get a single budget by its ID
  async getBudget(userId: string, budgetId: string): Promise<Budget | undefined> {
    const budgetRef = doc(this.firestore, `users/${userId}/budgets/${budgetId}`);
    const budgetSnap = await getDoc(budgetRef);
    if (budgetSnap.exists()) {
      return budgetSnap.data() as Budget;
    }
    return undefined;
  }

  // 🔹 Update an existing budget
  async updateBudget(userId: string, budgetId: string, updatedBudget: Partial<Budget>): Promise<void> {
    const budgetRef = doc(this.firestore, `users/${userId}/budgets/${budgetId}`);
    await updateDoc(budgetRef, updatedBudget);
  }

  // 🔹 Delete a budget
  async deleteBudget(userId: string, budgetId: string): Promise<void> {
    const budgetRef = doc(this.firestore, `users/${userId}/budgets/${budgetId}`);
    await deleteDoc(budgetRef);
  }

  // 🔹 Update the spent amount for a budget
  async updateSpent(userId: string, budgetId: string, amount: number): Promise<void> {
    const budgetRef = doc(this.firestore, `users/${userId}/budgets/${budgetId}`);
    const budgetSnap = await getDoc(budgetRef);
    if (budgetSnap.exists()) {
      const currentSpent = budgetSnap.data()?.['spent'] || 0;
      const newSpent = currentSpent + amount;
      await updateDoc(budgetRef, { spent: newSpent });
    }
  }
}
