import { Injectable } from '@angular/core';
import { CategoryService } from './category.service';
import { Firestore } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { MatDialog } from '@angular/material/dialog';
import { NotificationService } from '../notification.service';
import { HapticFeedbackService } from '../haptic-feedback.service';
import { LocalIndexDBStorageService } from '../indexdb-storage.service';
import { UserService } from './user.service';
import { FamilyService } from 'src/app/modules/family/services/family.service';

@Injectable({
    providedIn: 'root'
})
export class FamilyCategoryService extends CategoryService {
    constructor(
        firestore: Firestore,
        auth: Auth,
        store: Store<AppState>,
        dialog: MatDialog,
        notificationService: NotificationService,
        hapticFeedback: HapticFeedbackService,
        localStorageUtility: LocalIndexDBStorageService,
        userService: UserService,
        private familyService: FamilyService
    ) {
        super(firestore, auth, store, dialog, notificationService, hapticFeedback, localStorageUtility, userService);
    }

    /**
     * Override to use family group categories path
     */
    protected override getCategoriesPath(userId: string): string {
        const familyId = this.getFamilyId();
        
        if (!familyId) {
            console.warn('[FamilyCategoryService] No familyId found, falling back to personal categories');
            return super.getCategoriesPath(userId);
        }
        
        return `family-groups/${familyId}/categories`;
    }

    protected override getFamilyId(): string | undefined {
        return this.familyService.activeFamilyId() || undefined;
    }
}
