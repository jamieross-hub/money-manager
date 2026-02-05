import { User } from './user.model';
import { Account } from './account.model';
import { Category } from './category.model';
import { Transaction } from './transaction.model';

/**
 * Central registry of all localStorage keys used in the application
 * This provides type safety and makes it easier to migrate to other storage solutions
 */
export enum LocalStorageKey {
    // User & Auth
    GUEST_MODE = 'guest-mode',
    GUEST_DATA_INITIALIZED = 'guest-data-initialized',
    USER_DATA_GUEST = 'user-data-offline-guest',
    USER_DATA_PREFIX = 'user-data-',
    LAST_LOGIN_PREFIX = 'last-login-',

    // Guest Collections (prefixed with guest_)
    GUEST_ACCOUNTS = 'guest_accounts',
    GUEST_CATEGORIES = 'guest_categories',
    GUEST_TRANSACTIONS = 'guest_transactions',
    GUEST_BUDGETS = 'guest_budgets',
    GUEST_GOALS = 'guest_goals',

    // App State
    THEME_PREFERENCE = 'theme-preference',
    LOCALE_PREFERENCE = 'locale-preference',

    // Feature Flags
    FEATURE_FLAGS = 'feature-flags',

    // Cache
    CACHE_PREFIX = 'cache_',
}

/**
 * Type mapping for localStorage values
 * Maps each key to its corresponding data type
 */
export interface LocalStorageTypeMap {
    // User & Auth
    [LocalStorageKey.GUEST_MODE]: string; // 'true' | 'false'
    [LocalStorageKey.GUEST_DATA_INITIALIZED]: string; // 'true' | 'false'
    [LocalStorageKey.USER_DATA_GUEST]: User;

    // Guest Collections
    [LocalStorageKey.GUEST_ACCOUNTS]: Account[];
    [LocalStorageKey.GUEST_CATEGORIES]: Category[];
    [LocalStorageKey.GUEST_TRANSACTIONS]: Transaction[];
    [LocalStorageKey.GUEST_BUDGETS]: any[]; // Define budget type if available
    [LocalStorageKey.GUEST_GOALS]: any[]; // Define goal type if available

    // App State
    [LocalStorageKey.THEME_PREFERENCE]: 'light' | 'dark' | 'auto';
    [LocalStorageKey.LOCALE_PREFERENCE]: string;

    // Feature Flags
    [LocalStorageKey.FEATURE_FLAGS]: Record<string, boolean>;
}

/**
 * Helper type for dynamic keys (with prefixes or user IDs)
 */
export type DynamicLocalStorageKey =
    | `${LocalStorageKey.USER_DATA_PREFIX}${string}`
    | `${LocalStorageKey.LAST_LOGIN_PREFIX}${string}`
    | `${LocalStorageKey.CACHE_PREFIX}${string}`;

/**
 * Combined type for all localStorage keys
 */
export type AllLocalStorageKeys = LocalStorageKey | DynamicLocalStorageKey;

/**
 * Interface for last login information
 */
export interface LastLoginInfo {
    timestamp: number;
    userAgent: string;
    ip?: string;
}

/**
 * Helper functions for localStorage key management
 */
export class LocalStorageKeyHelper {
    /**
     * Get user-specific data key
     */
    static getUserDataKey(uid: string): string {
        return `${LocalStorageKey.USER_DATA_PREFIX}${uid}`;
    }

    /**
     * Get user-specific last login key
     */
    static getLastLoginKey(uid: string): string {
        return `${LocalStorageKey.LAST_LOGIN_PREFIX}${uid}`;
    }

    /**
     * Get guest collection key
     */
    static getGuestCollectionKey(collection: 'accounts' | 'categories' | 'transactions' | 'budgets' | 'goals'): LocalStorageKey {
        return LocalStorageKey[`GUEST_${collection.toUpperCase()}` as keyof typeof LocalStorageKey] as LocalStorageKey;
    }

    /**
     * Get cache key with prefix
     */
    static getCacheKey(key: string): string {
        return `${LocalStorageKey.CACHE_PREFIX}${key}`;
    }

    /**
     * Check if a key is a dynamic key
     */
    static isDynamicKey(key: string): key is DynamicLocalStorageKey {
        return (
            key.startsWith(LocalStorageKey.USER_DATA_PREFIX) ||
            key.startsWith(LocalStorageKey.LAST_LOGIN_PREFIX) ||
            key.startsWith(LocalStorageKey.CACHE_PREFIX)
        );
    }
}
