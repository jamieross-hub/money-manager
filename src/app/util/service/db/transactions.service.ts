import { Injectable } from '@angular/core';
import { Firestore, collection, doc, updateDoc, deleteDoc, getDoc, addDoc, onSnapshot, setDoc } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, BehaviorSubject, from, of } from 'rxjs';
import { map, switchMap, tap, catchError, timeout } from 'rxjs/operators';
import { orderBy, query, Timestamp, getDocs } from '@angular/fire/firestore';
import { DateService } from '../date.service';
import { Transaction } from '../../models/transaction.model';
import { RecurringInterval, SyncStatus, TransactionStatus } from '../../config/enums';
import { AppState } from 'src/app/store/app.state';
import { Store } from '@ngrx/store';
import * as CategoriesActions from '../../../store/categories/categories.actions';
import * as TransactionsActions from '../../../store/transactions/transactions.actions';
import { AccountsService } from './accounts.service';
import * as AccountsActions from '../../../store/accounts/accounts.actions';
import * as TransactionsSelectors from '../../../store/transactions/transactions.selectors';

import { CommonSyncService, SyncItem } from '../common-sync.service';
import { BaseService } from '../base.service';
import { LocalIndexDBStorageService } from '../indexdb-storage.service';
import { UserService } from './user.service';
import { LocalStorageKey, LocalStorageKeyHelper } from '../../models/local-storage.model';
import { CurrencyService } from '../currency.service';
import * as ProfileSelectors from 'src/app/store/profile/profile.selectors';

@Injectable({
    providedIn: 'root'
})
export class TransactionsService extends BaseService {
    private transactionsSubject = new BehaviorSubject<Transaction[]>([]);

    constructor(
        firestore: Firestore,
        auth: Auth,
        currencyService: CurrencyService,
        private dateService: DateService,
        protected store: Store<AppState>,
        private accountsService: AccountsService,
        private commonSyncService: CommonSyncService,
        private localStorageUtility: LocalIndexDBStorageService,
        protected userService: UserService
    ) {
        super(firestore, auth, currencyService);
    }

    private isGuest(): boolean {
        return this.userService.getCurrentUserId() === 'offline-guest';
    }

    /**
     * Get the transactions collection path
     */
    protected getTransactionsPath(userId: string, familyId?: string): string {
        const isFamilyMode = this.store.selectSignal(ProfileSelectors.selectProfile)()?.preferences?.isFamilyMode;
        const effectiveFamilyId = familyId || (isFamilyMode ? this.getFamilyId() : undefined);
        
        if (effectiveFamilyId) {
            return `family-groups/${effectiveFamilyId}/transactions`;
        }
        return `users/${userId}/transactions`;
    }

    /**
     * Get a specific transaction document path
     */
    protected getTransactionPath(userId: string, transactionId: string, familyId?: string): string {
        return `${this.getTransactionsPath(userId, familyId)}/${transactionId}`;
    }

    /**
     * Create a new transaction
     */
    createTransaction(userId: string, transaction: Transaction): Observable<void> {
        const transactionId = transaction.id || this.generateId();
        const now = new Date();
        const isOnline = this.commonSyncService.isCurrentlyOnline();
        const transactionData: Transaction = this.scrubUndefined({
            ...transaction,
            id: transactionId,
            date: this.dateService.toDate(transaction.date) || now,
            createdAt: now,
            updatedAt: now,
            createdBy: userId,
            updatedBy: userId,
            syncStatus: isOnline ? SyncStatus.SYNCED : SyncStatus.PENDING
        });

        if (this.isGuest()) {
            this.localStorageUtility.saveEntity('transactions', transactionData, 'id');
            // Update store immediately
            this.store.dispatch(TransactionsActions.createTransactionSuccess({
                transaction: transactionData
            }));
            // Update account balance
            if (transaction.accountId) {
                this.store.dispatch(AccountsActions.updateAccountBalanceForTransaction({
                    userId: userId,
                    accountId: transaction.accountId,
                    transactionType: 'create',
                    newTransaction: transactionData
                }));
            }
            return of(undefined);
        }

        return new Observable<void>(observer => {
            const createTransactionAsync = async () => {
                try {
                    // 1. Dispatch store updates immediately (Optimistic)
                    if (transaction.accountId) {
                        this.store.dispatch(AccountsActions.updateAccountBalanceForTransaction({
                            userId: userId,
                            accountId: transaction.accountId,
                            transactionType: 'create',
                            newTransaction: transactionData as Transaction
                        }));
                    }

                    this.store.dispatch(TransactionsActions.createTransactionSuccess({
                        transaction: transactionData as Transaction
                    }));

                    // 2. Update cache immediately
                    this.updateTransactionCache(userId, 'create', transactionData as Transaction);

                    // 3. Complete observer immediately (Making it non-blocking)
                    observer.next();
                    observer.complete();

                    // 4. Always add to sync queue (it handles online/offline internally)
                    await this.addToSyncQueue('create', transactionData, userId);
                } catch (error) {
                    console.error('Error in createTransaction:', error);
                    // Even if error occurs, we already completed observer to prevent UI hang
                }
            };

            createTransactionAsync();
        });
    }

