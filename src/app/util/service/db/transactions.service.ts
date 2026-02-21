import { Injectable } from '@angular/core';
import { Firestore, collection, doc, updateDoc, deleteDoc, getDoc, addDoc, onSnapshot, setDoc } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, BehaviorSubject, from, of } from 'rxjs';
import { map, switchMap, tap, catchError } from 'rxjs/operators';
import { orderBy, query, Timestamp, getDocs } from '@angular/fire/firestore';
import { DateService } from '../date.service';
import { Transaction } from '../../models/transaction.model';
import { RecurringInterval, SyncStatus } from '../../config/enums';
import { AppState } from 'src/app/store/app.state';
import { Store } from '@ngrx/store';
import * as CategoriesActions from '../../../store/categories/categories.actions';
import * as TransactionsActions from '../../../store/transactions/transactions.actions';
import { AccountsService } from './accounts.service';
import * as AccountsActions from '../../../store/accounts/accounts.actions';
import * as TransactionsSelectors from '../../../store/transactions/transactions.selectors';
import { CreateSplitTransactionRequest } from '../../models/splitwise.model';
import { SplitwiseService } from 'src/app/modules/splitwise/services/splitwise.service';
import { CommonSyncService, SyncItem } from '../common-sync.service';
import { BaseService } from '../base.service';
import { LocalIndexDBStorageService } from '../indexdb-storage.service';
import { UserService } from './user.service';
import { LocalStorageKeyHelper } from '../../models/local-storage.model';
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
        private store: Store<AppState>,
        private accountsService: AccountsService,
        private splitwiseService: SplitwiseService,
        private commonSyncService: CommonSyncService,
        private localStorageUtility: LocalIndexDBStorageService,
        private userService: UserService
    ) {
        super(firestore, auth, currencyService);
    }

    private isGuest(): boolean {
        return this.userService.getCurrentUserId() === 'offline-guest';
    }

    /**
     * Create a new transaction
     */
    createTransaction(userId: string, transaction: Omit<Transaction, 'id'>): Observable<void> {
        const transactionId = this.generateId();
        const now = new Date();
        const transactionData: Transaction = {
            ...transaction,
            id: transactionId,
            date: this.dateService.toDate(transaction.date) || now,
            createdAt: now,
            updatedAt: now,
            createdBy: userId,
            updatedBy: userId,
            syncStatus: SyncStatus.SYNCED
        };

        if (this.isGuest()) {
            this.localStorageUtility.saveEntity('transactions', transactionData, 'id');
            // Update store immediately
            this.store.dispatch(TransactionsActions.createTransactionSuccess({
                transaction: transactionData
            }));
            // Update account balance
            this.store.dispatch(AccountsActions.updateAccountBalanceForTransaction({
                userId: userId,
                accountId: transaction.accountId,
                transactionType: 'create',
                newTransaction: transactionData
            }));
            return of(undefined);
        }

        return new Observable<void>(observer => {
            const createTransactionAsync = async () => {
                try {
                    if (this.commonSyncService.isCurrentlyOnline()) {
                        try {
                            const transactionRef = doc(this.firestore, `users/${userId}/transactions/${transactionId}`);
                            
                            // 1. Dispatch store updates immediately (Optimistic)
                            this.store.dispatch(AccountsActions.updateAccountBalanceForTransaction({
                                userId: userId,
                                accountId: transaction.accountId,
                                transactionType: 'create',
                                newTransaction: transactionData as Transaction
                            }));

                            this.store.dispatch(TransactionsActions.createTransactionSuccess({
                                transaction: transactionData as Transaction
                            }));

                            // 2. Update cache immediately
                            this.updateTransactionCache(userId, 'create', transactionData as Transaction);

                            // 3. Perform Firestore operation in background or concurrently
                            const firestoreTask = setDoc(transactionRef, transactionData);

                            if (transaction.isSplitTransaction && transaction.splitGroupId) {
                                await this.createSplitTransaction(transaction.splitGroupId, transaction, transactionRef.id, userId);
                            }

                            await firestoreTask;

                            observer.next();
                            observer.complete();
                        } catch (error) {
                            console.error('Failed to create transaction online:', error);
                            // Fall back to offline mode
                            await this.addToSyncQueue('create', transactionData);
                            
                            // Update account balance even if offline
                            this.store.dispatch(AccountsActions.updateAccountBalanceForTransaction({
                                userId: userId,
                                accountId: transaction.accountId,
                                transactionType: 'create',
                                newTransaction: transactionData as Transaction
                            }));

                            // Add to store immediately for offline transactions
                            this.store.dispatch(TransactionsActions.createTransactionSuccess({
                                transaction: transactionData as Transaction
                            }));

                            // Update cache
                            this.updateTransactionCache(userId, 'create', transactionData as Transaction);
                            observer.next();
                            observer.complete();
                        }
                    } else {
                        // Store offline
                        await this.addToSyncQueue('create', transactionData);

                        // Update account balance even if offline
                        this.store.dispatch(AccountsActions.updateAccountBalanceForTransaction({
                            userId: userId,
                            accountId: transaction.accountId,
                            transactionType: 'create',
                            newTransaction: transactionData as Transaction
                        }));

                        // Add to store immediately for offline transactions
                        this.store.dispatch(TransactionsActions.createTransactionSuccess({
                            transaction: transactionData as Transaction
                        }));

                        // Update cache
                        this.updateTransactionCache(userId, 'create', transactionData as Transaction);
                        observer.next();
                        observer.complete();
                    }
                } catch (error) {
                    console.error('Error in createTransaction:', error);
                    observer.error(error);
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
                if (updatedTransaction.amount || updatedTransaction.accountId) {
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

                    const updateData = {
                        ...updatedTransaction,
                        updatedAt: new Date(),
                        updatedBy: userId,
                        syncStatus: this.commonSyncService.isCurrentlyOnline() ? SyncStatus.SYNCED : SyncStatus.PENDING
                    };

                    const newTransaction = { ...oldTransaction, ...updateData } as Transaction;

                    const handleBalanceUpdate = () => {
                        if (oldTransaction && (updatedTransaction.amount !== undefined || (updatedTransaction.accountId && updatedTransaction.accountId !== oldTransaction.accountId))) {
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

                    if (this.commonSyncService.isCurrentlyOnline()) {
                        try {
                            const transactionRef = doc(this.firestore, `users/${userId}/transactions/${transactionId}`);
                            
                            // 1. Dispatch store updates immediately (Optimistic)
                            handleBalanceUpdate();

                            this.store.dispatch(TransactionsActions.updateTransactionSuccess({
                                transaction: newTransaction
                            }));

                            // 2. Update cache immediately
                            this.updateTransactionCache(userId, 'update', newTransaction);

                            // 3. Perform Firestore operation
                            await updateDoc(transactionRef, updateData);

                            observer.next();
                            observer.complete();
                        } catch (error) {
                            console.error('Failed to update transaction online:', error);
                            await this.addToSyncQueue('update', { id: transactionId, ...updateData });

                            // Handle balance update even if offline
                            handleBalanceUpdate();

                            // Update store immediately for offline transactions
                            this.store.dispatch(TransactionsActions.updateTransactionSuccess({
                                transaction: newTransaction
                            }));

                            // Update cache
                            this.updateTransactionCache(userId, 'update', newTransaction);
                            observer.next();
                            observer.complete();
                        }
                    } else {
                        await this.addToSyncQueue('update', { id: transactionId, ...updateData });

                        // Handle balance update even if offline
                        handleBalanceUpdate();

                        // Update store immediately for offline transactions
                        this.store.dispatch(TransactionsActions.updateTransactionSuccess({
                            transaction: newTransaction
                        }));

                        // Update cache
                        this.updateTransactionCache(userId, 'update', newTransaction);
                        observer.next();
                        observer.complete();
                    }
                } catch (error) {
                    observer.error(error);
                }
            };

            updateTransactionAsync();
        });
    }

    /**
     * Delete a transaction
     */
    deleteTransaction(userId: string, transactionId: string): Observable<void> {
        if (this.isGuest()) {
            const transactions = this.localStorageUtility.getEntities<Transaction>('transactions');
            const transactionToDelete = transactions.find(t => t.id === transactionId);

            if (transactionToDelete) {
                this.localStorageUtility.deleteEntity('transactions', transactionId, 'id');
                // Update store immediately
                this.store.dispatch(TransactionsActions.deleteTransactionSuccess({ transactionId }));
                // Update account balance
                this.store.dispatch(AccountsActions.updateAccountBalanceForTransaction({
                    userId: userId,
                    accountId: transactionToDelete.accountId,
                    transactionType: 'delete',
                    oldTransaction: transactionToDelete
                }));
            }
            return of(undefined);
        }

        return new Observable<void>(observer => {
            // Get transaction data for balance update first from cache
            const cachedTransactions = this.getCachedTransactions(userId);
            const transactionToDelete = cachedTransactions.find(t => t.id === transactionId);

            const handleBalanceDeletion = () => {
                if (transactionToDelete) {
                    this.store.dispatch(AccountsActions.updateAccountBalanceForTransaction({
                        userId: userId,
                        accountId: transactionToDelete.accountId,
                        transactionType: 'delete',
                        oldTransaction: transactionToDelete
                    }));

                    // Handle split transaction deletion if needed
                    if (transactionToDelete.isSplitTransaction) {
                        this.splitwiseService.deleteSplitTransaction(transactionToDelete.id!, userId).catch(error => {
                            console.error('Failed to delete split transaction:', error);
                        });
                    }
                }
            };

            const transactionRef = doc(this.firestore, `users/${userId}/transactions/${transactionId}`);

            if (this.commonSyncService.isCurrentlyOnline()) {
                // 1. Dispatch store updates immediately (Optimistic)
                handleBalanceDeletion();

                this.store.dispatch(TransactionsActions.deleteTransactionSuccess({ transactionId }));

                // 2. Update cache immediately
                this.updateTransactionCache(userId, 'delete', { id: transactionId } as Transaction);

                // 3. Perform Firestore operation
                deleteDoc(transactionRef).then(() => {
                    observer.next();
                    observer.complete();
                }).catch(error => {
                    console.error('Failed to delete transaction online, but already removed from local UI:', error);
                    observer.error(error);
                });
            } else {
                // Offline mode - add to sync queue
                this.addToSyncQueue('delete', { id: transactionId }).then(() => {
                    // Handle balance deletion locally even if offline
                    handleBalanceDeletion();

                    this.store.dispatch(TransactionsActions.deleteTransactionSuccess({ transactionId }));
                    this.updateTransactionCache(userId, 'delete', { id: transactionId } as Transaction);
                    observer.next();
                    observer.complete();
                }).catch(error => {
                    console.error('Failed to add to sync queue:', error);
                    observer.error(error);
                });
            }
        });
    }

    /**
     * Get all transactions for a user (Local-Only)
     */
    getTransactions(userId: string): Observable<Transaction[]> {
        if (this.isGuest()) {
            const transactions = this.localStorageUtility.getEntities<Transaction>('transactions');
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

        const transactionsRef = query(
            collection(this.firestore, `users/${userId}/transactions`),
            orderBy('date', 'desc')
        );

        console.log(`[TransactionsService] Pulling transactions for user: ${userId}`);

        return from(getDocs(transactionsRef)).pipe(
            tap(querySnapshot => {
                const transactions: Transaction[] = [];
                querySnapshot.forEach(docSnap => {
                    transactions.push({ id: docSnap.id, ...docSnap.data() } as Transaction);
                });

                console.log(`[TransactionsService] Pulled ${transactions.length} transactions from Firestore`);

                // Cache the fresh data
                this.cacheTransactions(userId, transactions);
                
                // Update the subject for active components
                this.transactionsSubject.next(transactions);
                
                // Update NgRx state via success action
                this.store.dispatch(TransactionsActions.loadTransactionsSuccess({ transactions }));
            }),
            map(() => undefined),
            catchError(error => {
                console.error('[TransactionsService] Pull failed:', error);
                return of(undefined);
            })
        );
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
                    const transactionRef = doc(this.firestore, `users/${userId}/transactions/${transactionId}`);
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
    processRecurringTransaction(userId: string, transaction: Transaction): Observable<void> {
        return new Observable<void>(observer => {
            const processAsync = async () => {
                try {
                    // Create a new transaction for the current occurrence
                    const newTransaction: Omit<Transaction, 'id'> = {
                        ...transaction,
                        date: new Date(),
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
                        // Use today's date as the base for calculating next occurrence
                        const today = new Date();
                        const nextOccurrence = this.calculateNextOccurrence(
                            transaction.recurringInterval,
                            today
                        );

                        console.log(`Processing recurring transaction ${transaction.id} (${transaction.category}):`, {
                            interval: transaction.recurringInterval,
                            today: today,
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
     * Create split transaction
     */
    private async createSplitTransaction(selectedGroupId: string, formData: any, originalTransactionId: string, userId: string): Promise<void> {
        try {
            const splitTransactionData: CreateSplitTransactionRequest = {
                groupId: selectedGroupId,
                originalTransactionId: originalTransactionId,
                amount: formData.amount,
                splits: formData.splits || []
            };

            await this.splitwiseService.createSplitTransaction(splitTransactionData, userId).toPromise();
        } catch (error) {
            console.error('Failed to create split transaction:', error);
        }
    }

    /**
     * Add transaction to sync queue
     */
    private async addToSyncQueue(operation: 'create' | 'update' | 'delete', data: any): Promise<void> {
        const syncItem: Omit<SyncItem, 'timestamp' | 'retryCount'> = {
            id: this.generateId(),
            type: 'transaction',
            operation: operation,
            data: data,
            maxRetries: 3
        };

        const result = await this.commonSyncService.registerSyncItem(syncItem);
        if (!result.success) {
            console.error('Failed to register transaction for sync:', result.errors);
        }
    }

    /**
     * Get cached transactions from localStorage
     */
    private getCachedTransactions(userId: string): Transaction[] {
        try {
            const cachedData = this.localStorageUtility.getItem<Transaction[]>(LocalStorageKeyHelper.getTransactionsCacheKey(userId));
            if (cachedData) {
                return cachedData.filter(t => t && t.id);
            }
        } catch (error) {
            console.error('Error loading cached transactions:', error);
        }
        return [];
    }

    /**
     * Cache transactions to localStorage
     */
    private cacheTransactions(userId: string, transactions: Transaction[]): void {
        try {
            this.localStorageUtility.setItem(LocalStorageKeyHelper.getTransactionsCacheKey(userId), transactions);
        } catch (error) {
            console.error('Error caching transactions:', error);
        }
    }

    /**
     * Update transaction cache when transactions are created, updated, or deleted
     */
    private updateTransactionCache(userId: string, operation: 'create' | 'update' | 'delete', transaction?: Transaction): void {
        try {
            const cachedTransactions = this.getCachedTransactions(userId);

            switch (operation) {
                case 'create':
                    if (transaction) {
                        cachedTransactions.push(transaction);
                    }
                    break;
                case 'update':
                    if (transaction) {
                        const index = cachedTransactions.findIndex(t => t.id === transaction.id);
                        if (index !== -1) {
                            cachedTransactions[index] = { ...cachedTransactions[index], ...transaction };
                        }
                    }
                    break;
                case 'delete':
                    if (transaction) {
                        const index = cachedTransactions.findIndex(t => t.id === transaction.id);
                        if (index !== -1) {
                            cachedTransactions.splice(index, 1);
                        }
                    }
                    break;
            }

            this.cacheTransactions(userId, cachedTransactions);
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
