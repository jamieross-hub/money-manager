import { Injectable } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ExportFormat } from '../config/enums';
import { APP_CONFIG, ERROR_MESSAGES } from '../config/config';
import { CurrencyService } from './currency.service';
import { Firestore, writeBatch, doc } from '@angular/fire/firestore';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../components/confirm-dialog/confirm-dialog.component';
import { RestoreDialogComponent, RestoreMode } from '../components/restore-dialog/restore-dialog.component';
import { LocalIndexDBStorageService } from './indexdb-storage.service';
import { LocalStorageKey } from '../models/local-storage.model';
import { UserService } from './db/user.service';
import { APP_VERSION } from '../../version';
import { Transaction } from '../models/transaction.model';
import { Account, LoanAccount } from '../models/account.model';
import { Category } from '../models/category.model';

/**
 * Export options interface
 */
export interface ExportOptions {
    format: ExportFormat;
    filename?: string;
    includeHeaders?: boolean;
    dateFormat?: string;
    currencyFormat?: string;
    locale?: string;
}

/**
 * Export result interface
 */
export interface ExportResult {
    success: boolean;
    data?: Blob;
    filename?: string;
    error?: string;
    size?: number;
}

export interface BackupData {
    version: string;
    timestamp: string;
    userMode: 'guest' | 'logged-in';
    data: Record<string, any>;
    schemaVersion?: number;
}

@Injectable({
    providedIn: 'root'
})
export class BackupRestoreService {
    private readonly SCHEMA_VERSION = 1;

    constructor(
        private firestore: Firestore,
        private currencyService: CurrencyService,
        private localStorageService: LocalIndexDBStorageService,
        private userService: UserService,
        private dialog: MatDialog
    ) { }

    /**
     * Reads a JSON file and returns the parsed data.
     * @param file The file to read.
     * @returns A promise that resolves with the parsed JSON data.
     * @throws Error if the file is not a JSON file or if parsing fails.
     */
    readJsonFile<T = any>(file: File): Promise<T> {
        return new Promise((resolve, reject) => {
            // Validate file extension
            const fileName = file.name.toLowerCase();
            if (!fileName.endsWith('.json')) {
                reject(new Error('Invalid file type. Please select a JSON file.'));
                return;
            }

            const reader = new FileReader();

            reader.onload = (e: any) => {
                try {
                    const jsonString = e.target.result;
                    const jsonData = JSON.parse(jsonString);
                    resolve(jsonData);
                } catch (error) {
                    console.error('JSON parsing error:', error);
                    reject(new Error('Failed to parse JSON file. Please check the file format.'));
                }
            };

            reader.onerror = (error) => {
                console.error('File reading error:', error);
                reject(new Error('Failed to read file.'));
            };

            reader.readAsText(file);
        });
    }