    /**
     * Update an existing transaction
     */
    updateTransaction(userId: string, transactionId: string, updatedTransaction: Partial<Transaction>): Observable<void> {
        if (this.isGuest()) {
            const transactions = this.localStorageUtility.getEntities<Transaction>('transactions');
            const index = transactions.findIndex(t => t.id === transactionId);
            if (index !== -1) {
                const oldTransaction = { ...transactions[index] };
                const newTransaction = { ...oldTransaction, ...updatedTransaction, updatedAt: new Date(), syncStatus: SyncStatus.SYNCED };
                transactions[index] = newTransaction;
                this.localStorageUtility.saveEntities('transactions', transactions);

                // Update store immediately
                this.store.dispatch(TransactionsActions.updateTransactionSuccess({
                    transaction: newTransaction as Transaction
                }));

                // Update account balance if amount or account changed
                if ((updatedTransaction.amount || updatedTransaction.accountId) && oldTransaction.accountId) {
                    if (updatedTransaction.accountId && updatedTransaction.accountId !== oldTransaction.accountId) {
                        this.store.dispatch(AccountsActions.updateAccountBalanceForAccountTransfer({
                            userId: userId,
                            oldAccountId: oldTransaction.accountId,
                            newAccountId: updatedTransaction.accountId,
                            transaction: newTransaction as Transaction
                        }));
                    } else {
                        this.store.dispatch(AccountsActions.updateAccountBalanceForTransaction({
                            userId: userId,
                            accountId: oldTransaction.accountId,
                            transactionType: 'update',
                            oldTransaction: oldTransaction as Transaction,
                            newTransaction: newTransaction as Transaction
                        }));
                    }
                }
            }
            return of(undefined);
        }

        return new Observable<void>(observer => {
            const updateTransactionAsync = async () => {
                try {
                    // Fetch old transaction for balance calculation
                    const cachedTransactions = this.getCachedTransactions(userId);
                    const oldTransaction = cachedTransactions.find(t => t.id === transactionId);

                    const updateData = this.scrubUndefined({
                        ...updatedTransaction,
                        updatedAt: new Date(),
                        updatedBy: userId,
                        syncStatus: this.commonSyncService.isCurrentlyOnline() ? SyncStatus.SYNCED : SyncStatus.PENDING
                    });

                    const newTransaction = { ...oldTransaction, ...updateData } as Transaction;

                    const handleBalanceUpdate = () => {
                        if (oldTransaction && oldTransaction.accountId && (updatedTransaction.amount !== undefined || (updatedTransaction.accountId && updatedTransaction.accountId !== oldTransaction.accountId))) {
                            if (updatedTransaction.accountId && updatedTransaction.accountId !== oldTransaction.accountId) {
                                // Account changed - use account transfer action
                                this.store.dispatch(AccountsActions.updateAccountBalanceForAccountTransfer({
                                    userId: userId,
                                    oldAccountId: oldTransaction.accountId,
                                    newAccountId: updatedTransaction.accountId,
                                    transaction: newTransaction
                                }));
                            } else {
                                // Only amount or other details changed - use standard update action
                                this.store.dispatch(AccountsActions.updateAccountBalanceForTransaction({
                                    userId: userId,
                                    accountId: oldTransaction.accountId,
                                    transactionType: 'update',
                                    oldTransaction: oldTransaction,
                                    newTransaction: newTransaction
                                }));
                            }
                        }
                    };

                    // 1. Dispatch store updates immediately (Optimistic)
                    handleBalanceUpdate();

                    this.store.dispatch(TransactionsActions.updateTransactionSuccess({
                        transaction: newTransaction
                    }));

                    // 2. Update cache immediately
                    this.updateTransactionCache(userId, 'update', newTransaction);

                    // 3. Complete observer immediately
                    observer.next();
                    observer.complete();

                    // 4. Always add to sync queue (it handles online/offline internally)
                    await this.addToSyncQueue('update', newTransaction, userId);
                } catch (error) {
                    console.error('Error in updateTransaction:', error);
                }
            };

            updateTransactionAsync();
        });
    }

