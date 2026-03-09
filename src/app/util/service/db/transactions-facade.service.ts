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

    private getServiceForContext(familyId?: string): TransactionsService {
        if (familyId) return this.familyService;
        
        const profile = this.store.selectSignal(ProfileSelectors.selectProfile)();
        const isFamilyMode = profile?.preferences?.isFamilyMode || false;
        return isFamilyMode ? this.familyService : this.personalService;
    }

    createTransaction(userId: string, transaction: Omit<Transaction, 'id'>): Observable<void> {
        return this.getServiceForContext(transaction.familyId).createTransaction(userId, transaction);
    }

    updateTransaction(userId: string, transactionId: string, updatedTransaction: Partial<Transaction>, familyId?: string): Observable<void> {
        return this.getServiceForContext(familyId || (updatedTransaction as any).familyId).updateTransaction(userId, transactionId, updatedTransaction);
    }

    deleteTransaction(userId: string, transactionId: string, familyId?: string): Observable<Transaction | void> {
        return this.getServiceForContext(familyId).deleteTransaction(userId, transactionId);
    }

    getTransactions(userId: string, familyId?: string): Observable<Transaction[]> {
        const profile = this.store.selectSignal(ProfileSelectors.selectProfile)();
        const effectiveFamilyId = familyId || (profile?.preferences?.isFamilyMode ? profile?.preferences?.activeFamilyId : undefined);
        return this.getServiceForContext(effectiveFamilyId || undefined).getTransactions(userId, effectiveFamilyId || undefined);
    }

    pullFromFirestore(userId: string, familyId?: string): Observable<void> {
        const profile = this.store.selectSignal(ProfileSelectors.selectProfile)();
        const effectiveFamilyId = familyId || (profile?.preferences?.isFamilyMode ? profile?.preferences?.activeFamilyId : undefined);
        return this.getServiceForContext(effectiveFamilyId || undefined).pullFromFirestore(userId, effectiveFamilyId || undefined);
    }

    listenToTransactions(userId: string, familyId?: string): Observable<void> {
        const profile = this.store.selectSignal(ProfileSelectors.selectProfile)();
        const effectiveFamilyId = familyId || (profile?.preferences?.isFamilyMode ? profile?.preferences?.activeFamilyId : undefined);
        return this.getServiceForContext(effectiveFamilyId || undefined).listenToTransactions(userId, effectiveFamilyId || undefined);
    }

    getTransaction(userId: string, transactionId: string, familyId?: string): Observable<Transaction | undefined> {
        const profile = this.store.selectSignal(ProfileSelectors.selectProfile)();
        const effectiveFamilyId = familyId || (profile?.preferences?.isFamilyMode ? profile?.preferences?.activeFamilyId : undefined);
        return this.getServiceForContext(effectiveFamilyId || undefined).getTransaction(userId, transactionId, effectiveFamilyId || undefined);
    }

    /**
     * Get cached transactions from IndexedDB synchronously
     */
    getCachedTransactions(userId: string, familyId?: string): Transaction[] {
        const profile = this.store.selectSignal(ProfileSelectors.selectProfile)();
        const effectiveFamilyId = familyId || (profile?.preferences?.isFamilyMode ? profile?.preferences?.activeFamilyId : undefined);
        return this.getServiceForContext(effectiveFamilyId || undefined).getCachedTransactions(userId, effectiveFamilyId || undefined);
    }

    getSyncStatus(familyId?: string): { count: number; hasPendingOperations: boolean } {
        return this.getServiceForContext(familyId || undefined).getSyncStatus();
    }

    forceSync(familyId?: string): Promise<void> {
        return this.getServiceForContext(familyId || undefined).forceSync();
    }
}
