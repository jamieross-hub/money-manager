import { Injectable } from '@angular/core';
import { Firestore, collection, doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, Timestamp, onSnapshot, query, orderBy } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, of, from, BehaviorSubject } from 'rxjs';
import { map, catchError, tap, timeout, switchMap } from 'rxjs/operators';
import { CommonSyncService, SyncItem } from '../common-sync.service';
import { SyncStatus } from '../../config/enums';
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
    syncStatus?: string;
    lastSyncedAt?: any;
}

@Injectable({
    providedIn: 'root'
})
export class GoalsService {
    private goalsSubject = new BehaviorSubject<Goal[]>([]);

    constructor(
        private firestore: Firestore,
        private auth: Auth,
        private dateService: DateService,
        private localStorageUtility: LocalIndexDBStorageService,
        private store: Store<AppState>,
        private commonSyncService: CommonSyncService
    ) { }

    async createGoal(userId: string, goal: Goal): Promise<void> {
        const isGuest = userId === 'offline-guest';
        const newGoal = { ...goal, currentAmount: 0, syncStatus: SyncStatus.PENDING };

        // 1. Optimistic Update (Cache & NgRx)
        if (isGuest) {
            this.localStorageUtility.saveEntity('goals', newGoal, 'goalId');
        } else {
            const cacheKey = LocalStorageKeyHelper.getGoalsCacheKey(userId);
            const goals = this.localStorageUtility.getItem<Goal[]>(cacheKey) || [];
            goals.push(newGoal);
            this.localStorageUtility.setItem(cacheKey, goals);
        }

        this.store.dispatch(GoalsActions.createGoalSuccess({ goal: newGoal }));

        if (isGuest) return;

        // 2. Queue for Sync
        await this.addToSyncQueue('create', {
            ...newGoal,
            deadline: this.dateService.toTimestamp(newGoal.deadline)?.toMillis() ?? Date.now(),
        }, userId);
    }

    /** Get all goals (Local-Only + Real-time Sync) */
    getGoals(userId: string): Observable<Goal[]> {
        if (userId === 'offline-guest') {
            const localGoals = this.localStorageUtility.getEntities<Goal>('goals');
            this.goalsSubject.next(localGoals);
            return of(localGoals);
        }

        /**
         * ⚠️ ARCHITECTURE ALIGNMENT: IndexedDB as Source of Truth
         */
        return this.localStorageUtility.isReady$.pipe(
            switchMap(() => {
                // 1. Emit cached goals immediately
                const cacheKey = LocalStorageKeyHelper.getGoalsCacheKey(userId);
                const cachedGoals = this.localStorageUtility.getItem<Goal[]>(cacheKey) || [];
                
                if (cachedGoals.length > 0) {
                    this.goalsSubject.next(cachedGoals);
                }

                // 2. Return reactive subject
                return this.goalsSubject.asObservable();
            })
        );
    }

