import { Injectable } from '@angular/core';
import { TransactionsService } from './transactions.service';
import { Firestore } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { CurrencyService } from '../currency.service';
import { DateService } from '../date.service';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { AccountsService } from './accounts.service';
import { SplitwiseService } from 'src/app/modules/splitwise/services/splitwise.service';
import { CommonSyncService } from '../common-sync.service';
import { LocalIndexDBStorageService } from '../indexdb-storage.service';
import { UserService } from './user.service';
import { FamilyService } from 'src/app/modules/family/services/family.service';

@Injectable({
    providedIn: 'root'
})
export class FamilyTransactionsService extends TransactionsService {
    constructor(
        firestore: Firestore,
        auth: Auth,
        currencyService: CurrencyService,
        dateService: DateService,
        store: Store<AppState>,
        accountsService: AccountsService,
        splitwiseService: SplitwiseService,
        commonSyncService: CommonSyncService,
        localStorageUtility: LocalIndexDBStorageService,
        userService: UserService,
        private familyService: FamilyService
    ) {
        super(
            firestore,
            auth,
            currencyService,
            dateService,
            store,
            accountsService,
            splitwiseService,
            commonSyncService,
            localStorageUtility,
            userService
        );
    }

    protected override getTransactionsPath(userId: string): string {
        const familyId = this.familyService.activeFamilyId();
        
        if (!familyId) {
            console.warn('[FamilyTransactionsService] No familyId found, falling back to personal transactions');
            return super.getTransactionsPath(userId);
        }
        
        return `family-groups/${familyId}/transactions`;
    }

    protected override getTransactionPath(userId: string, transactionId: string): string {
        return `${this.getTransactionsPath(userId)}/${transactionId}`;
    }
}
