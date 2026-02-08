import { Injectable } from '@angular/core';
import { LocalStorageService } from '../local-storage.service';
import { LocalStorageKey } from '../../models/local-storage.model';
import { UserService } from './user.service';
import { ExportService } from '../export.service';
import { firstValueFrom } from 'rxjs';
import { APP_VERSION } from '../../../version';

export interface BackupData {
    version: string;
    timestamp: string;
    userMode: 'guest' | 'logged-in';
    data: any;
    schemaVersion: number;
}

@Injectable({
    providedIn: 'root'
})
export class BackupRestoreService {
    private readonly SCHEMA_VERSION = 1;

    constructor(
        private localStorageService: LocalStorageService,
        private userService: UserService,
        private exportService: ExportService
    ) { }

    /**
     * Export all app data to a JSON file
     */
    async exportData(): Promise<void> {
        const isGuest = this.userService.isGuestUser();
        const userMode = isGuest ? 'guest' : 'logged-in';
        let data: any = {};

        if (isGuest) {
            // Collect all relevant guest data from local storage
            data = this.collectGuestData();
        } else {
            // For logged-in users, we might want to fetch from Firestore OR 
            // export what's in the current local cache (which should be synced)
            // The requirement says "No server upload required (100% local)"
            // but for logged-in users, the "local data" is the cache.
            // Let's collect everything available in LocalStorageService
            data = this.collectAllLocalData();
        }

        const backup: BackupData = {
            version: APP_VERSION || '1.0.0',
            timestamp: new Date().toISOString(),
            userMode: userMode as any,
            data: data,
            schemaVersion: this.SCHEMA_VERSION
        };

        const filename = `money-manager-backup-${new Date().toISOString().split('T')[0]}`;
        this.exportService.exportToJSON(backup, filename);
    }

    /**
     * Import data from a backup object
     */
    async importData(backup: BackupData, mode: 'replace' | 'merge'): Promise<{ success: boolean; message: string; summary?: any }> {
        // 1. Validate basic shape
        if (!backup || !backup.data || !backup.schemaVersion) {
            return { success: false, message: 'BACKUP.INVALID_FORMAT' };
        }

        // 2. Check schema version compatibility
        if (backup.schemaVersion > this.SCHEMA_VERSION) {
            return { success: false, message: 'BACKUP.INCOMPATIBLE_VERSION' };
        }

        // 3. Process data based on mode
        try {
            if (mode === 'replace') {
                await this.performReplaceImport(backup.data);
            } else {
                await this.performMergeImport(backup.data);
            }
            return { success: true, message: 'BACKUP.IMPORT_SUCCESS' };
        } catch (error) {
            console.error('Import failed:', error);
            return { success: false, message: 'BACKUP.IMPORT_FAILED' };
        }
    }

    private collectGuestData(): any {
        const guestKeys = [
            LocalStorageKey.GUEST_ACCOUNTS,
            LocalStorageKey.GUEST_CATEGORIES,
            LocalStorageKey.GUEST_TRANSACTIONS,
            LocalStorageKey.GUEST_BUDGETS,
            LocalStorageKey.GUEST_GOALS,
            LocalStorageKey.USER_DATA_GUEST,
            LocalStorageKey.THEME_PREFERENCE,
            LocalStorageKey.LOCALE_PREFERENCE
        ];

        const data: any = {};
        guestKeys.forEach(key => {
            const val = this.localStorageService.getItem(key);
            if (val !== null) {
                data[key] = val;
            }
        });

        return data;
    }

    private collectAllLocalData(): any {
        const allKeys = this.localStorageService.getAllKeys();
        const data: any = {};

        // Exclude some keys that shouldn't be backed up (like temp cache)
        const excludePrefixes = ['cache_', 'last-login-'];

        allKeys.forEach(key => {
            if (!excludePrefixes.some(pref => key.startsWith(pref))) {
                data[key] = this.localStorageService.getItem(key);
            }
        });

        return data;
    }

    private async performReplaceImport(data: any): Promise<void> {
        // Clear all relevant app data first
        // Note: We might want to be selective, but 'replace' usually means everything.
        this.localStorageService.clear();

        // Populate with new data
        Object.entries(data).forEach(([key, value]) => {
            this.localStorageService.setItem(key, value);
        });

        // Trigger a reload or state refresh
        window.location.reload();
    }

    private async performMergeImport(data: any): Promise<void> {
        // Merging is trickier. For collections, we should append/unique.
        // For single settings, we might overwrite or ignore.

        for (const [key, value] of Object.entries(data)) {
            if (Array.isArray(value)) {
                // It's a collection (accounts, categories, transactions)
                const existing = this.localStorageService.getItem<any[]>(key) || [];

                // Simple merge based on 'id' or 'accountId'
                const merged = [...existing];
                (value as any[]).forEach(newItem => {
                    const id = newItem.id || newItem.accountId || newItem.transactionId;
                    const index = merged.findIndex(e => (e.id || e.accountId || e.transactionId) === id);
                    if (index === -1) {
                        merged.push(newItem);
                    } else {
                        // Conflict! In 'merge' mode, we could decide to keep existing or overwrite.
                        // Let's overwrite with backup data for now as it's an explicit restore.
                        merged[index] = newItem;
                    }
                });

                this.localStorageService.setItem(key, merged);
            } else {
                // Single value setting (e.g. theme)
                // Only overwrite if it doesn't exist? Or always overwrite?
                // For settings, overwrite seems safer for a "restore" action.
                this.localStorageService.setItem(key, value);
            }
        }

        // Refresh app state
        window.location.reload();
    }
}
