import { Injectable } from '@angular/core';
import { Firestore, collection, doc, updateDoc, deleteDoc, getDoc, addDoc, onSnapshot, setDoc } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { orderBy, query, Timestamp } from '@angular/fire/firestore';
import { DateService } from '../date.service';
import { Transaction } from '../../models/transaction.model';
import { RecurringInterval, SyncStatus } from '../../config/enums';
import { AppState } from 'src/app/store/app.state';
import { Store } from '@ngrx/store';
import * as CategoriesActions from '../../../store/categories/categories.actions';
import * as TransactionsActions from '../../../store/transactions/transactions.actions';
import { AccountsService } from './accounts.service';
import * as AccountsActions from '../../../store/accounts/accounts.actions';
import { CreateSplitTransactionRequest } from '../../models/splitwise.model';
import { SplitwiseService } from 'src/app/modules/splitwise/services/splitwise.service';
import { CommonSyncService, SyncItem } from '../common-sync.service';
import { BaseService } from '../base.service';
import { LocalIndexDBStorageService } from '../indexdb-storage.service';
import { UserService } from './user.service';
import { LocalStorageKeyHelper } from '../../models/local-storage.model';
import { of } from 'rxjs';
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
        const transactionData: Transaction = {
            ...transaction,
            id: transactionId,
            date: this.dateService.toDate(transaction.date) || new Date(),
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
                            await setDoc(transactionRef, transactionData);

                            if (transaction.isSplitTransaction && transaction.splitGroupId) {
                                await this.createSplitTransaction(transaction.splitGroupId, transaction, transactionRef.id, userId);
                            }

                            // Budget spent is now calculated dynamically based on transactions
                            // No need to update budget spent manually

                            // Update account balance
                            this.store.dispatch(AccountsActions.updateAccountBalanceForTransaction({
                                userId: userId,
                                accountId: transaction.accountId,
                                transactionType: 'create',
                                newTransaction: transactionData as Transaction
                            }));

                            // Add to store immediately for online transactions
                            this.store.dispatch(TransactionsActions.createTransactionSuccess({
                                transaction: transactionData as Transaction
                            }));

                            // Update cache
                            this.updateTransactionCache(userId, 'create', transactionData as Transaction);

                            observer.next();
                            observer.complete();
                        } catch (error) {
                            console.error('Failed to create transaction online:', error);
                            // Fall back to offline mode
                            await this.addToSyncQueue('create', transactionData);
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
                    this.store.dispatch(AccountsActions.updateAccountBalanceForTransaction({
                        userId: userId,
                        accountId: updatedTransaction.accountId || oldTransaction.accountId,
                        transactionType: 'update',
                        oldTransaction: oldTransaction as Transaction,
                        newTransaction: newTransaction as Transaction
                    }));
                }
            }
            return of(undefined);
        }

        return new Observable<void>(observer => {
            const updateTransactionAsync = async () => {
                try {
                    const updateData = {
                        ...updatedTransaction,
                        updatedAt: new Date(),
                        updatedBy: userId,
                        syncStatus: this.commonSyncService.isCurrentlyOnline() ? SyncStatus.SYNCED : SyncStatus.PENDING
                    };

                    if (this.commonSyncService.isCurrentlyOnline()) {
                        try {
                            const transactionRef = doc(this.firestore, `users/${userId}/transactions/${transactionId}`);
                            await updateDoc(transactionRef, updateData);

                            // Update account balance if amount or account changed
                            if (updatedTransaction.amount || updatedTransaction.accountId) {
                                this.store.dispatch(AccountsActions.updateAccountBalanceForTransaction({
                                    userId: userId,
                                    accountId: updatedTransaction.accountId || '',
                                    transactionType: 'update',
                                    oldTransaction: { id: transactionId } as Transaction,
                                    newTransaction: updateData as Transaction
                                }));
                            }

                            // Update store immediately for online transactions
                            this.store.dispatch(TransactionsActions.updateTransactionSuccess({
                                transaction: { id: transactionId, ...updateData } as Transaction
                            }));

                            // Update cache
                            this.updateTransactionCache(userId, 'update', { id: transactionId, ...updateData } as Transaction);

                            observer.next();
                            observer.complete();
                        } catch (error) {
                            console.error('Failed to update transaction online:', error);
                            await this.addToSyncQueue('update', { id: transactionId, ...updateData });
                            // Update store immediately for offline transactions
                            this.store.dispatch(TransactionsActions.updateTransactionSuccess({
                                transaction: { id: transactionId, ...updateData } as Transaction
                            }));

                            // Update cache
                            this.updateTransactionCache(userId, 'update', { id: transactionId, ...updateData } as Transaction);
                            observer.next();
                            observer.complete();
                        }
                    } else {
                        await this.addToSyncQueue('update', { id: transactionId, ...updateData });
                        // Update store immediately for offline transactions
                        this.store.dispatch(TransactionsActions.updateTransactionSuccess({
                            transaction: { id: transactionId, ...updateData } as Transaction
                        }));

                        // Update cache
                        this.updateTransactionCache(userId, 'update', { id: transactionId, ...updateData } as Transaction);
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
            // Get transaction data for balance update first
            const transactionRef = doc(this.firestore, `users/${userId}/transactions/${transactionId}`);

            getDoc(transactionRef).then(transactionDoc => {
                const transactionToDelete = transactionDoc.exists() ? { id: transactionDoc.id, ...transactionDoc.data() } as Transaction : null;

                if (this.commonSyncService.isCurrentlyOnline()) {
                    // Delete from Firestore first
                    deleteDoc(transactionRef).then(() => {
                        // Update account balance to reverse the transaction effect
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

                        // Remove from store immediately
                        this.store.dispatch(TransactionsActions.deleteTransactionSuccess({ transactionId }));

                        // Update cache
                        this.updateTransactionCache(userId, 'delete', { id: transactionId } as Transaction);

                        observer.next();
                        observer.complete();
                    }).catch(error => {
                        console.error('Failed to delete transaction online:', error);
                        // Fall back to offline mode
                        this.addToSyncQueue('delete', { id: transactionId }).then(() => {
                            this.store.dispatch(TransactionsActions.deleteTransactionSuccess({ transactionId }));
                            this.updateTransactionCache(userId, 'delete', { id: transactionId } as Transaction);
                            observer.next();
                            observer.complete();
                        }).catch(syncError => {
                            console.error('Failed to add to sync queue:', syncError);
                            observer.error(syncError);
                        });
                    });
                } else {
                    // Offline mode - add to sync queue
                    this.addToSyncQueue('delete', { id: transactionId }).then(() => {
                        this.store.dispatch(TransactionsActions.deleteTransactionSuccess({ transactionId }));
                        this.updateTransactionCache(userId, 'delete', { id: transactionId } as Transaction);
                        observer.next();
                        observer.complete();
                    }).catch(error => {
                        console.error('Failed to add to sync queue:', error);
                        observer.error(error);
                    });
                }
            }).catch(error => {
                console.error('Failed to get transaction for deletion:', error);
                observer.error(error);
            });
        });
    }

    /**
     * Get all transactions for a user
     */
    getTransactions(userId: string): Observable<Transaction[]> {
        if (this.isGuest()) {
            const transactions = this.localStorageUtility.getEntities<Transaction>('transactions');
            this.transactionsSubject.next(transactions);
            return of(transactions);
        }

        const transactionsRef = query(
            collection(this.firestore, `users/${userId}/transactions`),
            orderBy('date', 'desc')
        );

        return new Observable<Transaction[]>(observer => {
            // Emit cached transactions immediately for fast initial load
            const initialCachedTransactions = this.getCachedTransactions(userId);
            if (initialCachedTransactions.length > 0) {
                this.transactionsSubject.next(initialCachedTransactions);
                observer.next(initialCachedTransactions);
            }

            const unsubscribe = onSnapshot(
                transactionsRef,
                (querySnapshot) => {
                    const transactions: Transaction[] = [];

                    querySnapshot.forEach(doc => {
                        const transaction = { id: doc.id, ...doc.data() } as Transaction;
                        transactions.push(transaction);
                    });

                    // If offline, also load any cached transactions
                    if (!this.commonSyncService.isCurrentlyOnline()) {
                        const cachedTransactions = this.getCachedTransactions(userId);

                        // Merge online and cached transactions, avoiding duplicates
                        const onlineTransactionIds = transactions.map(t => t.id);
                        const uniqueCachedTransactions = cachedTransactions.filter(t =>
                            t.id && !onlineTransactionIds.includes(t.id)
                        );

                        transactions.push(...uniqueCachedTransactions);
                    }

                    // Cache transactions for offline use
                    this.cacheTransactions(userId, transactions);

                    this.transactionsSubject.next(transactions);
                    observer.next(transactions);
                },
                (error) => {
                    console.error('Failed to fetch transactions:', error);

                    // If offline and error, try to load from cache
                    if (!this.commonSyncService.isCurrentlyOnline()) {
                        const cachedTransactions = this.getCachedTransactions(userId);
                        this.transactionsSubject.next(cachedTransactions);
                        observer.next(cachedTransactions);
                    } else {
                        observer.next([]);
                    }
                }
            );

            return () => unsubscribe();
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
     * Get recurring transactions for a user
     */
    getRecurringTransactions(userId: string): Observable<Transaction[]> {
        if (this.isGuest()) {
            const transactions = this.localStorageUtility.getEntities<Transaction>('transactions');
            const recurringTransactions = transactions.filter(t => t.isRecurring === true);
            return of(recurringTransactions);
        }

        const transactionsRef = query(
            collection(this.firestore, `users/${userId}/transactions`),
            orderBy('date', 'desc')
        );

        return new Observable<Transaction[]>(observer => {
            const unsubscribe = onSnapshot(
                transactionsRef,
                (querySnapshot) => {
                    const transactions: Transaction[] = [];

                    querySnapshot.forEach(doc => {
                        const transaction = { id: doc.id, ...doc.data() } as Transaction;
                        transactions.push(transaction);
                    });

                    // Filter only recurring transactions
                    const recurringTransactions = transactions.filter(t => t.isRecurring === true);

                    observer.next(recurringTransactions);
                },
                (error) => {
                    console.error('Failed to fetch recurring transactions:', error);
                    observer.next([]);
                }
            );

            return () => unsubscribe();
        });
    }

    /**
     * Get recurring transactions that are due (next occurrence is today or in the past)
     */
    getDueRecurringTransactions(userId: string): Observable<Transaction[]> {
        return this.getRecurringTransactions(userId).pipe(
            switchMap(recurringTransactions => {
                console.log(`Checking ${recurringTransactions.length} recurring transactions for due status`);

                // Get all transactions to check for existing ones in current period
                return this.getTransactions(userId).pipe(
                    map(allTransactions => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);

                        return recurringTransactions.filter(transaction => {
                            // Additional check to ensure transaction is still recurring
                            if (!transaction.isRecurring) {
                                console.log(`Transaction ${transaction.id} (${transaction.payee}) is no longer recurring, skipping`);
                                return false;
                            }

                            if (!transaction.nextOccurrence) {
                                console.log(`Transaction ${transaction.id} (${transaction.payee}) has no next occurrence, skipping`);
                                return false;
                            }

                            const nextOccurrence = transaction.nextOccurrence instanceof Date
                                ? transaction.nextOccurrence
                                : this.dateService.toDate(transaction.nextOccurrence);

                            if (!nextOccurrence) {
                                console.log(`Transaction ${transaction.id} (${transaction.payee}) has invalid next occurrence, skipping`);
                                return false;
                            }

                            // Create a new Date object to avoid modifying the original
                            const normalizedNextOccurrence = new Date(nextOccurrence);
                            normalizedNextOccurrence.setHours(0, 0, 0, 0);

                            const isDue = normalizedNextOccurrence <= today;

                            if (!isDue) {
                                console.log(`Transaction ${transaction.id} (${transaction.payee}) is not due yet, next occurrence: ${normalizedNextOccurrence}`);
                                return false;
                            }

                            // Check if a transaction for this period already exists
                            const hasExistingTransaction = this.checkExistingTransactionInPeriod(
                                allTransactions,
                                transaction,
                                today
                            );

                            if (hasExistingTransaction) {
                                console.log(`Transaction ${transaction.id} (${transaction.payee}) already has an entry for current period, skipping`);
                                return false;
                            }

                            // For monthly recurring transactions, check if next occurrence is in current month
                            if (transaction.recurringInterval === RecurringInterval.MONTHLY) {
                                const nextOccurrence = transaction.nextOccurrence instanceof Date
                                    ? transaction.nextOccurrence
                                    : this.dateService.toDate(transaction.nextOccurrence);

                                if (nextOccurrence) {
                                    const isNextOccurrenceInCurrentMonth = this.isInSamePeriod(nextOccurrence, this.dateService.toDate(transaction.date), RecurringInterval.MONTHLY);
                                    console.log(`Monthly transaction ${transaction.id} (${transaction.payee}) next occurrence check:`, {
                                        nextOccurrence: nextOccurrence,
                                        currentMonth: today,
                                        isNextOccurrenceInCurrentMonth: isNextOccurrenceInCurrentMonth
                                    });

                                    if (isNextOccurrenceInCurrentMonth) {
                                        return false;
                                    }
                                }
                            }

                            // Debug logging
                            console.log(`Transaction ${transaction.id} (${transaction.payee}):`, {
                                isRecurring: transaction.isRecurring,
                                nextOccurrence: normalizedNextOccurrence,
                                today: today,
                                isDue: isDue,
                                hasExistingTransaction: hasExistingTransaction
                            });

                            return true;
                        });
                    })
                );
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

                        console.log(`Processing recurring transaction ${transaction.id} (${transaction.payee}):`, {
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

            // Check if it's the same type of transaction (same payee, amount, category, account)
            const isSameTransaction =
                transaction.payee === recurringTransaction.payee &&
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

        console.log(`Found ${matchingTransactions.length} existing transactions for ${recurringTransaction.payee} in current period:`,
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
                            cachedTransactions[index] = transaction;
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
