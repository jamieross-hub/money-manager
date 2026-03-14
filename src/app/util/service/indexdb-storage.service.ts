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
    private readonly ACCOUNTS_STORE = 'accounts';
    private readonly CATEGORIES_STORE = 'categories';
    private readonly DB_VERSION = 5;
    private db: IDBDatabase | null = null;

    // In-memory caches for synchronous access
    private keyValueCache = new Map<string, any>();
    private transactionsCache = new Map<string, any>();
    private accountsCache = new Map<string, any>();   // key = accountId | familyId_accountId
    private categoriesCache = new Map<string, any>(); // key = categoryId | familyId_categoryId

    // Secondary in-memory indices for O(1) synchronous lookups
    private familyIdIndex = new Map<string, Set<string>>(); // familyId -> Set of transaction keys
    private userIdIndex = new Map<string, Set<string>>();   // userId   -> Set of transaction keys
    private accountIdIndex = new Map<string, Set<string>>(); // accountId -> Set of transaction keys

    // Family-id indices for accounts/categories stores
    private accountsFamilyIdIndex = new Map<string, Set<string>>();   // familyId -> Set of account keys
    private categoriesFamilyIdIndex = new Map<string, Set<string>>(); // familyId -> Set of category keys

    private isInitialized = false;
    private isCleaningUp = false;
    private readonly initializedSubject = new BehaviorSubject<boolean>(false);
    public readonly isReady$ = this.initializedSubject.asObservable().pipe(
        filter(ready => ready),
        take(1)
    );

    public get isReady(): boolean {
        return this.isInitialized;
    }

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

    // ==========================================
    // Accounts Store (individual-item pattern)
    // key = accountId (personal) | familyId_accountId (family)
    // ==========================================

    /**
     * Store a single account.
     * key should be built with LocalStorageKeyHelper.getAccountItemKey()
     */
    setAccount<T>(key: string, value: T): void {
        if (this.isCleaningUp) {
            console.warn(`⚠️ Blocked write to accounts store for key "${key}" - Service is cleaning up.`);
            return;
        }
        // Always store a plain clone — prevents NgRx-frozen objects from entering the cache
        const safeValue = structuredClone(value);
        const oldValue = this.accountsCache.get(key);
        this.accountsCache.set(key, safeValue);
        this.updateAccountsSecondaryIndices(key, safeValue, oldValue);
        this.persistItem(key, safeValue, this.ACCOUNTS_STORE).catch(err =>
            console.error(`Error persisting account key "${key}":`, err)
        );
    }

    /**
     * Get a single account synchronously
     */
    getAccount<T>(key: string, clone = true): T | null {
        const value = this.accountsCache.get(key);
        if (value === undefined || value === null) return null;
        return clone ? structuredClone(value) as T : value as T;
    }

    /**
     * Remove a single account
     */
    removeAccount(key: string): void {
        if (this.isCleaningUp) return;
        const oldValue = this.accountsCache.get(key);
        this.accountsCache.delete(key);
        if (oldValue) this.updateAccountsSecondaryIndices(key, null, oldValue);
        this.deleteItem(key, this.ACCOUNTS_STORE).catch(err =>
            console.error(`Error deleting account key "${key}":`, err)
        );
    }

    /**
     * Get all accounts (synchronous)
     */
    getAllAccountsSync(): any[] {
        return Array.from(this.accountsCache.values());
    }

    /**
     * Get all account keys (synchronous)
     */
    getAccountKeys(): string[] {
        return Array.from(this.accountsCache.keys());
    }

    /**
     * Get accounts by familyId (Sync via Cache)
     */
    getAccountsByFamilyIdSync(familyId: string): any[] {
        const keys = this.accountsFamilyIdIndex.get(familyId);
        if (!keys) return [];
        return Array.from(keys).map(key => this.accountsCache.get(key)).filter(Boolean);
    }

    /**
     * Get personal accounts (no familyId) for a userId
     */
    getPersonalAccountsSync(userId: string): any[] {
        return Array.from(this.accountsCache.values()).filter(a => a && a.userId === userId && !a.familyId);
    }

    /**
     * Update secondary indices for accounts store
     */
    private updateAccountsSecondaryIndices(key: string, newValue: any, oldValue?: any): void {
        const removeFromIdx = (index: Map<string, Set<string>>, id: string | undefined) => {
            if (!id) return;
            const set = index.get(id);
            if (set) { set.delete(key); if (set.size === 0) index.delete(id); }
        };
        const addToIdx = (index: Map<string, Set<string>>, id: string | undefined) => {
            if (!id) return;
            if (!index.has(id)) index.set(id, new Set());
            index.get(id)!.add(key);
        };
        if (oldValue) removeFromIdx(this.accountsFamilyIdIndex, oldValue.familyId);
        if (newValue) addToIdx(this.accountsFamilyIdIndex, newValue.familyId);
    }

    // ==========================================
    // Categories Store (individual-item pattern)
    // key = categoryId (personal) | familyId_categoryId (family)
    // ==========================================

    /**
     * Store a single category.
     * key should be built with LocalStorageKeyHelper.getCategoryItemKey()
     */
    setCategory<T>(key: string, value: T): void {
        if (this.isCleaningUp) {
            console.warn(`⚠️ Blocked write to categories store for key "${key}" - Service is cleaning up.`);
            return;
        }
        // Always store a plain clone — prevents NgRx-frozen objects from entering the cache
        const safeValue = structuredClone(value);
        const oldValue = this.categoriesCache.get(key);
        this.categoriesCache.set(key, safeValue);
        this.updateCategoriesSecondaryIndices(key, safeValue, oldValue);
        this.persistItem(key, safeValue, this.CATEGORIES_STORE).catch(err =>
            console.error(`Error persisting category key "${key}":`, err)
        );
    }

    /**
     * Get a single category synchronously
     */
    getCategory<T>(key: string, clone = true): T | null {
        const value = this.categoriesCache.get(key);
        if (value === undefined || value === null) return null;
        return clone ? structuredClone(value) as T : value as T;
    }

    /**
     * Remove a single category
     */
    removeCategory(key: string): void {
        if (this.isCleaningUp) return;
        const oldValue = this.categoriesCache.get(key);
        this.categoriesCache.delete(key);
        if (oldValue) this.updateCategoriesSecondaryIndices(key, null, oldValue);
        this.deleteItem(key, this.CATEGORIES_STORE).catch(err =>
            console.error(`Error deleting category key "${key}":`, err)
        );
    }

    /**
     * Get all categories (synchronous)
     */
    getAllCategoriesSync(): any[] {
        return Array.from(this.categoriesCache.values());
    }

    /**
     * Get all category keys (synchronous)
     */
    getCategoryKeys(): string[] {
        return Array.from(this.categoriesCache.keys());
    }

    /**
     * Get categories by familyId (Sync via Cache)
     */
    getCategoriesByFamilyIdSync(familyId: string): any[] {
        const keys = this.categoriesFamilyIdIndex.get(familyId);
        if (!keys) return [];
        return Array.from(keys).map(key => this.categoriesCache.get(key)).filter(Boolean);
    }

    /**
     * Get personal categories (no familyId) for a userId
     */
    getPersonalCategoriesSync(userId: string): any[] {
        return Array.from(this.categoriesCache.values()).filter(c => c && c.userId === userId && !c.familyId);
    }

    /**
     * Update secondary indices for categories store
     */
    private updateCategoriesSecondaryIndices(key: string, newValue: any, oldValue?: any): void {
        const removeFromIdx = (index: Map<string, Set<string>>, id: string | undefined) => {
            if (!id) return;
            const set = index.get(id);
            if (set) { set.delete(key); if (set.size === 0) index.delete(id); }
        };
        const addToIdx = (index: Map<string, Set<string>>, id: string | undefined) => {
            if (!id) return;
            if (!index.has(id)) index.set(id, new Set());
            index.get(id)!.add(key);
        };
        if (oldValue) removeFromIdx(this.categoriesFamilyIdIndex, oldValue.familyId);
        if (newValue) addToIdx(this.categoriesFamilyIdIndex, newValue.familyId);
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
     * Helper to query any index on any store
     */
    private async queryIndex(indexName: string, value: any, storeName: string = this.TRANSACTIONS_STORE): Promise<any[]> {
        if (!this.db) return [];

        return new Promise((resolve) => {
            try {
                const transaction = this.db!.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const index = store.index(indexName);
                const request = index.getAll(value);

                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => {
                    console.error(`IndexedDB Index Error (${storeName}/${indexName}):`, request.error);
                    resolve([]);
                };
            } catch (error) {
                console.error(`Error querying ${storeName}/${indexName} index:`, error);
                resolve([]);
            }
        });
    }

    /**
     * Get transactions by familyId (Async via IndexedDB Index)
     */
    async getTransactionsByFamilyId(familyId: string): Promise<any[]> {
        if (!this.db) return this.getTransactionsByFamilyIdSync(familyId);
        return this.queryIndex('familyId', familyId, this.TRANSACTIONS_STORE);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Async Index Queries — Accounts Store
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Get accounts by familyId (Async via IndexedDB Index).
     * Falls back to the in-memory index when DB is unavailable.
     */
    async getAccountsByFamilyIdAsync(familyId: string): Promise<any[]> {
        if (!this.db) return this.getAccountsByFamilyIdSync(familyId);
        return this.queryIndex('familyId', familyId, this.ACCOUNTS_STORE);
    }

    /**
     * Get accounts by userId (Async via IndexedDB Index).
     * Returns only personal accounts (no familyId field).
     */
    async getAccountsByUserIdAsync(userId: string): Promise<any[]> {
        if (!this.db) return this.getPersonalAccountsSync(userId);
        const all = await this.queryIndex('userId', userId, this.ACCOUNTS_STORE);
        return all.filter((a: any) => a && !a.familyId);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Async Index Queries — Categories Store
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Get categories by familyId (Async via IndexedDB Index).
     * Falls back to the in-memory index when DB is unavailable.
     */
    async getCategoriesByFamilyIdAsync(familyId: string): Promise<any[]> {
        if (!this.db) return this.getCategoriesByFamilyIdSync(familyId);
        return this.queryIndex('familyId', familyId, this.CATEGORIES_STORE);
    }

    /**
     * Get categories by userId (Async via IndexedDB Index).
     * Returns only personal categories (no familyId field).
     */
    async getCategoriesByUserIdAsync(userId: string): Promise<any[]> {
        if (!this.db) return this.getPersonalCategoriesSync(userId);
        const all = await this.queryIndex('userId', userId, this.CATEGORIES_STORE);
        return all.filter((c: any) => c && !c.familyId);
    }

    /**
     * Clear the in-memory caches
     */
    clearMemoryCache(): void {
        this.keyValueCache.clear();
        this.transactionsCache.clear();
        this.accountsCache.clear();
        this.categoriesCache.clear();
        this.accountsFamilyIdIndex.clear();
        this.categoriesFamilyIdIndex.clear();
    }

    /**
     * Get an item (Sync API, Read from Cache)
     * @param clone - Set false to skip structuredClone for hot-path reads where
     *   the caller treats the value as read-only (e.g. dispatching into NgRx).
     */
    getItem<T>(key: string, storeName: string = this.STORE_NAME, clone = true): T | null {
        const cache = storeName === this.TRANSACTIONS_STORE ? this.transactionsCache : this.keyValueCache;
        const value = cache.get(key);

        if (value === undefined || value === null) {
            return null;
        }

        // Deep copy prevents external mutation of the cached object.
        // Pass clone=false for read-only callers (e.g. dispatch into NgRx store)
        // to avoid the structuredClone overhead on hot paths.
        return clone ? structuredClone(value) as T : value as T;
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
        this.accountsCache.clear();
        this.categoriesCache.clear();
        this.familyIdIndex.clear();
        this.userIdIndex.clear();
        this.accountIdIndex.clear();
        this.accountsFamilyIdIndex.clear();
        this.categoriesFamilyIdIndex.clear();

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

                // ── Dedicated Accounts Store ──────────────────────────────────────
                // key = accountId (personal) | familyId_accountId (family)
                let accountsStore: IDBObjectStore;
                if (!db.objectStoreNames.contains(this.ACCOUNTS_STORE)) {
                    accountsStore = db.createObjectStore(this.ACCOUNTS_STORE);
                    console.log('📦 Created accounts object store');
                } else {
                    accountsStore = request.transaction!.objectStore(this.ACCOUNTS_STORE);
                }
                if (!accountsStore.indexNames.contains('familyId')) {
                    accountsStore.createIndex('familyId', 'familyId', { unique: false });
                    console.log('📦 Created familyId index on accounts store');
                }
                if (!accountsStore.indexNames.contains('userId')) {
                    accountsStore.createIndex('userId', 'userId', { unique: false });
                    console.log('📦 Created userId index on accounts store');
                }

                // ── Dedicated Categories Store ────────────────────────────────────
                // key = categoryId (personal) | familyId_categoryId (family)
                let categoriesStore: IDBObjectStore;
                if (!db.objectStoreNames.contains(this.CATEGORIES_STORE)) {
                    categoriesStore = db.createObjectStore(this.CATEGORIES_STORE);
                    console.log('📦 Created categories object store');
                } else {
                    categoriesStore = request.transaction!.objectStore(this.CATEGORIES_STORE);
                }
                if (!categoriesStore.indexNames.contains('familyId')) {
                    categoriesStore.createIndex('familyId', 'familyId', { unique: false });
                    console.log('📦 Created familyId index on categories store');
                }
                if (!categoriesStore.indexNames.contains('userId')) {
                    categoriesStore.createIndex('userId', 'userId', { unique: false });
                    console.log('📦 Created userId index on categories store');
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
                // Load from all stores
                await this.loadStoreIntoCache(this.STORE_NAME);
                await this.loadStoreIntoCache(this.TRANSACTIONS_STORE);
                await this.loadStoreIntoCache(this.ACCOUNTS_STORE);
                await this.loadStoreIntoCache(this.CATEGORIES_STORE);
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
                    } else if (storeName === this.ACCOUNTS_STORE) {
                        this.accountsCache.set(cursor.key as string, cursor.value);
                        this.updateAccountsSecondaryIndices(cursor.key as string, cursor.value);
                    } else if (storeName === this.CATEGORIES_STORE) {
                        this.categoriesCache.set(cursor.key as string, cursor.value);
                        this.updateCategoriesSecondaryIndices(cursor.key as string, cursor.value);
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
    
    /**
     * Clear only transactions data
     */
    async clearTransactionsStore(): Promise<void> {
        this.transactionsCache.clear();
        this.familyIdIndex.clear();
        this.userIdIndex.clear();
        this.accountIdIndex.clear();

        return new Promise((resolve, reject) => {
            if (!this.db) return resolve();

            try {
                if (!this.db.objectStoreNames.contains(this.TRANSACTIONS_STORE)) {
                    return resolve();
                }

                const transaction = this.db.transaction([this.TRANSACTIONS_STORE], 'readwrite');
                transaction.objectStore(this.TRANSACTIONS_STORE).clear();

                transaction.oncomplete = () => {
                    console.log('✅ Transactions store cleared successfully');
                    resolve();
                };
                transaction.onerror = (event) => {
                    console.error('❌ Error clearing transactions store:', transaction.error);
                    reject(transaction.error);
                };
            } catch (error) {
                console.error('❌ Failed to start clear transactions transaction:', error);
                reject(error);
            }
        });
    }

    /**
     * Clear only accounts data (individual-item store)
     */
    async clearAccountsStore(): Promise<void> {
        this.accountsCache.clear();
        this.accountsFamilyIdIndex.clear();

        return new Promise((resolve, reject) => {
            if (!this.db) return resolve();
            try {
                if (!this.db.objectStoreNames.contains(this.ACCOUNTS_STORE)) return resolve();
                const tx = this.db.transaction([this.ACCOUNTS_STORE], 'readwrite');
                tx.objectStore(this.ACCOUNTS_STORE).clear();
                tx.oncomplete = () => { console.log('✅ Accounts store cleared'); resolve(); };
                tx.onerror = () => { console.error('❌ Error clearing accounts store:', tx.error); reject(tx.error); };
            } catch (error) {
                console.error('❌ Failed to clear accounts store:', error);
                reject(error);
            }
        });
    }

    /**
     * Clear only categories data (individual-item store)
     */
    async clearCategoriesStore(): Promise<void> {
        this.categoriesCache.clear();
        this.categoriesFamilyIdIndex.clear();

        return new Promise((resolve, reject) => {
            if (!this.db) return resolve();
            try {
                if (!this.db.objectStoreNames.contains(this.CATEGORIES_STORE)) return resolve();
                const tx = this.db.transaction([this.CATEGORIES_STORE], 'readwrite');
                tx.objectStore(this.CATEGORIES_STORE).clear();
                tx.oncomplete = () => { console.log('✅ Categories store cleared'); resolve(); };
                tx.onerror = () => { console.error('❌ Error clearing categories store:', tx.error); reject(tx.error); };
            } catch (error) {
                console.error('❌ Failed to clear categories store:', error);
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