    /**
     * Delete a transaction (Soft Delete)
     */
    deleteTransaction(userId: string, transactionId: string): Observable<void> {
        if (this.isGuest()) {
            const transactions = this.localStorageUtility.getEntities<Transaction>('transactions');
            const transactionToDelete = transactions.find(t => t.id === transactionId);

            if (transactionToDelete) {
                const updatedTx = { ...transactionToDelete, status: TransactionStatus.DELETED, updatedAt: new Date() };
                this.localStorageUtility.saveEntity('transactions', updatedTx, 'id');
                // Update store immediately
                this.store.dispatch(TransactionsActions.deleteTransactionSuccess({ 
                    transactionId, 
                    transaction: updatedTx 
                }));
                // Update account balance
                if (transactionToDelete.accountId) {
                    this.store.dispatch(AccountsActions.updateAccountBalanceForTransaction({
                        userId: userId,
                        accountId: transactionToDelete.accountId,
                        transactionType: 'delete',
                        oldTransaction: transactionToDelete
                    }));
                }
            }
            return of(undefined);
        }

        return new Observable<void>(observer => {
            // Get transaction data for balance update first from cache
            const cachedTransactions = this.getCachedTransactions(userId);
            const transactionToDelete = cachedTransactions.find(t => t.id === transactionId);

            const handleBalanceDeletion = () => {
                if (transactionToDelete && transactionToDelete.accountId) {
                    this.store.dispatch(AccountsActions.updateAccountBalanceForTransaction({
                        userId: userId,
                        accountId: transactionToDelete.accountId,
                        transactionType: 'delete',
                        oldTransaction: transactionToDelete
                    }));
                }
            };

            // 1. Optimistic updates
            handleBalanceDeletion();
            if (transactionToDelete) {
                const transactionWithDeletedStatus = this.scrubUndefined({ ...transactionToDelete, status: TransactionStatus.DELETED, updatedAt: new Date() });
                this.store.dispatch(TransactionsActions.deleteTransactionSuccess({ 
                    transactionId, 
                    transaction: transactionWithDeletedStatus as Transaction 
                }));
            }
            
            // 2. Update cache immediately
            if (transactionToDelete) {
                this.updateTransactionCache(userId, 'update', { ...transactionToDelete, status: TransactionStatus.DELETED, updatedAt: new Date() } as Transaction);
            }

            // 3. Complete observer immediately
            observer.next();
            observer.complete();

            // 4. Always add to sync queue (it handles online/offline internally)
            this.addToSyncQueue('update', { id: transactionId, status: TransactionStatus.DELETED, updatedAt: new Date(), familyId: transactionToDelete?.familyId }, userId).catch(error => {
                console.error('Failed to add to sync queue:', error);
            });
        });
    }

    /**
     * Get all transactions for a user
     */
    getTransactions(userId: string, familyId?: string): Observable<Transaction[]> {
        const isFamilyMode = this.store.selectSignal(ProfileSelectors.selectProfile)()?.preferences?.isFamilyMode;
        const effectiveFamilyId = familyId || (isFamilyMode ? this.getFamilyId() : undefined);

        if (effectiveFamilyId) {
            return this.getFamilyTransactions(userId, effectiveFamilyId);
        }

        if (this.isGuest()) {
            const transactions = this.localStorageUtility.getEntities<Transaction>('transactions').filter(t => t.status !== TransactionStatus.DELETED);
            this.transactionsSubject.next(transactions);
            return of(transactions);
        }

        /**
         * ⚠️ ARCHITECTURE ALIGNMENT: Source of Truth = IndexedDB
         * 
         * Components should not have a direct connection to Firebase. 
         * Instead, they subscribe to this.transactionsSubject which is kept updated by 
         * the central background sync listener (CommonSyncService -> listenToTransactions).
         */
        return this.localStorageUtility.isReady$.pipe(
            switchMap(() => {
                // 1. Always emit cached transactions immediately for a snappy UI
                const cached = this.getCachedTransactions(userId);
                this.transactionsSubject.next(cached);

                // 2. Return the subject's observable. The global background listener 
                // captures Firebase updates and pushes them into this subject.
                return this.transactionsSubject.asObservable();
            })
        );
    }

