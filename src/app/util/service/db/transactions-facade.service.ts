import { Injectable, InjectionToken, Inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Transaction } from '../../models/transaction.model';
import { TransactionsService } from './transactions.service';
import { FamilyTransactionsService } from './family-transactions.service';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import * as ProfileSelectors from 'src/app/store/profile/profile.selectors';

export const PERSONAL_TRANSACTIONS_SERVICE = new InjectionToken<TransactionsService>('PersonalTransactionsService');

@Injectable({
    providedIn: 'root'
})
export class TransactionsFacadeService {
    constructor(
        @Inject(PERSONAL_TRANSACTIONS_SERVICE) private personalService: TransactionsService,
        private familyService: FamilyTransactionsService,
        private store: Store<AppState>
    ) {}

    private get activeService(): TransactionsService {
        const profile = this.store.selectSignal(ProfileSelectors.selectProfile)();
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

    getTransactions(userId: string, familyId?: string): Observable<Transaction[]> {
        const profile = this.store.selectSignal(ProfileSelectors.selectProfile)();
        const effectiveFamilyId = familyId || (profile?.preferences?.isFamilyMode ? profile?.preferences?.activeFamilyId : undefined);
        return this.activeService.getTransactions(userId, effectiveFamilyId || undefined);
    }

    pullFromFirestore(userId: string, familyId?: string): Observable<void> {
        const profile = this.store.selectSignal(ProfileSelectors.selectProfile)();
        const effectiveFamilyId = familyId || (profile?.preferences?.isFamilyMode ? profile?.preferences?.activeFamilyId : undefined);
        return this.activeService.pullFromFirestore(userId, effectiveFamilyId || undefined);
    }

    listenToTransactions(userId: string, familyId?: string): Observable<void> {
        const profile = this.store.selectSignal(ProfileSelectors.selectProfile)();
        const effectiveFamilyId = familyId || (profile?.preferences?.isFamilyMode ? profile?.preferences?.activeFamilyId : undefined);
        return this.activeService.listenToTransactions(userId, effectiveFamilyId || undefined);
    }

    getTransaction(userId: string, transactionId: string, familyId?: string): Observable<Transaction | undefined> {
        const profile = this.store.selectSignal(ProfileSelectors.selectProfile)();
        const effectiveFamilyId = familyId || (profile?.preferences?.isFamilyMode ? profile?.preferences?.activeFamilyId : undefined);
        return this.activeService.getTransaction(userId, transactionId, effectiveFamilyId || undefined);
    }

    /**
     * Get cached transactions from IndexedDB synchronously
     */
    getCachedTransactions(userId: string, familyId?: string): Transaction[] {
        const profile = this.store.selectSignal(ProfileSelectors.selectProfile)();
        const effectiveFamilyId = familyId || (profile?.preferences?.isFamilyMode ? profile?.preferences?.activeFamilyId : undefined);
        return this.activeService.getCachedTransactions(userId, effectiveFamilyId || undefined);
    }

    getSyncStatus(): { count: number; hasPendingOperations: boolean } {
        return this.activeService.getSyncStatus();
    }

    forceSync(): Promise<void> {
        return this.activeService.forceSync();
    }
}
