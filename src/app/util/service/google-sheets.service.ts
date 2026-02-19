import { Injectable } from '@angular/core';
import { BaseService } from './base.service';
import { Firestore, collection, doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, Timestamp, addDoc, onSnapshot, writeBatch, serverTimestamp } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, from, throwError, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { CurrencyService } from './currency.service';

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  sheetName: string;
}

export interface GoogleSheetsConnection {
  id: string;
  name: string;
  spreadsheetUrl: string;
  spreadsheetId: string;
  sheetName: string;
  isActive: boolean;
  lastSync?: Date;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class GoogleSheetsService extends BaseService {
  private readonly COLLECTION_NAME = 'googleSheets';

  constructor(
    protected override readonly firestore: Firestore,
    protected override readonly auth: Auth,
    protected override readonly currencyService: CurrencyService
  ) {
    super(firestore, auth, currencyService);
  }

  /**
   * Extract spreadsheet ID from Google Sheets URL
   */
  extractSpreadsheetId(url: string): string | null {
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname === 'docs.google.com' && urlObj.pathname.includes('/spreadsheets/d/')) {
        const pathParts = urlObj.pathname.split('/');
        const spreadsheetIndex = pathParts.findIndex(part => part === 'd');
        if (spreadsheetIndex !== -1 && pathParts[spreadsheetIndex + 1]) {
          return pathParts[spreadsheetIndex + 1];
        }
      }
      return null;
    } catch (error) {
      console.error('Error extracting spreadsheet ID:', error);
      return null;
    }
  }

  /**
   * Validate Google Sheets URL format
   */
  validateSheetUrl(url: string): boolean {
    const spreadsheetId = this.extractSpreadsheetId(url);
    return !!spreadsheetId;
  }

  /**
   * Get all Google Sheets connections for the current user
   */
  getConnections(): Observable<GoogleSheetsConnection[]> {
    try {
      const collectionRef = this.getCollectionRef(this.COLLECTION_NAME);

      return from(getDocs(collectionRef)).pipe(
        map(snapshot => {
          return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as GoogleSheetsConnection));
        }),
        catchError(error => this.handleError(error, 'getConnections'))
      );
    } catch (error) {
      return this.handleError(error, 'getConnections');
    }
  }

  /**
   * Create a new Google Sheets connection
   */
  createConnection(connection: Omit<GoogleSheetsConnection, 'id' | 'createdAt' | 'updatedAt'>): Observable<GoogleSheetsConnection> {
    try {

      // Extract spreadsheet ID from URL
      const spreadsheetId = this.extractSpreadsheetId(connection.spreadsheetUrl);
      if (!spreadsheetId) {
        return throwError(() => new Error('Invalid Google Sheets URL'));
      }

      const newConnection: GoogleSheetsConnection = {
        ...connection,
        spreadsheetId,
        id: this.generateId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const docRef = this.getDocumentRef(this.COLLECTION_NAME, newConnection.id);

      return from(setDoc(docRef, newConnection)).pipe(
        map(() => newConnection),
        catchError(error => this.handleError(error, 'createConnection'))
      );
    } catch (error) {
      return this.handleError(error, 'createConnection');
    }
  }

  /**
   * Update an existing Google Sheets connection
   */
  updateConnection(id: string, updates: Partial<GoogleSheetsConnection>): Observable<void> {
    try {
      const docRef = this.getDocumentRef(this.COLLECTION_NAME, id);
      const updateData = {
        ...updates,
        updatedAt: new Date()
      };

      return from(updateDoc(docRef, updateData)).pipe(
        catchError(error => this.handleError(error, 'updateConnection'))
      );
    } catch (error) {
      return this.handleError(error, 'updateConnection');
    }
  }

  /**
   * Delete a Google Sheets connection
   */
  deleteConnection(id: string): Observable<void> {
    try {
      const docRef = this.getDocumentRef(this.COLLECTION_NAME, id);

      return from(deleteDoc(docRef)).pipe(
        catchError(error => this.handleError(error, 'deleteConnection'))
      );
    } catch (error) {
      return this.handleError(error, 'deleteConnection');
    }
  }

  /**
   * Test connection to Google Sheets (read-only)
   */
  testConnection(config: GoogleSheetsConfig): Observable<boolean> {
    try {
      // For read-only access, we'll use a simple fetch to check if the sheet is accessible
      // This works for publicly shared sheets or sheets shared with "Anyone with the link can view"
      const url = `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${config.sheetName}`;

      return from(fetch(url, { method: 'HEAD' })).pipe(
        map(response => {
          return response.ok;
        }),
        catchError(error => {
          console.error('Google Sheets connection test failed:', error);
          return of(false);
        })
      );
    } catch (error) {
      return of(false);
    }
  }

  /**
   * Import data from Google Sheets (read-only)
   */
  importFromSheet(config: GoogleSheetsConfig): Observable<any[]> {
    try {
      // Use Google Sheets CSV export for read-only access
      const url = `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${config.sheetName}`;

      return from(fetch(url)).pipe(
        switchMap(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return from(response.text());
        }),
        map((csvText: string) => {
          if (!csvText || csvText.trim() === '') {
            return [];
          }

          // Parse CSV data
          const lines = csvText.split('\n');
          if (lines.length < 2) {
            return [];
          }

          // Parse headers
          const headers = this.parseCSVLine(lines[0]);
          const rows = lines.slice(1).filter(line => line.trim() !== '');

          return rows.map(line => {
            const values = this.parseCSVLine(line);
            const obj: any = {};
            headers.forEach((header: string, index: number) => {
              obj[header] = values[index] || '';
            });
            return obj;
          });
        }),
        catchError(error => this.handleError(error, 'importFromSheet'))
      );
    } catch (error) {
      return this.handleError(error, 'importFromSheet');
    }
  }

  /**
   * Parse CSV line (handles quoted values)
   */
  private parseCSVLine(line: string): string[] {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  /**
   * Export data to Google Sheets (read-only - this will be disabled)
   */
  exportToSheet(config: GoogleSheetsConfig, data: any[]): Observable<boolean> {
    // Read-only mode - export is not supported
    return throwError(() => new Error('Export is not supported in read-only mode. Please use the Google Sheets interface to edit data.'));
  }

  /**
   * Get Google Sheets setup instructions for read-only access
   */
  getSetupInstructions(): string[] {
    return [
      '1. Use the "Get Example Sheet" button below to open a template you can copy',
      '2. In the example sheet, click "File" → "Make a copy" to create your own version',
      '3. Open your copied Google Sheet in the browser',
      '4. Click "Share" in the top right corner',
      '5. Set sharing to "Anyone with the link can view"',
      '6. Copy the URL from your browser address bar',
      '7. Paste the URL in the "Sheet URL" field below',
      '8. Enter the name of the specific sheet tab (e.g., "Sheet1", "Transactions")',
      '9. Test the connection to verify access',
      'Note: This is read-only access for data import only'
    ];
  }

  /**
   * Get Google Sheets documentation URL
   */
  getApiDocsUrl(): string {
    return 'https://support.google.com/docs/answer/2494822?hl=en';
  }
} 