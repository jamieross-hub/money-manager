import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class LocalStorageUtilityService {
    constructor() { }

    /**
     * Get an item from localStorage and parse it
     */
    getItem<T>(key: string): T | null {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (error) {
            console.error(`Error reading key "${key}" from localStorage:`, error);
            return null;
        }
    }

    /**
     * Save an item to localStorage as JSON
     */
    setItem<T>(key: string, value: T): void {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error(`Error saving key "${key}" to localStorage:`, error);
        }
    }

    /**
     * Remove an item from localStorage
     */
    removeItem(key: string): void {
        localStorage.removeItem(key);
    }

    /**
     * Entity CRUD helpers
     */

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

    private getCollectionKey(collection: string): string {
        return `guest_${collection}`;
    }
}
