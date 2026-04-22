import { Injectable } from '@angular/core';
import { BaseService } from './base.service';
import { Firestore, collection, doc, setDoc, updateDoc, deleteDoc, getDocs, onSnapshot, query, orderBy } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, from, throwError, of, BehaviorSubject } from 'rxjs';
import { catchError, map, tap, switchMap, timeout } from 'rxjs/operators';
import { CurrencyService } from './currency.service';
import { LocalIndexDBStorageService } from './indexdb-storage.service';
import { LocalStorageKeyHelper } from '../models/local-storage.model';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { UserService } from './db/user.service';

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  sheetName: string;
}

export interface GoogleSheetsConnection {
  id: string;
  userId?: string;
  name: string;
  spreadsheetUrl: string;
  spreadsheetId: string;
  sheetName: string;
  isActive: boolean;
  lastSync?: Date | any;
  createdAt: Date | any;
  updatedAt: Date | any;
}

@Injectable({
  providedIn: 'root'
})
export class GoogleSheetsService extends BaseService {
  private readonly COLLECTION_NAME = 'googleSheets';
  private connectionsSubject = new BehaviorSubject<GoogleSheetsConnection[]>([]);
  private activeListenerPath: string | null = null;

  constructor(
    protected override readonly firestore: Firestore,
    protected override readonly auth: Auth,
    protected override readonly currencyService: CurrencyService,
    private readonly storageService: LocalIndexDBStorageService,
    private readonly store: Store<AppState>,
    private readonly userService: UserService
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
    const userId = this.userService.getCurrentUserId();
    if (!userId) return of([]);

    return this.storageService.isReady$.pipe(
      switchMap(() => {
        // 1. Emit cached connections immediately
        const cacheKey = LocalStorageKeyHelper.getGoogleSheetsCacheKey(userId);
        const cached = this.storageService.getItem<GoogleSheetsConnection[]>(cacheKey) || [];
        if (cached.length > 0) {
          this.connectionsSubject.next(cached);
        }

        // 2. Return reactive subject
        return this.connectionsSubject.asObservable();
      })
    );
  }

  /**
   * Set up a real-time listener for connections
   */
  listenToConnections(userId: string): Observable<void> {
    if (!userId || userId === 'offline-guest') return of(undefined);

    const currentPath = `users/${userId}/${this.COLLECTION_NAME}`;
    if (this.activeListenerPath === currentPath) {
      return of(undefined);
    }
    this.activeListenerPath = currentPath;

    return new Observable<void>(observer => {
      const collectionRef = query(
        collection(this.firestore, currentPath),
        orderBy('createdAt', 'desc')
      );

      console.log(`[GoogleSheetsService] 🔌 Starting real-time listener for connections: ${userId}`);

      const unsubscribe = onSnapshot(collectionRef, (snap) => {
        const connections: GoogleSheetsConnection[] = [];
        snap.forEach(docSnap => {
          const data = docSnap.data() as any;
          connections.push({
            ...data,
            id: docSnap.id,
            // Convert Timestamps to Dates if necessary
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
            lastSync: data.lastSync?.toDate ? data.lastSync.toDate() : data.lastSync
          });
        });

        const cacheKey = LocalStorageKeyHelper.getGoogleSheetsCacheKey(userId);
        this.storageService.setItem(cacheKey, connections);
        this.connectionsSubject.next(connections);
        
        observer.next();
      }, (error) => {
        console.warn(`[GoogleSheetsService] ⚠️ Real-time listener failed:`, error);
        observer.complete();
      });

      return () => {
        this.activeListenerPath = null;
        unsubscribe();
      };
    });
  }

  /**
   * Pull connections from Firestore and update local cache
   */
  pullFromFirestore(userId: string): Observable<void> {
    if (!userId || userId === 'offline-guest') return of(undefined);

    const currentPath = `users/${userId}/${this.COLLECTION_NAME}`;
    const collectionRef = collection(this.firestore, currentPath);

    console.log(`[GoogleSheetsService] Pulling connections for user: ${userId}`);

    return from(getDocs(collectionRef)).pipe(
      timeout(10000),
      tap(snapshot => {
        const connections = snapshot.docs.map(docSnap => {
          const data = docSnap.data() as any;
          return {
            ...data,
            id: docSnap.id,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
            lastSync: data.lastSync?.toDate ? data.lastSync.toDate() : data.lastSync
          };
        });

        console.log(`[GoogleSheetsService] Pulled ${connections.length} connections from Firestore`);

        const cacheKey = LocalStorageKeyHelper.getGoogleSheetsCacheKey(userId);
        this.storageService.setItem(cacheKey, connections);
        this.connectionsSubject.next(connections);
      }),
      map(() => undefined),
      catchError(error => {
        console.error('[GoogleSheetsService] Pull failed:', error);
        return of(undefined);
      })
    );
  }