    /**
     * Set up a real-time listener for goals
     */
    listenToGoals(userId: string): Observable<void> {
        if (userId === 'offline-guest') return of(undefined);

        return new Observable<void>(observer => {
            const goalsRef = query(
                collection(this.firestore, `users/${userId}/goals`),
                orderBy('title', 'asc')
            );

            console.log(`[GoalsService] 🔌 Starting real-time listener for user: ${userId}`);
            
            // 0. Emit cached goals immediately
            const cacheKey = LocalStorageKeyHelper.getGoalsCacheKey(userId);
            const cachedGoals = this.localStorageUtility.getItem<Goal[]>(cacheKey) || [];
            if (cachedGoals.length > 0) {
                this.goalsSubject.next(cachedGoals);
                this.store.dispatch(GoalsActions.loadGoalsSuccess({ goals: cachedGoals }));
            }

            const unsubscribe = onSnapshot(goalsRef, (snap) => {
                const goals: Goal[] = [];
                snap.forEach(docSnap => {
                    const data = docSnap.data();
                    if (data && (data['goalId'] || docSnap.id)) {
                        goals.push({ goalId: docSnap.id, ...data } as Goal);
                    }
                });

                this.localStorageUtility.setItem(cacheKey, goals);
                this.goalsSubject.next(goals);
                this.store.dispatch(GoalsActions.loadGoalsSuccess({ goals }));
                
                observer.next();
            }, (error) => {
                console.warn(`[GoalsService] ⚠️ Real-time listener failed (may be offline):`, error);
                observer.complete();
            });

            return () => unsubscribe();
        });
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
                    const data = docSnap.data();
                    if (data && (data['goalId'] || docSnap.id)) {
                        goals.push({ goalId: docSnap.id, ...data } as Goal);
                    }
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

    async getGoal(userId: string, goalId: string): Promise<Goal | undefined> {
        const isGuest = userId === 'offline-guest';
        const cacheKey = LocalStorageKeyHelper.getGoalsCacheKey(userId);

        // 1. Try reading from local cache first
        let cachedGoals: Goal[] = [];
        if (isGuest) {
            cachedGoals = this.localStorageUtility.getEntities<Goal>('goals');
        } else {
            cachedGoals = this.localStorageUtility.getItem<Goal[]>(cacheKey) || [];
        }

        const cachedGoal = cachedGoals.find(g => g.goalId === goalId);
        if (cachedGoal) return cachedGoal;

        if (isGuest) return undefined;

        // 2. Fallback to Firestore
        try {
            const goalRef = doc(this.firestore, `users/${userId}/goals/${goalId}`);
            const goalSnap = await getDoc(goalRef);
            if (goalSnap.exists()) {
                const data = goalSnap.data();
                if (data && (data['goalId'] || goalSnap.id)) {
                    const goal = { goalId: goalSnap.id, ...data } as Goal;
                    // Update cache
                    cachedGoals.push(goal);
                    this.localStorageUtility.setItem(cacheKey, cachedGoals);
                    return goal;
                }
            }
        } catch (error) {
            console.error('[GoalsService] Error fetching goal from Firestore:', error);
        }
        
        return undefined;
    }

    async updateGoal(userId: string, goalId: string, updatedGoal: Partial<Goal>): Promise<void> {
        const isGuest = userId === 'offline-guest';
        let currentGoal: Goal | undefined;

        // 1. Optimistic Update
        if (isGuest) {
            const goals = this.localStorageUtility.getEntities<Goal>('goals');
            const index = goals.findIndex(g => g.goalId === goalId);
            if (index !== -1) {
                goals[index] = { ...goals[index], ...updatedGoal };
                currentGoal = goals[index];
                this.localStorageUtility.saveEntities('goals', goals);
            }
        } else {
            const cacheKey = LocalStorageKeyHelper.getGoalsCacheKey(userId);
            const goals = this.localStorageUtility.getItem<Goal[]>(cacheKey) || [];
            const index = goals.findIndex(g => g.goalId === goalId);
            if (index !== -1) {
                goals[index] = { ...goals[index], ...updatedGoal, syncStatus: SyncStatus.PENDING };
                currentGoal = goals[index];
                this.localStorageUtility.setItem(cacheKey, goals);
            }
        }

        if (currentGoal) {
            this.store.dispatch(GoalsActions.updateGoalSuccess({ goal: currentGoal }));
        }

        if (isGuest) return;

        // 2. Queue for Sync
        const syncData: any = { goalId, ...updatedGoal };
        if (updatedGoal.deadline) {
            syncData.deadline = this.dateService.toTimestamp(updatedGoal.deadline)?.toMillis();
        }

        await this.addToSyncQueue('update', syncData, userId);
    }

    async deleteGoal(userId: string, goalId: string): Promise<void> {
        const isGuest = userId === 'offline-guest';

        // 1. Optimistic Update
        if (isGuest) {
            this.localStorageUtility.deleteEntity('goals', goalId, 'goalId');
        } else {
            const cacheKey = LocalStorageKeyHelper.getGoalsCacheKey(userId);
            const goals = this.localStorageUtility.getItem<Goal[]>(cacheKey) || [];
            const filtered = goals.filter(g => g.goalId !== goalId);
            this.localStorageUtility.setItem(cacheKey, filtered);
        }

        this.store.dispatch(GoalsActions.deleteGoalSuccess({ goalId }));

        if (isGuest) return;

        // 2. Queue for Sync
        await this.addToSyncQueue('delete', { goalId }, userId);
    }

    async updateCurrentAmount(userId: string, goalId: string, amount: number): Promise<void> {
        const isGuest = userId === 'offline-guest';
        let newAmount = 0;
        let goalToUpdate: Goal | undefined;

        // 1. Optimistic Update
        if (isGuest) {
            const goals = this.localStorageUtility.getEntities<Goal>('goals');
            const index = goals.findIndex(g => g.goalId === goalId);
            if (index !== -1) {
                const currentAmount = goals[index].currentAmount || 0;
                goals[index].currentAmount = currentAmount + amount;
                newAmount = goals[index].currentAmount;
                goalToUpdate = goals[index];
                this.localStorageUtility.saveEntities('goals', goals);
            }
        } else {
            const cacheKey = LocalStorageKeyHelper.getGoalsCacheKey(userId);
            const goals = this.localStorageUtility.getItem<Goal[]>(cacheKey) || [];
            const index = goals.findIndex(g => g.goalId === goalId);
            if (index !== -1) {
                const currentAmount = goals[index].currentAmount || 0;
                goals[index].currentAmount = currentAmount + amount;
                goals[index].syncStatus = SyncStatus.PENDING;
                newAmount = goals[index].currentAmount;
                goalToUpdate = goals[index];
                this.localStorageUtility.setItem(cacheKey, goals);
            }
        }

        if (goalToUpdate) {
            this.store.dispatch(GoalsActions.updateGoalSuccess({ goal: goalToUpdate }));
        }

        if (isGuest) return;

        // 2. Queue for Sync
        await this.addToSyncQueue('update', { goalId, currentAmount: newAmount }, userId);
    }

    /**
     * Add goal to sync queue
     */
    private async addToSyncQueue(operation: 'create' | 'update' | 'delete', data: any, userId: string): Promise<void> {
        const syncItem: Omit<SyncItem, 'timestamp' | 'retryCount'> = {
            id: data.goalId,
            type: 'goal',
            operation: operation,
            data: data,
            maxRetries: 3,
            collectionPath: `users/${userId}/goals`
        };

        const result = await this.commonSyncService.registerSyncItem(syncItem);
        if (!result.success) {
            console.error('Failed to register goal for sync:', result.errors);
        }
    }
}
