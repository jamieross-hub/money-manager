import { Injectable } from '@angular/core';
import { Firestore, collection, doc, updateDoc, deleteDoc, getDoc, addDoc, onSnapshot, setDoc } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, BehaviorSubject, from, of } from 'rxjs';
import { map, switchMap, tap, catchError, timeout, startWith } from 'rxjs/operators';
import { orderBy, query, Timestamp, getDocs } from '@angular/fire/firestore';
import { DateService } from '../date.service';
import { Transaction } from '../../models/transaction.model';
import { RecurringInterval, SyncStatus, TransactionStatus } from '../../config/enums';
import { AppState } from 'src/app/store/app.state';
import { Store } from '@ngrx/store';
import * as CategoriesActions from '../../../store/categories/categories.actions';
import * as TransactionsActions from '../../../store/transactions/transactions.actions';
import * as FamilyActions from '../../../modules/family/store/family.actions';
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
    private activeListenerPath: string | null = null;

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
        const now = Timestamp.now();
        const isOnline = this.commonSyncService.isCurrentlyOnline();
        const transactionData: Transaction = this.scrubUndefined({
            ...transaction,
            id: transactionId,
            date: this.dateService.toDate(transaction.date) || now.toDate(),
            createdAt: now,
            updatedAt: now,
            createdBy: userId,
            updatedBy: userId,
            syncStatus: this.isGuest() ? SyncStatus.SYNCED : SyncStatus.PENDING
        });

        if (this.isGuest()) {
            this.localStorageUtility.saveEntity('transactions', transactionData, 'id');
            // Update store immediately
            this.store.dispatch(TransactionsActions.createTransactionSuccess({
                transaction: transactionData
            }));
            // Update account balance
            if (transaction.accountId || transaction.toAccountId) {
                const affectedAccounts = new Set([transaction.accountId, transaction.toAccountId].filter(Boolean));
                affectedAccounts.forEach(accId => {
                    this.store.dispatch(AccountsActions.updateAccountBalanceForTransaction({
                        userId: userId,
                        accountId: accId as string,
                        transactionType: 'create',
                        newTransaction: transactionData
                    }));
                });
            }
            return of(undefined);
        }

        return new Observable<void>(observer => {
            const createTransactionAsync = async () => {
                try {
                    // 1. Dispatch store updates immediately (Optimistic)
                    if (transaction.accountId || transaction.toAccountId) {
                        const affectedAccounts = new Set([transaction.accountId, transaction.toAccountId].filter(Boolean));
                        affectedAccounts.forEach(accId => {
                            this.store.dispatch(AccountsActions.updateAccountBalanceForTransaction({
                                userId: userId,
                                accountId: accId as string,
                                transactionType: 'create',
                                newTransaction: transactionData as Transaction
                            }));
                        });
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

                // Update account balance if amount, account, toAccount or type changed
                const accountChanged = updatedTransaction.accountId && updatedTransaction.accountId !== oldTransaction.accountId;
                const toAccountChanged = updatedTransaction.toAccountId !== undefined && updatedTransaction.toAccountId !== oldTransaction.toAccountId;
                const amountChanged = updatedTransaction.amount !== undefined && updatedTransaction.amount !== oldTransaction.amount;
                const typeChanged = updatedTransaction.type && updatedTransaction.type !== oldTransaction.type;
                
                if ((amountChanged || accountChanged || toAccountChanged || typeChanged) && oldTransaction.accountId) {
                    const affectedAccounts = new Set([
                        oldTransaction.accountId, 
                        oldTransaction.toAccountId, 
                        newTransaction.accountId, 
                        newTransaction.toAccountId
                    ].filter(Boolean));

                    affectedAccounts.forEach(accId => {
                        this.store.dispatch(AccountsActions.updateAccountBalanceForTransaction({
                            userId: userId,
                            accountId: accId as string,
                            transactionType: 'update',
                            oldTransaction: oldTransaction as Transaction,
                            newTransaction: newTransaction as Transaction
                        }));
                    });
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
                        updatedAt: Timestamp.now(),
                        updatedBy: userId,
                        syncStatus: this.isGuest() ? SyncStatus.SYNCED : SyncStatus.PENDING
                    });

                    const newTransaction = { ...oldTransaction, ...updateData } as Transaction;

                    const handleBalanceUpdate = () => {
                        const accountChanged = updatedTransaction.accountId && updatedTransaction.accountId !== oldTransaction?.accountId;
                        const toAccountChanged = updatedTransaction.toAccountId !== undefined && updatedTransaction.toAccountId !== oldTransaction?.toAccountId;
                        const amountChanged = updatedTransaction.amount !== undefined && updatedTransaction.amount !== oldTransaction?.amount;
                        const typeChanged = updatedTransaction.type && updatedTransaction.type !== oldTransaction?.type;

                        if (oldTransaction && oldTransaction.accountId && (amountChanged || accountChanged || toAccountChanged || typeChanged)) {
                            const affectedAccounts = new Set([
                                oldTransaction.accountId, 
                                oldTransaction.toAccountId, 
                                newTransaction.accountId, 
                                newTransaction.toAccountId
                            ].filter(Boolean));

                            affectedAccounts.forEach(accId => {
                                this.store.dispatch(AccountsActions.updateAccountBalanceForTransaction({
                                    userId: userId,
                                    accountId: accId as string,
                                    transactionType: 'update',
                                    oldTransaction: oldTransaction,
                                    newTransaction: newTransaction
                                }));
                            });
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
     * Performs a local-first delete (IndexedDB + Store) then registers for background sync.
     */
    deleteTransaction(userId: string, transactionId: string): Observable<Transaction | void> {
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
                if (transactionToDelete.accountId || transactionToDelete.toAccountId) {
                    const affectedAccounts = new Set([transactionToDelete.accountId, transactionToDelete.toAccountId].filter(Boolean));
                    affectedAccounts.forEach(accId => {
                        this.store.dispatch(AccountsActions.updateAccountBalanceForTransaction({
                            userId: userId,
                            accountId: accId as string,
                            transactionType: 'delete',
                            oldTransaction: transactionToDelete
                        }));
                    });
                }
                return of(updatedTx as Transaction);
            }
            return of(undefined);
        }

        return new Observable<Transaction | undefined>(observer => {
            // Get transaction data for balance update first from cache
            const cachedTransactions = this.getCachedTransactions(userId);
            const transactionToDelete = cachedTransactions.find(t => t.id === transactionId);

            const handleBalanceDeletion = () => {
                if (transactionToDelete && (transactionToDelete.accountId || transactionToDelete.toAccountId)) {
                    const affectedAccounts = new Set([transactionToDelete.accountId, transactionToDelete.toAccountId].filter(Boolean));
                    affectedAccounts.forEach(accId => {
                        this.store.dispatch(AccountsActions.updateAccountBalanceForTransaction({
                            userId: userId,
                            accountId: accId as string,
                            transactionType: 'delete',
                            oldTransaction: transactionToDelete
                        }));
                    });
                }
            };

            // 1. Optimistic updates
            handleBalanceDeletion();
            
            let transactionWithDeletedStatus: Transaction | undefined;
            if (transactionToDelete) {
                transactionWithDeletedStatus = this.scrubUndefined({ 
                    ...transactionToDelete, 
                    status: TransactionStatus.DELETED, 
                    updatedAt: Timestamp.now(),
                    syncStatus: this.isGuest() ? SyncStatus.SYNCED : SyncStatus.PENDING
                }) as Transaction;
                
                this.store.dispatch(TransactionsActions.deleteTransactionSuccess({ 
                    transactionId, 
                    transaction: transactionWithDeletedStatus 
                }));
                
                // 2. Update cache immediately (IndexedDB)
                this.updateTransactionCache(userId, 'update', transactionWithDeletedStatus);
            }
            
            // 3. Complete observer immediately with the deleted transaction data
            // This ensures downstream effects have the data they need without extra lookups.
            if (transactionWithDeletedStatus) {
                observer.next(transactionWithDeletedStatus);
            } else {
                observer.next(undefined);
            }
            observer.complete();

            // 4. Always add to sync queue (it handles online/offline internally)
            if (transactionId) {
                this.addToSyncQueue('update', { 
                    ...transactionWithDeletedStatus
                }, userId).catch(error => {
                    console.error('Failed to add to sync queue:', error);
                });
            }
        });
    }

    /**
     * Bulk delete transactions (soft-delete, local-first).
     * Performs one optimistic store dispatch, one bulk cache write,
     * and queues each item for background sync — no per-item loops in callers.
     */
    deleteTransactions(userId: string, transactions: Transaction[]): Observable<void> {
        if (!transactions || transactions.length === 0) return of(undefined);

        const now = Timestamp.now();

        if (this.isGuest()) {
            const batchItems: { key: string; value: Transaction }[] = [];
            
            transactions.forEach(tx => {
                const updatedTx = {
                    ...tx,
                    status: TransactionStatus.DELETED,
                    updatedAt: new Date(),
                    syncStatus: SyncStatus.SYNCED
                } as Transaction;

                // 1. Prepare for bulk IndexedDB write
                batchItems.push({
                    key: tx.id!,
                    value: updatedTx
                });

                // 2. Dispatch store success per item (optimistic)
                this.store.dispatch(TransactionsActions.deleteTransactionSuccess({
                    transactionId: tx.id!,
                    transaction: updatedTx
                }));

                // 3. Dispatch balance updates
                if (tx.accountId || tx.toAccountId) {
                    const affectedAccounts = new Set([tx.accountId, tx.toAccountId].filter(Boolean));
                    affectedAccounts.forEach(accId => {
                        this.store.dispatch(AccountsActions.updateAccountBalanceForTransaction({
                            userId,
                            accountId: accId as string,
                            transactionType: 'delete',
                            oldTransaction: tx
                        }));
                    });
                }
            });

            // Use the service's own bulk logic to keep IndexedDB and store in sync
            this.bulkUpdateTransactionCache(userId, transactions.map(tx => ({
                ...tx,
                status: TransactionStatus.DELETED,
                updatedAt: new Date(),
                syncStatus: SyncStatus.SYNCED
            }) as Transaction));
            return of(undefined);
        }

        return new Observable<void>(observer => {
            const cachedTransactions = this.getCachedTransactions(userId);
            const cacheMap = new Map(cachedTransactions.map(tx => [tx.id, tx]));

            // 1. Build soft-deleted versions and dispatch store updates in a single pass
            const deletedVersions: Transaction[] = transactions.map(tx => {
                const cached = cacheMap.get(tx.id!) || tx;
                const updatedTx = this.scrubUndefined({
                    ...cached,
                    status: TransactionStatus.DELETED,
                    updatedAt: now,
                    syncStatus: SyncStatus.PENDING
                }) as Transaction;

                // Optimistic: update account balances
                if (updatedTx.accountId || updatedTx.toAccountId) {
                    const affectedAccounts = new Set([updatedTx.accountId, updatedTx.toAccountId].filter(Boolean));
                    affectedAccounts.forEach(accId => {
                        this.store.dispatch(AccountsActions.updateAccountBalanceForTransaction({
                            userId,
                            accountId: accId as string,
                            transactionType: 'delete',
                            oldTransaction: updatedTx
                        }));
                    });
                }

                // Dispatch success per item to clear from UI
                this.store.dispatch(TransactionsActions.deleteTransactionSuccess({
                    transactionId: updatedTx.id!,
                    transaction: updatedTx
                }));

                return updatedTx;
            });

            // 2. Bulk-update cache in a single IndexedDB write batch
            this.bulkUpdateTransactionCache(userId, deletedVersions);

            // 3. Complete the observable immediately (non-blocking)
            observer.next();
            observer.complete();

            // 4. Queue each for background sync
            deletedVersions.forEach(tx => {
                this.addToSyncQueue('update', tx, userId).catch(err => {
                    console.error(`[TransactionsService] Bulk delete sync queue error for ${tx.id}:`, err);
                });
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
         * Always wait for IndexedDB to be ready before deciding whether the
         * cache is empty. On first load the DB may not have finished hydrating
         * in-memory caches yet, so an apparent miss is not a real miss.
         */
        const cached = this.getCachedTransactions(userId);
        if (cached.length > 0) {
            this.transactionsSubject.next(cached);
            // Hydrate personal store immediately
            this.store.dispatch(TransactionsActions.loadTransactionsSuccess({ transactions: cached }));
        }

        return this.localStorageUtility.isReady$.pipe(
            switchMap(() => {
                const refreshed = this.getCachedTransactions(userId);
                if (refreshed.length > 0) {
                    // Cache is hot — emit immediately and let the Firestore listener provide updates.
                    this.transactionsSubject.next(refreshed);
                    this.store.dispatch(TransactionsActions.loadTransactionsSuccess({ transactions: refreshed }));
                } else {
                    // Cache is genuinely empty after DB ready — attempt pull only if online.
                    // When offline this returns of(undefined) silently; the Firestore
                    // listener (listenToTransactions) has its own offline fallback.
                    if (this.commonSyncService.isCurrentlyOnline()) {
                        this.pullFromFirestore(userId).subscribe();
                    }
                }
                return this.transactionsSubject.asObservable();
            }),
            startWith(this.transactionsSubject.value)
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
        /**
         * ⚠️ ARCHITECTURE ALIGNMENT: IndexedDB as Source of Truth
         */
        const cached = this.getCachedTransactions(userId, familyId);
        if (cached.length > 0) {
            this.transactionsSubject.next(cached);
            // Hydrate family store immediately to prevent selector delays
            this.store.dispatch(FamilyActions.loadTransactionsSuccess({ transactions: cached }));
        }

        return this.localStorageUtility.isReady$.pipe(
            switchMap(() => {
                const refreshed = this.getCachedTransactions(userId, familyId);
                this.transactionsSubject.next(refreshed);
                return this.transactionsSubject.asObservable();
            }),
            startWith(this.transactionsSubject.value)
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

        const isFamilyMode = this.store.selectSignal(ProfileSelectors.selectProfile)()?.preferences?.isFamilyMode;
        const effectiveFamilyId = familyId || (isFamilyMode ? this.getFamilyId() : undefined);

        return from(getDocs(transactionsRef)).pipe(
            timeout(20000), // Timeout after 20s for larger datasets
            tap((querySnapshot: any) => {
                const firestoreTransactions: Transaction[] = [];
                querySnapshot.forEach((docSnap: any) => {
                    const data = docSnap.data();
                    if (data && (data['amount'] !== undefined || docSnap.id)) {
                        const tx = { id: docSnap.id, ...data } as Transaction;
                        // ── Indexing Protection: Family transactions MUST have familyId field
                        // even if it's not present in the Firestore document itself.
                        if (effectiveFamilyId && !tx.familyId) {
                            tx.familyId = effectiveFamilyId;
                        }
                        firestoreTransactions.push(tx);
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

                // Persist the merged list back to local cache efficiently
                this.bulkUpdateTransactionCache(userId, merged);

                // 2. Re-read from IndexedDB cache (Source of Truth)
                const updatedFromCache = this.getCachedTransactions(userId, familyId);

                // 3. Update subject and NgRx state
                console.log(`[TransactionsService] Dispatching ${updatedFromCache.length} transactions from cache to store`);
                this.transactionsSubject.next(updatedFromCache);
                
                if (effectiveFamilyId) {
                  this.store.dispatch(FamilyActions.loadTransactionsSuccess({ transactions: updatedFromCache }));
                } else {
                  this.store.dispatch(TransactionsActions.loadTransactionsSuccess({ transactions: updatedFromCache }));
                }
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

        const currentPath = this.getTransactionsPath(userId, familyId);
        console.log(`[TransactionsService] 🔍 Checking listener for path: '${currentPath}' (Active: ${this.activeListenerPath ?? 'None'})`);

        if (this.activeListenerPath === currentPath) {
            console.log(`[TransactionsService] 🛡️ Listener setup SKIPPED - Already active for path: '${currentPath}'`);
            return of(undefined);
        }
        
        console.log(`[TransactionsService] 🚀 Initializing new real-time listener for path: '${currentPath}'`);
        this.activeListenerPath = currentPath;

        const transactionsRef = query(
            collection(this.firestore, currentPath),
            orderBy('date', 'desc')
        );

        console.log(`[TransactionsService] Starting real-time listener for user: ${userId}`);

        const isFamilyMode = this.store.selectSignal(ProfileSelectors.selectProfile)()?.preferences?.isFamilyMode;
        const effectiveFamilyId = familyId || (isFamilyMode ? this.getFamilyId() : undefined);

        return new Observable<void>(observer => {
            // 0. Emit cached transactions immediately
            // This ensures data is visible instantly without waiting for Firestore
            const cachedList = this.getCachedTransactions(userId, familyId);
            if (cachedList.length > 0) {
                this.transactionsSubject.next(cachedList);
                if (effectiveFamilyId) {
                    this.store.dispatch(FamilyActions.loadTransactionsSuccess({ transactions: cachedList }));
                } else {
                    this.store.dispatch(TransactionsActions.loadTransactionsSuccess({ transactions: cachedList }));
                }
            }

            // Track whether this is the first snapshot emission (full load) vs. incremental.
            let isFirstSnapshot = true;

            const unsubscribe = onSnapshot(transactionsRef,
                (querySnapshot) => {
                    if (isFirstSnapshot) {
                        // ── FULL LOAD (first emission) ─────────────────────────────────────
                        // On the initial snapshot we must reconcile all Firestore docs with
                        // local pending items, just like pullFromFirestore does.
                        isFirstSnapshot = false;

                        const firestoreTransactions: Transaction[] = [];
                        querySnapshot.forEach((docSnap) => {
                            const data = docSnap.data();
                            if (data && (data['amount'] !== undefined || docSnap.id)) {
                                const tx = { id: docSnap.id, ...data } as Transaction;
                                if (effectiveFamilyId && !tx.familyId) {
                                    tx.familyId = effectiveFamilyId;
                                }
                                firestoreTransactions.push(tx);
                            }
                        });

                        console.log(`[TransactionsService] 📥 Initial snapshot received for '${currentPath}': ${firestoreTransactions.length} transactions`);

                        // Merge with local pending transactions to protect offline writes.
                        const localTransactions = this.getCachedTransactions(userId, familyId);
                        const merged = this.mergeFirestoreAndLocal(firestoreTransactions, localTransactions);

                        // Persist merged list to IndexedDB efficiently (now flat for all modes)
                        this.bulkUpdateTransactionCache(userId, merged);

                        // Re-read sorted list from IndexedDB (Source of Truth).
                        const updatedFromCache = this.getCachedTransactions(userId, familyId);

                        this.transactionsSubject.next(updatedFromCache);
                        if (effectiveFamilyId) {
                            this.store.dispatch(FamilyActions.loadTransactionsSuccess({ transactions: updatedFromCache }));
                        } else {
                            this.store.dispatch(TransactionsActions.loadTransactionsSuccess({ transactions: updatedFromCache }));
                        }

                        observer.next();
                        return;
                    }

                    // ── INCREMENTAL UPDATE (subsequent emissions) ──────────────────────────
                    // Only process the documents that actually changed (added/modified/removed).
                    // This avoids re-writing all 397+ documents on every tiny update.
                    const changes = querySnapshot.docChanges();
                    if (changes.length === 0) {
                        observer.next();
                        return;
                    }

                    console.log(`[TransactionsService] 📥 Incremental update for '${currentPath}': ${changes.length} change(s)`);

                    // Build a mutable map from the current in-memory list for O(1) patching.
                    const current = this.transactionsSubject.getValue();
                    const txMap = new Map<string, Transaction>(current.map(t => [t.id!, t]));

                    changes.forEach((change) => {
                        const docSnap = change.doc;
                        if (change.type === 'removed') {
                            // Remove from map and IndexedDB cache.
                            txMap.delete(docSnap.id);
                            const itemKey = LocalStorageKeyHelper.getTransactionItemKey(docSnap.id, effectiveFamilyId);
                            this.localStorageUtility.removeTransaction(itemKey);
                        } else {
                            // 'added' or 'modified'
                            const data = docSnap.data();
                            if (data && (data['amount'] !== undefined || docSnap.id)) {
                                const tx = { id: docSnap.id, ...data } as Transaction;
                                if (effectiveFamilyId && !tx.familyId) {
                                    tx.familyId = effectiveFamilyId;
                                }

                                // Only overwrite if the local copy is not a still-pending write.
                                // We check the actual IndexedDB cache instead of our in-memory map to ensure 
                                // we pick up sync-completions from CommonSyncService.
                                const itemKey = LocalStorageKeyHelper.getTransactionItemKey(tx.id!, effectiveFamilyId);
                                const cached = this.localStorageUtility.getItem<Transaction>(itemKey, 'transactions');
                                const isLocalPending = cached?.syncStatus === 'pending';
                                
                                if (!isLocalPending) {
                                    txMap.set(tx.id!, tx);
                                    this.updateTransactionCache(userId, 'update', tx);
                                }
                            }
                        }
                    });

                    // Produce sorted array and push to store — no full IndexedDB re-read needed.
                    const updatedList = this.sortTransactions(Array.from(txMap.values()));
                    this.transactionsSubject.next(updatedList);
                    if (effectiveFamilyId) {
                        this.store.dispatch(FamilyActions.loadTransactionsSuccess({ transactions: updatedList }));
                    } else {
                        this.store.dispatch(TransactionsActions.loadTransactionsSuccess({ transactions: updatedList }));
                    }

                    observer.next();
                },
                (error) => {
                    console.warn(`[TransactionsService] ⚠️ Real-time listener failed for path '${currentPath}' (may be offline):`, error);
                    observer.complete();
                }
            );

            return () => {
                console.log(`[TransactionsService] 🔌 Stopping real-time listener for path: '${currentPath}'`);
                if (this.activeListenerPath === currentPath) {
                    console.log(`[TransactionsService] 🔌 Clearing activeListenerPath for '${currentPath}'`);
                    this.activeListenerPath = null;
                }
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
                if (typeof date === 'object') {
                    if (typeof (date as any).toDate === 'function') return (date as any).toDate().getTime();
                    if ('seconds' in date) return (date as any).seconds * 1000;
                }
                const d = new Date(date);
                return isNaN(d.getTime()) ? 0 : d.getTime();
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
     * Update multiple transactions in cache efficiently (Bulk)
     */
    protected bulkUpdateTransactionCache(userId: string, transactions: Transaction[]): void {
        try {
            const itemsToSet: { key: string; value: Transaction }[] = [];
            for (const tx of transactions) {
                if (!tx.id) continue;
                const itemKey = LocalStorageKeyHelper.getTransactionItemKey(tx.id, tx.familyId);
                const existing = this.localStorageUtility.getItem<Transaction>(itemKey, 'transactions');
                itemsToSet.push({ key: itemKey, value: { ...existing, ...tx } });
            }
            if (itemsToSet.length > 0) {
                this.localStorageUtility.setTransactions(itemsToSet);
            }
        } catch (error) {
            console.error('Error in bulkUpdateTransactionCache:', error);
        }
    }

    /**
     * Cleanup transactions with status 'deleted' older than 30 days
     */
    public cleanupOldDeletedTransactions(userId: string, cleanupIds: string[], familyId?: string): void {
        if (!cleanupIds || cleanupIds.length === 0) return;

        console.log(`[TransactionsService] Cleaning up ${cleanupIds.length} old deleted transactions`);

        if (this.isGuest()) {
            const transactions = this.getCachedTransactions(userId, familyId);
            const toDelete = transactions.filter(t => cleanupIds.includes(t.id || ''));
            toDelete.forEach(tx => {
                const itemKey = LocalStorageKeyHelper.getTransactionItemKey(tx.id!, familyId);
                this.localStorageUtility.removeTransaction(itemKey);
            });
            
            const updated = this.getCachedTransactions(userId, familyId);
            this.transactionsSubject.next(updated);
            return;
        }

        cleanupIds.forEach(id => {
            this.addToSyncQueue('delete', { id, familyId }, userId).catch(err => {
                console.error('Failed to add cleanup delete to sync queue:', err);
            });
            const itemKey = LocalStorageKeyHelper.getTransactionItemKey(id, familyId);
            this.localStorageUtility.removeTransaction(itemKey);
        });

        const updatedList = this.getCachedTransactions(userId, familyId);
        this.transactionsSubject.next(updatedList);
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
