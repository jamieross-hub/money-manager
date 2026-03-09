import { Injectable, InjectionToken, Inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Account, CreateAccountRequest, UpdateAccountRequest } from '../../models/account.model';
import { AccountsService } from './accounts.service';
import { Transaction } from '../../models/transaction.model';

export const PERSONAL_ACCOUNTS_SERVICE = new InjectionToken<AccountsService>('PersonalAccountsService');

@Injectable({
    providedIn: 'root'
})
export class AccountsFacadeService {
    constructor(
        @Inject(PERSONAL_ACCOUNTS_SERVICE) private accountsService: AccountsService
    ) {}

    createAccount(userId: string, accountData: CreateAccountRequest): Observable<string> {
        return this.accountsService.createAccount(userId, accountData);
    }

    getAccounts(userId: string): Observable<Account[]> {
        return this.accountsService.getAccounts(userId);
    }

    pullFromFirestore(userId: string): Observable<void> {
        return this.accountsService.pullFromFirestore(userId);
    }

    getAccount(userId: string, accountId: string): Observable<Account | undefined> {
        return this.accountsService.getAccount(userId, accountId);
    }

    updateAccount(userId: string, accountId: string, accountData: UpdateAccountRequest): Observable<void> {
        return this.accountsService.updateAccount(userId, accountId, accountData);
    }

    deleteAccount(userId: string, accountId: string): Observable<void> {
        return this.accountsService.deleteAccount(userId, accountId);
    }

    updateAccountBalanceForTransaction(
        userId: string,
        accountId: string,
        transactionType: 'create' | 'update' | 'delete',
        oldTransaction?: Transaction,
        newTransaction?: Transaction
    ): Observable<number> {
        return this.accountsService.updateAccountBalanceForTransaction(userId, accountId, transactionType, oldTransaction, newTransaction);
    }

    updateAccountBalanceForTransactions(
        userId: string,
        transactions: { accountId: string; type: 'income' | 'expense'; amount: number }[]
    ): Observable<void> {
        return this.accountsService.updateAccountBalanceForTransactions(userId, transactions);
    }

    updateAccountBalanceForAccountTransfer(
        userId: string,
        oldAccountId: string,
        newAccountId: string,
        transaction: Transaction
    ): Observable<void> {
        return this.accountsService.updateAccountBalanceForAccountTransfer(userId, oldAccountId, newAccountId, transaction);
    }

    /**
     * Set up a real-time listener for accounts
     * Typically managed by CommonSyncService
     */
    listenToAccounts(userId: string): Observable<void> {
        return (this.accountsService as any).listenToAccounts(userId);
    }
}
