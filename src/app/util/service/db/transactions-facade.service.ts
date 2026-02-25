import { Injectable, InjectionToken, Inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Transaction } from '../../models/transaction.model';
import { TransactionsService } from './transactions.service';
import { FamilyTransactionsService } from './family-transactions.service';
import { UserService } from './user.service';

export const PERSONAL_TRANSACTIONS_SERVICE = new InjectionToken<TransactionsService>('PersonalTransactionsService');

@Injectable({
    providedIn: 'root'
})
export class TransactionsFacadeService {
    constructor(
        @Inject(PERSONAL_TRANSACTIONS_SERVICE) private personalService: TransactionsService,
        private familyService: FamilyTransactionsService,
        private userService: UserService
    ) {}

    private get activeService(): TransactionsService {
        const profile = this.userService.userAuth$.value;
        const isFamilyMode = profile?.preferences?.isFamilyMode || false;
        return isFamilyMode ? this.familyService : this.personalService;
    }

    createTransaction(userId: string, transaction: Omit<Transaction, 'id'>): Observable<void> {
        return this.activeService.createTransaction(userId, transaction);
    }

    updateTransaction(userId: string, transactionId: string, updatedTransaction: Partial<Transaction>): Observable<void> {
        return this.activeService.updateTransaction(userId, transactionId, updatedTransaction);
    }

    deleteTransaction(userId: string, transactionId: string): Observable<void> {
        return this.activeService.deleteTransaction(userId, transactionId);
    }

    getTransactions(userId: string): Observable<Transaction[]> {
        return this.activeService.getTransactions(userId);
    }

    pullFromFirestore(userId: string): Observable<void> {
        return this.activeService.pullFromFirestore(userId);
    }

    listenToTransactions(userId: string): Observable<void> {
        return this.activeService.listenToTransactions(userId);
    }

    getTransaction(userId: string, transactionId: string): Observable<Transaction | undefined> {
        return this.activeService.getTransaction(userId, transactionId);
    }

    getSyncStatus(): { count: number; hasPendingOperations: boolean } {
        return this.activeService.getSyncStatus();
    }

    forceSync(): Promise<void> {
        return this.activeService.forceSync();
    }

    getRecurringTransactions(userId: string): Observable<Transaction[]> {
        return this.activeService.getRecurringTransactions(userId);
    }

    getDueRecurringTransactions(userId: string): Observable<Transaction[]> {
        return this.activeService.getDueRecurringTransactions(userId);
    }

    processRecurringTransaction(userId: string, transaction: Transaction, confirmedDate?: Date): Observable<void> {
        return this.activeService.processRecurringTransaction(userId, transaction, confirmedDate);
    }

    skipRecurringTransaction(userId: string, transaction: Transaction, skippedDate?: Date): Observable<void> {
        return this.activeService.skipRecurringTransaction(userId, transaction, skippedDate);
    }
}
