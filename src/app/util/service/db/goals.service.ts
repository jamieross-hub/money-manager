import { Injectable } from '@angular/core';
import { Firestore, collection, doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, Timestamp, onSnapshot } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, of, from } from 'rxjs';
import { map, catchError, tap, timeout } from 'rxjs/operators';
import { DateService } from '../date.service';
import { LocalIndexDBStorageService } from '../indexdb-storage.service';
import { LocalStorageKeyHelper } from '../../models/local-storage.model';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import * as GoalsActions from 'src/app/store/goals/goals.actions';
import * as GoalsSelectors from 'src/app/store/goals/goals.selectors';

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
        private localStorageUtility: LocalIndexDBStorageService,
        private store: Store<AppState>
    ) { }

    // 🔹 Create a new goal
    async createGoal(userId: string, goal: Goal): Promise<void> {
        if (userId === 'offline-guest') {
            this.localStorageUtility.saveEntity('goals', {
                ...goal,
                currentAmount: 0
            }, 'goalId');
            return;
        }

        const goalRef = doc(this.firestore, `users/${userId}/goals/${goal.goalId}`);
        await setDoc(goalRef, {
            ...goal,
            deadline: this.dateService.toTimestamp(goal.deadline),
            currentAmount: 0, // Initialize currentAmount to 0
        });
    }

    /** Get all goals (Store-based) */
    getGoals(userId: string): Observable<Goal[]> {
        if (userId === 'offline-guest') {
            const localGoals = this.localStorageUtility.getEntities<Goal>('goals');
            return of(localGoals);
        }

        return this.store.select(GoalsSelectors.selectAllGoals);
    }

    /** Pull goals from Firestore and update local cache */
    pullFromFirestore(userId: string): Observable<void> {
        if (userId === 'offline-guest') return of(undefined);

        // Ensure we have an active auth user before attempting pull
        const currentUser = this.auth.currentUser;
        if (!currentUser || currentUser.uid !== userId) {
            console.warn(`[GoalsService] Pull skipped: Auth user mismatch or not logged in (UID: ${currentUser?.uid}, expected: ${userId})`);
            return of(undefined);
        }

        const goalsRef = collection(this.firestore, `users/${userId}/goals`);

        console.log(`[GoalsService] Pulling goals for user: ${userId}`);

        return from(getDocs(goalsRef)).pipe(
            timeout(15000),
            tap((querySnapshot: any) => {
                const goals: Goal[] = [];
                querySnapshot.forEach((docSnap: any) => {
                    goals.push(docSnap.data() as Goal);
                });

                console.log(`[GoalsService] Pulled ${goals.length} goals from Firestore`);

                // Update cache
                this.localStorageUtility.setItem(LocalStorageKeyHelper.getGoalsCacheKey(userId), goals);
                
                // Update NgRx state
                this.store.dispatch(GoalsActions.loadGoalsSuccess({ goals }));
            }),
            map(() => undefined),
            catchError(error => {
                if (error.code === 'permission-denied') {
                    console.error(`[GoalsService] Permission Denied for user ${userId}. Check Firestore rules.`);
                } else {
                    console.error('[GoalsService] Pull failed:', error);
                }
                return of(undefined);
            })
        );
    }

    // 🔹 Get a single goal by its ID
    async getGoal(userId: string, goalId: string): Promise<Goal | undefined> {
        if (userId === 'offline-guest') {
            const goals = this.localStorageUtility.getEntities<Goal>('goals');
            return goals.find(g => g.goalId === goalId);
        }

        const goalRef = doc(this.firestore, `users/${userId}/goals/${goalId}`);
        const goalSnap = await getDoc(goalRef);
        if (goalSnap.exists()) {
            return goalSnap.data() as Goal;
        }
        return undefined;
    }

    // 🔹 Update an existing goal
    async updateGoal(userId: string, goalId: string, updatedGoal: Partial<Goal>): Promise<void> {
        if (userId === 'offline-guest') {
            const goals = this.localStorageUtility.getEntities<Goal>('goals');
            const index = goals.findIndex(g => g.goalId === goalId);
            if (index !== -1) {
                goals[index] = { ...goals[index], ...updatedGoal };
                this.localStorageUtility.saveEntities('goals', goals);
            }
            return;
        }

        const goalRef = doc(this.firestore, `users/${userId}/goals/${goalId}`);
        await updateDoc(goalRef, updatedGoal);
    }

    // 🔹 Delete a goal
    async deleteGoal(userId: string, goalId: string): Promise<void> {
        if (userId === 'offline-guest') {
            this.localStorageUtility.deleteEntity('goals', goalId, 'goalId');
            return;
        }

        const goalRef = doc(this.firestore, `users/${userId}/goals/${goalId}`);
        await deleteDoc(goalRef);
    }

    // 🔹 Update the current amount for a goal
    async updateCurrentAmount(userId: string, goalId: string, amount: number): Promise<void> {
        if (userId === 'offline-guest') {
            const goals = this.localStorageUtility.getEntities<Goal>('goals');
            const index = goals.findIndex(g => g.goalId === goalId);
            if (index !== -1) {
                const currentAmount = goals[index].currentAmount || 0;
                goals[index].currentAmount = currentAmount + amount;
                this.localStorageUtility.saveEntities('goals', goals);
            }
            return;
        }

        const goalRef = doc(this.firestore, `users/${userId}/goals/${goalId}`);
        const goalSnap = await getDoc(goalRef);
        if (goalSnap.exists()) {
            const currentAmount = goalSnap.data()?.['currentAmount'] || 0;
            const newAmount = currentAmount + amount;
            await updateDoc(goalRef, { currentAmount: newAmount });
        }
    }
}