  /**
   * Create a new Google Sheets connection
   */
  createConnection(connection: Omit<GoogleSheetsConnection, 'id' | 'createdAt' | 'updatedAt'>): Observable<GoogleSheetsConnection> {
    const userId = this.userService.getCurrentUserId();
    if (!userId) return throwError(() => new Error('User not authenticated'));

    try {
      const spreadsheetId = this.extractSpreadsheetId(connection.spreadsheetUrl);
      if (!spreadsheetId) {
        return throwError(() => new Error('Invalid Google Sheets URL'));
      }

      const id = this.generateId();
      const newConnection: GoogleSheetsConnection = {
        ...connection,
        id,
        userId,
        spreadsheetId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const docRef = doc(this.firestore, `users/${userId}/${this.COLLECTION_NAME}/${id}`);

      // Optimistic update
      const currentConnections = this.connectionsSubject.value;
      this.connectionsSubject.next([newConnection, ...currentConnections]);
      const cacheKey = LocalStorageKeyHelper.getGoogleSheetsCacheKey(userId);
      this.storageService.setItem(cacheKey, [newConnection, ...currentConnections]);

      return from(setDoc(docRef, this.scrubUndefined(newConnection))).pipe(
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
    const userId = this.userService.getCurrentUserId();
    if (!userId) return throwError(() => new Error('User not authenticated'));

    try {
      const docRef = doc(this.firestore, `users/${userId}/${this.COLLECTION_NAME}/${id}`);
      const updateData = {
        ...updates,
        updatedAt: new Date()
      };

      // Optimistic update
      const currentConnections = this.connectionsSubject.value;
      const index = currentConnections.findIndex(c => c.id === id);
      if (index !== -1) {
        const updated = { ...currentConnections[index], ...updateData };
        const newConnections = [...currentConnections];
        newConnections[index] = updated;
        this.connectionsSubject.next(newConnections);
        const cacheKey = LocalStorageKeyHelper.getGoogleSheetsCacheKey(userId);
        this.storageService.setItem(cacheKey, newConnections);
      }

      return from(updateDoc(docRef, this.scrubUndefined(updateData))).pipe(
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
    const userId = this.userService.getCurrentUserId();
    if (!userId) return throwError(() => new Error('User not authenticated'));

    try {
      const docRef = doc(this.firestore, `users/${userId}/${this.COLLECTION_NAME}/${id}`);

      // Optimistic update
      const currentConnections = this.connectionsSubject.value;
      const newConnections = currentConnections.filter(c => c.id !== id);
      this.connectionsSubject.next(newConnections);
      const cacheKey = LocalStorageKeyHelper.getGoogleSheetsCacheKey(userId);
      this.storageService.setItem(cacheKey, newConnections);

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
      // Use GET with a minimal range to check accessibility robustly without heavy data transfer
      // range=A1:A1 ensures we only try to read one cell
      const url = `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(config.sheetName)}&range=A1:A1`;

      return from(fetch(url)).pipe(
        timeout(5000),
        map(response => response.ok),
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
      const url = `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(config.sheetName)}`;

      return from(fetch(url)).pipe(
        timeout(15000),
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
    return throwError(() => new Error('Export is not supported in read-only mode.'));
  }

  /**
   * Get Google Sheets setup instructions
   */
  getSetupInstructions(): string[] {
    return [
      '1. Use the "Get Example Sheet" button below to open a template you can copy',
      '2. In the example sheet, click "File" → "Make a copy" to create your own version',
      '3. Open your copied Google Sheet in the browser',
      '4. Click "Share" in the top right corner',
      '5. Set sharing to "Anyone with the link" and select "Editor" role',
      '6. Copy the URL from your browser address bar',
      '7. Paste the URL in the "Sheet URL" field below',
      '8. Enter the name of the specific sheet tab (e.g., "Import Transactions")',
      '9. Test the connection to verify access',
      'Note: This requires Editor access to support both data import and automated backups'
    ];
  }

  /**
   * Get Google Sheets documentation URL
   */
  getApiDocsUrl(): string {
    return 'https://support.google.com/docs/answer/2494822?hl=en';
  }
}
 