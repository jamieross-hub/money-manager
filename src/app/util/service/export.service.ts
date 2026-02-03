import { Injectable } from '@angular/core';
import { IExportService } from './interfaces';
import { Observable, from, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ExportFormat, CurrencyCode } from '../config/enums';
import { APP_CONFIG, ERROR_MESSAGES } from '../config/config';

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
 * Export service providing data export functionality in multiple formats
 */
import { Firestore, writeBatch, doc, collection } from '@angular/fire/firestore';

/**
 * Export service providing data export functionality in multiple formats
 */
@Injectable({
  providedIn: 'root'
})
export class ExportService implements IExportService {

  constructor(private firestore: Firestore) { }

  /**
   * Export data to CSV format
   */
  exportToCSV(data: any[], filename: string): void {
    try {
      const csvContent = this.convertToCSV(data);
      this.downloadFile(csvContent, filename, 'text/csv');
    } catch (error) {
      console.error('CSV export failed:', error);
      throw new Error(ERROR_MESSAGES.NETWORK.SERVER_ERROR);
    }
  }

  /**
   * Export data to PDF format
   */
  exportToPDF(data: any[], filename: string): void {
    try {
      const pdfContent = this.convertToPDF(data);
      this.downloadFile(pdfContent, filename, 'application/pdf');
    } catch (error) {
      console.error('PDF export failed:', error);
      throw new Error(ERROR_MESSAGES.NETWORK.SERVER_ERROR);
    }
  }

  /**
   * Export data to Excel format
   */
  exportToExcel(data: any[], filename: string): void {
    try {
      const excelContent = this.convertToExcel(data);
      this.downloadFile(excelContent, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } catch (error) {
      console.error('Excel export failed:', error);
      throw new Error(ERROR_MESSAGES.NETWORK.SERVER_ERROR);
    }
  }

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
   * Generate report in specified format
   */
  generateReport(data: any, format: string): Observable<Blob> {
    return from(this.generateReportAsync(data, format)).pipe(
      catchError(error => throwError(() => new Error(ERROR_MESSAGES.NETWORK.SERVER_ERROR)))
    );
  }

  private async generateReportAsync(data: any, format: string): Promise<Blob> {
    try {
      switch (format.toLowerCase()) {
        case 'csv':
          return this.generateCSVBlob(data);
        case 'pdf':
          return this.generatePDFBlob(data);
        case 'excel':
          return this.generateExcelBlob(data);
        case 'json':
          return this.generateJSONBlob(data);
        default:
          throw new Error(`Unsupported format: ${format}`);
      }
    } catch (error) {
      console.error('Report generation failed:', error);
      throw error;
    }
  }

  /**
   * Export transactions with advanced options
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

      switch (options.format) {
        case ExportFormat.CSV:
          blob = this.generateCSVBlob(processedData);
          filename += '.csv';
          break;
        case ExportFormat.PDF:
          blob = this.generatePDFBlob(processedData);
          filename += '.pdf';
          break;
        case ExportFormat.EXCEL:
          blob = this.generateExcelBlob(processedData);
          filename += '.xlsx';
          break;
        case ExportFormat.JSON:
          blob = this.generateJSONBlob(processedData);
          filename += '.json';
          break;
        default:
          throw new Error(`Unsupported format: ${options.format}`);
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
   * Export accounts data
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

      switch (options.format) {
        case ExportFormat.CSV:
          blob = this.generateCSVBlob(processedData);
          filename += '.csv';
          break;
        case ExportFormat.PDF:
          blob = this.generatePDFBlob(processedData);
          filename += '.pdf';
          break;
        case ExportFormat.EXCEL:
          blob = this.generateExcelBlob(processedData);
          filename += '.xlsx';
          break;
        case ExportFormat.JSON:
          blob = this.generateJSONBlob(processedData);
          filename += '.json';
          break;
        default:
          throw new Error(`Unsupported format: ${options.format}`);
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
   * Convert data to CSV format
   */
  private convertToCSV(data: any[]): string {
    if (!data || data.length === 0) {
      return '';
    }

    const headers = Object.keys(data[0]);
    const csvRows = [];

    // Add headers
    csvRows.push(headers.join(','));

    // Add data rows
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        // Escape commas and quotes
        const escapedValue = String(value).replace(/"/g, '""');
        return `"${escapedValue}"`;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }

  /**
   * Convert data to PDF format (simplified implementation)
   */
  private convertToPDF(data: any[]): string {
    // This is a simplified implementation
    // In a real application, you would use a library like jsPDF
    let pdfContent = '%PDF-1.4\n';
    pdfContent += '1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n';
    pdfContent += '2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n';

    // Add content
    let content = '';
    for (const row of data) {
      content += Object.values(row).join(' | ') + '\n';
    }

    pdfContent += `3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/Contents 4 0 R\n>>\nendobj\n`;
    pdfContent += `4 0 obj\n<<\n/Length ${content.length}\n>>\nstream\n${content}\nendstream\nendobj\n`;

    return pdfContent;
  }

  /**
   * Convert data to Excel format (simplified implementation)
   */
  private convertToExcel(data: any[]): string {
    // This is a simplified implementation
    // In a real application, you would use a library like SheetJS
    let excelContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
    excelContent += '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">\n';
    excelContent += '<sheets>\n<sheet name="Data" sheetId="1" r:id="rId1"/>\n</sheets>\n</workbook>';

    return excelContent;
  }

  /**
   * Generate CSV blob
   */
  private generateCSVBlob(data: any[]): Blob {
    const csvContent = this.convertToCSV(data);
    return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  }

  /**
   * Generate PDF blob
   */
  private generatePDFBlob(data: any[]): Blob {
    const pdfContent = this.convertToPDF(data);
    return new Blob([pdfContent], { type: 'application/pdf' });
  }

  /**
   * Generate Excel blob
   */
  private generateExcelBlob(data: any[]): Blob {
    const excelContent = this.convertToExcel(data);
    return new Blob([excelContent], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
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

    const currency = format || CurrencyCode.USD;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  /**
   * Get supported export formats
   */
  getSupportedFormats(): ExportFormat[] {
    return Object.values(ExportFormat);
  }

  /**
   * Get format MIME type
   */
  getFormatMimeType(format: ExportFormat): string {
    switch (format) {
      case ExportFormat.CSV:
        return 'text/csv';
      case ExportFormat.PDF:
        return 'application/pdf';
      case ExportFormat.EXCEL:
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case ExportFormat.JSON:
        return 'application/json';
      default:
        return 'application/octet-stream';
    }
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
          // We use set() with merge: true or just overwrite to ensure ID is preserved
          // Assuming 'id' field is present in category object.
          // If export includes 'id', we use it. If not, we can't link, but Guest Mode IDs are usually UUIDs generated by client or simple strings.
          // We MUST assume export data has 'id'.
          if (cat.id) {
            const ref = doc(this.firestore, `users/${userId}/categories/${cat.id}`);
            batch.set(ref, cat);
          }
        }
      }

      // 2. Import Accounts
      if (data.accounts && Array.isArray(data.accounts)) {
        for (const acc of data.accounts) {
          if (acc.accountId) { // Accounts usually use 'accountId' in this app based on previous files
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