    /**
     * Get all family transactions (Optimized via IndexedDB Index)
     */
    getFamilyTransactions(userId: string, familyId: string): Observable<Transaction[]> {
        if (this.isGuest()) return of([]);

        /**
         * ⚠️ ARCHITECTURE ALIGNMENT: IndexedDB as Source of Truth
         * 
         * This method emits initially from the local cache and then relies on the 
         * global background sync listener managed by CommonSyncService to provide 
         * updates via transactionsSubject.
         */
        return this.localStorageUtility.isReady$.pipe(
            switchMap(() => {
                // 1. Pull current state from IndexedDB immediately
                const cached = this.getCachedTransactions(userId, familyId);
                this.transactionsSubject.next(cached);

                // 2. Return reactive subject. Updates will be pushed here by 
                // listenToTransactions() when the background sync detects changes.
                return this.transactionsSubject.asObservable();
            })
        );
    }

    /**
     * Helper to merge Firestore transactions with pending local changes
     */
    private mergeFirestoreAndLocal(firestoreTransactions: Transaction[], localTransactions: Transaction[]): Transaction[] {
        const firestoreMap = new Map<string, Transaction>(
            firestoreTransactions.map(t => [t.id!, t])
        );

        const pendingLocal = localTransactions.filter(localTx => {
            if (!localTx.id) return false;
            const inFirestore = firestoreMap.has(localTx.id);
            const isPending = localTx.syncStatus === SyncStatus.PENDING;
            return !inFirestore || isPending;
        });

        const pendingLocalMap = new Map<string, Transaction>(
            pendingLocal.map(t => [t.id!, t])
        );

        return [
            ...firestoreTransactions.map(t => pendingLocalMap.get(t.id!) ?? t),
            ...pendingLocal.filter(t => !firestoreMap.has(t.id!))
        ];
    }

    /**
     * Pull transactions from Firestore once and update local cache
     */
    pullFromFirestore(userId: string, familyId?: string): Observable<void> {
        if (this.isGuest()) return of(undefined);

        // Ensure we have an active auth user before attempting pull
        const currentUser = this.auth.currentUser;
        if (!currentUser || currentUser.uid !== userId) {
            console.warn(`[TransactionsService] Pull skipped: Auth user mismatch or not logged in (UID: ${currentUser?.uid}, expected: ${userId})`);
            return of(undefined);
        }

        const transactionsRef = query(
            collection(this.firestore, this.getTransactionsPath(userId, familyId)),
            orderBy('date', 'desc')
        );

        console.log(`[TransactionsService] Pulling transactions for user: ${userId}`);

        return from(getDocs(transactionsRef)).pipe(
            timeout(20000), // Timeout after 20s for larger datasets
            tap((querySnapshot: any) => {
                const firestoreTransactions: Transaction[] = [];
                querySnapshot.forEach((docSnap: any) => {
                    const data = docSnap.data();
                    if (data && (data['amount'] !== undefined || docSnap.id)) {
                        firestoreTransactions.push({ id: docSnap.id, ...data } as Transaction);
                    }
                });

                console.log(`[TransactionsService] Pulled ${firestoreTransactions.length} transactions from Firestore`);

                // ── Offline-created transactions must survive the pull.
                // When the user adds a transaction while offline it is:
                //   1. Written to the local IndexedDB cache immediately.
                //   2. Added to the CommonSyncService sync queue (syncStatus = PENDING).
                //   3. Pushed to Firestore by manualSync() when coming online.
                // BUT the subsequent pullFromFirestore fires concurrently and may
                // receive Firestore data before the write has been committed.
                // We protect local-pending transactions by merging instead of replacing.

                const localTransactions = this.getCachedTransactions(userId, familyId);
                const merged = this.mergeFirestoreAndLocal(firestoreTransactions, localTransactions);

                // Persist the merged list back to local cache.
                // 1. Update cache with individual objects
                merged.forEach(tx => this.updateTransactionCache(userId, 'update', tx));

                // 2. Re-read from IndexedDB cache (Source of Truth)
                const updatedFromCache = this.getCachedTransactions(userId, familyId);

                // 3. Update subject and NgRx state
                console.log(`[TransactionsService] Dispatching ${updatedFromCache.length} transactions from cache to store`);
                this.transactionsSubject.next(updatedFromCache);
                this.store.dispatch(TransactionsActions.loadTransactionsSuccess({ transactions: updatedFromCache }));
            }),
            map(() => undefined),
            catchError(error => {
                if (error.name === 'TimeoutError') {
                    console.warn('[TransactionsService] Pull timed out, using local data');
                } else if (error.code === 'permission-denied') {
                    console.error(`[TransactionsService] Permission Denied for user ${userId}. Check Firestore rules.`);
                } else {
                    console.error('[TransactionsService] Pull failed:', error);
                }
                return of(undefined);
            })
        );
    }

