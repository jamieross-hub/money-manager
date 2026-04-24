import { User } from './user.model';
import { Account } from './account.model';
import { Category } from './category.model';
import { Transaction } from './transaction.model';

/**
 * Central registry of all storage keys used in the application
 * This provides type safety and makes it easier to migrate to other storage solutions
 */
export enum LocalStorageKey {
    // User & Auth
    GUEST_MODE = 'guest-mode',
    GUEST_DATA_INITIALIZED = 'guest-data-initialized',
    USER_DATA_GUEST = 'user-data-offline-guest',
    USER_DATA_PREFIX = 'user-data-',
    LAST_LOGIN_PREFIX = 'last-login-',
    LAST_ACTIVE_UID = 'last-active-uid',

    // Guest Collections (prefixed with guest_)
    GUEST_ACCOUNTS = 'guest_accounts',
    GUEST_CATEGORIES = 'guest_categories',
    GUEST_TRANSACTIONS = 'guest_transactions',
    GUEST_BUDGETS = 'guest_budgets',
    GUEST_GOALS = 'guest_goals',

    // App State
    APP_STATE = 'app_state',
    NAVIGATION_STATE = 'app-state', // Kept 'app-state' value to maintain backward compatibility if needed, or migration
    LAST_DATA_REFRESH = 'last-data-refresh',
    THEME_PREFERENCE = 'theme-preference',
    LOCALE_PREFERENCE = 'locale-preference',
    ADMIN_SETTINGS = 'admin-settings',
    FILTER_PRESETS = 'money-manager-filter-presets',
    APP_LOGS = 'app_logs',
    APP_LANGUAGE = 'app_language',
    REPORTS_PREFERENCES = 'reports-preferences',
    REPORTS_UI_STATE = 'reports-ui-state',

    // Feature Flags
    FEATURE_FLAGS = 'feature-flags',

    // Cache
    // Notifications
    NOTIFICATIONS_ENABLED = 'notifications_enabled',
    NOTIFICATION_PREFIX = 'notification_',
    NOTIFICATION_ADVANCED_PREFIX = 'notification_advanced_',

    // PWA
    PWA_INSTALL_DISMISSED = 'pwa-install-dismissed',
    PWA_INSTALL_DISMISSED_TIME = 'pwa-install-dismissed-time',
    APP_BACKGROUND_STATE = 'app-background-state',

    // Firebase
    FCM_TOKEN = 'fcm-token',

    // App Version/Cache
    APP_VERSION = 'app-version',
    APP_CACHE_VERSION = 'app-cache-version',
    CACHE_PREFIX = 'cache_',
    SYNC_QUEUE = 'sync-queue',
    TRANSACTIONS_CACHE = 'transactions-cache',
    CATEGORIES_CACHE = 'categories-cache',
    ACCOUNTS_CACHE = 'accounts-cache',
    BUDGETS_CACHE = 'budgets-cache',
    GOALS_CACHE = 'goals-cache',
    GOOGLE_SHEETS_CACHE = 'google-sheets-cache',
    FAMILIES_CACHE = 'families-cache',
    RECURRING_CACHE = 'recurring-cache',
    CURRENT_FILTER_STATE = 'current-filter-state',
    RECENT_FOOTER_MODES = 'recent-footer-modes',
}

/**
 * Type mapping for storage values
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
 * Combined type for all storage keys
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
 * Helper functions for storage key management
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
     * Get transactions cache key
     */
    static getTransactionsCacheKey(uid: string, familyId?: string): string {
        return familyId 
            ? `${LocalStorageKey.TRANSACTIONS_CACHE}-${uid}-${familyId}`
            : `${LocalStorageKey.TRANSACTIONS_CACHE}-${uid}`;
    }

    /**
     * Get individual transaction item key
     */
    static getTransactionItemKey(transactionId: string, familyId?: string): string {
        return transactionId;
    }

    /**
     * Get individual account item key
     * Personal: accountId
     * Family:   familyId_accountId
     */
    static getAccountItemKey(accountId: string, familyId?: string): string {
        return familyId ? `${familyId}_${accountId}` : accountId;
    }

    /**
     * Get individual category item key
     * Personal: categoryId
     * Family:   familyId_categoryId
     */
    static getCategoryItemKey(categoryId: string, familyId?: string): string {
        return familyId ? `${familyId}_${categoryId}` : categoryId;
    }

    /**
     * Get settlements cache key
     */
    static getSettlementsCacheKey(familyId: string): string {
        return `family-settlements-${familyId}`;
    }

    /**
     * Get members cache key
     */
    static getMembersCacheKey(familyId: string): string {
        return `family-members-${familyId}`;
    }

    /**
     * Get family cache key
     */
    static getFamilyCacheKey(familyId: string): string {
        return `family-${familyId}`;
    }

    /**
     * Get recurring cache key
     */
    static getRecurringCacheKey(uid: string): string {
        return `${LocalStorageKey.RECURRING_CACHE}-${uid}`;
    }

    /**
     * Get categories cache key
     */
    static getCategoriesCacheKey(uid: string, familyId?: string): string {
        return familyId
            ? `${LocalStorageKey.CATEGORIES_CACHE}-${uid}-${familyId}`
            : `${LocalStorageKey.CATEGORIES_CACHE}-${uid}`;
    }

    /**
     * Get accounts cache key
     */
    static getAccountsCacheKey(uid: string, familyId?: string): string {
        return familyId
            ? `${LocalStorageKey.ACCOUNTS_CACHE}-${uid}-${familyId}`
            : `${LocalStorageKey.ACCOUNTS_CACHE}-${uid}`;
    }

    /**
     * Get budgets cache key
     */
    static getBudgetsCacheKey(uid: string, familyId?: string): string {
        return familyId
            ? `${LocalStorageKey.BUDGETS_CACHE}-${uid}-${familyId}`
            : `${LocalStorageKey.BUDGETS_CACHE}-${uid}`;
    }

    /**
     * Get goals cache key
     */
    static getGoalsCacheKey(uid: string, familyId?: string): string {
        return familyId
            ? `${LocalStorageKey.GOALS_CACHE}-${uid}-${familyId}`
            : `${LocalStorageKey.GOALS_CACHE}-${uid}`;
    }

    /**
     * Get google sheets cache key
     */
    static getGoogleSheetsCacheKey(uid: string): string {
        return `${LocalStorageKey.GOOGLE_SHEETS_CACHE}-${uid}`;
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
