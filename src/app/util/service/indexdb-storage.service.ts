import { Injectable } from '@angular/core';
import { LocalStorageKey, LocalStorageKeyHelper } from '../models/local-storage.model';
import { BehaviorSubject } from 'rxjs';
import { filter, take } from 'rxjs/operators';

/**
 * Hybrid LocalStorage Service (IndexedDB + In-Memory Cache)
 * 
 * Provides a synchronous API (via in-memory cache) backed by asynchronous IndexedDB persistence.
 * This ensures high performance for reads while breaking away from the blocking localStorage API.
 * 
 * MUST be initialized via APP_INITIALIZER to ensure cache is hot before app startup.
 */
@Injectable({
    providedIn: 'root'
})
export class LocalIndexDBStorageService {

    // Expose helper for external use
    public readonly keyHelper = LocalStorageKeyHelper;

    private static instance: LocalIndexDBStorageService | null = null;

    private readonly DB_NAME = 'MoneyManagerDB';
    private readonly STORE_NAME = 'keyValueStore';
    private readonly TRANSACTIONS_STORE = 'transactions';
    private readonly DB_VERSION = 4;
    private db: IDBDatabase | null = null;

    // In-memory caches for synchronous access
    private keyValueCache = new Map<string, any>();
    private transactionsCache = new Map<string, any>();
    
    // Secondary in-memory indices for O(1) synchronous lookups
    private familyIdIndex = new Map<string, Set<string>>(); // familyId -> Set of transaction keys
    private userIdIndex = new Map<string, Set<string>>();   // userId -> Set of transaction keys
    private accountIdIndex = new Map<string, Set<string>>(); // accountId -> Set of transaction keys
    private isInitialized = false;
    private isCleaningUp = false;
    private readonly initializedSubject = new BehaviorSubject<boolean>(false);
    public readonly isReady$ = this.initializedSubject.asObservable().pipe(
        filter(ready => ready),
        take(1)
    );

    constructor() {
        LocalIndexDBStorageService.instance = this;
    }

    /**
     * Get the singleton instance (for non-DI contexts like APP_INITIALIZER)
     */
    public static getInstance(): LocalIndexDBStorageService {
        if (!LocalIndexDBStorageService.instance) {
            LocalIndexDBStorageService.instance = new LocalIndexDBStorageService();
        }
        return LocalIndexDBStorageService.instance;
    }


    /**
     * Initialize the service: Open DB and load all data into cache
     * Called during APP_INITIALIZER
     */
    async initialize(): Promise<void> {
        if (this.isInitialized && !this.isCleaningUp) return;

        console.log('📦 Initializing Hybrid Storage Service...');

        try {
            await this.openDatabase();
            await this.loadCacheFromDb();
            
            // Post-initialization: Migrate transaction data if needed
            await this.migrateIfNeeded();
            
            console.log(`✅ Storage initialized. KeyValue: ${this.keyValueCache.size}, Transactions: ${this.transactionsCache.size}`);
            this.isInitialized = true;
            this.isCleaningUp = false;
            this.initializedSubject.next(true);
        } catch (error) {
            console.error('❌ Failed to initialize storage service:', error);
            // Fallback: try to load what we can or operate in memory-only mode if DB fails
        }
    }

    /**
     * Set an item (Sync API, Async Persistence)
     */
    setItem<T>(key: string, value: T, storeName: string = this.STORE_NAME): void {
        if (this.isCleaningUp) {
            console.warn(`⚠️ Blocked write to ${storeName} for key "${key}" - Service is cleaning up.`);
            return;
        }

        // Update correct cache immediately
        if (storeName === this.TRANSACTIONS_STORE) {
            const oldValue = this.transactionsCache.get(key);
            this.transactionsCache.set(key, value);
            this.updateSecondaryIndices(key, value, oldValue);
        } else {
            this.keyValueCache.set(key, value);
        }

        // Persist to DB asynchronously
        this.persistItem(key, value, storeName).catch(err => {
            console.error(`Error persisting key "${key}" to store "${storeName}":`, err);
        });
    }
    
    /**
     * Set a transaction item (Convenience method)
     */
    setTransaction<T>(key: string, value: T): void {
        this.setItem(key, value, this.TRANSACTIONS_STORE);
    }