    /**
     * Set up a real-time listener for transactions
     */
    listenToTransactions(userId: string, familyId?: string): Observable<void> {
        if (this.isGuest()) return of(undefined);

        const currentUser = this.auth.currentUser;
        if (!currentUser || currentUser.uid !== userId) {
            console.warn(`[TransactionsService] Listener skipped: Auth mismatch (UID: ${currentUser?.uid}, expected: ${userId})`);
            return of(undefined);
        }

        const transactionsRef = query(
            collection(this.firestore, this.getTransactionsPath(userId, familyId)),
            orderBy('date', 'desc')
        );

        console.log(`[TransactionsService] Starting real-time listener for user: ${userId}`);

        return new Observable<void>(observer => {
            const unsubscribe = onSnapshot(transactionsRef,
                (querySnapshot) => {
                    const firestoreTransactions: Transaction[] = [];
                    querySnapshot.forEach((docSnap) => {
                        const data = docSnap.data();
                        if (data && (data['amount'] !== undefined || docSnap.id)) {
                            firestoreTransactions.push({ id: docSnap.id, ...data } as Transaction);
                        }
                    });

                    console.log(`[TransactionsService] Real-time update: ${firestoreTransactions.length} transactions`);

                    // ── Same merge logic as pullFromFirestore.
                    // onSnapshot fires when coming back online and may not yet contain
                    // transactions that were pushed by the sync queue in the same moment.
                    const localTransactions = this.getCachedTransactions(userId, familyId);
                    const merged = this.mergeFirestoreAndLocal(firestoreTransactions, localTransactions);

                    // 1. Update cache with individual objects
                    merged.forEach(tx => this.updateTransactionCache(userId, 'update', tx));

                    // 2. Re-read from IndexedDB cache (Source of Truth)
                    const updatedFromCache = this.getCachedTransactions(userId, familyId);

                    // 3. Update subject and NgRx state
                    this.transactionsSubject.next(updatedFromCache);
                    this.store.dispatch(TransactionsActions.loadTransactionsSuccess({ transactions: updatedFromCache }));

                    observer.next();
                },
                (error) => {
                    console.error('[TransactionsService] Real-time listener failed:', error);
                    observer.error(error);
                }
            );

            return () => {
                console.log(`[TransactionsService] Stopping real-time listener for user: ${userId}`);
                unsubscribe();
            };
        });
    }

    /**
     * Get a specific transaction
     */
    getTransaction(userId: string, transactionId: string, familyId?: string): Observable<Transaction | undefined> {
        if (this.isGuest()) {
            const transactions = this.localStorageUtility.getEntities<Transaction>('transactions');
            return of(transactions.find(t => t.id === transactionId));
        }

        return new Observable<Transaction | undefined>(observer => {
            // Reads from IndexedDB first (O(1) lookup since we re-keyed to transactionId only)
            const itemKey = LocalStorageKeyHelper.getTransactionItemKey(transactionId, familyId);
            const cached = this.localStorageUtility.getItem<Transaction>(itemKey, 'transactions');
            
            if (cached) {
                observer.next(cached);
                observer.complete();
                return;
            }

            // Fallback: If not found in cache, pull once from Firestore
            const getTransactionAsync = async () => {
                try {
                    const transactionRef = doc(this.firestore, this.getTransactionPath(userId, transactionId, familyId));
                    const transactionDoc = await getDoc(transactionRef);

                    if (transactionDoc.exists()) {
                        const transaction = { id: transactionDoc.id, ...transactionDoc.data() } as Transaction;
                        // Update cache
                        this.updateTransactionCache(userId, 'update', transaction);
                        observer.next(transaction);
                    } else {
                        observer.next(undefined);
                    }
                    observer.complete();
                } catch (error) {
                    // Fail gracefully
                    observer.next(undefined);
                    observer.complete();
                }
            };

            getTransactionAsync();
        });
    }

