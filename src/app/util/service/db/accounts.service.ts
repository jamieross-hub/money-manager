import { Injectable } from '@angular/core';
import { Firestore, collection, doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, writeBatch, onSnapshot, query, orderBy } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable } from 'rxjs';
import { Account, CreateAccountRequest, UpdateAccountRequest } from '../../models/account.model';
import { Transaction } from '../../models/transaction.model';
import { LocalIndexDBStorageService } from '../indexdb-storage.service';
import { LocalStorageKeyHelper } from '../../models/local-storage.model';
import { UserService } from './user.service';
import { of, map, from, catchError, tap, timeout, BehaviorSubject } from 'rxjs';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import * as AccountsActions from 'src/app/store/accounts/accounts.actions';
import * as ProfileSelectors from 'src/app/store/profile/profile.selectors';
import { CommonSyncService, SyncItem } from '../common-sync.service';
import { FamilyService } from 'src/app/modules/family/services/family.service';
import { toObservable } from '@angular/core/rxjs-interop';
import { switchMap, distinctUntilChanged } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class AccountsService {
    private accountsSubject = new BehaviorSubject<Account[]>([]);
    
    constructor(
        private firestore: Firestore,
        private auth: Auth,
        private localStorageUtility: LocalIndexDBStorageService,
        protected userService: UserService,
        protected store: Store<AppState>,
        private commonSyncService: CommonSyncService,
        private familyService: FamilyService
    ) { }

    /**
     * Get the accounts collection path
     */
    protected getAccountsPath(userId: string): string {
        const familyId = this.getFamilyId();
        if (familyId) {
            return `family-groups/${familyId}/accounts`;
        }
        return `users/${userId}/accounts`;
    }

    /**
     * Get a specific account document path
     */
    protected getAccountPath(userId: string, accountId: string): string {
        return `${this.getAccountsPath(userId)}/${accountId}`;
    }

    private isGuest(): boolean {
        return this.userService.getCurrentUserId() === 'offline-guest';
    }

    /**
     * Get the cache key for accounts
     */
    protected getAccountsCacheKey(userId: string): string {
        return LocalStorageKeyHelper.getAccountsCacheKey(userId, this.getFamilyId());
    }

    /**
     * Get the family ID for cache key
     */
    protected getFamilyId(): string | undefined {
        const profile = this.store.selectSignal(ProfileSelectors.selectProfile)();
        const isFamilyMode = profile?.preferences?.isFamilyMode || false;
        return isFamilyMode ? (this.familyService.activeFamilyId() || undefined) : undefined;
    }

    // 🔹 Create a new account for the logged-in user
    createAccount(userId: string, accountData: CreateAccountRequest): Observable<string> {
        const accountId = this.generateAccountId();
        const account: Account = {
            accountId,
            userId,
            ...accountData,
            balance: Number(accountData.balance) || 0,
            createdAt: new Date() as any, // Firebase Timestamp
            isActive: true
        };

        if (this.isGuest()) {
            this.localStorageUtility.saveEntity('accounts', account, 'accountId');
            this.store.dispatch(AccountsActions.createAccountSuccess({ account }));
            return of(accountId);
        }

        return new Observable<string>(observer => {
            const accountRef = doc(this.firestore, this.getAccountPath(userId, accountId));
            
            // 1. Dispatch store updates immediately (Optimistic)
            this.store.dispatch(AccountsActions.createAccountSuccess({ account }));
            
            // 2. Update cache immediately
            this.updateAccountCache(userId, 'create', account);

            // 3. Complete observer immediately
            observer.next(accountId);
            observer.complete();

            // 4. Always add to sync queue (it handles online/offline internally)
            this.addToSyncQueue('create', account, userId).catch(error => {
                console.error('Failed to add account to sync queue:', error);
            });
        });
    }

    /**
     * Get all accounts for a user with real-time sync.
     * Reacts automatically to changes in the user's family mode preference.
     */
    getAccounts(userId: string): Observable<Account[]> {
        if (this.isGuest()) {
            const accounts = this.localStorageUtility.getEntities<Account>('accounts');
            this.accountsSubject.next(accounts);
            return of(accounts);
        }

        /**
         * ⚠️ ARCHITECTURE ALIGNMENT: Source of Truth = IndexedDB
         * 
         * Components should not have a direct connection to Firebase. 
         * Instead, they subscribe to this.accountsSubject which is kept updated by 
         * the central background sync listener (CommonSyncService -> listenToAccounts).
         */
        return this.localStorageUtility.isReady$.pipe(
            switchMap(() => {
                // 1. Emit cached accounts immediately from the current context (family vs personal)
                const cacheKey = this.getAccountsCacheKey(userId);
                const cachedAccounts = (this.localStorageUtility.getItem<Account[]>(cacheKey) || [])
                    .filter(a => !!(a && a.accountId));
                
                if (cachedAccounts.length > 0) {
                    this.accountsSubject.next(cachedAccounts);
                }

                // 2. Return reactive subject. Updates will be pushed here by 
                // listenToAccounts() when the background sync detects changes.
                return this.accountsSubject.asObservable();
            })
        );
    }

    /**
     * Set up a real-time listener for accounts
     * Typically managed by CommonSyncService
     */
    listenToAccounts(userId: string): Observable<void> {
        if (this.isGuest()) return of(undefined);

        return new Observable<void>(observer => {
            const currentPath = this.getAccountsPath(userId);
            const cacheKey = this.getAccountsCacheKey(userId);
            
            console.log(`[AccountsService] 🔌 Starting real-time listener for path: ${currentPath}`);

            const accountsRef = query(
                collection(this.firestore, currentPath),
                orderBy('name', 'asc')
            );

            const unsubscribe = onSnapshot(accountsRef,
                (querySnapshot) => {
                    const firestoreAccounts: Account[] = [];
                    querySnapshot.forEach((docSnap) => {
                        const data = docSnap.data();
                        if (data && (data['name'] !== undefined || docSnap.id)) {
                            firestoreAccounts.push({ accountId: docSnap.id, ...data } as Account);
                        }
                    });
                    
                    // Update cache
                    this.localStorageUtility.setItem(cacheKey, firestoreAccounts);
                    
                    // Update subject and Store
                    this.accountsSubject.next(firestoreAccounts);
                    this.store.dispatch(AccountsActions.loadAccountsSuccess({ accounts: firestoreAccounts }));
                    
                    observer.next();
                },
                (error) => {
                    console.error(`[AccountsService] ❌ Real-time listener failed for ${currentPath}:`, error);
                    observer.error(error);
                }
            );

            return () => {
                console.log(`[AccountsService] 🔌 Stopping listener for: ${currentPath}`);
                unsubscribe();
            };
        });
    }

    /**
     * Pull accounts from Firestore and update local cache
     */
    pullFromFirestore(userId: string): Observable<void> {
        if (this.isGuest()) return of(undefined);

        // Ensure we have an active auth user before attempting pull
        const currentUser = this.auth.currentUser;
        if (!currentUser || currentUser.uid !== userId) {
            console.warn(`[AccountsService] Pull skipped: Auth user mismatch or not logged in (UID: ${currentUser?.uid}, expected: ${userId})`);
            return of(undefined);
        }

        const accountsRef = collection(this.firestore, this.getAccountsPath(userId));

        console.log(`[AccountsService] Pulling accounts for user: ${userId}`);

        return from(getDocs(accountsRef)).pipe(
            timeout(15000),
            tap((querySnapshot: any) => {
                const accounts: Account[] = [];
                querySnapshot.forEach((docSnap: any) => {
                    const data = docSnap.data();
                    if (data && data.accountId && data.name) {
                        accounts.push(data as Account);
                    } else {
                        console.warn('[AccountsService] Skipping invalid/empty account document:', docSnap.id);
                    }
                });

                console.log(`[AccountsService] Pulled ${accounts.length} accounts from Firestore`);

                // Update cache
                this.localStorageUtility.setItem(this.getAccountsCacheKey(userId), accounts);
                
                // Update NgRx state
                this.store.dispatch(AccountsActions.loadAccountsSuccess({ accounts }));
            }),
            map(() => undefined),
            catchError(error => {
                if (error.code === 'permission-denied') {
                    console.error(`[AccountsService] Permission Denied for user ${userId}. Check Firestore rules.`);
                } else {
                    console.error('[AccountsService] Pull failed:', error);
                }
                return of(undefined);
            })
        );
    }

    // 🔹 Get a single account by its ID
    getAccount(userId: string, accountId: string): Observable<Account | undefined> {
        if (this.isGuest()) {
            const accounts = this.localStorageUtility.getEntities<Account>('accounts');
            return of(accounts.find(a => (a as any).accountId === accountId));
        }

        return new Observable<Account | undefined>(observer => {
            // Reads from IndexedDB first
            const cacheKey = this.getAccountsCacheKey(userId);
            const cachedAccounts = this.localStorageUtility.getItem<Account[]>(cacheKey) || [];
            const cached = cachedAccounts.find(a => a.accountId === accountId);

            if (cached) {
                observer.next(cached);
                observer.complete();
                return;
            }

            // Fallback: If not found in cache, pull once from Firestore
            const accountRef = doc(this.firestore, this.getAccountPath(userId, accountId));
            getDoc(accountRef).then(accountSnap => {
                if (accountSnap.exists()) {
                    const data = accountSnap.data() as any;
                    const account: Account = {
                        accountId: accountSnap.id || data.accountId,
                        userId: data.userId,
                        name: data.name || '',
                        type: data.type,
                        balance: Number(data.balance) || 0,
                        createdAt: data.createdAt,
                        updatedAt: data.updatedAt || null,
                        description: data.description || '',
                        accountNumber: data.accountNumber || '',
                        institution: data.institution || '',
                        currency: data.currency || 'USD',
                        isActive: data.isActive !== undefined ? data.isActive : true,
                        lastSyncAt: data.lastSyncAt || null,
                        syncStatus: data.syncStatus,
                        icon: data.icon || '',
                        color: data.color || '',
                        loanDetails: data.loanDetails || null,
                        creditCardDetails: data.creditCardDetails || null
                    };
                    // Update cache
                    this.updateAccountCache(userId, 'update', account);
                    observer.next(account);
                } else {
                    observer.next(undefined);
                }
                observer.complete();
            }).catch(error => {
                // Fail gracefully
                observer.next(undefined);
                observer.complete();
            });
        });
    }

    // 🔹 Update an existing account's details
    updateAccount(userId: string, accountId: string, accountData: UpdateAccountRequest): Observable<void> {
        const sanitizedData = { ...accountData };
        if (sanitizedData.balance !== undefined) {
            sanitizedData.balance = Number(sanitizedData.balance) || 0;
        }

        if (this.isGuest()) {
            const accounts = this.localStorageUtility.getEntities<Account>('accounts');
            const index = accounts.findIndex(a => (a as any).accountId === accountId);
            if (index !== -1) {
                const updatedAccount = { ...accounts[index], ...sanitizedData, updatedAt: new Date() as any };
                accounts[index] = updatedAccount;
                this.localStorageUtility.saveEntities('accounts', accounts);
                this.store.dispatch(AccountsActions.updateAccountSuccess({ account: updatedAccount }));
            }
            return of(undefined);
        }

        return new Observable<void>(observer => {
            const accountRef = doc(this.firestore, this.getAccountPath(userId, accountId));
            const updateData = {
                ...sanitizedData,
                updatedAt: new Date() as any // Firebase Timestamp
            };

            // 1. Dispatch store updates immediately (Optimistic)
            this.store.dispatch(AccountsActions.updateAccountSuccess({ account: { accountId, ...sanitizedData } as any }));
            
            // 2. Update cache immediately
            this.updateAccountCache(userId, 'update', { accountId, ...sanitizedData } as any);

            // 3. Complete observer immediately
            observer.next();
            observer.complete();

            // 4. Always add to sync queue (it handles online/offline internally)
            this.addToSyncQueue('update', { accountId, ...updateData }, userId).catch(error => {
                console.error('Failed to add account update to sync queue:', error);
            });
        });
    }

    // 🔹 Delete an account
    deleteAccount(userId: string, accountId: string): Observable<void> {
        if (this.isGuest()) {
            this.localStorageUtility.deleteEntity('accounts', accountId, 'accountId');
            this.store.dispatch(AccountsActions.deleteAccountSuccess({ accountId }));
            return of(undefined);
        }

        return new Observable<void>(observer => {
            const accountRef = doc(this.firestore, this.getAccountPath(userId, accountId));

            // 1. Dispatch store updates immediately (Optimistic)
            this.store.dispatch(AccountsActions.deleteAccountSuccess({ accountId }));

            // 2. Update cache immediately
            this.updateAccountCache(userId, 'delete', { accountId } as any);

            // 3. Complete observer immediately
            observer.next();
            observer.complete();

            // 4. Always add to sync queue (it handles online/offline internally)
            this.addToSyncQueue('delete', { accountId }, userId).catch(error => {
                console.error('Failed to add account deletion to sync queue:', error);
            });
        });
    }

    // 🔹 Update account balance based on transaction changes
    updateAccountBalanceForTransaction(
        userId: string,
        accountId: string,
        transactionType: 'create' | 'update' | 'delete',
        oldTransaction?: Transaction,
        newTransaction?: Transaction
    ): Observable<number> {
        let optimisticBalance = 0;
        let updateDataToSync: any = null;
        
        // 1. Optimistic Update
        const isGuest = userId === 'offline-guest';
        let accounts: Account[] = [];
        const cacheKey = LocalStorageKeyHelper.getAccountsCacheKey(userId);

        if (isGuest) {
            accounts = this.localStorageUtility.getEntities<Account>('accounts');
        } else {
            accounts = this.localStorageUtility.getItem<Account[]>(cacheKey) || [];
        }

        const index = accounts.findIndex(a => (a as any).accountId === accountId);
        
        if (index !== -1) {
            const account = accounts[index];
            let balanceChange = 0;
            let loanRemainingBalanceChange = 0;

            const getEffect = (t: Transaction) => {
            // ONLY COMPLETED transactions should affect the current balance.
            if ((t as any).isPending || t.status === 'pending') return 0;
            const amount = Number(t.amount) || 0;
            return t.type === 'income' ? amount : -amount;
        };
        const getLoanEffect = (t: Transaction) => {
            // ONLY COMPLETED transactions should affect the remaining balance.
            if ((t as any).isPending || t.status === 'pending') return 0;
            const amount = Number(t.amount) || 0;
            return t.type === 'expense' ? -amount : 0;
        };

            if (transactionType === 'create' && newTransaction) {
                balanceChange = getEffect(newTransaction);
                if (account.type === 'loan') loanRemainingBalanceChange = getLoanEffect(newTransaction);
            } else if (transactionType === 'update' && oldTransaction && newTransaction) {
                balanceChange = getEffect(newTransaction) - getEffect(oldTransaction);
                if (account.type === 'loan') loanRemainingBalanceChange = getLoanEffect(newTransaction) - getLoanEffect(oldTransaction);
            } else if (transactionType === 'delete' && oldTransaction) {
                balanceChange = -getEffect(oldTransaction);
                if (account.type === 'loan') loanRemainingBalanceChange = -getLoanEffect(oldTransaction);
            }

            account.balance = (Number(account.balance) || 0) + balanceChange;
            if (account.type === 'loan' && account.loanDetails) {
                account.loanDetails.remainingBalance = (Number(account.loanDetails.remainingBalance) || 0) + loanRemainingBalanceChange;
            }
            account.updatedAt = new Date() as any;
            optimisticBalance = account.balance;

            updateDataToSync = {
                balance: account.balance,
                updatedAt: account.updatedAt
            };
            if (account.type === 'loan' && account.loanDetails) {
                updateDataToSync.loanDetails = account.loanDetails;
            }
            
            if (isGuest) {
                this.localStorageUtility.saveEntities('accounts', accounts);
            } else {
                this.localStorageUtility.setItem(cacheKey, accounts);
            }
            this.store.dispatch(AccountsActions.updateAccountSuccess({ account: { ...account } as any }));
        }

        if (this.isGuest()) {
            return of(optimisticBalance);
        }

        return new Observable<number>(observer => {
            // 2. Complete observer immediately
            observer.next(optimisticBalance);
            observer.complete();

            if (updateDataToSync) {
                this.addToSyncQueue('update', { accountId, ...updateDataToSync }, userId).catch(error => {
                    console.error('Error syncing account balance:', error);
                });
            }
        });
    }

    // 🔹 Update account balance for multiple transactions (batch update)
    updateAccountBalanceForTransactions(
        userId: string,
        transactions: { accountId: string; type: 'income' | 'expense'; amount: number }[]
    ): Observable<void> {
        // 1. Optimistic Update
        const isGuest = userId === 'offline-guest';
        let accounts: Account[] = [];
        const cacheKey = LocalStorageKeyHelper.getAccountsCacheKey(userId);
        const updatedAccountsMap = new Map<string, any>();

        if (isGuest) {
            accounts = this.localStorageUtility.getEntities<Account>('accounts');
        } else {
            accounts = this.localStorageUtility.getItem<Account[]>(cacheKey) || [];
        }
        
        transactions.forEach((t: any) => {
        const index = accounts.findIndex(a => (a as any).accountId === t.accountId);
        if (index !== -1) {
            // ONLY COMPLETED transactions should affect the current balance.
            if (!t.isPending && t.status !== 'pending') {
                const account = accounts[index];
                const amount = Number(t.amount) || 0;
                const balanceChange = t.type === 'income' ? amount : -amount;
                account.balance = (Number(account.balance) || 0) + balanceChange;
                if (account.type === 'loan' && account.loanDetails && t.type === 'expense') {
                    account.loanDetails.remainingBalance = (Number(account.loanDetails.remainingBalance) || 0) - amount;
                }
                account.updatedAt = new Date() as any;
                this.store.dispatch(AccountsActions.updateAccountSuccess({ account: { ...account } as any }));
                
                updatedAccountsMap.set(account.accountId, {
                    balance: account.balance,
                    updatedAt: account.updatedAt,
                    loanDetails: account.type === 'loan' ? account.loanDetails : undefined
                });
            }
        }
    });

        if (isGuest) {
            this.localStorageUtility.saveEntities('accounts', accounts);
        } else {
            this.localStorageUtility.setItem(cacheKey, accounts);
        }
        
        if (this.isGuest()) {
            return of(undefined);
        }

        return new Observable<void>(observer => {
            observer.next();
            observer.complete();

            // Register sync items for each updated account
            for (const [accountId, updateData] of updatedAccountsMap.entries()) {
                this.addToSyncQueue('update', { accountId, ...updateData }, userId).catch(error => {
                    console.error(`Error syncing account balance for ${accountId}:`, error);
                });
            }
        });
    }

    // 🔹 Update account balance when transaction account is changed
    updateAccountBalanceForAccountTransfer(
        userId: string,
        oldAccountId: string,
        newAccountId: string,
        transaction: Transaction
    ): Observable<void> {
        // 1. Optimistic Update
        const isGuest = userId === 'offline-guest';
        let accounts: Account[] = [];
        const cacheKey = LocalStorageKeyHelper.getAccountsCacheKey(userId);
        const updatesToSync: any[] = [];

        if (isGuest) {
            accounts = this.localStorageUtility.getEntities<Account>('accounts');
        } else {
            accounts = this.localStorageUtility.getItem<Account[]>(cacheKey) || [];
        }

        const oldIndex = accounts.findIndex(a => (a as any).accountId === oldAccountId);
        const newIndex = accounts.findIndex(a => (a as any).accountId === newAccountId);

        if (oldIndex !== -1 && newIndex !== -1) {
            const oldAccount = accounts[oldIndex];
            const newAccount = accounts[newIndex];
            const amount = Number(transaction.amount) || 0;
            const transactionEffect = transaction.type === 'income' ? amount : -amount;

            oldAccount.balance = (Number(oldAccount.balance) || 0) - transactionEffect;
            newAccount.balance = (Number(newAccount.balance) || 0) + transactionEffect;

            if (transaction.type === 'expense') {
                if (oldAccount.type === 'loan' && oldAccount.loanDetails) {
                    oldAccount.loanDetails.remainingBalance = (Number(oldAccount.loanDetails.remainingBalance) || 0) + amount;
                }
                if (newAccount.type === 'loan' && newAccount.loanDetails) {
                    newAccount.loanDetails.remainingBalance = (Number(newAccount.loanDetails.remainingBalance) || 0) - amount;
                }
            }

            oldAccount.updatedAt = new Date() as any;
            newAccount.updatedAt = new Date() as any;
            
            if (isGuest) {
                this.localStorageUtility.saveEntities('accounts', accounts);
            } else {
                this.localStorageUtility.setItem(cacheKey, accounts);
            }
            this.store.dispatch(AccountsActions.updateAccountSuccess({ account: { ...oldAccount } as any }));
            this.store.dispatch(AccountsActions.updateAccountSuccess({ account: { ...newAccount } as any }));

            updatesToSync.push({ 
                accountId: oldAccountId, 
                balance: oldAccount.balance, 
                updatedAt: oldAccount.updatedAt,
                loanDetails: oldAccount.type === 'loan' ? oldAccount.loanDetails : undefined
            });
            updatesToSync.push({ 
                accountId: newAccountId, 
                balance: newAccount.balance, 
                updatedAt: newAccount.updatedAt,
                loanDetails: newAccount.type === 'loan' ? newAccount.loanDetails : undefined
            });
        }
        
        if (this.isGuest()) {
            return of(undefined);
        }

        return new Observable<void>(observer => {
            observer.next();
            observer.complete();

            updatesToSync.forEach(update => {
                this.addToSyncQueue('update', update, userId).catch(error => {
                    console.error(`Error syncing transfer update for ${update.accountId}:`, error);
                });
            });
        });
    }



    /**
     * Add account to sync queue
     */
    private async addToSyncQueue(operation: 'create' | 'update' | 'delete', data: any, userId: string): Promise<void> {
        const syncItem: Omit<SyncItem, 'timestamp' | 'retryCount'> = {
            id: data.accountId || this.generateAccountId(),
            type: 'account',
            operation: operation,
            data: data,
            maxRetries: 3,
            collectionPath: this.getAccountsPath(userId)
        };

        const result = await this.commonSyncService.registerSyncItem(syncItem);
        if (!result.success) {
            console.error('Failed to register account for sync:', result.errors);
        }
    }

    // 🔹 Generate a unique account ID
    private generateAccountId(): string {
        return 'acc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Update account cache when accounts are created, updated, or deleted
     */
    protected updateAccountCache(userId: string, operation: 'create' | 'update' | 'delete', account?: Account): void {
        try {
            const cacheKey = this.getAccountsCacheKey(userId);
            const cachedAccounts = (this.localStorageUtility.getItem<Account[]>(cacheKey) || [])
                .filter(a => !!(a && a.accountId));

            if (!account || !account.accountId) {
                if (operation !== 'delete') return;
            }

            switch (operation) {
                case 'create':
                    if (account && account.accountId) {
                        cachedAccounts.push(account);
                    }
                    break;
                case 'update':
                    if (account && account.accountId) {
                        const index = cachedAccounts.findIndex(a => a.accountId === account.accountId);
                        if (index !== -1) {
                            cachedAccounts[index] = { ...cachedAccounts[index], ...account };
                        } else {
                            cachedAccounts.push(account);
                        }
                    }
                    break;
                case 'delete':
                    if (account && account.accountId) {
                        const index = cachedAccounts.findIndex(a => a.accountId === account.accountId);
                        if (index !== -1) {
                            cachedAccounts.splice(index, 1);
                        }
                    }
                    break;
            }

            this.localStorageUtility.setItem(cacheKey, cachedAccounts);
        } catch (error) {
            console.error('Error updating account cache:', error);
        }
    }
}
