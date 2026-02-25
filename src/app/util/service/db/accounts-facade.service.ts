import { Injectable, InjectionToken, Inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Account, CreateAccountRequest, UpdateAccountRequest } from '../../models/account.model';
import { AccountsService } from './accounts.service';
import { FamilyAccountsService } from './family-accounts.service';
import { UserService } from './user.service';
import { Transaction } from '../../models/transaction.model';

export const PERSONAL_ACCOUNTS_SERVICE = new InjectionToken<AccountsService>('PersonalAccountsService');

@Injectable({
    providedIn: 'root'
})
export class AccountsFacadeService {
    constructor(
        @Inject(PERSONAL_ACCOUNTS_SERVICE) private personalService: AccountsService,
        private familyService: FamilyAccountsService,
        private userService: UserService
    ) {}

    private get activeService(): AccountsService {
        const profile = this.userService.userAuth$.value;
        const isFamilyMode = profile?.preferences?.isFamilyMode || false;
        return isFamilyMode ? this.familyService : this.personalService;
    }

    createAccount(userId: string, accountData: CreateAccountRequest): Observable<string> {
        return this.activeService.createAccount(userId, accountData);
    }

    getAccounts(userId: string): Observable<Account[]> {
        return this.activeService.getAccounts(userId);
    }

    pullFromFirestore(userId: string): Observable<void> {
        return this.activeService.pullFromFirestore(userId);
    }

    getAccount(userId: string, accountId: string): Observable<Account | undefined> {
        return this.activeService.getAccount(userId, accountId);
    }

    updateAccount(userId: string, accountId: string, accountData: UpdateAccountRequest): Observable<void> {
        return this.activeService.updateAccount(userId, accountId, accountData);
    }

    deleteAccount(userId: string, accountId: string): Observable<void> {
        return this.activeService.deleteAccount(userId, accountId);
    }

    updateAccountBalanceForTransaction(
        userId: string,
        accountId: string,
        transactionType: 'create' | 'update' | 'delete',
        oldTransaction?: Transaction,
        newTransaction?: Transaction
    ): Observable<number> {
        return this.activeService.updateAccountBalanceForTransaction(userId, accountId, transactionType, oldTransaction, newTransaction);
    }

    updateAccountBalanceForTransactions(
        userId: string,
        transactions: { accountId: string; type: 'income' | 'expense'; amount: number }[]
    ): Observable<void> {
        return this.activeService.updateAccountBalanceForTransactions(userId, transactions);
    }

    updateAccountBalanceForAccountTransfer(
        userId: string,
        oldAccountId: string,
        newAccountId: string,
        transaction: Transaction
    ): Observable<void> {
        return this.activeService.updateAccountBalanceForAccountTransfer(userId, oldAccountId, newAccountId, transaction);
    }
}
