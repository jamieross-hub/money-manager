import { Injectable } from '@angular/core';
import { AccountsService } from './accounts.service';
import { Firestore } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { LocalIndexDBStorageService } from '../indexdb-storage.service';
import { UserService } from './user.service';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';

@Injectable({
    providedIn: 'root'
})
export class FamilyAccountsService extends AccountsService {
    constructor(
        firestore: Firestore,
        auth: Auth,
        localStorageUtility: LocalIndexDBStorageService,
        userService: UserService,
        store: Store<AppState>
    ) {
        super(firestore, auth, localStorageUtility, userService, store);
    }

    /**
     * Override to use family group accounts path
     */
    protected override getAccountsPath(userId: string): string {
        const profile = this.userService.userAuth$.value;
        const familyId = profile?.preferences?.familyId;
        
        if (!familyId) {
            console.warn('[FamilyAccountsService] No familyId found, falling back to personal accounts');
            return super.getAccountsPath(userId);
        }
        
        return `family-groups/${familyId}/accounts`;
    }
}
