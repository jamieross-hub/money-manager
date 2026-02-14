import { Injectable } from '@angular/core';
import { Firestore, collection, doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, writeBatch, onSnapshot } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable } from 'rxjs';
import { Account, CreateAccountRequest, UpdateAccountRequest } from '../../models/account.model';
import { Transaction } from '../../models/transaction.model';
import { LocalIndexDBStorageService } from '../indexdb-storage.service';
import { LocalStorageKeyHelper } from '../../models/local-storage.model';
import { UserService } from './user.service';
import { of, map } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class AccountsService {
    constructor(
        private firestore: Firestore,
        private auth: Auth,
        private localStorageUtility: LocalIndexDBStorageService,
        private userService: UserService
    ) { }

    private isGuest(): boolean {
        return this.userService.getCurrentUserId() === 'offline-guest';
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
            return of(accountId);
        }

        return new Observable<string>(observer => {
            const accountRef = doc(this.firestore, `users/${userId}/accounts/${accountId}`);
            setDoc(accountRef, account).then(() => {
                observer.next(accountId);
                observer.complete();
            }).catch(error => {
                console.error(`Error creating account for ${userId}:`, error);
                observer.error(error);
            });
        });
    }

    // 🔹 Get all accounts for the logged-in user
    getAccounts(userId: string): Observable<Account[]> {
        if (this.isGuest()) {
            return of(this.localStorageUtility.getEntities<Account>('accounts'));
        }

        const accountsRef = collection(this.firestore, `users/${userId}/accounts`);

        return new Observable<Account[]>(observer => {
            // 1. Emit cached data immediately if available
            try {
                const cachedAccounts = this.localStorageUtility.getItem<Account[]>(LocalStorageKeyHelper.getAccountsCacheKey(userId));
                if (cachedAccounts && cachedAccounts.length > 0) {
                    console.log(`[AccountsService] Emitting ${cachedAccounts.length} cached accounts`);
                    observer.next(cachedAccounts);
                }
            } catch (error) {
                console.warn('[AccountsService] Failed to load cached accounts:', error);
            }

            // 2. Subscribe to realtime updates
            const unsubscribe = onSnapshot(accountsRef,
                (querySnapshot) => {
                    const accounts: Account[] = [];
                    querySnapshot.forEach(docSnap => {
                        accounts.push(docSnap.data() as Account);
                    });

                    console.log(`[AccountsService] Received ${accounts.length} accounts from Firestore`);

                    // Update cache for next time
                    try {
                        this.localStorageUtility.setItem(LocalStorageKeyHelper.getAccountsCacheKey(userId), accounts);
                    } catch (error) {
                        console.warn('[AccountsService] Failed to cache accounts:', error);
                    }

                    observer.next(accounts);
                },
                (error) => {
                    console.error(`[AccountsService] Error in onSnapshot for ${userId}:`, error);
                    // If we haven't emitted anything yet (e.g. no cache), we might want to error or emit empty
                    // For now, let the initial cache emission (if any) stand, or error if no cache was found.
                    if (!observer.closed) {
                        // If we are offline and have cache, we don't necessarily want to error out the whole stream
                        if (error.code === 'unavailable' || !navigator.onLine) {
                            console.warn('[AccountsService] Firestore unavailable, relying on cache');
                        } else {
                            observer.error(error);
                        }
                    }
                }
            );

            return () => unsubscribe();
        });
    }

    // 🔹 Get a single account by its ID
    getAccount(userId: string, accountId: string): Observable<Account | undefined> {
        if (this.isGuest()) {
            const accounts = this.localStorageUtility.getEntities<Account>('accounts');
            return of(accounts.find(a => (a as any).accountId === accountId));
        }

        return new Observable<Account | undefined>(observer => {
            const accountRef = doc(this.firestore, `users/${userId}/accounts/${accountId}`);
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
                accounts[index] = { ...accounts[index], ...sanitizedData, updatedAt: new Date() as any };
                this.localStorageUtility.saveEntities('accounts', accounts);
            }
            return of(undefined);
        }

        return new Observable<void>(observer => {
            const accountRef = doc(this.firestore, `users/${userId}/accounts/${accountId}`);
            const updateData = {
                ...sanitizedData,
                updatedAt: new Date() as any // Firebase Timestamp
            };
            updateDoc(accountRef, updateData).then(() => {
                observer.next();
                observer.complete();
            }).catch(error => {
                observer.error(error);
            });
        });
    }

    // 🔹 Delete an account
    deleteAccount(userId: string, accountId: string): Observable<void> {
        if (this.isGuest()) {
            this.localStorageUtility.deleteEntity('accounts', accountId, 'accountId');
            return of(undefined);
        }

        return new Observable<void>(observer => {
            const accountRef = doc(this.firestore, `users/${userId}/accounts/${accountId}`);
            deleteDoc(accountRef).then(() => {
                observer.next();
                observer.complete();
            }).catch(error => {
                observer.error(error);
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
        if (this.isGuest()) {
            const accounts = this.localStorageUtility.getEntities<Account>('accounts');
            const index = accounts.findIndex(a => (a as any).accountId === accountId);
            if (index === -1) return of(0);

            const account = accounts[index];
            let balanceChange = 0;
            let loanRemainingBalanceChange = 0;

            // Simplified balance calculation logic for local use
            const getEffect = (t: Transaction) => {
                const amount = Number(t.amount) || 0;
                return t.type === 'income' ? amount : -amount;
            };
            const getLoanEffect = (t: Transaction) => {
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
                account.loanDetails.remainingBalance = Math.max(0, (Number(account.loanDetails.remainingBalance) || 0) + loanRemainingBalanceChange);
            }
            account.updatedAt = new Date() as any;
            this.localStorageUtility.saveEntities('accounts', accounts);
            return of(account.balance);
        }

        return new Observable<number>(observer => {
            const updateBalanceAsync = async () => {
                try {
                    const accountRef = doc(this.firestore, `users/${userId}/accounts/${accountId}`);
                    const accountSnap = await getDoc(accountRef);

                    if (!accountSnap.exists()) {
                        observer.error('Account not found');
                        return;
                    }

                    const account = accountSnap.data() as Account;
                    let balanceChange = 0;
                    let loanRemainingBalanceChange = 0;

                    const getEffect = (t: Transaction) => {
                        const amount = Number(t.amount) || 0;
                        return t.type === 'income' ? amount : -amount;
                    };
                    const getLoanEffect = (t: Transaction) => {
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
                        const newRemainingBalance = Math.max(0, (Number(account.loanDetails.remainingBalance) || 0) + loanRemainingBalanceChange);
                        updateData['loanDetails.remainingBalance'] = newRemainingBalance;
                    }

                    await updateDoc(accountRef, updateData);
                    observer.next(newBalance);
                    observer.complete();
                } catch (error) {
                    observer.error(error);
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
        if (this.isGuest()) {
            const accounts = this.localStorageUtility.getEntities<Account>('accounts');
            transactions.forEach(t => {
                const index = accounts.findIndex(a => (a as any).accountId === t.accountId);
                if (index !== -1) {
                    const account = accounts[index];
                    const amount = Number(t.amount) || 0;
                    const balanceChange = t.type === 'income' ? amount : -amount;
                    account.balance = (Number(account.balance) || 0) + balanceChange;
                    if (account.type === 'loan' && account.loanDetails && t.type === 'expense') {
                        account.loanDetails.remainingBalance = Math.max(0, (Number(account.loanDetails.remainingBalance) || 0) - amount);
                    }
                    account.updatedAt = new Date() as any;
                }
            });
            this.localStorageUtility.saveEntities('accounts', accounts);
            return of(undefined);
        }

        return new Observable<void>(observer => {
            const updateBalancesAsync = async () => {
                try {
                    const batch = writeBatch(this.firestore);
                    const accountBalanceChanges = new Map<string, number>();
                    const accountLoanChanges = new Map<string, number>();

                    // Calculate balance changes for each account
                    transactions.forEach(transaction => {
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
                        const accountRef = doc(this.firestore, `users/${userId}/accounts/${accountId}`);
                        const accountSnap = await getDoc(accountRef);

                        if (accountSnap.exists()) {
                            const account = accountSnap.data() as Account;
                            const newBalance = (Number(account.balance) || 0) + balanceChange;
                            const updateData: any = {
                                balance: newBalance,
                                updatedAt: new Date() as any
                            };

                            // Handle loan account updates
                            if (account.type === 'loan' && account.loanDetails) {
                                const loanChange = accountLoanChanges.get(accountId) || 0;
                                if (loanChange > 0) {
                                    const currentRemainingBalance = Number(account.loanDetails.remainingBalance) || 0;
                                    const newRemainingBalance = Math.max(0, currentRemainingBalance - loanChange);

                                    updateData['loanDetails.remainingBalance'] = newRemainingBalance;
                                }
                            }

                            batch.update(accountRef, updateData);
                        }
                    }

                    await batch.commit();
                    observer.next();
                    observer.complete();
                } catch (error) {
                    observer.error(error);
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
        if (this.isGuest()) {
            const accounts = this.localStorageUtility.getEntities<Account>('accounts');
            const oldIndex = accounts.findIndex(a => (a as any).accountId === oldAccountId);
            const newIndex = accounts.findIndex(a => (a as any).accountId === newAccountId);

            if (oldIndex !== -1 && newIndex !== -1) {
                const oldAccount = accounts[oldIndex];
                const newAccount = accounts[newIndex];
                const amount = Number(transaction.amount) || 0;
                const transactionEffect = transaction.type === 'income' ? amount : -amount;

                oldAccount.balance = (Number(oldAccount.balance) || 0) - transactionEffect;
                if (oldAccount.type === 'loan' && oldAccount.loanDetails && transaction.type === 'expense') {
                    oldAccount.loanDetails.remainingBalance = (Number(oldAccount.loanDetails.remainingBalance) || 0) + amount;
                }

                newAccount.balance = (Number(newAccount.balance) || 0) + transactionEffect;
                if (newAccount.type === 'loan' && newAccount.loanDetails && transaction.type === 'expense') {
                    newAccount.loanDetails.remainingBalance = Math.max(0, (Number(newAccount.loanDetails.remainingBalance) || 0) - amount);
                }

                oldAccount.updatedAt = new Date() as any;
                newAccount.updatedAt = new Date() as any;
                this.localStorageUtility.saveEntities('accounts', accounts);
            }
            return of(undefined);
        }

        return new Observable<void>(observer => {
            const updateBalancesAsync = async () => {
                try {
                    const batch = writeBatch(this.firestore);

                    // Get both accounts
                    const oldAccountRef = doc(this.firestore, `users/${userId}/accounts/${oldAccountId}`);
                    const newAccountRef = doc(this.firestore, `users/${userId}/accounts/${newAccountId}`);

                    const [oldAccountSnap, newAccountSnap] = await Promise.all([
                        getDoc(oldAccountRef),
                        getDoc(newAccountRef)
                    ]);

                    if (!oldAccountSnap.exists() || !newAccountSnap.exists()) {
                        observer.error('One or both accounts not found');
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

                    // Handle loan account updates for old account
                    if (oldAccount.type === 'loan' && oldAccount.loanDetails && transaction.type === 'expense') {
                        // Remove the loan payment effect from old account
                        const currentRemainingBalance = Number(oldAccount.loanDetails.remainingBalance) || 0;
                        const newRemainingBalance = currentRemainingBalance + amount;

                        oldAccountUpdateData['loanDetails.remainingBalance'] = newRemainingBalance;
                    }

                    // Prepare update data for new account
                    const newAccountUpdateData: any = {
                        balance: (Number(newAccount.balance) || 0) + transactionEffect,
                        updatedAt: new Date() as any
                    };

                    // Handle loan account updates for new account
                    if (newAccount.type === 'loan' && newAccount.loanDetails && transaction.type === 'expense') {
                        // Add the loan payment effect to new account
                        const currentRemainingBalance = Number(newAccount.loanDetails.remainingBalance) || 0;
                        const newRemainingBalance = Math.max(0, currentRemainingBalance - amount);

                        newAccountUpdateData['loanDetails.remainingBalance'] = newRemainingBalance;
                    }

                    // Update both accounts
                    batch.update(oldAccountRef, oldAccountUpdateData);
                    batch.update(newAccountRef, newAccountUpdateData);

                    await batch.commit();
                    observer.next();
                    observer.complete();
                } catch (error) {
                    observer.error(error);
                }
            };

            updateBalancesAsync();
        });
    }



    // 🔹 Generate a unique account ID
    private generateAccountId(): string {
        return 'acc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
}