    /**
     * Get sync status
     */
    getSyncStatus(): { count: number; hasPendingOperations: boolean } {
        const status = this.commonSyncService.syncStatus;
        return {
            count: status.pendingItems,
            hasPendingOperations: status.pendingItems > 0
        };
    }

    /**
     * Force sync offline operations
     */
    async forceSync(): Promise<void> {
        await this.commonSyncService.manualSync();
    }

    /**
     * Add transaction to sync queue
     */
    private async addToSyncQueue(operation: 'create' | 'update' | 'delete', data: any, userId: string): Promise<void> {
        const syncItem: Omit<SyncItem, 'timestamp' | 'retryCount'> = {
            id: this.generateId(),
            type: 'transaction',
            operation: operation,
            data: data,
            maxRetries: 3,
            collectionPath: this.getTransactionsPath(userId, data.familyId)
        };

        const result = await this.commonSyncService.registerSyncItem(syncItem);
        if (!result.success) {
            console.error('Failed to register transaction for sync:', result.errors);
        }
    }

    /**
     * Get the cache key for transactions
     */
    protected getTransactionsCacheKey(userId: string, familyId?: string): string {
            const isFamilyMode = this.store.selectSignal(ProfileSelectors.selectProfile)()?.preferences?.isFamilyMode;
        const id = isFamilyMode ? (familyId || this.getFamilyId()) : '';
        if (id) {
            return `family-transactions-${id}`;
        }
        return `transactions-${userId}`;
    }

    /**
     * Get the family ID for cache key (overridden in FamilyTransactionsService)
     */
    protected getFamilyId(): string | undefined {
        return '';
    }

    /**
     * Get cached transactions from IndexDB
     */
    public getCachedTransactions(userId: string, familyId?: string): Transaction[] {
        try {
            const isFamilyMode = this.store.selectSignal(ProfileSelectors.selectProfile)()?.preferences?.isFamilyMode;
            const effectiveFamilyId = familyId || (isFamilyMode ? this.getFamilyId() : '');
            
            let transactions: Transaction[];
            
            if (effectiveFamilyId) {
                // Optimized: Use the new familyId index filtering
                transactions = this.localStorageUtility.getTransactionsByFamilyIdSync(effectiveFamilyId);
            } else {
                // Personal mode: Use userId index to filter (ensures isolation)
                transactions = this.localStorageUtility.getTransactionsByUserIdSync(userId);
            }
            
            return this.sortTransactions(transactions);
        } catch (error) {
            console.error('Error getting cached transactions:', error);
            return [];
        }
    }

    /**
     * Helper to sort transactions by date descending
     */
    protected sortTransactions(transactions: any[]): Transaction[] {
        return transactions.sort((a, b) => {
            const getTime = (date: any) => {
                if (!date) return 0;
                if (date instanceof Date) return date.getTime();
                if (typeof date === 'object' && typeof (date as any).toDate === 'function') {
                    return (date as any).toDate().getTime();
                }
                return new Date(date).getTime();
            };
            return getTime(b.date) - getTime(a.date);
        });
    }

    /**
     * Update transaction cache when transactions are created, updated, or deleted
     */
    protected updateTransactionCache(userId: string, operation: 'create' | 'update' | 'delete', transaction?: Transaction): void {
        try {
            if (!transaction || !transaction.id) return;
            const itemKey = LocalStorageKeyHelper.getTransactionItemKey(transaction.id, transaction.familyId);

            switch (operation) {
                case 'create':
                case 'update':
                    if (transaction && transaction.id) {
                        const existing = this.localStorageUtility.getItem<Transaction>(itemKey, 'transactions');
                        this.localStorageUtility.setTransaction(itemKey, { ...existing, ...transaction });
                    }
                    break;
                case 'delete':
                    if (transaction && transaction.id) {
                        this.localStorageUtility.removeTransaction(itemKey);
                    }
                    break;
            }
        } catch (error) {
            console.error('Error updating transaction cache:', error);
        }
    }



    /**
     * Check if Firebase validation error
     */
    private isFirebaseValidationError(error: any): boolean {
        return error && (
            error.code === 'permission-denied' ||
            error.code === 'unavailable' ||
            error.code === 'invalid-argument' ||
            error.message?.includes('permission') ||
            error.message?.includes('validation')
        );
    }
}
