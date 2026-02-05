import { Injectable } from '@angular/core';
import { LocalStorageKey, LocalStorageTypeMap, LocalStorageKeyHelper } from '../models/local-storage.model';

/**
 * Centralized LocalStorage service for production-ready localStorage operations
 * Provides type-safe get/set/remove with error handling, JSON serialization, and entity CRUD helpers
 * Consolidates functionality from LocalStorageService and LocalStorageUtilityService
 * Uses LocalStorageKey enum for type safety and easier migration to other storage solutions
 */
@Injectable({
    providedIn: 'root'
})
export class LocalStorageService {

    // Expose helper for external use
    public readonly keyHelper = LocalStorageKeyHelper;

    /**
     * Check if localStorage is available
     */
    private isLocalStorageAvailable(): boolean {
        try {
            const test = '__localStorage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            console.warn('localStorage is not available:', e);
            return false;
        }
    }

    /**
     * Set an item in localStorage
     * @param key Storage key
     * @param value Value to store (will be JSON stringified if object)
     */
    setItem<T>(key: string, value: T): boolean {
        if (!this.isLocalStorageAvailable()) {
            console.error('localStorage not available');
            return false;
        }

        try {
            const serializedValue = typeof value === 'string'
                ? value
                : JSON.stringify(value);
            localStorage.setItem(key, serializedValue);
            return true;
        } catch (error) {
            console.error(`Error setting localStorage item "${key}":`, error);
            return false;
        }
    }

    /**
     * Get an item from localStorage
     * @param key Storage key
     * @param parseJson Whether to parse as JSON (default: true)
     * @returns Parsed value or null if not found/error
     */
    getItem<T>(key: string, parseJson: boolean = true): T | null {
        if (!this.isLocalStorageAvailable()) {
            return null;
        }

        try {
            const value = localStorage.getItem(key);

            if (value === null) {
                return null;
            }

            if (!parseJson) {
                return value as unknown as T;
            }

            return JSON.parse(value) as T;
        } catch (error) {
            console.error(`Error getting localStorage item "${key}":`, error);
            return null;
        }
    }

    /**
     * Remove an item from localStorage
     * @param key Storage key
     */
    removeItem(key: string): boolean {
        if (!this.isLocalStorageAvailable()) {
            return false;
        }

        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error(`Error removing localStorage item "${key}":`, error);
            return false;
        }
    }

    /**
     * Clear all items from localStorage
     */
    clear(): boolean {
        if (!this.isLocalStorageAvailable()) {
            return false;
        }

        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.error('Error clearing localStorage:', error);
            return false;
        }
    }

    /**
     * Check if a key exists in localStorage
     * @param key Storage key
     */
    hasItem(key: string): boolean {
        if (!this.isLocalStorageAvailable()) {
            return false;
        }

        return localStorage.getItem(key) !== null;
    }

    /**
     * Get all keys from localStorage
     */
    getAllKeys(): string[] {
        if (!this.isLocalStorageAvailable()) {
            return [];
        }

        try {
            return Object.keys(localStorage);
        } catch (error) {
            console.error('Error getting localStorage keys:', error);
            return [];
        }
    }

    // ========== Type-Safe Methods Using LocalStorageKey Enum ==========

    /**
     * Type-safe get method using LocalStorageKey enum
     */
    getTyped<K extends LocalStorageKey>(
        key: K
    ): any {
        return this.getItem(key as string);
    }

    /**
     * Type-safe set method using LocalStorageKey enum
     */
    setTyped<K extends LocalStorageKey>(
        key: K,
        value: any
    ): boolean {
        return this.setItem(key as string, value);
    }

    /**
     * Remove item using LocalStorageKey enum
     */
    removeTyped(key: LocalStorageKey): boolean {
        return this.removeItem(key as string);
    }

    /**
     * Check if item exists using LocalStorageKey enum
     */
    hasTyped(key: LocalStorageKey): boolean {
        return this.hasItem(key as string);
    }

    // ========== Entity CRUD Helpers (from LocalStorageUtilityService) ==========

    /**
     * Get all entities of a specific type (e.g., 'accounts', 'categories')
     */
    getEntities<T>(collection: string): T[] {
        return this.getItem<T[]>(this.getCollectionKey(collection)) || [];
    }

    /**
     * Save all entities of a specific type
     */
    saveEntities<T>(collection: string, entities: T[]): void {
        this.setItem(this.getCollectionKey(collection), entities);
    }

    /**
     * Add or update an entity in a collection
     */
    saveEntity<T extends { id?: string; accountId?: string; transactionId?: string; budgetId?: string; goalId?: string }>(
        collection: string,
        entity: T,
        idField: keyof T = 'id' as keyof T
    ): void {
        const entities = this.getEntities<T>(collection);
        const id = entity[idField];
        const index = entities.findIndex(e => e[idField] === id);

        if (index !== -1) {
            entities[index] = { ...entity };
        } else {
            entities.push(entity);
        }

        this.saveEntities(collection, entities);
    }

    /**
     * Delete an entity from a collection
     */
    deleteEntity<T>(collection: string, id: string, idField: string = 'id'): void {
        const entities = this.getEntities<any>(collection);
        const filtered = entities.filter(e => e[idField] !== id);
        this.saveEntities(collection, filtered);
    }

    /**
     * Get collection key with guest prefix
     */
    private getCollectionKey(collection: string): string {
        return `guest_${collection}`;
    }
}