    /**
     * Get all transaction keys (synchronous)
     */
    getTransactionKeys(): string[] {
        return Array.from(this.transactionsCache.keys());
    }

    /**
     * Get all transactions (synchronous)
     */
    getAllTransactionsSync(): any[] {
        return Array.from(this.transactionsCache.values());
    }

    /**
     * Get transactions by familyId (Sync via Cache)
     */
    getTransactionsByFamilyIdSync(familyId: string): any[] {
        const keys = this.familyIdIndex.get(familyId);
        if (!keys) return [];
        return Array.from(keys).map(key => this.transactionsCache.get(key)).filter(Boolean);
    }

    /**
     * Get transactions by userId (Sync via Cache)
     */
    getTransactionsByUserIdSync(userId: string): any[] {
        const keys = this.userIdIndex.get(userId);
        if (!keys) return [];
        // Personal mode: Filter out family transactions (Set logic ensures O(1) lookup vs linear filter)
        return Array.from(keys)
            .map(key => this.transactionsCache.get(key))
            .filter(tx => tx && tx.userId === userId && !tx.familyId);
    }

    /**
     * Get transactions by accountId (Sync via Cache)
     */
    getTransactionsByAccountIdSync(accountId: string): any[] {
        const keys = this.accountIdIndex.get(accountId);
        if (!keys) return [];
        return Array.from(keys).map(key => this.transactionsCache.get(key)).filter(Boolean);
    }

    /**
     * Get transactions by userId (Async via IndexedDB Index)
     */
    async getTransactionsByUserId(userId: string): Promise<any[]> {
        if (!this.db) {
            return this.getTransactionsByUserIdSync(userId);
        }

        return this.queryIndex('userId', userId);
    }

    /**
     * Helper to query any index
     */
    private async queryIndex(indexName: string, value: any): Promise<any[]> {
        if (!this.db) return [];

        return new Promise((resolve) => {
            try {
                const transaction = this.db!.transaction([this.TRANSACTIONS_STORE], 'readonly');
                const store = transaction.objectStore(this.TRANSACTIONS_STORE);
                const index = store.index(indexName);
                const request = index.getAll(value);

                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => {
                    console.error(`IndexedDB Index Error (${indexName}):`, request.error);
                    resolve([]);
                };
            } catch (error) {
                console.error(`Error querying ${indexName} index:`, error);
                resolve([]);
            }
        });
    }

    /**
     * Get transactions by familyId (Async via IndexedDB Index)
     */
    async getTransactionsByFamilyId(familyId: string): Promise<any[]> {
        if (!this.db) {
            return this.getTransactionsByFamilyIdSync(familyId);
        }

        return new Promise((resolve) => {
            try {
                const transaction = this.db!.transaction([this.TRANSACTIONS_STORE], 'readonly');
                const store = transaction.objectStore(this.TRANSACTIONS_STORE);
                const index = store.index('familyId');
                const request = index.getAll(familyId);

                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => {
                    console.error('IndexedDB Index Error:', request.error);
                    resolve(this.getTransactionsByFamilyIdSync(familyId));
                };
            } catch (error) {
                console.error('Error querying familyId index:', error);
                resolve(this.getTransactionsByFamilyIdSync(familyId));
            }
        });
    }

    /**
     * Clear the in-memory caches
     */
    clearMemoryCache(): void {
        this.keyValueCache.clear();
        this.transactionsCache.clear();
    }

    /**
     * Get an item (Sync API, Read from Cache)
     */
    getItem<T>(key: string, storeName: string = this.STORE_NAME): T | null {
        const cache = storeName === this.TRANSACTIONS_STORE ? this.transactionsCache : this.keyValueCache;
        const value = cache.get(key);

        if (value === undefined || value === null) {
            return null;
        }

        // Deep copy to prevent reference mutation issues
        return structuredClone(value) as T;
    }

