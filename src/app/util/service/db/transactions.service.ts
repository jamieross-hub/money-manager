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
    createTransaction(userId: string, transaction: Omit<Transaction, 'id'>): Observable<void> {
        const transactionId = this.generateId();
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

                    // 4. Perform Firestore operation in background
                    if (this.commonSyncService.isCurrentlyOnline()) {
                        try {
                            const transactionRef = doc(this.firestore, this.getTransactionPath(userId, transactionId));
                            
                            const firestoreTask = setDoc(transactionRef, transactionData);



                            await firestoreTask;
                        } catch (error) {
                            console.warn('⚠️ Failed to create transaction online, moving to sync queue:', error);
                            await this.addToSyncQueue('create', transactionData, userId);
                        }
                    } else {
                        // Store offline
                        await this.addToSyncQueue('create', transactionData, userId);
                    }
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

                    // 4. Background update
                    if (this.commonSyncService.isCurrentlyOnline()) {
                        try {
                            const transactionRef = doc(this.firestore, this.getTransactionPath(userId, transactionId));
                            await updateDoc(transactionRef, updateData);
                        } catch (error) {
                            console.warn('⚠️ Failed to update transaction online, moving to sync queue:', error);
                            await this.addToSyncQueue('update', { id: transactionId, ...updateData }, userId);
                        }
                    } else {
                        await this.addToSyncQueue('update', { id: transactionId, ...updateData }, userId);
                    }
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

            // 4. Background operation
            const transactionRef = doc(this.firestore, this.getTransactionPath(userId, transactionId));

            if (this.commonSyncService.isCurrentlyOnline()) {
                updateDoc(transactionRef, { status: TransactionStatus.DELETED, updatedAt: new Date() }).catch(error => {
                    console.warn('⚠️ Failed to soft delete transaction online, moving to sync queue:', error);
                    this.addToSyncQueue('update', { id: transactionId, status: TransactionStatus.DELETED, updatedAt: new Date() }, userId);
                });
            } else {
                // Offline mode - add to sync queue
                this.addToSyncQueue('update', { id: transactionId, status: TransactionStatus.DELETED, updatedAt: new Date() }, userId).catch(error => {
                    console.error('Failed to add to sync queue:', error);
                });
            }
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
                    firestoreTransactions.push({ id: docSnap.id, ...docSnap.data() } as Transaction);
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
                        firestoreTransactions.push({ id: docSnap.id, ...docSnap.data() } as Transaction);
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
            const getTransactionAsync = async () => {
                try {
                    const transactionRef = doc(this.firestore, this.getTransactionPath(userId, transactionId));
                    const transactionDoc = await getDoc(transactionRef);

                    if (transactionDoc.exists()) {
                        const transaction = { id: transactionDoc.id, ...transactionDoc.data() } as Transaction;
                        observer.next(transaction);
                    } else {
                        observer.next(undefined);
                    }
                    observer.complete();
                } catch (error) {
                    observer.error(error);
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
     * Get recurring transactions for a user (Store-based)
     */
    getRecurringTransactions(userId: string): Observable<Transaction[]> {
        if (this.isGuest()) {
            const transactions = this.localStorageUtility.getEntities<Transaction>('transactions');
            const recurringTransactions = transactions.filter(t => t.isRecurring === true);
            return of(recurringTransactions);
        }

        return this.store.select(TransactionsSelectors.selectAllTransactions).pipe(
            map(transactions => transactions.filter(t => t.isRecurring === true))
        );
    }

    /**
     * Get recurring transactions that are due (next occurrence is today or in the past)
     */
    getDueRecurringTransactions(userId: string): Observable<Transaction[]> {
        return this.store.select(TransactionsSelectors.selectAllTransactions).pipe(
            map(allTransactions => {
                const recurringTransactions = allTransactions.filter(t => t.isRecurring === true);
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                return recurringTransactions.filter(transaction => {
                    // Additional check to ensure transaction is still recurring
                    if (!transaction.isRecurring) {
                        return false;
                    }

                    if (!transaction.nextOccurrence) {
                        return false;
                    }

                    const nextOccurrence = transaction.nextOccurrence instanceof Date
                        ? transaction.nextOccurrence
                        : this.dateService.toDate(transaction.nextOccurrence);

                    if (!nextOccurrence) {
                        return false;
                    }

                    // Create a new Date object to avoid modifying the original
                    const normalizedNextOccurrence = new Date(nextOccurrence);
                    normalizedNextOccurrence.setHours(0, 0, 0, 0);

                    const isDue = normalizedNextOccurrence <= today;

                    if (!isDue) {
                        return false;
                    }

                    // Check if a transaction for this period already exists
                    const hasExistingTransaction = this.checkExistingTransactionInPeriod(
                        allTransactions,
                        transaction,
                        today
                    );

                    if (hasExistingTransaction) {
                        return false;
                    }

                    // For monthly recurring transactions, check if next occurrence is in current month
                    if (transaction.recurringInterval === RecurringInterval.MONTHLY) {
                        const nextOccurrence = transaction.nextOccurrence instanceof Date
                            ? transaction.nextOccurrence
                            : this.dateService.toDate(transaction.nextOccurrence);

                        if (nextOccurrence) {
                            const isNextOccurrenceInCurrentMonth = this.isInSamePeriod(nextOccurrence, this.dateService.toDate(transaction.date), RecurringInterval.MONTHLY);
                            if (isNextOccurrenceInCurrentMonth) {
                                return false;
                            }
                        }
                    }

                    return true;
                });
            })
        );
    }

    /**
     * Process a recurring transaction and update its next occurrence
     */
    processRecurringTransaction(userId: string, transaction: Transaction, confirmedDate?: Date): Observable<void> {
        return new Observable<void>(observer => {
            const processAsync = async () => {
                try {
                    // Use the confirmed date (e.g. from the virtual occurrence) or today
                    const creationDate = confirmedDate || new Date();

                    // Create a new transaction for the current occurrence
                    const newTransaction: Omit<Transaction, 'id'> = {
                        ...transaction,
                        date: creationDate,
                        nextOccurrence: null, // Remove recurring info for the new transaction
                        isRecurring: false,
                        recurringInterval: null,
                        recurringEndDate: null,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        createdBy: userId,
                        updatedBy: userId,
                        syncStatus: SyncStatus.SYNCED,
                        isPending: false,
                        lastSyncedAt: new Date()
                    };

                    // Create the new transaction
                    await this.createTransaction(userId, newTransaction).toPromise();

                    // Update the original recurring transaction with next occurrence
                    if (transaction.recurringInterval) {
                        // Use the confirmed date as the base for calculating next occurrence
                        // If confirming today for tomorrow, we want to advance FROM tomorrow
                        const nextOccurrence = this.calculateNextOccurrence(
                            transaction.recurringInterval,
                            creationDate
                        );

                        console.log(`Processing recurring transaction ${transaction.id} (${transaction.category}):`, {
                            interval: transaction.recurringInterval,
                            creationDate: creationDate,
                            calculatedNextOccurrence: nextOccurrence
                        });

                        const updatedRecurringTransaction: Partial<Transaction> = {
                            nextOccurrence: nextOccurrence,
                            updatedAt: new Date(),
                            updatedBy: userId
                        };

                        // Check if we've reached the end date
                        if (transaction.recurringEndDate && nextOccurrence > transaction.recurringEndDate) {
                            console.log(`Recurring transaction ${transaction.id} has reached end date, marking as non-recurring`);
                            // Mark as non-recurring since we've reached the end
                            updatedRecurringTransaction.isRecurring = false;
                            updatedRecurringTransaction.recurringInterval = undefined;
                            updatedRecurringTransaction.recurringEndDate = undefined;
                        }

                        await this.updateTransaction(userId, transaction.id!, updatedRecurringTransaction).toPromise();
                        console.log(`Successfully updated recurring transaction ${transaction.id} with next occurrence: ${nextOccurrence}`);

                        // Add a small delay to ensure Firestore update is reflected
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }

                    observer.next();
                    observer.complete();
                } catch (error) {
                    console.error('Failed to process recurring transaction:', error);
                    observer.error(error);
                }
            };

            processAsync();
        });
    }

    /**
     * Skip a recurring transaction occurrence without creating a new record
     */
    skipRecurringTransaction(userId: string, transaction: Transaction, skippedDate?: Date): Observable<void> {
        return new Observable<void>(observer => {
            const skipAsync = async () => {
                try {
                    if (transaction.recurringInterval) {
                        const baseDate = skippedDate || (transaction.nextOccurrence 
                            ? (transaction.nextOccurrence instanceof Date ? transaction.nextOccurrence : this.dateService.toDate(transaction.nextOccurrence))
                            : new Date());
                        
                        const nextOccurrence = this.calculateNextOccurrence(
                            transaction.recurringInterval,
                            baseDate || new Date()
                        );

                        const updatedRecurringTransaction: Partial<Transaction> = {
                            nextOccurrence: nextOccurrence,
                            updatedAt: new Date(),
                            updatedBy: userId
                        };

                        // Check if we've reached the end date
                        if (transaction.recurringEndDate && nextOccurrence > transaction.recurringEndDate) {
                            updatedRecurringTransaction.isRecurring = false;
                            updatedRecurringTransaction.recurringInterval = undefined;
                            updatedRecurringTransaction.recurringEndDate = undefined;
                        }

                        await this.updateTransaction(userId, transaction.id!, updatedRecurringTransaction).toPromise();
                        console.log(`Successfully skipped recurring transaction ${transaction.id}, next occurrence: ${nextOccurrence}`);
                    }
                    observer.next();
                    observer.complete();
                } catch (error) {
                    console.error('Failed to skip recurring transaction:', error);
                    observer.error(error);
                }
            };
            skipAsync();
        });
    }

    /**
     * Check if a transaction for the current period already exists
     */
    private checkExistingTransactionInPeriod(allTransactions: Transaction[], recurringTransaction: Transaction, today: Date): boolean {
        // Find transactions that match the recurring transaction criteria
        const matchingTransactions = allTransactions.filter(transaction => {
            // Skip the recurring transaction itself
            if (transaction.id === recurringTransaction.id) {
                return false;
            }

            // Check if it's the same type of transaction (same category, amount, account)
            const isSameTransaction =
                transaction.category === recurringTransaction.category &&
                transaction.amount === recurringTransaction.amount &&
                transaction.categoryId === recurringTransaction.categoryId &&
                transaction.accountId === recurringTransaction.accountId &&
                transaction.type === recurringTransaction.type;

            if (!isSameTransaction) {
                return false;
            }

            // Check if the transaction date falls within the current period
            const transactionDate = transaction.date instanceof Date
                ? transaction.date
                : this.dateService.toDate(transaction.date);

            if (!transactionDate) {
                return false;
            }

            return this.isInSamePeriod(transactionDate, today, recurringTransaction.recurringInterval!);
        });

        console.log(`Found ${matchingTransactions.length} existing transactions for ${recurringTransaction.category} in current period:`,
            matchingTransactions.map(t => ({ id: t.id, date: t.date, amount: t.amount })));

        return matchingTransactions.length > 0;
    }

    /**
     * Check if two dates are in the same period based on recurring interval
     */
    private isInSamePeriod(date1: Date, date2: Date | null, interval: RecurringInterval): boolean {
        const d1 = new Date(date1);
        const d2 = date2 ? new Date(date2) : new Date();

        // Normalize both dates to start of day
        d1.setHours(0, 0, 0, 0);
        d2.setHours(0, 0, 0, 0);

        switch (interval) {
            case RecurringInterval.DAILY:
                // Same day
                return d1.getTime() === d2.getTime();

            case RecurringInterval.WEEKLY:
                // Same week (Monday to Sunday)
                const week1 = this.getWeekStart(d1);
                const week2 = this.getWeekStart(d2);
                return week1.getTime() === week2.getTime();

            case RecurringInterval.MONTHLY:
                // Same month and year
                return d1.getFullYear() === d2.getFullYear() &&
                    d1.getMonth() === d2.getMonth();

            case RecurringInterval.YEARLY:
                // Same year
                return d1.getFullYear() === d2.getFullYear();

            default:
                return false;
        }
    }

    /**
     * Get the start of the week (Monday) for a given date
     */
    private getWeekStart(date: Date): Date {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }



    /**
     * Calculate next occurrence for recurring transactions
     */
    private calculateNextOccurrence(interval: RecurringInterval, currentDate: Date | Timestamp): Date {
        const date = currentDate instanceof Date ? currentDate : currentDate.toDate();
        const nextDate = new Date(date);

        console.log(`Calculating next occurrence for interval ${interval} from date ${date}`);

        switch (interval) {
            case RecurringInterval.DAILY:
                nextDate.setDate(nextDate.getDate() + 1);
                break;
            case RecurringInterval.WEEKLY:
                nextDate.setDate(nextDate.getDate() + 7);
                break;
            case RecurringInterval.MONTHLY:
                nextDate.setMonth(nextDate.getMonth() + 1);
                break;
            case RecurringInterval.YEARLY:
                nextDate.setFullYear(nextDate.getFullYear() + 1);
                break;
            default:
                nextDate.setDate(nextDate.getDate() + 1);
        }

        console.log(`Calculated next occurrence: ${nextDate}`);
        return nextDate;
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
            
            const transactions: Transaction[] = allTransactions.filter(tx => {
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
                    const existing = this.localStorageUtility.getItem<Transaction>(itemKey);
                    this.localStorageUtility.setTransaction(itemKey, { ...existing, ...transaction });
                    break;
                case 'delete':
                    this.localStorageUtility.removeTransaction(itemKey);
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
