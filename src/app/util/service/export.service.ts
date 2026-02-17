import { Injectable } from '@angular/core';
import { IExportService } from './interfaces';
import { Observable, from, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ExportFormat } from '../config/enums';
import { APP_CONFIG, ERROR_MESSAGES } from '../config/config';
import { CurrencyService } from './currency.service';
import { Firestore, writeBatch, doc } from '@angular/fire/firestore';

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

/**
 * Export service providing data export functionality in JSON format
 */
@Injectable({
  providedIn: 'root'
})
export class ExportService implements IExportService {

  constructor(
    private firestore: Firestore,
    private currencyService: CurrencyService
  ) { }

  /**
   * Export data to JSON format
   */
  exportToJSON(data: any, filename: string): void {
    try {
      const jsonContent = JSON.stringify(data, null, 2);
      this.downloadFile(jsonContent, filename, 'application/json');
    } catch (error) {
      console.error('JSON export failed:', error);
      throw new Error(ERROR_MESSAGES.NETWORK.SERVER_ERROR);
    }
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
   * Export transactions with advanced options (JSON only)
   */
  exportTransactions(transactions: any[], options: ExportOptions): Observable<ExportResult> {
    return from(this.exportTransactionsAsync(transactions, options)).pipe(
      catchError(error => throwError(() => new Error(error.message || ERROR_MESSAGES.NETWORK.SERVER_ERROR)))
    );
  }

  private async exportTransactionsAsync(transactions: any[], options: ExportOptions): Promise<ExportResult> {
    try {
      const processedData = this.processTransactionData(transactions, options);
      let blob: Blob;
      let filename = options.filename || `transactions_${new Date().toISOString().split('T')[0]}`;

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
   * Export full backup (transactions, accounts, categories)
   */
  exportFullBackup(data: { transactions: any[], accounts: any[], categories: any[] }, filename?: string): void {
    try {
      const backupData = {
        timestamp: new Date().toISOString(),
        version: 1,
        ...data
      };

      const name = filename || `money_manager_backup_${new Date().toISOString().split('T')[0]}`;
      this.exportToJSON(backupData, name);
    } catch (error) {
      console.error('Full backup export failed:', error);
      throw new Error(ERROR_MESSAGES.NETWORK.SERVER_ERROR);
    }
  }

  /**
   * Export accounts data (JSON only)
   */
  exportAccounts(accounts: any[], options: ExportOptions): Observable<ExportResult> {
    return from(this.exportAccountsAsync(accounts, options)).pipe(
      catchError(error => throwError(() => new Error(error.message || ERROR_MESSAGES.NETWORK.SERVER_ERROR)))
    );
  }

  private async exportAccountsAsync(accounts: any[], options: ExportOptions): Promise<ExportResult> {
    try {
      const processedData = this.processAccountData(accounts, options);
      let blob: Blob;
      let filename = options.filename || `accounts_${new Date().toISOString().split('T')[0]}`;

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
   * Generate JSON blob
   */
  private generateJSONBlob(data: any): Blob {
    const jsonContent = JSON.stringify(data, null, 2);
    return new Blob([jsonContent], { type: 'application/json' });
  }

  /**
   * Download file to user's device
   */
  private downloadFile(content: string | Blob, filename: string, mimeType: string): void {
    const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  /**
   * Process transaction data for export
   */
  private processTransactionData(transactions: any[], options: ExportOptions): any[] {
    return transactions.map(transaction => ({
      Date: this.formatDate(transaction.date, options.dateFormat),
      Payee: transaction.payee,
      Amount: this.formatCurrency(transaction.amount, options.currencyFormat),
      Type: transaction.type,
      Category: transaction.category,
      Account: transaction.account,
      Notes: transaction.notes || '',
      Status: transaction.status
    }));
  }

  /**
   * Process account data for export
   */
  private processAccountData(accounts: any[], options: ExportOptions): any[] {
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

    const dateObj = date instanceof Date ? date : new Date(date);
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
} 