    /**
     * Remove an item (Sync API, Async Persistence)
     */
    removeItem(key: string, storeName: string = this.STORE_NAME): void {
        if (this.isCleaningUp) {
            console.warn(`⚠️ Blocked remove from ${storeName} for key "${key}" - Service is cleaning up.`);
            return;
        }

        if (storeName === this.TRANSACTIONS_STORE) {
            const oldValue = this.transactionsCache.get(key);
            this.transactionsCache.delete(key);
            if (oldValue) this.updateSecondaryIndices(key, null, oldValue);
        } else {
            this.keyValueCache.delete(key);
        }

        this.deleteItem(key, storeName).catch(err => {
            console.error(`Error deleting key "${key}" from store "${storeName}":`, err);
        });
    }
    
    /**
     * Remove a transaction item
     */
    removeTransaction(key: string): void {
        this.removeItem(key, this.TRANSACTIONS_STORE);
    }

    /**
     * Clear all data
     */
    async clear(): Promise<void> {
        this.isCleaningUp = true;
        this.keyValueCache.clear();
        this.transactionsCache.clear();
        this.familyIdIndex.clear();
        this.userIdIndex.clear();
        this.accountIdIndex.clear();

        try {
            await this.clearDb();
            // We keep isCleaningUp = true until next initialization
            console.log('🧹 Storage service cleared and writes blocked.');
        } catch (err) {
            console.error('Error clearing database:', err);
            // Allow retry of clear, but keep blocking writes
            throw err;
        }
    }

    /**
     * Check if item exists
     */
    hasItem(key: string, storeName: string = this.STORE_NAME): boolean {
        const cache = storeName === this.TRANSACTIONS_STORE ? this.transactionsCache : this.keyValueCache;
        return cache.has(key);
    }

    /**
     * Get all keys
     */
    getAllKeys(): string[] {
        return [...Array.from(this.keyValueCache.keys()), ...Array.from(this.transactionsCache.keys())];
    }

    // ==========================================
    // Internal IndexedDB Operations
    // ==========================================

    private openDatabase(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            request.onerror = (event) => {
                console.error('IndexedDB error:', request.error);
                reject(request.error);
            };

            request.onsuccess = (event) => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
                const db = request.result;
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    db.createObjectStore(this.STORE_NAME);
                }
                
                let transactionStore: IDBObjectStore;
                if (!db.objectStoreNames.contains(this.TRANSACTIONS_STORE)) {
                    transactionStore = db.createObjectStore(this.TRANSACTIONS_STORE);
                } else {
                    transactionStore = request.transaction!.objectStore(this.TRANSACTIONS_STORE);
                }

                // Create familyId index for efficient filtering
                if (!transactionStore.indexNames.contains('familyId')) {
                    transactionStore.createIndex('familyId', 'familyId', { unique: false });
                    console.log('📦 Created familyId index on transactions store');
                }

                // Create userId index for multi-user support
                if (!transactionStore.indexNames.contains('userId')) {
                    transactionStore.createIndex('userId', 'userId', { unique: false });
                    console.log('📦 Created userId index on transactions store');
                }

                // Create date index for efficient sorting
                if (!transactionStore.indexNames.contains('date')) {
                    transactionStore.createIndex('date', 'date', { unique: false });
                    console.log('📦 Created date index on transactions store');
                }

