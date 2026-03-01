import { Injectable } from '@angular/core';
import { Firestore, collection, doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, writeBatch, onSnapshot } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable } from 'rxjs';
import { Account, CreateAccountRequest, UpdateAccountRequest } from '../../models/account.model';
import { Transaction } from '../../models/transaction.model';
import { LocalIndexDBStorageService } from '../indexdb-storage.service';
import { LocalStorageKeyHelper } from '../../models/local-storage.model';
import { UserService } from './user.service';
import { of, map, from, catchError, tap, timeout } from 'rxjs';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import * as AccountsActions from 'src/app/store/accounts/accounts.actions';

@Injectable({
    providedIn: 'root'
})
export class AccountsService {
    constructor(
        private firestore: Firestore,
        private auth: Auth,
        private localStorageUtility: LocalIndexDBStorageService,
        protected userService: UserService,
        protected store: Store<AppState>
    ) { }

    /**
     * Get the accounts collection path
     */
    protected getAccountsPath(userId: string): string {
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
     * Get the family ID for cache key (overridden in FamilyAccountsService)
     */
    protected getFamilyId(): string | undefined {
        return undefined;
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

            // 4. Perform Firestore operation in background
            setDoc(accountRef, account).catch(error => {
                console.error(`Error creating account for ${userId}:`, error);
            });
        });
    }

    /**
     * Get all accounts for a user (Local-Only)
     */
    getAccounts(userId: string): Observable<Account[]> {
        if (this.isGuest()) {
            return of(this.localStorageUtility.getEntities<Account>('accounts'));
        }

        return new Observable<Account[]>(observer => {
            try {
                const cachedAccounts = this.localStorageUtility.getItem<Account[]>(LocalStorageKeyHelper.getAccountsCacheKey(userId));
                if (cachedAccounts) {
                    observer.next(cachedAccounts);
                } else {
                    observer.next([]);
                }
            } catch (error) {
                console.warn('[AccountsService] Failed to load cached accounts:', error);
                observer.next([]);
            }
            observer.complete();
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
                    accounts.push(docSnap.data() as Account);
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
            const accountRef = doc(this.firestore, this.getAccountPath(userId, accountId));
            getDoc(accountRef).then(accountSnap => {
                if (accountSnap.exists()) {
                    observer.next(accountSnap.data() as Account);
                } else {
                    observer.next(undefined);
                }
                observer.complete();
            }).catch(error => {
                observer.error(error);
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

            // 4. Perform Firestore operation in background
            updateDoc(accountRef, updateData).catch(error => {
                console.error(`Error updating account for ${userId}:`, error);
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

            // 4. Perform Firestore operation in background
            deleteDoc(accountRef).catch(error => {
                console.error(`Error deleting account for ${userId}:`, error);
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

            // 3. Background DB Update
            const updateBalanceAsync = async () => {
                try {
                    const accountRef = doc(this.firestore, this.getAccountPath(userId, accountId));
                    const accountSnap = await getDoc(accountRef);

                    if (!accountSnap.exists()) {
                        return;
                    }

                    const account = accountSnap.data() as Account;
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

                    const newBalance = (Number(account.balance) || 0) + balanceChange;
                    const updateData: any = {
                        balance: newBalance,
                        updatedAt: new Date() as any
                    };

                    if (account.type === 'loan' && account.loanDetails) {
                        updateData['loanDetails.remainingBalance'] = (Number(account.loanDetails.remainingBalance) || 0) + loanRemainingBalanceChange;
                    }


                    await updateDoc(accountRef, updateData);
                } catch (error) {
                    console.error('Error updating account balance:', error);
                }
            };
            updateBalanceAsync();
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
            const updateBalancesAsync = async () => {
                try {
                    const batch = writeBatch(this.firestore);
                    const accountBalanceChanges = new Map<string, number>();
                    const accountLoanChanges = new Map<string, number>();

                    // Calculate balance changes for each account
                transactions.forEach((transaction: any) => {
                    // ONLY COMPLETED transactions should affect the current balance.
                    if (transaction.isPending || transaction.status === 'pending') return;

                    const currentChange = accountBalanceChanges.get(transaction.accountId) || 0;
                        const amount = Number(transaction.amount) || 0;
                        const transactionChange = transaction.type === 'income' ? amount : -amount;
                        accountBalanceChanges.set(transaction.accountId, currentChange + transactionChange);

                        // Track loan changes for expense transactions
                        if (transaction.type === 'expense') {
                            const currentLoanChange = accountLoanChanges.get(transaction.accountId) || 0;
                            accountLoanChanges.set(transaction.accountId, currentLoanChange + amount);
                        }
                    });

                    // Update each account's balance
                    for (const [accountId, balanceChange] of accountBalanceChanges) {
                        const accountRef = doc(this.firestore, this.getAccountPath(userId, accountId));
                        const accountSnap = await getDoc(accountRef);

                        if (accountSnap.exists()) {
                            const account = accountSnap.data() as Account;
                            const newBalance = (Number(account.balance) || 0) + balanceChange;
                            const updateData: any = {
                                balance: newBalance,
                                updatedAt: new Date() as any
                            };

                            const loanChange = accountLoanChanges.get(accountId) || 0;
                            if (account.type === 'loan' && account.loanDetails && loanChange !== 0) {
                                updateData['loanDetails.remainingBalance'] = (Number(account.loanDetails.remainingBalance) || 0) - loanChange;
                            }


                            batch.update(accountRef, updateData);
                        }
                    }

                    await batch.commit();
                } catch (error) {
                    console.error('Error batch updating account balances:', error);
                }
            };

            updateBalancesAsync();
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
        }
        
        if (this.isGuest()) {
            return of(undefined);
        }

        return new Observable<void>(observer => {
            observer.next();
            observer.complete();
            const updateBalancesAsync = async () => {
                try {
                    const batch = writeBatch(this.firestore);

                    // Get both accounts
                    const oldAccountRef = doc(this.firestore, this.getAccountPath(userId, oldAccountId));
                    const newAccountRef = doc(this.firestore, this.getAccountPath(userId, newAccountId));

                    const [oldAccountSnap, newAccountSnap] = await Promise.all([
                        getDoc(oldAccountRef),
                        getDoc(newAccountRef)
                    ]);

                    if (!oldAccountSnap.exists() || !newAccountSnap.exists()) {
                        return;
                    }

                    const oldAccount = oldAccountSnap.data() as Account;
                    const newAccount = newAccountSnap.data() as Account;

                    // Calculate the transaction effect
                    const amount = Number(transaction.amount) || 0;
                    const transactionEffect = transaction.type === 'income' ? amount : -amount;

                    // Prepare update data for old account
                    const oldAccountUpdateData: any = {
                        balance: (Number(oldAccount.balance) || 0) - transactionEffect,
                        updatedAt: new Date() as any
                    };

                    // Prepare update data for new account
                    const newAccountUpdateData: any = {
                        balance: (Number(newAccount.balance) || 0) + transactionEffect,
                        updatedAt: new Date() as any
                    };

                    if (transaction.type === 'expense') {
                        if (oldAccount.type === 'loan' && oldAccount.loanDetails) {
                            oldAccountUpdateData['loanDetails.remainingBalance'] = (Number(oldAccount.loanDetails.remainingBalance) || 0) + amount;
                        }
                        if (newAccount.type === 'loan' && newAccount.loanDetails) {
                            newAccountUpdateData['loanDetails.remainingBalance'] = (Number(newAccount.loanDetails.remainingBalance) || 0) - amount;
                        }
                    }

                    // Update both accounts
                    batch.update(oldAccountRef, oldAccountUpdateData);
                    batch.update(newAccountRef, newAccountUpdateData);

                    await batch.commit();
                } catch (error) {
                    console.error('Error translating transfer updates online:', error);
                }
            };

            updateBalancesAsync();
        });
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
            const cachedAccounts = this.localStorageUtility.getItem<Account[]>(cacheKey) || [];

            switch (operation) {
                case 'create':
                    if (account) {
                        cachedAccounts.push(account);
                    }
                    break;
                case 'update':
                    if (account) {
                        const index = cachedAccounts.findIndex(a => a.accountId === account.accountId);
                        if (index !== -1) {
                            cachedAccounts[index] = { ...cachedAccounts[index], ...account };
                        }
                    }
                    break;
                case 'delete':
                    if (account) {
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
