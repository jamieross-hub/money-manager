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
    protected getTransactionsPath(userId: string): string {
        return `users/${userId}/transactions`;
    }

    /**
     * Get a specific transaction document path
     */
    protected getTransactionPath(userId: string, transactionId: string): string {
        return `${this.getTransactionsPath(userId)}/${transactionId}`;
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
                    await this.addToSyncQueue('update', { id: transactionId, ...updateData }, userId);
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
            this.addToSyncQueue('update', { id: transactionId, status: TransactionStatus.DELETED, updatedAt: new Date() }, userId).catch(error => {
                console.error('Failed to add to sync queue:', error);
            });
        });
    }

    /**
     * Get all transactions for a user (Local-Only)
     */
    getTransactions(userId: string): Observable<Transaction[]> {
        if (this.isGuest()) {
            const transactions = this.localStorageUtility.getEntities<Transaction>('transactions').filter(t => t.status !== TransactionStatus.DELETED);
            this.transactionsSubject.next(transactions);
            return of(transactions);
        }

        return new Observable<Transaction[]>(observer => {
            // Emit cached transactions immediately
            const transactions = this.getCachedTransactions(userId);
            this.transactionsSubject.next(transactions);
            observer.next(transactions);
            // Complete as it's a one-time emit from local cache
            observer.complete();
        });
    }

    /**
     * Pull transactions from Firestore once and update local cache
     */
    pullFromFirestore(userId: string): Observable<void> {
        if (this.isGuest()) return of(undefined);

        // Ensure we have an active auth user before attempting pull
        const currentUser = this.auth.currentUser;
        if (!currentUser || currentUser.uid !== userId) {
            console.warn(`[TransactionsService] Pull skipped: Auth user mismatch or not logged in (UID: ${currentUser?.uid}, expected: ${userId})`);
            return of(undefined);
        }

        const transactionsRef = query(
            collection(this.firestore, this.getTransactionsPath(userId)),
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

                const localTransactions = this.getCachedTransactions(userId);

                // Build a map of Firestore transactions by ID for O(1) lookup.
                const firestoreMap = new Map<string, Transaction>(
                    firestoreTransactions.map(t => [t.id!, t])
                );

                // Collect local-pending transactions — those that exist locally but
                // either are not in Firestore yet or have a PENDING sync status.
                const pendingLocal = localTransactions.filter(localTx => {
                    if (!localTx.id) return false;
                    const inFirestore = firestoreMap.has(localTx.id);
                    const isPending = localTx.syncStatus === SyncStatus.PENDING;
                    // Keep if: (a) not in Firestore yet (offline-created, not pushed yet)
                    //          (b) or explicitly marked PENDING (offline-updated)
                    return !inFirestore || isPending;
                });

                if (pendingLocal.length > 0) {
                    console.log(`[TransactionsService] Preserving ${pendingLocal.length} pending-local transaction(s) through pull`);
                }

                // Merge: Firestore data is the source of truth EXCEPT for pending local items.
                // Pending local items overwrite any Firestore version for the same ID.
                const pendingLocalMap = new Map<string, Transaction>(
                    pendingLocal.map(t => [t.id!, t])
                );

                const merged: Transaction[] = [
                    // Start with Firestore transactions, overriding with pending-local if present.
                    ...firestoreTransactions.map(t => pendingLocalMap.get(t.id!) ?? t),
                    // Append pending-local transactions that don't appear in Firestore at all.
                    ...pendingLocal.filter(t => !firestoreMap.has(t.id!))
                ];

                // Persist the merged list back to local cache.
                // Persist individual transactions to the new store logic
                merged.forEach(tx => this.updateTransactionCache(userId, 'update', tx));

                // Update the subject for active components
                this.transactionsSubject.next(merged);

                // Update NgRx state via success action
                this.store.dispatch(TransactionsActions.loadTransactionsSuccess({ transactions: merged }));
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
    listenToTransactions(userId: string): Observable<void> {
        if (this.isGuest()) return of(undefined);

        const currentUser = this.auth.currentUser;
        if (!currentUser || currentUser.uid !== userId) {
            console.warn(`[TransactionsService] Listener skipped: Auth mismatch (UID: ${currentUser?.uid}, expected: ${userId})`);
            return of(undefined);
        }

        const transactionsRef = query(
            collection(this.firestore, this.getTransactionsPath(userId)),
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
                    const localTransactions = this.getCachedTransactions(userId);
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

                    const merged: Transaction[] = [
                        ...firestoreTransactions.map(t => pendingLocalMap.get(t.id!) ?? t),
                        ...pendingLocal.filter(t => !firestoreMap.has(t.id!))
                    ];

                    // 1. Update cache
                    // 1. Update cache with individual objects
                    merged.forEach(tx => this.updateTransactionCache(userId, 'update', tx));

                    // 2. Update subject
                    this.transactionsSubject.next(merged);

                    // 3. Update NgRx state
                    this.store.dispatch(TransactionsActions.loadTransactionsSuccess({ transactions: merged }));

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
    getTransaction(userId: string, transactionId: string): Observable<Transaction | undefined> {
        if (this.isGuest()) {
            const transactions = this.localStorageUtility.getEntities<Transaction>('transactions');
            return of(transactions.find(t => t.id === transactionId));
        }

        return new Observable<Transaction | undefined>(observer => {
            // Reads from IndexedDB first
            const cachedTransactions = this.getCachedTransactions(userId);
            const cached = cachedTransactions.find(t => t.id === transactionId);
            
            if (cached) {
                observer.next(cached);
                observer.complete();
                return;
            }

            // Fallback: If not found in cache, pull once from Firestore
            const getTransactionAsync = async () => {
                try {
                    const transactionRef = doc(this.firestore, this.getTransactionPath(userId, transactionId));
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
            collectionPath: this.getTransactionsPath(userId)
        };

        const result = await this.commonSyncService.registerSyncItem(syncItem);
        if (!result.success) {
            console.error('Failed to register transaction for sync:', result.errors);
        }
    }

    /**
     * Get the cache key for transactions
     */
    protected getTransactionsCacheKey(userId: string): string {
        return LocalStorageKeyHelper.getTransactionsCacheKey(userId, this.getFamilyId());
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
    public getCachedTransactions(userId: string): Transaction[] {
        try {
            const familyId = this.getFamilyId();
            const allTransactions = this.localStorageUtility.getAllTransactionsSync();
            
            const transactions: Transaction[] = allTransactions
                .filter(tx => !!(tx && tx.id))
                .filter(tx => {
                    if (familyId) {
                        return tx.familyId === familyId;
                    } else {
                        return !tx.familyId;
                    }
                });
            
            // Sort by date descending
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
        } catch (error) {
            console.error('Error getting cached transactions:', error);
            return [];
        }
    }

    /**
     * Update transaction cache when transactions are created, updated, or deleted
     */
    protected updateTransactionCache(userId: string, operation: 'create' | 'update' | 'delete', transaction?: Transaction): void {
        try {
            const familyId = this.getFamilyId();

            if (!transaction || !transaction.id) return;
            const itemKey = LocalStorageKeyHelper.getTransactionItemKey(transaction.id, familyId);

            switch (operation) {
                case 'create':
                case 'update':
                    if (transaction && transaction.id) {
                        const existing = this.localStorageUtility.getItem<Transaction>(itemKey);
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
