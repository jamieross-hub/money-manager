import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { selectAllAccounts } from 'src/app/store/accounts/accounts.selectors';
import { selectAllCategories } from 'src/app/store/categories/categories.selectors';
import { selectAllTransactions } from 'src/app/store/transactions/transactions.selectors';
import { take } from 'rxjs';
import { UserService } from 'src/app/util/service/db/user.service';
import { NotificationService } from 'src/app/util/service/notification.service';

import { BreakpointObserver } from '@angular/cdk/layout';
import { StepperOrientation } from '@angular/material/stepper';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatStepperModule } from '@angular/material/stepper';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { BackupRestoreService } from 'src/app/util/service/backupRestore.service';

@Component({
    selector: 'app-sync-to-cloud',
    templateUrl: './sync-to-cloud.component.html',
    styleUrls: ['./sync-to-cloud.component.scss'],
    standalone: true,
    imports: [
        CommonModule,
        MatIconModule,
        MatButtonModule,
        MatProgressSpinnerModule,
        MatStepperModule,
        MatCardModule,
        MatDividerModule,
        MatProgressBarModule
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SyncToCloudComponent implements OnInit {
    currentStep = 1;
    isExporting = false;
    isImporting = false;
    importFile: File | null = null;
    importProgress = 0;
    stepperOrientation: Observable<StepperOrientation>;

    // Data to export
    accounts: any[] = [];
    categories: any[] = [];
    transactions: any[] = [];

    constructor(
        private router: Router,
        private store: Store<AppState>,
        private backupRestoreService: BackupRestoreService,
        private userService: UserService,
        private notificationService: NotificationService,
        breakpointObserver: BreakpointObserver
    ) {
        this.stepperOrientation = breakpointObserver
            .observe('(max-width: 800px)')
            .pipe(map(({ matches }) => (matches ? 'vertical' : 'horizontal')));
    }

    ngOnInit() {
        this.loadDataForExport();

        // Determine initial step based on auth status
        this.userService.userAuth$.subscribe(user => {
            if (user && !this.userService.isGuestUser()) {
                if (this.currentStep === 2) {
                    this.currentStep = 3; // Auto-advance if sitting on auth step
                }
            }
        });

        if (!this.userService.isGuestUser()) {
            this.currentStep = 3;
        }
    }

    loadDataForExport() {
        this.store.select(selectAllAccounts).pipe(take(1)).subscribe(data => this.accounts = data);
        this.store.select(selectAllCategories).pipe(take(1)).subscribe(data => this.categories = data);
        this.store.select(selectAllTransactions).pipe(take(1)).subscribe(data => this.transactions = data);
    }

    async exportData() {
        this.isExporting = true;
        try {
            this.backupRestoreService.exportFullBackup({
                transactions: this.transactions,
                accounts: this.accounts,
                categories: this.categories
            });
            this.notificationService.success('Data exported successfully!');
            setTimeout(() => {
                this.currentStep = 2;
                this.isExporting = false;
            }, 1500);
        } catch (error) {
            console.error('Export failed', error);
            this.notificationService.error('Export failed. Please try again.');
            this.isExporting = false;
        }
    }

    navigateToSignIn() {
        // We want to return here after sign in
        this.router.navigate(['/sign-in'], { queryParams: { redirect: '/sync-to-cloud' } });
    }

    async signInWithGoogle() {
        try {
            await this.userService.signInWithGoogle();
            this.notificationService.success('Signed in with Google successfully!');
            // The subscription in ngOnInit will handle moving to step 3
        } catch (error: any) {
            console.error('Google sign in failed', error);
            this.notificationService.error('Google sign in failed: ' + (error.message || 'Unknown error'));
        }
    }

    onFileSelected(event: any) {
        const file = event.target.files[0];
        if (file) {
            this.importFile = file;
        }
    }

    async importData() {
        if (!this.importFile) {
            this.notificationService.warning("Please select a file to import");
            return;
        }

        this.isImporting = true;
        this.importProgress = 10;

        const reader = new FileReader();
        reader.onload = async (e: any) => {
            try {
                const json = JSON.parse(e.target.result);
                if (!json.version || !json.accounts || !json.categories || !json.transactions) {
                    throw new Error("Invalid backup format");
                }

                const userId = this.userService.getCurrentUserId();
                if (!userId) throw new Error("User not authenticated");

                this.importProgress = 30;

                // 1. Import Categories
                // We might want to deduplicate here, but for now assuming clean slate or merge
                for (const cat of json.categories) {
                    // Remove ID to let Firestore generate new one, or implement ID mapping logic
                    // For simplicity in this version, we create new entities.
                    // In a robust system, we would map oldId -> newId.
                    // Let's assume we create new and stick with it for MVP
                    // NOTE: Simple recreate for now.
                    // Issues: Linking transactions to new Category/Account IDs.
                    // Solution: Needs ID mapping.
                    // Since we don't have ID mapping logic in this MVP step,
                    // we will just create them. Linked IDs in transactions will fail validation if they don't match.
                    // CRITICAL FIX: We need real implementation.
                }

                // REVISED IMPORT LOGIC WITH ID MAPPING
                const accountIdMap = new Map<string, string>(); // Old -> New
                const categoryIdMap = new Map<string, string>(); // Old -> New

                // Import Accounts
                let processedCount = 0;
                const totalItems = json.accounts.length + json.categories.length + json.transactions.length;

                for (const account of json.accounts) {
                    // Dispatch create action - ideally we need an action that returns the ID or service method
                    // Since actions are void, we might use Service directly or specialized action.
                    // Using generic 'createAccount' action relies on Effects.
                    // Let's use AccountsService directly or rely on the Fact that we need the ID.
                    // Since we are inside a component, accessing Service is better for synchronous-like ID retrieval if possible.
                    // But our actions are NGRX.

                    // WORKAROUND: For this MVP, we will try to retain IDs if possible OR
                    // Realistically, to do this right without rewriting backend logic:
                    // We dispatch actions. But we can't get IDs back easily.
                    // ALTERNATIVE: Use the existing IDs? Firestore allows setting specific IDs.
                    // If we can force specific IDs on creation, we don't need mapping.
                    // Let's check `createAccount` signature or Payload.
                    // It takes `accountData`. If `id` is part of data and backend allows it...

                    // Let's assume we can't reuse IDs easily without checking backend rules.
                    // Fallback: We'll do what ImportTransactionsComponent does:
                    // It matches by Name? No, that component allows selecting from dropdown.

                    // To keep it simple and robust for "Sync":
                    // We will try to CREATE with same ID if possible, otherwise we need a robust backend function "importBackup"
                    // which is not available.
                }

                // Okay, simpler approach for MVP:
                // We will just recreate everything.
                // Transactions have `accountId` and `categoryId`. 
                // We'll create Categories & Accounts first. 
                // We will implement a lookup by Name.
                // 1. Create Categories. Store Name -> NewID map. (Or assume user hasn't changed names much).

                // BETTER APPROACH for MVP:
                // Use `UserService.importBackup(json)` if we can create it?
                // No, let's keep logic here but simplistic.

                // Plan:
                // 1. Create categories (one by one).
                // 2. Create accounts (one by one).
                // 3. Create transactions (map category/account by Name if possible, or preserve IDs if we can use `setDoc`).

                // Actually best way: use `setDoc` with the OLD ID in Firestore directly if we have permission.
                // `UserService` or common sync service usually writes to `users/{uid}/...`
                // If we write directly to Firestore from here (bypassing NGRX effects for import usually is faster/easier for bulk), we can preserve IDs.

                // Let's use `createCategory` action for now and ignore linking for a second? No that breaks data.
                // Let's ask the user to just "Import" and we push actions.
                // We will attempt to push objects AS IS. Firestore usually AUTO-GENERATES ids if not provided.
                // If we provide ID in the data object passed to `addDoc` it is ignored, `setDoc` uses it.

                // Let's assume we use the Store Actions. Most Store actions use `addDoc` (auto ID).
                // To fix relations: 
                // We need to map.
                // Since we can't get result from `dispatch`, we are stuck.

                // CORRECT PATH: Implement `importBackup` in `ExportService` or `CommonSyncService` that handles this logic properly using `writeBatch` and `doc(collection, id)`.
                // This component should just call `this.exportService.importFullBackup(json)`.

                // I will implement `importFullBackup` in `ExportService` (or `CommonSyncService`) after this step.
                // I will stub the call here.

                await this.backupRestoreService.importFullBackup(json, userId);

                this.importProgress = 100;
                this.notificationService.success("Import successful!");
                setTimeout(() => {
                    this.router.navigate(['/dashboard']);
                }, 1000);

            } catch (error) {
                console.error("Import error", error);
                this.notificationService.error("Import failed: " + error);
                this.isImporting = false;
            }
        };
        reader.readAsText(this.importFile);
    }

    skipImport() {
        this.notificationService.info('Import skipped');
        this.router.navigate(['/dashboard']);
    }

    onStepChange(event: any) {
        this.currentStep = event.selectedIndex + 1;
    }

    goToStep(step: number) {
        this.currentStep = step;
        // Logic to move stepper programmaticall is handled via binding [selectedIndex]
    }
}
