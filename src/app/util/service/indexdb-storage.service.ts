import { Injectable } from '@angular/core';
import { LocalStorageKey, LocalStorageKeyHelper } from '../models/local-storage.model';

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
    private readonly DB_VERSION = 2;
    private db: IDBDatabase | null = null;

    // In-memory caches for synchronous access
    private keyValueCache = new Map<string, any>();
    private transactionsCache = new Map<string, any>();
    private isInitialized = false;

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
        if (this.isInitialized) return;

        console.log('📦 Initializing Hybrid Storage Service...');

        try {
            await this.openDatabase();
            await this.loadCacheFromDb();
            
            // Post-initialization: Migrate transaction data if needed
            await this.migrateIfNeeded();
            
            console.log(`✅ Storage initialized. KeyValue: ${this.keyValueCache.size}, Transactions: ${this.transactionsCache.size}`);
            this.isInitialized = true;
        } catch (error) {
            console.error('❌ Failed to initialize storage service:', error);
            // Fallback: try to load what we can or operate in memory-only mode if DB fails
        }
    }

    /**
     * Set an item (Sync API, Async Persistence)
     */
    setItem<T>(key: string, value: T, storeName: string = this.STORE_NAME): void {
        // Update correct cache immediately
        if (storeName === this.TRANSACTIONS_STORE) {
            this.transactionsCache.set(key, value);
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
        if (storeName === this.TRANSACTIONS_STORE) {
            this.transactionsCache.delete(key);
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
    clear(): void {
        this.keyValueCache.clear();
        this.transactionsCache.clear();

        this.clearDb().catch(err => {
            console.error('Error clearing database:', err);
        });
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

            request.onupgradeneeded = (event: any) => {
                const db = request.result;
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    db.createObjectStore(this.STORE_NAME);
                }
                if (!db.objectStoreNames.contains(this.TRANSACTIONS_STORE)) {
                    db.createObjectStore(this.TRANSACTIONS_STORE);
                }
                // Migration logic could go here if we were migrating schema version
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
                            const itemKey = familyId ? `${familyId}_${tx.id}` : tx.id;
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

        if (keysToMigrate.length > 0 || collectionKeys.length > 0) {
            console.log('✅ Overall transaction storage migration complete.');
        }
    }



    private persistItem(key: string, value: any, storeName: string): Promise<void> {
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

            const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(this.STORE_NAME);
            store.clear();

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
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