    /**
     * Downloads data as a JSON file.
     * @param data The data to download.
     * @param filename The name of the file to save (without extension).
     */
    downloadJson(data: any, filename: string): void {
        try {
            const jsonContent = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonContent], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            // Ensure filename has .json extension
            link.download = filename.toLowerCase().endsWith('.json') ? filename : `${filename}.json`;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading JSON:', error);
            throw new Error('Failed to download JSON file.');
        }
    }

    /**
     * Downloads a template for transaction import.
     */
    downloadTransactionTemplate(): void {
        const templateData = [
            {
                "payee": "Salary Payment",
                "amount": 50000,
                "type": "income",
                "category": "Salary",
                "date": "2024-01-15",
                "notes": "Monthly salary"
            },
            {
                "payee": "Grocery Store",
                "amount": 1500,
                "type": "expense",
                "category": "Food & Dining",
                "date": "2024-01-16",
                "notes": "Weekly groceries"
            }
        ];

        this.downloadJson(templateData, 'transaction_import_template.json');
    }

    /**
     * Export data to JSON format
     * @deprecated Use downloadJson directly or specific export methods
     */
    exportToJSON(data: any, filename: string): void {
        this.downloadJson(data, filename);
    }

    /**
     * Generate report in JSON format
     */
    generateReport(data: any, format: string): Observable<Blob> {
        return from(this.generateReportAsync(data, format)).pipe(
            catchError(error => throwError(() => new Error(ERROR_MESSAGES.NETWORK.SERVER_ERROR)))
        );
    }

    private async generateReportAsync(data: any, format: string): Promise<Blob> {
        try {
            if (format.toLowerCase() === 'json') {
                return this.generateJSONBlob(data);
            }
            throw new Error(`Unsupported format: ${format}. Only JSON is supported.`);
        } catch (error) {
            console.error('Report generation failed:', error);
            throw error;
        }
    }

    /**
     * Generic export method to reduce duplication
     */
    private async exportDataAsJson<T>(
        data: T[],
        options: ExportOptions,
        processor: (items: T[], opts: ExportOptions) => any[],
        defaultFilenamePrefix: string
    ): Promise<ExportResult> {
        try {
            const processedData = processor.call(this, data, options);
            let blob: Blob;
            let filename = options.filename || `${defaultFilenamePrefix}_${new Date().toISOString().split('T')[0]}`;

            if (options.format === ExportFormat.JSON) {
                blob = this.generateJSONBlob(processedData);
                filename += '.json';
            } else {
                throw new Error(`Unsupported format: ${options.format}. Only JSON is supported.`);
            }

            return {
                success: true,
                data: blob,
                filename,
                size: blob.size
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }

    /**
     * Export transactions with advanced options (JSON only)
     */
    exportTransactions(transactions: Transaction[], options: ExportOptions): Observable<ExportResult> {
        return from(this.exportDataAsJson(
            transactions,
            options,
            this.processTransactionData,
            'transactions'
        )).pipe(
            catchError(error => throwError(() => new Error(error.message || ERROR_MESSAGES.NETWORK.SERVER_ERROR)))
        );
    }

    /**
     * Export full backup (transactions, accounts, categories)
     */
    exportFullBackup(data: { transactions: Transaction[], accounts: Account[], categories: Category[] }, filename?: string): void {
        try {
            const backupData = {
                timestamp: new Date().toISOString(),
                version: 1,
                ...data
            };

            const name = filename || `money_manager_backup_${new Date().toISOString().split('T')[0]}`;
            this.downloadJson(backupData, name);
        } catch (error) {
            console.error('Full backup export failed:', error);
            throw new Error(ERROR_MESSAGES.NETWORK.SERVER_ERROR);
        }
    }

    /**
     * Export accounts data (JSON only)
     */
    exportAccounts(accounts: Account[], options: ExportOptions): Observable<ExportResult> {
        return from(this.exportDataAsJson(
            accounts,
            options,
            this.processAccountData,
            'accounts'
        )).pipe(
            catchError(error => throwError(() => new Error(error.message || ERROR_MESSAGES.NETWORK.SERVER_ERROR)))
        );
    }

    /**
     * Generate JSON blob
     */
    private generateJSONBlob(data: any): Blob {
        const jsonContent = JSON.stringify(data, null, 2);
        return new Blob([jsonContent], { type: 'application/json' });
    }

    /**
     * Process transaction data for export
     */
    private processTransactionData(transactions: Transaction[], options: ExportOptions): any[] {
        return transactions.map(transaction => ({
            Date: this.formatDate(transaction.date, options.dateFormat),
            Payee: transaction.payee,
            Amount: this.formatCurrency(transaction.amount, options.currencyFormat),
            Type: transaction.type,
            Category: transaction.category, // Using category name directly if available in projection, otherwise might be ID
            Account: transaction.accountId, // Ideally should be account name, but respecting existing logic
            Notes: transaction.notes || '',
            Status: transaction.status
        }));
    }

    /**
     * Process account data for export
     */
    private processAccountData(accounts: Account[], options: ExportOptions): any[] {
        return accounts.map(account => {
            // Handle loan accounts specially - use negative remaining balance
            let balance = account.balance;
            if (account.type === 'loan' && account.loanDetails) {
                balance = -(account.loanDetails.remainingBalance || 0);
            }

            return {
                Name: account.name,
                Type: account.type,
                Balance: this.formatCurrency(balance, options.currencyFormat),
                Currency: account.currency,
                Institution: account.institution || '',
                Description: account.description || '',
                Status: account.isActive ? 'Active' : 'Inactive'
            };
        });
    }

    /**
     * Format date according to specified format
     */
    private formatDate(date: any, format?: string): string {
        if (!date) return '';

        const dateObj = date instanceof Date ? date : new Date(date); // Handle Timestamp conversion if needed in calling code or here
        // If date is Firestore Timestamp, it should be converted before calling this or check for .toDate()
        if (typeof date === 'object' && 'toDate' in date && typeof date.toDate === 'function') {
            return this.formatDate(date.toDate(), format);
        }

        if (isNaN(dateObj.getTime())) return '';

        const locale = 'en-US';
        const options: Intl.DateTimeFormatOptions = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        };

        return new Intl.DateTimeFormat(locale, options).format(dateObj);
    }

    /**
     * Format currency according to specified format
     */
    private formatCurrency(amount: number, format?: string): string {
        if (typeof amount !== 'number' || isNaN(amount)) return '0.00';

        return this.currencyService.formatAmount(amount);
    }

    /**
     * Get supported export formats
     */
    getSupportedFormats(): ExportFormat[] {
        return [ExportFormat.JSON];
    }

    /**
     * Get format MIME type
     */
    getFormatMimeType(format: ExportFormat): string {
        if (format === ExportFormat.JSON) {
            return 'application/json';
        }
        return 'application/octet-stream';
    }

    /**
     * Validate export data
     */
    validateExportData(data: any[]): boolean {
        return Array.isArray(data) && data.length > 0;
    }

    /**
     * Import full backup data
     */
    async importFullBackup(data: any, userId: string): Promise<void> {
        if (!data || !userId) throw new Error('Invalid data or user ID');

        const batch = writeBatch(this.firestore);

        try {
            // 1. Import Categories
            if (data.categories && Array.isArray(data.categories)) {
                for (const cat of data.categories) {
                    if (cat.id) {
                        const ref = doc(this.firestore, `users/${userId}/categories/${cat.id}`);
                        batch.set(ref, cat);
                    }
                }
            }

            // 2. Import Accounts
            if (data.accounts && Array.isArray(data.accounts)) {
                for (const acc of data.accounts) {
                    if (acc.accountId) {
                        const ref = doc(this.firestore, `users/${userId}/accounts/${acc.accountId}`);
                        batch.set(ref, acc);
                    }
                }
            }

            // 3. Import Transactions
            if (data.transactions && Array.isArray(data.transactions)) {
                for (const tx of data.transactions) {
                    if (tx.id) {
                        const ref = doc(this.firestore, `users/${userId}/transactions/${tx.id}`);
                        batch.set(ref, tx);
                    }
                }
            }

            await batch.commit();

        } catch (error) {
            console.error('Import failed:', error);
            throw error;
        }
    }

    /**
     * Get export file size limit
     */
    getFileSizeLimit(): number {
        return APP_CONFIG.EXPORT.MAX_RECORDS * 1024; // Approximate size in bytes
    }

    /**
     * Export all app data to a JSON file
     */
    async exportData(): Promise<void> {
        const isGuest = this.userService.isGuestUser();
        const userMode = isGuest ? 'guest' : 'logged-in';

        // Unified data collection ensuring offline compatibility
        const data = this.collectUnifiedData();

        const backup: BackupData = {
            version: APP_VERSION || '1.0.0',
            timestamp: new Date().toISOString(),
            userMode: userMode as any,
            data: data,
            schemaVersion: this.SCHEMA_VERSION
        };

        const filename = `Family-Expense-Tracker-backup-${new Date().toISOString().split('T')[0]}`;
        this.downloadJson(backup, filename);
    }

    /**
     * Import data from a backup object
     */
    async importData(backup: BackupData, mode: 'replace' | 'merge'): Promise<{ success: boolean; message: string; summary?: any }> {
        // 1. Validate basic shape
        // Allow missing schemaVersion for backward compatibility (assume version 0 or 1)
        if (!backup || !backup.data) {
            return { success: false, message: 'BACKUP.INVALID_FORMAT' };
        }

        // 2. Check schema version compatibility (if present)
        if (backup.schemaVersion && backup.schemaVersion > this.SCHEMA_VERSION) {
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

    /**
     * Handles the full restore process: confirmation dialog -> file reading -> import
     */
    handleRestore(file: File): Observable<{ success: boolean; message: string }> {
        return new Observable(observer => {
            const dialogRef = this.dialog.open(RestoreDialogComponent, {
                width: '450px'
            });

            dialogRef.afterClosed().subscribe(async (mode: RestoreMode | undefined) => {
                if (mode) {
                    try {
                        const backupData = await this.readJsonFile<BackupData>(file);
                        const result = await this.importData(backupData, mode);

                        if (result.success) {
                            observer.next({ success: true, message: result.message });
                        } else {
                            observer.next({ success: false, message: result.message });
                        }
                        observer.complete();
                    } catch (error) {
                        console.error('Error importing data:', error);
                        observer.next({ success: false, message: 'BACKUP.PARSE_ERROR' });
                        observer.complete();
                    }
                } else {
                    observer.complete();
                }
            });
        });
    }


    /**
     * Validates the structure of the imported transaction data.
     * @param data The parsed JSON data.
     * @returns An object indicating validity and an optional error message.
     */
    validateTransactionImport(data: any): { isValid: boolean; error?: string } {
        if (!Array.isArray(data)) {
            return { isValid: false, error: 'JSON file must contain an array of transactions.' };
        }

        if (data.length === 0) {
            return { isValid: false, error: 'JSON file is empty.' };
        }

        return { isValid: true };
    }

    /**
     * Parses and validates a transaction export file.
     * @param file The file to parse.
     * @returns A promise that resolves with the parsed and validated data.
     */
    async parseTransactionExport(file: File): Promise<any[]> {
        const jsonData = await this.readJsonFile(file);
        const validation = this.validateTransactionImport(jsonData);

        if (!validation.isValid) {
            throw new Error(validation.error || 'Invalid JSON format');
        }

        return jsonData;
    }

    private collectUnifiedData(): Record<string, any> {
        const allKeys = this.localStorageService.getAllKeys();
        const data: Record<string, any> = {};

        // Exclude some keys that shouldn't be backed up (like temp cache)
        const excludePrefixes = ['cache_', 'last-login-', 'firebase', 'sts'];

        allKeys.forEach(key => {
            if (!excludePrefixes.some(pref => key.startsWith(pref))) {
                data[key] = this.localStorageService.getItem(key);
            }
        });

        // If app_state exists, extract entities to guest keys
        this.extractGuestDataFromAppState(data);

        return data;
    }

    private extractGuestDataFromAppState(data: Record<string, any>): void {
        const appState = data[LocalStorageKey.APP_STATE] || data['app-state'];
        if (appState) {
            console.log('Exporting: Extracting entities from app_state for offline compatibility');

            // Helper to extract entities
            const extractEntities = (source: any, targetKey: LocalStorageKey) => {
                if (source && source.entities) {
                    const items = Object.values(source.entities);
                    if (items.length > 0) {
                        data[targetKey] = items;
                    }
                }
            };

            extractEntities(appState.transactions, LocalStorageKey.GUEST_TRANSACTIONS);
            extractEntities(appState.accounts, LocalStorageKey.GUEST_ACCOUNTS);
            extractEntities(appState.categories, LocalStorageKey.GUEST_CATEGORIES);

            // Remove app_state from export as requested
            delete data[LocalStorageKey.APP_STATE];
            delete data['app-state'];
        }
    }

    private async performReplaceImport(data: Record<string, any>): Promise<void> {
        // Clear all relevant app data first
        this.localStorageService.clear();

        // Populate with new data
        Object.entries(data).forEach(([key, value]) => {
            this.localStorageService.setItem(key, value);
        });
    }

    private async performMergeImport(data: Record<string, any>): Promise<void> {
        // Merging collections using simple optimization (Map)

        for (const [key, value] of Object.entries(data)) {
            if (Array.isArray(value)) {
                // It's a collection (accounts, categories, transactions)
                const existing = this.localStorageService.getItem<any[]>(key) || [];

                // Use a Map for O(1) lookup based on ID
                // ID resolution strategy: item.id (common) || item.accountId (accounts) || item.transactionId (transactions)
                const getId = (item: any) => item.id || item.accountId || item.transactionId;

                // Initialize map with existing items
                const validItemsMap = new Map<string, any>();

                existing.forEach(item => {
                    const id = getId(item);
                    if (id) validItemsMap.set(id, item);
                });

                // Merge new items (overwrite existing if collision, as this is a "Restore")
                (value as any[]).forEach(newItem => {
                    const id = getId(newItem);
                    if (id) {
                        validItemsMap.set(id, newItem);
                    } else {
                        // Item without ID? Push logic might handle it, but for now we might skip or generate ID. 
                        // Assuming valid entities have IDs.
                        // If no ID, we can't dedup, so maybe just add it? 
                        // Safe approach: only merge items with IDs.
                    }
                });

                this.localStorageService.setItem(key, Array.from(validItemsMap.values()));
            } else {
                // Single value setting (e.g. theme) -> Overwrite
                this.localStorageService.setItem(key, value);
            }
        }

        // Refresh app state
        // window.location.reload();
    }
}