                // Create accountId/categoryId indices for reporting/filtering
                if (!transactionStore.indexNames.contains('accountId')) {
                    transactionStore.createIndex('accountId', 'accountId', { unique: false });
                }
                if (!transactionStore.indexNames.contains('categoryId')) {
                    transactionStore.createIndex('categoryId', 'categoryId', { unique: false });
                }
            };
        });
    }

    private loadCacheFromDb(): Promise<void> {
        return new Promise(async (resolve, reject) => {
            if (!this.db) {
                return reject(new Error('Database not open'));
            }

            try {
                // Load from both stores
                await this.loadStoreIntoCache(this.STORE_NAME);
                await this.loadStoreIntoCache(this.TRANSACTIONS_STORE);
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    private loadStoreIntoCache(storeName: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.db || !this.db.objectStoreNames.contains(storeName)) {
                return resolve();
            }

            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.openCursor();

            request.onsuccess = (event: any) => {
                const cursor = event.target.result;
                if (cursor) {
                    if (storeName === this.TRANSACTIONS_STORE) {
                        this.transactionsCache.set(cursor.key as string, cursor.value);
                        this.updateSecondaryIndices(cursor.key as string, cursor.value);
                    } else {
                        this.keyValueCache.set(cursor.key as string, cursor.value);
                    }
                    cursor.continue();
                } else {
                    resolve();
                }
            };

            request.onerror = () => reject(request.error);
        });
    }

    private async migrateIfNeeded(): Promise<void> {
        if (!this.db) return;

        const txPrefix = 'tx_';
        const txCacheKey = 'transactions-cache';
        
        // 1. Migrate anything that might still be in the flat keyValueCache to transactions store
        const keysToMigrate = Array.from(this.keyValueCache.keys()).filter(key => 
            key.startsWith(txPrefix)
        );

        if (keysToMigrate.length > 0) {
            console.log(`📦 Migrating ${keysToMigrate.length} items to dedicated transaction store...`);
            for (const oldKey of keysToMigrate) {
                const value = this.keyValueCache.get(oldKey);
                // Remove prefix for new store storage
                const newKey = oldKey.startsWith(txPrefix) ? oldKey.substring(txPrefix.length) : oldKey;
                
                await this.deleteItem(oldKey, this.STORE_NAME);
                
                this.keyValueCache.delete(oldKey);
                this.transactionsCache.set(newKey, value);
                await this.persistItem(newKey, value, this.TRANSACTIONS_STORE);
            }
        }

        // 2. "Unpack" any transactions-cache arrays into individual items and delete the array key
        const collectionKeys = Array.from(this.keyValueCache.keys()).filter(key => 
            key.includes(txCacheKey)
        );

        if (collectionKeys.length > 0) {
            console.log(`📦 Unpacking ${collectionKeys.length} transaction collections...`);
            for (const key of collectionKeys) {
                const value = this.keyValueCache.get(key);
                if (Array.isArray(value)) {
                    // Extract familyId from key if present
                    // Key format: transactions-cache-uid-familyId
                    const parts = key.split('-');
                    const familyId = parts.length > 3 ? parts[3] : undefined;
                    
                    for (const tx of value) {
                        if (tx && tx.id) {
                            const itemKey = tx.id;
                            // Save as individual item in the transactions cache and store
                            this.transactionsCache.set(itemKey, tx);
                            await this.persistItem(itemKey, tx, this.TRANSACTIONS_STORE);
                        }
                    }
                }
                // Delete the collection key from wherever it might be
                this.keyValueCache.delete(key);
                this.transactionsCache.delete(key);
                await this.deleteItem(key, this.STORE_NAME);
                await this.deleteItem(key, this.TRANSACTIONS_STORE);
            }
            console.log('✅ Unpacking complete.');
        }

        // 3. Re-key existing family transactions that use the familyId_prefix
        const prefixedKeys = Array.from(this.transactionsCache.keys()).filter(key => 
            key.includes('_') && !key.startsWith(txPrefix)
        );

        if (prefixedKeys.length > 0) {
            console.log(`📦 Re-keying ${prefixedKeys.length} prefixed transactions...`);
            for (const oldKey of prefixedKeys) {
                const value = this.transactionsCache.get(oldKey);
                if (!value) continue;
                
                const newKey = value.id;
                
                if (newKey && newKey !== oldKey) {
                    await this.deleteItem(oldKey, this.TRANSACTIONS_STORE);
                    this.transactionsCache.delete(oldKey);
                    
                    this.transactionsCache.set(newKey, value);
                    await this.persistItem(newKey, value, this.TRANSACTIONS_STORE);
                }
            }
        }

        if (keysToMigrate.length > 0 || collectionKeys.length > 0 || prefixedKeys.length > 0) {
            console.log('✅ Overall transaction storage migration complete.');
        }
    }

    /**
     * Update secondary in-memory indices for transactions
     */
    private updateSecondaryIndices(key: string, newValue: any, oldValue?: any): void {
        const removeFromIndex = (index: Map<string, Set<string>>, id: string | undefined) => {
            if (!id) return;
            const set = index.get(id);
            if (set) {
                set.delete(key);
                if (set.size === 0) index.delete(id);
            }
        };

        const addToIndex = (index: Map<string, Set<string>>, id: string | undefined) => {
            if (!id) return;
            if (!index.has(id)) index.set(id, new Set());
            index.get(id)!.add(key);
        };

        // Handle removals from old indices if updating or deleting
        if (oldValue) {
            removeFromIndex(this.familyIdIndex, oldValue.familyId);
            removeFromIndex(this.userIdIndex, oldValue.userId);
            removeFromIndex(this.accountIdIndex, oldValue.accountId);
        }

        // Handle additions to new indices if creating or updating
        if (newValue) {
            addToIndex(this.familyIdIndex, newValue.familyId);
            addToIndex(this.userIdIndex, newValue.userId);
            addToIndex(this.accountIdIndex, newValue.accountId);
        }
    }



    private persistItem(key: string, value: any, storeName: string): Promise<void> {
        if (this.isCleaningUp) return Promise.resolve();

        return new Promise((resolve, reject) => {
            if (!this.db) {
                // If DB failed to open, we just silently fail (cache works)
                return resolve();
            }

            if (!this.db.objectStoreNames.contains(storeName)) {
                return reject(new Error(`Store "${storeName}" not found`));
            }

            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            store.put(value, key);

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    private deleteItem(key: string, storeName: string): Promise<void> {
        if (this.isCleaningUp) return Promise.resolve();

        return new Promise((resolve, reject) => {
            if (!this.db) return resolve();

            if (!this.db.objectStoreNames.contains(storeName)) {
                return resolve();
            }

            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            store.delete(key);

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    private clearDb(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.db) return resolve();

            try {
                // Get all existing store names to clear everything
                const storesToClear = Array.from(this.db.objectStoreNames);

                if (storesToClear.length === 0) {
                    return resolve();
                }

                console.log(`🧹 Clearing ${storesToClear.length} stores: ${storesToClear.join(', ')}`);
                const transaction = this.db.transaction(storesToClear, 'readwrite');
                
                storesToClear.forEach(storeName => {
                    transaction.objectStore(storeName).clear();
                });

                transaction.oncomplete = () => {
                    console.log('✅ All object stores cleared successfully');
                    resolve();
                };
                transaction.onerror = (event) => {
                    console.error('❌ Error clearing object stores:', transaction.error);
                    reject(transaction.error);
                };
            } catch (error) {
                console.error('❌ Failed to start clear database transaction:', error);
                reject(error);
            }
        });
    }

    // ==========================================
    // Type-Safe Methods & Collections (No Changes)
    // ==========================================

    getTyped<K extends LocalStorageKey>(key: K): any {
        return this.getItem(key as string);
    }

    setTyped<K extends LocalStorageKey>(key: K, value: any): void {
        this.setItem(key as string, value);
    }

    removeTyped(key: LocalStorageKey): void {
        this.removeItem(key as string);
    }

    hasTyped(key: LocalStorageKey): boolean {
        return this.hasItem(key as string);
    }

    getEntities<T>(collection: string): T[] {
        return this.getItem<T[]>(this.getCollectionKey(collection)) || [];
    }

    saveEntities<T>(collection: string, entities: T[]): void {
        this.setItem(this.getCollectionKey(collection), entities);
    }

    saveEntity<T extends { id?: string; accountId?: string; transactionId?: string; budgetId?: string; goalId?: string }>(
        collection: string,
        entity: T,
        idField: keyof T = 'id' as keyof T
    ): void {
        if (entity[idField] === undefined || entity[idField] === null) {
            console.warn(`[LocalIndexDBStorageService] Skipping saveEntity for collection "${collection}": Missing ID field "${String(idField)}"`);
            return;
        }

        const entities = [...this.getEntities<T>(collection)];
        const id = entity[idField];
        const index = entities.findIndex(e => e[idField] === id);

        if (index !== -1) {
            entities[index] = { ...entity };
        } else {
            entities.push(entity);
        }

        this.saveEntities(collection, entities);
    }

    deleteEntity<T>(collection: string, id: string, idField: string = 'id'): void {
        const entities = this.getEntities<any>(collection);
        const filtered = entities.filter(e => e[idField] !== id);
        this.saveEntities(collection, filtered);
    }

    private getCollectionKey(collection: string): string {
        return `guest_${collection}`;
    }
}
