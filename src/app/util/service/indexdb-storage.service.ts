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
    private readonly DB_VERSION = 1;
    private db: IDBDatabase | null = null;

    // In-memory cache for synchronous access
    private cache = new Map<string, any>();
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
            console.log(`✅ Storage initialized with ${this.cache.size} items in cache.`);
            this.isInitialized = true;
        } catch (error) {
            console.error('❌ Failed to initialize storage service:', error);
            // Fallback: try to load what we can or operate in memory-only mode if DB fails
        }
    }

    /**
     * Set an item (Sync API, Async Persistence)
     */
    setItem<T>(key: string, value: T): void {
        // Update cache immediately
        this.cache.set(key, value);

        // Persist to DB asynchronously
        this.persistItem(key, value).catch(err => {
            console.error(`Error persisting key "${key}":`, err);
        });
    }

    /**
     * Get an item (Sync API, Read from Cache)
     */
    getItem<T>(key: string): T | null {
        const value = this.cache.get(key);

        if (value === undefined || value === null) {
            return null;
        }

        // Deep copy to prevent reference mutation issues
        return structuredClone(value) as T;
    }

    /**
     * Remove an item (Sync API, Async Persistence)
     */
    removeItem(key: string): void {
        this.cache.delete(key);

        this.deleteItem(key).catch(err => {
            console.error(`Error deleting key "${key}":`, err);
        });
    }

    /**
     * Clear all data
     */
    clear(): void {
        this.cache.clear();

        this.clearDb().catch(err => {
            console.error('Error clearing database:', err);
        });
    }

    /**
     * Check if item exists
     */
    hasItem(key: string): boolean {
        return this.cache.has(key);
    }

    /**
     * Get all keys
     */
    getAllKeys(): string[] {
        return Array.from(this.cache.keys());
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
                // Migration logic could go here if we were migrating schema version
            };
        });
    }

    private loadCacheFromDb(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                return reject(new Error('Database not open'));
            }

            const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
            const store = transaction.objectStore(this.STORE_NAME);
            const countRequest = store.count();

            countRequest.onsuccess = () => {
                // Migrate from localStorage if DB is empty
                if (countRequest.result === 0) {
                    this.migrateFromLocalStorage();
                    return resolve();
                }

                const request = store.openCursor();

                request.onsuccess = (event: any) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        this.cache.set(cursor.key as string, cursor.value);
                        cursor.continue();
                    } else {
                        resolve();
                    }
                };

                request.onerror = () => reject(request.error);
            };

            countRequest.onerror = () => reject(countRequest.error);
        });
    }

    private migrateFromLocalStorage(): void {
        if (typeof localStorage === 'undefined') return;

        console.log('Migrating data from localStorage to IndexedDB...');

        Object.keys(localStorage).forEach(key => {
            const rawValue = localStorage.getItem(key);
            if (rawValue !== null) {
                try {
                    this.cache.set(key, JSON.parse(rawValue));
                } catch {
                    this.cache.set(key, rawValue);
                }
            }
        });
    }

    private persistItem(key: string, value: any): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                // If DB failed to open, we just silently fail (cache works)
                return resolve();
            }

            const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(this.STORE_NAME);
            store.put(value, key);

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    private deleteItem(key: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.db) return resolve();

            const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(this.STORE_NAME);
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
        const entities = [...this.getEntities<T>(collection)];
        const id = entity[idField];
        const index = entities.findIndex(e => e[idField] === id);

        if (index !== -1) {
            entities[index] = { ...entity };
        } else {
            entities.push(entity); // 
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
