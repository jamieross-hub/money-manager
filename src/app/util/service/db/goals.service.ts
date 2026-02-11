import { Injectable } from '@angular/core';
import { Firestore, collection, doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, Timestamp, onSnapshot } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable } from 'rxjs';
import { DateService } from '../date.service';
import { LocalIndexDBStorageService } from '../indexdb-storage.service';
import { LocalStorageKeyHelper } from '../../models/local-storage.model';

export interface Goal {
    goalId: string;
    userId: string;
    title: string;
    targetAmount: number;
    currentAmount: number;
    deadline: Timestamp;
}

@Injectable({
    providedIn: 'root'
})
export class GoalsService {

    constructor(
        private firestore: Firestore,
        private auth: Auth,
        private dateService: DateService,
        private localStorageUtility: LocalIndexDBStorageService
    ) { }

    // 🔹 Create a new goal
    async createGoal(userId: string, goal: Goal): Promise<void> {
        const goalRef = doc(this.firestore, `users/${userId}/goals/${goal.goalId}`);
        await setDoc(goalRef, {
            ...goal,
            deadline: this.dateService.toTimestamp(goal.deadline),
            currentAmount: 0, // Initialize currentAmount to 0
        });
    }

    // 🔹 Get all goals for a user
    getGoals(userId: string): Observable<Goal[]> {
        const goalsRef = collection(this.firestore, `users/${userId}/goals`);

        return new Observable<Goal[]>(observer => {
            // 1. Emit cached data immediately if available
            try {
                const cachedGoals = this.localStorageUtility.getItem<Goal[]>(LocalStorageKeyHelper.getGoalsCacheKey(userId));
                if (cachedGoals && cachedGoals.length > 0) {
                    console.log(`[GoalsService] Emitting ${cachedGoals.length} cached goals`);
                    observer.next(cachedGoals);
                }
            } catch (error) {
                console.warn('[GoalsService] Failed to load cached goals:', error);
            }

            // 2. Subscribe to realtime updates
            const unsubscribe = onSnapshot(goalsRef,
                (querySnapshot) => {
                    const goals: Goal[] = [];
                    querySnapshot.forEach(docSnap => {
                        goals.push(docSnap.data() as Goal);
                    });

                    console.log(`[GoalsService] Received ${goals.length} goals from Firestore`);

                    // Update cache for next time
                    try {
                        this.localStorageUtility.setItem(LocalStorageKeyHelper.getGoalsCacheKey(userId), goals);
                    } catch (error) {
                        console.warn('[GoalsService] Failed to cache goals:', error);
                    }

                    observer.next(goals);
                },
                (error) => {
                    console.error(`[GoalsService] Error in onSnapshot for ${userId}:`, error);
                    if (!observer.closed) {
                        if (error.code === 'unavailable' || !navigator.onLine) {
                            console.warn('[GoalsService] Firestore unavailable, relying on cache');
                        } else {
                            observer.error(error);
                        }
                    }
                }
            );

            return () => unsubscribe();
        });
    }

    // 🔹 Get a single goal by its ID
    async getGoal(userId: string, goalId: string): Promise<Goal | undefined> {
        const goalRef = doc(this.firestore, `users/${userId}/goals/${goalId}`);
        const goalSnap = await getDoc(goalRef);
        if (goalSnap.exists()) {
            return goalSnap.data() as Goal;
        }
        return undefined;
    }

    // 🔹 Update an existing goal
    async updateGoal(userId: string, goalId: string, updatedGoal: Partial<Goal>): Promise<void> {
        const goalRef = doc(this.firestore, `users/${userId}/goals/${goalId}`);
        await updateDoc(goalRef, updatedGoal);
    }

    // 🔹 Delete a goal
    async deleteGoal(userId: string, goalId: string): Promise<void> {
        const goalRef = doc(this.firestore, `users/${userId}/goals/${goalId}`);
        await deleteDoc(goalRef);
    }

    // 🔹 Update the current amount for a goal
    async updateCurrentAmount(userId: string, goalId: string, amount: number): Promise<void> {
        const goalRef = doc(this.firestore, `users/${userId}/goals/${goalId}`);
        const goalSnap = await getDoc(goalRef);
        if (goalSnap.exists()) {
            const currentAmount = goalSnap.data()?.['currentAmount'] || 0;
            const newAmount = currentAmount + amount;
            await updateDoc(goalRef, { currentAmount: newAmount });
        }
    }
}
