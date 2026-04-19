import { Category } from '../models';
import { CurrencyCode, LanguageCode, ThemeType, DateRangePreset, TransactionType, AccountType } from './enums';

/**
 * Application configuration constants
 */
export const APP_CONFIG = {
  // App metadata
  APP_NAME: 'Family Expense Tracker',
  APP_VERSION: '1.0.0',
  APP_DESCRIPTION: 'Family expense management application',
  WELCOME_MESSAGE: 'Master your money, your way. Choose the mode that fits your needs to get started:',
  install_prompt_dismissed_days: 7,

  // Firebase configuration
  FIREBASE: {
    COLLECTIONS: {
      USERS: 'users',
      TRANSACTIONS: 'transactions',
      ACCOUNTS: 'accounts',
      CATEGORIES: 'categories',
      BUDGETS: 'budgets',
      GOALS: 'goals',
      TAXES: 'taxes',
      SUBSCRIPTIONS: 'subscriptions'
    },
    SUBCOLLECTIONS: {
      USER_TRANSACTIONS: 'transactions',
      USER_ACCOUNTS: 'accounts',
      USER_CATEGORIES: 'categories',
      USER_BUDGETS: 'budgets',
      USER_GOALS: 'goals',
      USER_TAXES: 'taxes'
    }
  },

  // Offline configuration
  OFFLINE: {
    MAX_RETRY_ATTEMPTS: 3,
    SYNC_INTERVAL: 30000, // 30 seconds
    CACHE_EXPIRY: 24 * 60 * 60 * 1000, // 24 hours
    QUEUE_KEY: 'offline-queue',
    USER_DATA_PREFIX: 'user-data-'
  },

  // Pagination
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
    PAGE_SIZE_OPTIONS: [10, 20, 50, 100]
  },

  // Validation
  VALIDATION: {
    MIN_PASSWORD_LENGTH: 8,
    MAX_PASSWORD_LENGTH: 128,
    MIN_NAME_LENGTH: 2,
    MAX_NAME_LENGTH: 50,
    MIN_AMOUNT: 0.01,
    MAX_AMOUNT: 999999999.99,
    MIN_ACCOUNT_BALANCE: -999999999.99,
    MAX_ACCOUNT_BALANCE: 999999999.99,
    RESERVED_CATEGORY_NAMES: {
      // 'loan payment': 'is a reserved name for Loan Account category',
      'settlement': 'is a reserved name for Family Group settlements',
      'adjustment': 'is a reserved name for Ledger adjustments',
      'transfer': 'is a reserved name for Transfer between accounts'
    }
  },

  // Regional configuration (Currency and Language)
  REGIONAL: {
    CURRENCY_DEFAULT: CurrencyCode.INR,
    LANGUAGE_DEFAULT: LanguageCode.EN,

    COUNTRY_MAPPING: {
      // Americas - North
      'US': {
        countryName: 'United States',
        currency: CurrencyCode.USD,
        languages: [{ code: LanguageCode.EN, name: 'English' }],
        timezones: [
          'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'America/Denver',
          'America/Phoenix', 'America/Detroit', 'America/Anchorage', 'America/Honolulu'
        ],
        symbol: '$',
        decimalPlaces: 2
      },
      'CA': {
        countryName: 'Canada',
        currency: CurrencyCode.CAD,
        languages: [{ code: LanguageCode.EN, name: 'English' }],
        timezones: ['America/Toronto', 'America/Vancouver', 'America/Montreal', 'America/Edmonton'],
        symbol: 'C$',
        decimalPlaces: 2
      },
      'MX': {
        countryName: 'Mexico',
        currency: CurrencyCode.MXN,
        languages: [{ code: LanguageCode.ES_MX, name: 'Español (México)' }],
        timezones: ['America/Mexico_City'],
        symbol: '$',
        decimalPlaces: 2
      },

      // Americas - South
      'BR': {
        countryName: 'Brazil',
        currency: CurrencyCode.BRL,
        languages: [{ code: LanguageCode.PT_BR, name: 'Português (Brasil)' }],
        timezones: ['America/Sao_Paulo'],
        symbol: 'R$',
        decimalPlaces: 2
      },
      'AR': {
        countryName: 'Argentina',
        currency: CurrencyCode.ARS,
        languages: [{ code: LanguageCode.ES_AR, name: 'Español (Argentina)' }],
        timezones: ['America/Argentina/Buenos_Aires'],
        symbol: '$',
        decimalPlaces: 2
      },
      'CL': {
        countryName: 'Chile',
        currency: CurrencyCode.CLP,
        languages: [{ code: LanguageCode.ES, name: 'Español' }],
        timezones: ['America/Santiago'],
        symbol: '$',
        decimalPlaces: 0
      },
      'CO': {
        countryName: 'Colombia',
        currency: CurrencyCode.COP,
        languages: [{ code: LanguageCode.ES, name: 'Español' }],
        timezones: ['America/Bogota'],
        symbol: '$',
        decimalPlaces: 2
      },
      'PE': {
        countryName: 'Peru',
        currency: CurrencyCode.PEN,
        languages: [{ code: LanguageCode.ES, name: 'Español' }],
        timezones: ['America/Lima'],
        symbol: 'S/',
        decimalPlaces: 2
      },

      // Europe - Major
      'GB': {
        countryName: 'United Kingdom',
        currency: CurrencyCode.GBP,
        languages: [{ code: LanguageCode.EN, name: 'English' }],
        timezones: ['Europe/London'],
        symbol: '£',
        decimalPlaces: 2
      },
      'CH': {
        countryName: 'Switzerland',
        currency: CurrencyCode.CHF,
        languages: [{ code: LanguageCode.DE, name: 'Deutsch' }],
        timezones: ['Europe/Zurich'],
        symbol: 'Fr',
        decimalPlaces: 2
      },
      'SE': {
        countryName: 'Sweden',
        currency: CurrencyCode.SEK,
        languages: [{ code: LanguageCode.SV, name: 'Svenska' }],
        timezones: ['Europe/Stockholm'],
        symbol: 'kr',
        decimalPlaces: 2
      },
      'NO': {
        countryName: 'Norway',
        currency: CurrencyCode.NOK,
        languages: [{ code: LanguageCode.NO, name: 'Norsk' }],
        timezones: ['Europe/Oslo'],
        symbol: 'kr',
        decimalPlaces: 2
      },
      'DK': {
        countryName: 'Denmark',
        currency: CurrencyCode.DKK,
        languages: [{ code: LanguageCode.DA, name: 'Dansk' }],
        timezones: ['Europe/Copenhagen'],
        symbol: 'kr',
        decimalPlaces: 2
      },
      'PL': {
        countryName: 'Poland',
        currency: CurrencyCode.PLN,
        languages: [{ code: LanguageCode.PL, name: 'Polski' }],
        timezones: ['Europe/Warsaw'],
        symbol: 'zł',
        decimalPlaces: 2
      },
      'RU': {
        countryName: 'Russia',
        currency: CurrencyCode.RUB,
        languages: [{ code: LanguageCode.RU, name: 'Русский' }],
        timezones: ['Europe/Moscow'],
        symbol: '₽',
        decimalPlaces: 2
      },
      'TR': {
        countryName: 'Turkey',
        currency: CurrencyCode.TRY,
        languages: [{ code: LanguageCode.TR, name: 'Türkçe' }],
        timezones: ['Europe/Istanbul'],
        symbol: '₺',
        decimalPlaces: 2
      },

      // Eurozone countries
      'DE': { countryName: 'Germany', currency: CurrencyCode.EUR, languages: [{ code: LanguageCode.DE, name: 'Deutsch' }], timezones: ['Europe/Berlin'], symbol: '€', decimalPlaces: 2 },
      'FR': { countryName: 'France', currency: CurrencyCode.EUR, languages: [{ code: LanguageCode.FR, name: 'Français' }], timezones: ['Europe/Paris'], symbol: '€', decimalPlaces: 2 },
      'IT': { countryName: 'Italy', currency: CurrencyCode.EUR, languages: [{ code: LanguageCode.IT, name: 'Italiano' }], timezones: ['Europe/Rome'], symbol: '€', decimalPlaces: 2 },
      'ES': { countryName: 'Spain', currency: CurrencyCode.EUR, languages: [{ code: LanguageCode.ES, name: 'Español' }], timezones: ['Europe/Madrid'], symbol: '€', decimalPlaces: 2 },
      'PT': { countryName: 'Portugal', currency: CurrencyCode.EUR, languages: [{ code: LanguageCode.PT, name: 'Português' }], timezones: ['Europe/Lisbon'], symbol: '€', decimalPlaces: 2 },
      'NL': { countryName: 'Netherlands', currency: CurrencyCode.EUR, languages: [{ code: LanguageCode.NL, name: 'Nederlands' }], timezones: ['Europe/Amsterdam'], symbol: '€', decimalPlaces: 2 },
      'BE': { countryName: 'Belgium', currency: CurrencyCode.EUR, languages: [{ code: LanguageCode.FR, name: 'Français' }], timezones: ['Europe/Brussels'], symbol: '€', decimalPlaces: 2 },
      'AT': { countryName: 'Austria', currency: CurrencyCode.EUR, languages: [{ code: LanguageCode.DE, name: 'Deutsch' }], timezones: ['Europe/Vienna'], symbol: '€', decimalPlaces: 2 },
      'IE': { countryName: 'Ireland', currency: CurrencyCode.EUR, languages: [{ code: LanguageCode.EN, name: 'English' }], timezones: ['Europe/Dublin'], symbol: '€', decimalPlaces: 2 },
      'FI': { countryName: 'Finland', currency: CurrencyCode.EUR, languages: [{ code: LanguageCode.FI, name: 'Suomi' }], timezones: ['Europe/Helsinki'], symbol: '€', decimalPlaces: 2 },
      'GR': { countryName: 'Greece', currency: CurrencyCode.EUR, languages: [{ code: LanguageCode.EN, name: 'English' }], timezones: ['Europe/Athens'], symbol: '€', decimalPlaces: 2 },
      'UA': { countryName: 'Ukraine', currency: CurrencyCode.EUR, languages: [{ code: LanguageCode.EN, name: 'English' }], timezones: ['Europe/Kiev'], symbol: '€', decimalPlaces: 2 },
      'RO': { countryName: 'Romania', currency: CurrencyCode.EUR, languages: [{ code: LanguageCode.EN, name: 'English' }], timezones: ['Europe/Bucharest'], symbol: '€', decimalPlaces: 2 },

      // Asia Pacific
      'IN': {
        countryName: 'India',
        currency: CurrencyCode.INR,
        languages: [
          { code: LanguageCode.EN, name: 'English' },
          { code: LanguageCode.HI, name: 'Hindi' }
        ],
        timezones: ['Asia/Kolkata', 'Asia/Calcutta'],
        symbol: '₹',
        decimalPlaces: 2
      },
      'CN': {
        countryName: 'China',
        currency: CurrencyCode.CNY,
        languages: [{ code: LanguageCode.ZH, name: '中文' }],
        timezones: ['Asia/Shanghai', 'Asia/Chongqing', 'Asia/Urumqi'],
        symbol: '¥',
        decimalPlaces: 2
      },
      'JP': {
        countryName: 'Japan',
        currency: CurrencyCode.JPY,
        languages: [{ code: LanguageCode.JA, name: '日本語' }],
        timezones: ['Asia/Tokyo'],
        symbol: '¥',
        decimalPlaces: 0
      },
      'AU': {
        countryName: 'Australia',
        currency: CurrencyCode.AUD,
        languages: [{ code: LanguageCode.EN, name: 'English' }],
        timezones: ['Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Perth', 'Australia/Adelaide'],
        symbol: 'A$',
        decimalPlaces: 2
      },
      'NZ': {
        countryName: 'New Zealand',
        currency: CurrencyCode.NZD,
        languages: [{ code: LanguageCode.EN, name: 'English' }],
        timezones: ['Pacific/Auckland'],
        symbol: 'NZ$',
        decimalPlaces: 2
      },
      'HK': {
        countryName: 'Hong Kong',
        currency: CurrencyCode.HKD,
        languages: [{ code: LanguageCode.ZH, name: '中文' }],
        timezones: ['Asia/Hong_Kong'],
        symbol: 'HK$',
        decimalPlaces: 2
      },
      'SG': {
        countryName: 'Singapore',
        currency: CurrencyCode.SGD,
        languages: [{ code: LanguageCode.EN, name: 'English' }],
        timezones: ['Asia/Singapore'],
        symbol: 'S$',
        decimalPlaces: 2
      },
      'TW': {
        countryName: 'Taiwan',
        currency: CurrencyCode.TWD,
        languages: [{ code: LanguageCode.ZH, name: '中文' }],
        timezones: ['Asia/Taipei'],
        symbol: 'NT$',
        decimalPlaces: 2
      },
      'KR': {
        countryName: 'South Korea',
        currency: CurrencyCode.KRW,
        languages: [{ code: LanguageCode.KO, name: '한국어' }],
        timezones: ['Asia/Seoul'],
        symbol: '₩',
        decimalPlaces: 0
      },
      'TH': {
        countryName: 'Thailand',
        currency: CurrencyCode.THB,
        languages: [{ code: LanguageCode.TH, name: 'ไทย' }],
        timezones: ['Asia/Bangkok'],
        symbol: '฿',
        decimalPlaces: 2
      },
      'ID': {
        countryName: 'Indonesia',
        currency: CurrencyCode.IDR,
        languages: [{ code: LanguageCode.ID, name: 'Bahasa Indonesia' }],
        timezones: ['Asia/Jakarta'],
        symbol: 'Rp',
        decimalPlaces: 2
      },
      'MY': {
        countryName: 'Malaysia',
        currency: CurrencyCode.MYR,
        languages: [{ code: LanguageCode.MS, name: 'Bahasa Melayu' }],
        timezones: ['Asia/Kuala_Lumpur'],
        symbol: 'RM',
        decimalPlaces: 2
      },
      'PH': {
        countryName: 'Philippines',
        currency: CurrencyCode.PHP,
        languages: [{ code: LanguageCode.EN, name: 'English' }],
        timezones: ['Asia/Manila'],
        symbol: '₱',
        decimalPlaces: 2
      },
      'VN': {
        countryName: 'Vietnam',
        currency: CurrencyCode.VND,
        languages: [{ code: LanguageCode.VI, name: 'Tiếng Việt' }],
        timezones: ['Asia/Ho_Chi_Minh'],
        symbol: '₫',
        decimalPlaces: 0
      },
      'IL': {
        countryName: 'Israel',
        currency: CurrencyCode.ILS,
        languages: [{ code: LanguageCode.HE, name: 'עברית' }],
        timezones: ['Asia/Jerusalem'],
        symbol: '₪',
        decimalPlaces: 2
      },
      'IR': {
        countryName: 'Iran',
        currency: CurrencyCode.USD,
        languages: [{ code: LanguageCode.EN, name: 'English' }],
        timezones: ['Asia/Tehran'],
        symbol: '$',
        decimalPlaces: 2
      }, // Fallback

      // Middle East
      'SA': {
        countryName: 'Saudi Arabia',
        currency: CurrencyCode.SAR,
        languages: [{ code: LanguageCode.AR, name: 'العربية' }],
        timezones: ['Asia/Riyadh'],
        symbol: '﷼',
        decimalPlaces: 2
      },
      'AE': {
        countryName: 'United Arab Emirates',
        currency: CurrencyCode.AED,
        languages: [{ code: LanguageCode.AR, name: 'العربية' }],
        timezones: ['Asia/Dubai'],
        symbol: 'د.إ',
        decimalPlaces: 2
      },

      // Africa
      'ZA': {
        countryName: 'South Africa',
        currency: CurrencyCode.ZAR,
        languages: [{ code: LanguageCode.EN, name: 'English' }],
        timezones: ['Africa/Johannesburg'],
        symbol: 'R',
        decimalPlaces: 2
      },
      'NG': {
        countryName: 'Nigeria',
        currency: CurrencyCode.NGN,
        languages: [{ code: LanguageCode.EN, name: 'English' }],
        timezones: ['Africa/Lagos'],
        symbol: '₦',
        decimalPlaces: 2
      },
      'EG': {
        countryName: 'Egypt',
        currency: CurrencyCode.EGP,
        languages: [{ code: LanguageCode.AR, name: 'العربية' }],
        timezones: ['Africa/Cairo'],
        symbol: 'E£',
        decimalPlaces: 2
      },
      'KE': {
        countryName: 'Kenya',
        currency: CurrencyCode.KES,
        languages: [{ code: LanguageCode.EN, name: 'English' }],
        timezones: ['Africa/Nairobi'],
        symbol: 'KSh',
        decimalPlaces: 2
      },
      'GH': {
        countryName: 'Ghana',
        currency: CurrencyCode.GHS,
        languages: [{ code: LanguageCode.EN, name: 'English' }],
        timezones: ['Africa/Accra'],
        symbol: '₵',
        decimalPlaces: 2
      },
      'MA': {
        countryName: 'Morocco',
        currency: CurrencyCode.MAD,
        languages: [{ code: LanguageCode.AR, name: 'العربية' }],
        timezones: ['Africa/Casablanca'],
        symbol: 'dh',
        decimalPlaces: 2
      },
    },

    LANGUAGE: {
      SUPPORTED: [
        LanguageCode.EN,
        LanguageCode.ES,
        LanguageCode.FR,
        LanguageCode.DE,
        LanguageCode.HI,
        LanguageCode.ZH
      ]
    }
  },

  // Theme configuration
  THEME: {
    DEFAULT: ThemeType.AUTO,
    SUPPORTED: [ThemeType.LIGHT, ThemeType.DARK, ThemeType.AUTO],
    STORAGE_KEY: 'app-theme'
  },

  // Date range presets
  DATE_RANGES: {
    [DateRangePreset.TODAY]: { label: 'Today', days: 0 },
    [DateRangePreset.YESTERDAY]: { label: 'Yesterday', days: -1 },
    [DateRangePreset.THIS_WEEK]: { label: 'This Week', days: -7 },
    [DateRangePreset.LAST_WEEK]: { label: 'Last Week', days: -14 },
    [DateRangePreset.THIS_MONTH]: { label: 'This Month', days: -30 },
    [DateRangePreset.LAST_MONTH]: { label: 'Last Month', days: -60 },
    [DateRangePreset.THIS_YEAR]: { label: 'This Year', days: -365 },
    [DateRangePreset.LAST_YEAR]: { label: 'Last Year', days: -730 }
  },

  // Notification configuration
  NOTIFICATIONS: {
    AUTO_HIDE_DELAY: 3000, // 5 seconds
    MAX_NOTIFICATIONS: 5,
    POSITION: 'top-right'
  },

  // Export configuration
  EXPORT: {
    MAX_RECORDS: 10000,
    BATCH_SIZE: 1000,
    DEFAULT_FORMAT: 'csv'
  },

  // Security configuration
  SECURITY: {
    SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 1 day
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
    PASSWORD_HISTORY_SIZE: 5
  },

  // Performance configuration
  PERFORMANCE: {
    DEBOUNCE_DELAY: 300, // 300ms
    THROTTLE_DELAY: 100, // 100ms
    CACHE_SIZE: 100,
    MAX_CONCURRENT_REQUESTS: 5
  },

  // Feature flags
  FEATURES: {
    OFFLINE_MODE: true,
    PWA_SUPPORT: true,
    EXPORT_FUNCTIONALITY: true,
    ADVANCED_REPORTS: true,
    MULTI_CURRENCY: true,
    RECURRING_TRANSACTIONS: true,
    BUDGET_ALERTS: true,
    GOAL_TRACKING: true,
    TAX_CALCULATOR: true
  },

  // PWA configuration
  PWA: {
    SILENT_UPDATES: true, // Enable silent auto-updates without user notifications
    UPDATE_CHECK_INTERVAL: 30 * 60 * 1000, // 30 minutes
    MOBILE_UPDATE_INTERVAL: 30 * 60 * 1000, // 30 minutes for mobile
    DESKTOP_UPDATE_INTERVAL: 6 * 60 * 60 * 1000, // 6 hours for desktop
    AUTO_ACTIVATE_UPDATES: true, // Automatically activate updates when available
    PRESERVE_USER_DATA: true // Preserve user data during updates
  }
} as const;

/**
 * API endpoints configuration
 */
export const API_ENDPOINTS = {
  // User endpoints
  USER: {
    PROFILE: '/api/user/profile',
    PREFERENCES: '/api/user/preferences',
    SUBSCRIPTION: '/api/user/subscription'
  },

  // Transaction endpoints
  TRANSACTIONS: {
    LIST: '/api/transactions',
    CREATE: '/api/transactions',
    UPDATE: '/api/transactions/:id',
    DELETE: '/api/transactions/:id',
    BULK: '/api/transactions/bulk',
    EXPORT: '/api/transactions/export'
  },

  // Account endpoints
  ACCOUNTS: {
    LIST: '/api/accounts',
    CREATE: '/api/accounts',
    UPDATE: '/api/accounts/:id',
    DELETE: '/api/accounts/:id',
    BALANCE: '/api/accounts/:id/balance'
  },

  // Category endpoints
  CATEGORIES: {
    LIST: '/api/categories',
    CREATE: '/api/categories',
    UPDATE: '/api/categories/:id',
    DELETE: '/api/categories/:id'
  },

  // Budget endpoints
  BUDGETS: {
    LIST: '/api/budgets',
    CREATE: '/api/budgets',
    UPDATE: '/api/budgets/:id',
    DELETE: '/api/budgets/:id',
    PROGRESS: '/api/budgets/:id/progress'
  },

  // Goal endpoints
  GOALS: {
    LIST: '/api/goals',
    CREATE: '/api/goals',
    UPDATE: '/api/goals/:id',
    DELETE: '/api/goals/:id',
    PROGRESS: '/api/goals/:id/progress'
  },

  // Report endpoints
  REPORTS: {
    SUMMARY: '/api/reports/summary',
    EXPENSES: '/api/reports/expenses',
    INCOME: '/api/reports/income',
    TRENDS: '/api/reports/trends',
    CHARTS: '/api/reports/charts'
  }
} as const;

/**
 * Error messages configuration
 */
export const ERROR_MESSAGES = {
  // Authentication errors
  AUTH: {
    INVALID_CREDENTIALS: 'Invalid email or password',
    USER_NOT_FOUND: 'User not found',
    EMAIL_ALREADY_EXISTS: 'Email already exists',
    WEAK_PASSWORD: 'Password is too weak',
    TOO_MANY_ATTEMPTS: 'Too many login attempts. Please try again later',
    SESSION_EXPIRED: 'Session expired. Please login again'
  },

  // Validation errors
  VALIDATION: {
    REQUIRED_FIELD: 'This field is required',
    INVALID_EMAIL: 'Please enter a valid email address',
    INVALID_AMOUNT: 'Please enter a valid amount',
    INVALID_DATE: 'Please enter a valid date',
    MIN_LENGTH: 'Minimum length is {min} characters',
    MAX_LENGTH: 'Maximum length is {max} characters',
    INVALID_FORMAT: 'Invalid format'
  },

  // Network errors
  NETWORK: {
    CONNECTION_ERROR: 'Connection error. Please check your internet connection',
    TIMEOUT: 'Request timeout. Please try again',
    SERVER_ERROR: 'Server error. Please try again later',
    OFFLINE: 'You are offline. Changes will be saved locally'
  },

  // Permission errors
  PERMISSION: {
    ACCESS_DENIED: 'Access denied',
    INSUFFICIENT_PERMISSIONS: 'Insufficient permissions',
    FEATURE_NOT_AVAILABLE: 'This feature is not available in your plan'
  }
} as const;

/**
 * Success messages configuration
 */
export const SUCCESS_MESSAGES = {
  // General success messages
  GENERAL: {
    SAVED: 'Changes saved successfully',
    DELETED: 'Item deleted successfully',
    CREATED: 'Item created successfully',
    UPDATED: 'Item updated successfully',
    PROFILE_UPDATED: 'Profile updated successfully'
  },

  // Authentication success messages
  AUTH: {
    LOGIN_SUCCESS: 'Login successful',
    LOGOUT_SUCCESS: 'Logout successful',
    REGISTRATION_SUCCESS: 'Registration successful',
    PASSWORD_CHANGED: 'Password changed successfully'
  },

  // Transaction success messages
  TRANSACTIONS: {
    CREATED: 'Transaction created successfully',
    UPDATED: 'Transaction updated successfully',
    DELETED: 'Transaction deleted successfully',
    BULK_IMPORTED: 'Transactions imported successfully'
  },

  BACKUP: {
    EXPORT_SUCCESS: 'Backup exported successfully',
    IMPORT_SUCCESS: 'Backup imported successfully'
  }
} as const;



export const TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Kolkata', label: 'Mumbai (IST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
];


// Available icons for category selection
export interface CategoryIcon {
  icon: string;
  name: string;
  group?: string;
}

export const CATEGORY_ICONS: CategoryIcon[] = [
  // ⭐ Popular
  { icon: 'shopping_cart', name: 'Shopping', group: 'Popular' },
  { icon: 'restaurant', name: 'Restaurant', group: 'Popular' },
  { icon: 'local_grocery_store', name: 'Groceries', group: 'Popular' },
  { icon: 'directions_car', name: 'Transport', group: 'Popular' },
  { icon: 'payments', name: 'Payments', group: 'Popular' },
  { icon: 'receipt_long', name: 'Bills', group: 'Popular' },
  { icon: 'account_balance_wallet', name: 'Wallet', group: 'Popular' },
  { icon: 'attach_money', name: 'Cash', group: 'Popular' },

  // 🍽️ Food & Dining
  { icon: 'restaurant', name: 'Restaurant', group: 'Food & Dining' },
  { icon: 'fastfood', name: 'Fast Food', group: 'Food & Dining' },
  { icon: 'local_cafe', name: 'Cafe', group: 'Food & Dining' },
  { icon: 'liquor', name: 'Drinks', group: 'Food & Dining' },
  { icon: 'ramen_dining', name: 'Food', group: 'Food & Dining' },
  { icon: 'local_dining', name: 'Dining', group: 'Food & Dining' },

  // 🛒 Shopping
  { icon: 'shopping_cart', name: 'Shopping', group: 'Shopping' },
  { icon: 'shopping_bag', name: 'Shopping Bag', group: 'Shopping' },
  { icon: 'store', name: 'Store', group: 'Shopping' },
  { icon: 'storefront', name: 'Market', group: 'Shopping' },
  { icon: 'local_mall', name: 'Mall', group: 'Shopping' },
  { icon: 'local_offer', name: 'Deals', group: 'Shopping' },
  { icon: 'card_giftcard', name: 'Gift Card', group: 'Shopping' },

  // 🥦 Groceries & Household
  { icon: 'local_grocery_store', name: 'Groceries', group: 'Groceries' },
  { icon: 'shopping_basket', name: 'Basket', group: 'Groceries' },
  { icon: 'inventory', name: 'Inventory', group: 'Groceries' },
  { icon: 'inventory_2', name: 'Supplies', group: 'Groceries' },
  { icon: 'cleaning_services', name: 'Cleaning', group: 'Groceries' },

  // 🚗 Transport & Travel
  { icon: 'directions_car', name: 'Car', group: 'Transport' },
  { icon: 'two_wheeler', name: 'Bike', group: 'Transport' },
  { icon: 'directions_bus', name: 'Bus', group: 'Transport' },
  { icon: 'train', name: 'Train', group: 'Transport' },
  { icon: 'flight', name: 'Flight', group: 'Transport' },
  { icon: 'local_taxi', name: 'Taxi', group: 'Transport' },
  { icon: 'local_gas_station', name: 'Fuel', group: 'Transport' },
  { icon: 'commute', name: 'Commute', group: 'Transport' },

  //  Utilities & Bills
  { icon: 'receipt', name: 'Receipt', group: 'Utilities' },
  { icon: 'receipt_long', name: 'Bills', group: 'Utilities' },
  { icon: 'lightbulb', name: 'Electricity', group: 'Utilities' },
  { icon: 'water_drop', name: 'Water', group: 'Utilities' },
  { icon: 'wifi', name: 'Internet', group: 'Utilities' },
  { icon: 'phone', name: 'Phone', group: 'Utilities' },
  { icon: 'router', name: 'Router', group: 'Utilities' },
  { icon: 'electrical_services', name: 'Electrical Services', group: 'Utilities' },

  // 💰 Finance
  { icon: 'account_balance', name: 'Bank', group: 'Finance' },
  { icon: 'account_balance_wallet', name: 'Wallet', group: 'Finance' },
  { icon: 'monetization_on', name: 'Money', group: 'Finance' },
  { icon: 'payments', name: 'Payments', group: 'Finance' },
  { icon: 'attach_money', name: 'Cash', group: 'Finance' },
  { icon: 'credit_card', name: 'Credit Card', group: 'Finance' },
  { icon: 'savings', name: 'Savings', group: 'Finance' },
  { icon: 'currency_exchange', name: 'Exchange', group: 'Finance' },
  { icon: 'request_quote', name: 'Invoice', group: 'Finance' },
  { icon: 'paid', name: 'Paid', group: 'Finance' },

  // 🧾 Documents
  { icon: 'description', name: 'Documents', group: 'Documents' },
  { icon: 'article', name: 'Article', group: 'Documents' },
  { icon: 'folder', name: 'Folder', group: 'Documents' },
  { icon: 'gavel', name: 'Legal', group: 'Documents' },
  { icon: 'policy', name: 'Insurance', group: 'Documents' },

  // 🏠 Home
  { icon: 'home', name: 'Home', group: 'Home' },
  { icon: 'apartment', name: 'Apartment', group: 'Home' },
  { icon: 'kitchen', name: 'Kitchen', group: 'Home' },
  { icon: 'bed', name: 'Bedroom', group: 'Home' },
  { icon: 'weekend', name: 'Furniture', group: 'Home' },

  // 🧰 Repairs
  { icon: 'build', name: 'Tools', group: 'Repairs' },
  { icon: 'construction', name: 'Construction', group: 'Repairs' },
  { icon: 'handyman', name: 'Handyman', group: 'Repairs' },
  { icon: 'plumbing', name: 'Plumbing', group: 'Repairs' },
  { icon: 'settings', name: 'Maintenance', group: 'Repairs' },

  // 🏥 Health & Wellness
  { icon: 'local_hospital', name: 'Hospital', group: 'Health' },
  { icon: 'health_and_safety', name: 'Health', group: 'Health' },
  { icon: 'medication', name: 'Medicine', group: 'Health' },
  { icon: 'fitness_center', name: 'Gym', group: 'Health' },
  { icon: 'spa', name: 'Spa', group: 'Health' },
  { icon: 'self_improvement', name: 'Wellness', group: 'Health' },

  // 👕 Personal
  { icon: 'checkroom', name: 'Clothing', group: 'Personal' },
  { icon: 'dry_cleaning', name: 'Laundry', group: 'Personal' },
  { icon: 'content_cut', name: 'Haircut', group: 'Personal' },
  { icon: 'face', name: 'Personal Care', group: 'Personal' },
  { icon: 'style', name: 'Fashion', group: 'Personal' },

  // 👶 Kids & Family
  { icon: 'family_restroom', name: 'Family', group: 'Family' },
  { icon: 'child_care', name: 'Childcare', group: 'Family' },
  { icon: 'child_friendly', name: 'Kids', group: 'Family' },
  { icon: 'baby_changing_station', name: 'Baby Care', group: 'Family' },
  { icon: 'toys', name: 'Toys', group: 'Family' },

  // 🎓 Education
  { icon: 'school', name: 'School', group: 'Education' },
  { icon: 'menu_book', name: 'Books', group: 'Education' },
  { icon: 'library_books', name: 'Library', group: 'Education' },
  { icon: 'edit', name: 'Study', group: 'Education' },

  // 🎮 Entertainment & Leisure
  { icon: 'movie', name: 'Movies', group: 'Entertainment' },
  { icon: 'music_note', name: 'Music', group: 'Entertainment' },
  { icon: 'sports_esports', name: 'Gaming', group: 'Entertainment' },
  { icon: 'live_tv', name: 'Streaming', group: 'Entertainment' },
  { icon: 'celebration', name: 'Party', group: 'Entertainment' },

  // 🏃 Activities
  { icon: 'sports_soccer', name: 'Football', group: 'Activities' },
  { icon: 'sports_cricket', name: 'Cricket', group: 'Activities' },
  { icon: 'sports_basketball', name: 'Basketball', group: 'Activities' },
  { icon: 'directions_run', name: 'Running', group: 'Activities' },

  // 🐾 Pets
  { icon: 'pets', name: 'Pets', group: 'Pets' },

  // 🎁 Charity & Gifts
  { icon: 'redeem', name: 'Gift', group: 'Charity & Gifts' },
  { icon: 'volunteer_activism', name: 'Charity', group: 'Charity & Gifts' },
  { icon: 'cake', name: 'Birthday', group: 'Charity & Gifts' },

  // 💼 Work
  { icon: 'work', name: 'Work', group: 'Work' },
  { icon: 'business_center', name: 'Business', group: 'Work' },
  { icon: 'computer', name: 'Tech', group: 'Work' },
  { icon: 'schedule', name: 'Schedule', group: 'Work' },

  // 📈 Investments
  { icon: 'show_chart', name: 'Stocks', group: 'Investments' },
  { icon: 'insights', name: 'Insights', group: 'Investments' },
  { icon: 'trending_up', name: 'Growth', group: 'Investments' },

  // 🏷️ Generic
  { icon: 'category', name: 'Category', group: 'Generic' },
  { icon: 'label', name: 'Label', group: 'Generic' },
  { icon: 'bookmark', name: 'Bookmark', group: 'Generic' },
  { icon: 'star', name: 'Favorite', group: 'Generic' },
  { icon: 'flag', name: 'Flag', group: 'Generic' },

  // 🎭 Lifestyle & Fun
  { icon: 'rocket_launch', name: 'Startups', group: 'Fun' },
  { icon: 'auto_awesome', name: 'Magic', group: 'Fun' },
  { icon: 'emoji_events', name: 'Trophy', group: 'Fun' },
  { icon: 'casino', name: 'Gambling', group: 'Fun' },
  { icon: 'sports_bar', name: 'Beer/Drinks', group: 'Fun' },
  { icon: 'nightlife', name: 'Parties', group: 'Fun' },
  { icon: 'outdoor_grill', name: 'BBQ', group: 'Fun' },
  { icon: 'palette', name: 'Art', group: 'Fun' },
  { icon: 'camera_alt', name: 'Photography', group: 'Fun' },
  { icon: 'hiking', name: 'Adventure', group: 'Fun' },
  { icon: 'surfing', name: 'Surfing', group: 'Fun' },
  { icon: 'icecream', name: 'Teats', group: 'Fun' },
  { icon: 'theater_comedy', name: 'Theater', group: 'Fun' },
  { icon: 'attractions', name: 'Amusement', group: 'Fun' },
  { icon: 'castle', name: 'Travel', group: 'Fun' },
];

export const ACCOUNT_ICONS: CategoryIcon[] = [
  // Core Financial
  { icon: 'account_balance', name: 'Bank', group: 'Core Financial' },
  { icon: 'account_balance_wallet', name: 'Wallet', group: 'Core Financial' },
  { icon: 'credit_card', name: 'Credit Card', group: 'Core Financial' },
  { icon: 'payments', name: 'Cash', group: 'Core Financial' },
  { icon: 'savings', name: 'Savings', group: 'Core Financial' },
  { icon: 'monetization_on', name: 'Income', group: 'Core Financial' },
  { icon: 'paid', name: 'Paid', group: 'Core Financial' },
  
  // Banking & Cards
  { icon: 'account_box', name: 'Personal Account', group: 'Banking & Cards' },
  { icon: 'business', name: 'Business Account', group: 'Banking & Cards' },
  { icon: 'security', name: 'Insurance', group: 'Banking & Cards' },
  { icon: 'contactless', name: 'Digital/Contactless', group: 'Banking & Cards' },
  { icon: 'wallet', name: 'Digital Wallet', group: 'Banking & Cards' },
  { icon: 'credit_score', name: 'Credit Score', group: 'Banking & Cards' },
  
  // Assets & Investments
  { icon: 'trending_up', name: 'Investment', group: 'Assets & Investments' },
  { icon: 'show_chart', name: 'Stocks', group: 'Assets & Investments' },
  { icon: 'currency_bitcoin', name: 'Crypto', group: 'Assets & Investments' },
  { icon: 'token', name: 'Digital Assets', group: 'Assets & Investments' },
  { icon: 'home', name: 'Real Estate', group: 'Assets & Investments' },
  { icon: 'directions_car', name: 'Vehicle', group: 'Assets & Investments' },
  { icon: 'diamond', name: 'Luxury/Gold', group: 'Assets & Investments' },
  
  // Usage Themed
  { icon: 'family_restroom', name: 'Family Account', group: 'Usage Combined' },
  { icon: 'groups', name: 'Shared Account', group: 'Usage Combined' },
  { icon: 'flight', name: 'Travel Fund', group: 'Usage Combined' },
  { icon: 'school', name: 'Education Fund', group: 'Usage Combined' },
  { icon: 'local_hospital', name: 'Medical Fund', group: 'Usage Combined' },
  { icon: 'work', name: 'Salary Account', group: 'Usage Combined' },
  { icon: 'storefront', name: 'Merchant Account', group: 'Usage Combined' },
  
  // Generic
  { icon: 'account_circle', name: 'Profile', group: 'Generic' },
  { icon: 'stars', name: 'Premium', group: 'Generic' },
  { icon: 'auto_awesome', name: 'Special', group: 'Generic' },
];


// Available colors for category selection
export const CATEGORY_COLORS: { label: string; value: string }[] = [
  // Vibrant & Modern
  { label: 'Emerald', value: '#10B981' },
  { label: 'Teal', value: '#14B8A6' },
  { label: 'Cyan', value: '#06B6D4' },
  { label: 'Sky', value: '#0EA5E9' },
  { label: 'Blue', value: '#3B82F6' },
  { label: 'Indigo', value: '#6366F1' },
  { label: 'Violet', value: '#8B5CF6' },
  { label: 'Purple', value: '#A855F7' },
  { label: 'Red', value: '#EF4444' },
  { label: 'Orange', value: '#F97316' },
  { label: 'Amber', value: '#F59E0B' },
  { label: 'Green', value: '#22C55E' },
  
  // Premium & Sophisticated
  { label: 'Midnight', value: '#1E293B' },
  { label: 'Charcoal', value: '#334155' },
  { label: 'Forest', value: '#064E3B' },
  { label: 'Burgundy', value: '#7F1D1D' },
  { label: 'Navy', value: '#1E3A8A' },
  { label: 'Grape', value: '#581C87' },
  { label: 'Chocolate', value: '#451A03' },
  
  // Soft & Elegant
  { label: 'Lavender', value: '#E8EAF6' },
  { label: 'Champagne', value: '#F7E7CE' },
  { label: 'Mint', value: '#D1FAE5' },
  { label: 'Peach', value: '#FFEDD5' },
  { label: 'Rose', value: '#F43F5E' },
  
  // Metallic
  { label: 'Gold', value: '#D4AF37' },
  { label: 'Silver', value: '#C0C0C0' },
  { label: 'Bronze', value: '#CD7F32' },
  { label: 'Platinum', value: '#E5E4E2' },
  { label: 'Slate', value: '#64748B' },
];


export const defaultCategoriesForNewUser: Category[] = [
  // Income Categories
  {
    name: 'Salary',
    type: TransactionType.INCOME,
    color: '#40916c', // Emerald 500
    icon: 'work',
    createdAt: Date.now(),
    isSystem: false,
    familyId: '',
    userId: '',
  },
  {
    name: 'Freelance',
    type: TransactionType.INCOME,
    color: '#40916c', // Teal 500
    icon: 'computer',
    createdAt: Date.now(),
    isSystem: false,
    familyId: '',
    userId: '',
  },
  {
    name: 'Investments',
    type: TransactionType.INCOME,
    color: '#40916c', // Gold
    icon: 'trending_up',
    createdAt: Date.now(),
    isSystem: false,
    familyId: '',
    userId: '',
  },
  {
    name: 'Gifts & Rewards',
    type: TransactionType.INCOME,
    color: '#40916c', // Fuchsia 500
    icon: 'card_giftcard',
    createdAt: Date.now(),
    isSystem: false,
    familyId: '',
    userId: '',
  },
  {
    name: 'Other Income',
    type: TransactionType.INCOME,
    color: '#40916c', // Slate 500
    icon: 'attach_money',
    createdAt: Date.now(),
    isSystem: false,
    familyId: '',
    userId: '',
  },

  // Expense Categories
  {
    name: 'Food & Dining',
    type: TransactionType.EXPENSE,
    color: '#40916c', // Amber 500
    icon: 'restaurant',
    createdAt: Date.now(),
    isSystem: false,
    familyId: '',
    userId: '',
  },
  {
    name: 'Transport & Fuel',
    type: TransactionType.EXPENSE,
    color: '#40916c', // Orange 500
    icon: 'directions_car',
    createdAt: Date.now(),
    isSystem: false,
    familyId: '',
    userId: '',
  },
  {
    name: 'Shopping',
    type: TransactionType.EXPENSE,
    color: '#40916c', // Pink 500
    icon: 'shopping_cart',
    createdAt: Date.now(),
    isSystem: false,
    familyId: '',
    userId: '',
  },
  {
    name: 'Bills & Utilities',
    type: TransactionType.EXPENSE,
    color: '#40916c', // Red 500
    icon: 'receipt_long',
    createdAt: Date.now(),
    isSystem: false,
    familyId: '',
    userId: '',
  },
  {
    name: 'Healthcare',
    type: TransactionType.EXPENSE,
    color: '#40916c', // Sky 500
    icon: 'local_hospital',
    createdAt: Date.now(),
    isSystem: false,
    familyId: '',
    userId: '',
  },
  {
    name: 'Entertainment',
    type: TransactionType.EXPENSE,
    color: '#40916c', // Violet 500
    icon: 'sports_esports',
    createdAt: Date.now(),
    isSystem: false,
    familyId: '',
    userId: '',
  },
  {
    name: 'Education',
    type: TransactionType.EXPENSE,
    color: '#40916c', // Indigo 500
    icon: 'school',
    createdAt: Date.now(),
    isSystem: false,
    familyId: '',
    userId: '',
  },
  {
    name: 'Travel',
    type: TransactionType.EXPENSE,
    color: '#40916c', // Blue 500
    icon: 'flight',
    createdAt: Date.now(),
    isSystem: false,
    familyId: '',
    userId: '',
  },
  {
    name: 'Family & Kids',
    type: TransactionType.EXPENSE,
    color: '#40916c', // Lime 500
    icon: 'family_restroom',
    createdAt: Date.now(),
    isSystem: false,
    familyId: '',
    userId: '',
  },
  {
    name: 'Charity',
    type: TransactionType.EXPENSE,
    color: '#40916c', // Yellow 500
    icon: 'volunteer_activism',
    createdAt: Date.now(),
    isSystem: false,
    familyId: '',
    userId: '',
  },
  {
    name: 'Other Expenses',
    type: TransactionType.EXPENSE,
    color: '#40916c', // Slate 400
    icon: 'category',
    createdAt: Date.now(),
    isSystem: false,
    familyId: '',
    userId: '',
  }
];

export const ACCOUNT_TYPE_OPTIONS = [
  { value: AccountType.BANK, label: 'Bank', icon: 'account_balance' },
  { value: AccountType.CASH, label: 'Cash', icon: 'payments' },
  { value: AccountType.CREDIT, label: 'Credit Card', icon: 'credit_card' },
  { value: AccountType.LOAN, label: 'Loan', icon: 'money' },
  { value: AccountType.INVESTMENT, label: 'Investment', icon: 'trending_up' }
];

export const GROUP_ICON_OPTIONS: { icon: string; label: string }[] = [
  { icon: 'family_restroom', label: 'Family' },
  { icon: 'home', label: 'Home & Household' },
  { icon: 'work', label: 'Work' },
  { icon: 'groups', label: 'Friends' },
  { icon: 'favorite', label: 'Loved Ones' },
  { icon: 'school', label: 'Education' },
  { icon: 'savings', label: 'Savings & Goals' },
  { icon: 'account_balance', label: 'Bills & Payments' },
  { icon: 'restaurant', label: 'Food & Dining' },
  { icon: 'directions_car', label: 'Transport' },
  { icon: 'flight', label: 'Travel' },
  { icon: 'sports_soccer', label: 'Sports & Fitness' },
  { icon: 'celebration', label: 'Events & Parties' },
  { icon: 'volunteer_activism', label: 'Donations' },
  { icon: 'pets', label: 'Pets' },
  { icon: 'health_and_safety', label: 'Health' },
];

/** Curated categories seeded per group type based on the selected icon. */
export const GROUP_CATEGORIES_MAP: Record<string, Pick<Category, 'name' | 'type' | 'icon' | 'color' | 'isSystem' | 'familyId' | 'userId' | 'createdAt'>[]> = {

  // 👨‍👩‍👧 Family
  family_restroom: [
    { name: 'Food & Dining', type: TransactionType.EXPENSE, icon: 'restaurant', color: '#F59E0B', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Groceries', type: TransactionType.EXPENSE, icon: 'local_grocery_store', color: '#10B981', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Bills & Utilities', type: TransactionType.EXPENSE, icon: 'receipt_long', color: '#EF4444', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Education', type: TransactionType.EXPENSE, icon: 'school', color: '#6366F1', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Healthcare', type: TransactionType.EXPENSE, icon: 'local_hospital', color: '#0EA5E9', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Transport', type: TransactionType.EXPENSE, icon: 'directions_car', color: '#F97316', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Shopping', type: TransactionType.EXPENSE, icon: 'shopping_cart', color: '#A855F7', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Entertainment', type: TransactionType.EXPENSE, icon: 'movie', color: '#8B5CF6', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Family & Kids', type: TransactionType.EXPENSE, icon: 'child_care', color: '#14B8A6', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Household Income', type: TransactionType.INCOME, icon: 'account_balance_wallet', color: '#22C55E', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Other', type: TransactionType.EXPENSE, icon: 'category', color: '#64748B', isSystem: false, familyId: '', userId: '', createdAt: 0 },
  ],

  // 🏠 Home & Household
  home: [
    { name: 'Rent / EMI', type: TransactionType.EXPENSE, icon: 'home', color: '#EF4444', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Groceries', type: TransactionType.EXPENSE, icon: 'local_grocery_store', color: '#10B981', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Electricity', type: TransactionType.EXPENSE, icon: 'lightbulb', color: '#F59E0B', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Water', type: TransactionType.EXPENSE, icon: 'water_drop', color: '#0EA5E9', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Internet', type: TransactionType.EXPENSE, icon: 'wifi', color: '#6366F1', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Gas / Cooking', type: TransactionType.EXPENSE, icon: 'local_fire_department', color: '#F97316', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Maintenance & Repairs', type: TransactionType.EXPENSE, icon: 'handyman', color: '#64748B', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Household Items', type: TransactionType.EXPENSE, icon: 'cleaning_services', color: '#14B8A6', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Home Income', type: TransactionType.INCOME, icon: 'account_balance_wallet', color: '#22C55E', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Other', type: TransactionType.EXPENSE, icon: 'category', color: '#64748B', isSystem: false, familyId: '', userId: '', createdAt: 0 },
  ],

  // 💼 Work
  work: [
    { name: 'Office Supplies', type: TransactionType.EXPENSE, icon: 'business_center', color: '#64748B', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Work Meals', type: TransactionType.EXPENSE, icon: 'lunch_dining', color: '#F59E0B', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Commute', type: TransactionType.EXPENSE, icon: 'commute', color: '#F97316', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Software & Tools', type: TransactionType.EXPENSE, icon: 'computer', color: '#6366F1', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Training & Courses', type: TransactionType.EXPENSE, icon: 'menu_book', color: '#8B5CF6', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Printing & Stationery', type: TransactionType.EXPENSE, icon: 'print', color: '#0EA5E9', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Business Travel', type: TransactionType.EXPENSE, icon: 'flight', color: '#14B8A6', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Salary / Income', type: TransactionType.INCOME, icon: 'work', color: '#22C55E', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Freelance Income', type: TransactionType.INCOME, icon: 'computer', color: '#10B981', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Other', type: TransactionType.EXPENSE, icon: 'category', color: '#64748B', isSystem: false, familyId: '', userId: '', createdAt: 0 },
  ],

  // 👥 Friends
  groups: [
    { name: 'Food & Drinks', type: TransactionType.EXPENSE, icon: 'restaurant', color: '#F59E0B', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Entertainment', type: TransactionType.EXPENSE, icon: 'movie', color: '#8B5CF6', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Travel', type: TransactionType.EXPENSE, icon: 'flight', color: '#0EA5E9', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Shopping', type: TransactionType.EXPENSE, icon: 'shopping_bag', color: '#A855F7', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Activities', type: TransactionType.EXPENSE, icon: 'sports_soccer', color: '#10B981', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Gifts', type: TransactionType.EXPENSE, icon: 'card_giftcard', color: '#F97316', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Events', type: TransactionType.EXPENSE, icon: 'celebration', color: '#EF4444', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Contributions', type: TransactionType.INCOME, icon: 'account_balance_wallet', color: '#22C55E', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Other', type: TransactionType.EXPENSE, icon: 'category', color: '#64748B', isSystem: false, familyId: '', userId: '', createdAt: 0 },
  ],

  // ❤️ Loved Ones
  favorite: [
    { name: 'Gifts', type: TransactionType.EXPENSE, icon: 'card_giftcard', color: '#F43F5E', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Dining Out', type: TransactionType.EXPENSE, icon: 'restaurant', color: '#F59E0B', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Activities & Fun', type: TransactionType.EXPENSE, icon: 'attractions', color: '#8B5CF6', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Travel', type: TransactionType.EXPENSE, icon: 'flight', color: '#0EA5E9', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Movies & Shows', type: TransactionType.EXPENSE, icon: 'movie', color: '#6366F1', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Special Occasions', type: TransactionType.EXPENSE, icon: 'cake', color: '#F97316', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Shopping', type: TransactionType.EXPENSE, icon: 'shopping_bag', color: '#A855F7', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Contributions', type: TransactionType.INCOME, icon: 'account_balance_wallet', color: '#22C55E', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Other', type: TransactionType.EXPENSE, icon: 'category', color: '#64748B', isSystem: false, familyId: '', userId: '', createdAt: 0 },
  ],

  // 🎓 Education
  school: [
    { name: 'Tuition / Fees', type: TransactionType.EXPENSE, icon: 'school', color: '#6366F1', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Books & Stationery', type: TransactionType.EXPENSE, icon: 'menu_book', color: '#F59E0B', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Online Courses', type: TransactionType.EXPENSE, icon: 'computer', color: '#8B5CF6', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Uniform & Clothing', type: TransactionType.EXPENSE, icon: 'checkroom', color: '#0EA5E9', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Transport', type: TransactionType.EXPENSE, icon: 'directions_bus', color: '#F97316', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Meals', type: TransactionType.EXPENSE, icon: 'lunch_dining', color: '#10B981', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Exam Fees', type: TransactionType.EXPENSE, icon: 'edit', color: '#EF4444', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Scholarships / Income', type: TransactionType.INCOME, icon: 'account_balance_wallet', color: '#22C55E', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Other', type: TransactionType.EXPENSE, icon: 'category', color: '#64748B', isSystem: false, familyId: '', userId: '', createdAt: 0 },
  ],

  // 💰 Savings & Goals
  savings: [
    { name: 'Emergency Fund', type: TransactionType.INCOME, icon: 'health_and_safety', color: '#EF4444', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Vacation Fund', type: TransactionType.INCOME, icon: 'flight', color: '#0EA5E9', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Home / Down Payment', type: TransactionType.INCOME, icon: 'home', color: '#10B981', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Vehicle Fund', type: TransactionType.INCOME, icon: 'directions_car', color: '#F97316', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Investment', type: TransactionType.INCOME, icon: 'trending_up', color: '#22C55E', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Retirement', type: TransactionType.INCOME, icon: 'savings', color: '#6366F1', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Withdrawal', type: TransactionType.EXPENSE, icon: 'account_balance_wallet', color: '#64748B', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Other Goal', type: TransactionType.INCOME, icon: 'category', color: '#A855F7', isSystem: false, familyId: '', userId: '', createdAt: 0 },
  ],

  // 🧾 Bills & Payments
  account_balance: [
    { name: 'Electricity', type: TransactionType.EXPENSE, icon: 'lightbulb', color: '#F59E0B', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Water', type: TransactionType.EXPENSE, icon: 'water_drop', color: '#0EA5E9', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Internet', type: TransactionType.EXPENSE, icon: 'wifi', color: '#6366F1', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Mobile / Phone', type: TransactionType.EXPENSE, icon: 'phone', color: '#10B981', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Gas', type: TransactionType.EXPENSE, icon: 'local_fire_department', color: '#EF4444', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Insurance', type: TransactionType.EXPENSE, icon: 'policy', color: '#64748B', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Rent / EMI', type: TransactionType.EXPENSE, icon: 'home', color: '#F97316', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Subscriptions', type: TransactionType.EXPENSE, icon: 'live_tv', color: '#8B5CF6', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Credit Card', type: TransactionType.EXPENSE, icon: 'credit_card', color: '#A855F7', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Contributions', type: TransactionType.INCOME, icon: 'account_balance_wallet', color: '#22C55E', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Other', type: TransactionType.EXPENSE, icon: 'category', color: '#64748B', isSystem: false, familyId: '', userId: '', createdAt: 0 },
  ],

  // 🍽️ Food & Dining
  restaurant: [
    { name: 'Groceries', type: TransactionType.EXPENSE, icon: 'local_grocery_store', color: '#10B981', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Restaurants', type: TransactionType.EXPENSE, icon: 'restaurant', color: '#F59E0B', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Food Delivery', type: TransactionType.EXPENSE, icon: 'delivery_dining', color: '#F97316', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Cafe & Coffee', type: TransactionType.EXPENSE, icon: 'local_cafe', color: '#92400E', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Street Food & Snacks', type: TransactionType.EXPENSE, icon: 'fastfood', color: '#EF4444', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Alcohol & Drinks', type: TransactionType.EXPENSE, icon: 'liquor', color: '#8B5CF6', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Contributions', type: TransactionType.INCOME, icon: 'account_balance_wallet', color: '#22C55E', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Other', type: TransactionType.EXPENSE, icon: 'category', color: '#64748B', isSystem: false, familyId: '', userId: '', createdAt: 0 },
  ],

  // 🚗 Transport
  directions_car: [
    { name: 'Fuel / Petrol', type: TransactionType.EXPENSE, icon: 'local_gas_station', color: '#F97316', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Vehicle Maintenance', type: TransactionType.EXPENSE, icon: 'build', color: '#64748B', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Vehicle Insurance', type: TransactionType.EXPENSE, icon: 'policy', color: '#6366F1', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Parking', type: TransactionType.EXPENSE, icon: 'local_parking', color: '#0EA5E9', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Toll Charges', type: TransactionType.EXPENSE, icon: 'toll', color: '#EF4444', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Cab / Taxi', type: TransactionType.EXPENSE, icon: 'local_taxi', color: '#F59E0B', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Bus / Train', type: TransactionType.EXPENSE, icon: 'train', color: '#10B981', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Auto / Rickshaw', type: TransactionType.EXPENSE, icon: 'two_wheeler', color: '#A855F7', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Contributions', type: TransactionType.INCOME, icon: 'account_balance_wallet', color: '#22C55E', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Other', type: TransactionType.EXPENSE, icon: 'category', color: '#64748B', isSystem: false, familyId: '', userId: '', createdAt: 0 },
  ],

  // ✈️ Travel
  flight: [
    // 🚗 Transport
    { name: 'Fuel / Petrol', type: TransactionType.EXPENSE, icon: 'local_gas_station', color: '#F97316', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Cab / Taxi', type: TransactionType.EXPENSE, icon: 'local_taxi', color: '#F59E0B', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Bus / Train', type: TransactionType.EXPENSE, icon: 'train', color: '#10B981', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Flights', type: TransactionType.EXPENSE, icon: 'flight', color: '#0EA5E9', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Auto / Rickshaw', type: TransactionType.EXPENSE, icon: 'two_wheeler', color: '#A855F7', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Parking & Toll', type: TransactionType.EXPENSE, icon: 'local_parking', color: '#64748B', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    // 🏨 Accommodation
    { name: 'Hotel / Resort', type: TransactionType.EXPENSE, icon: 'hotel', color: '#6366F1', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Hostel / Airbnb', type: TransactionType.EXPENSE, icon: 'holiday_village', color: '#8B5CF6', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    // 🍽️ Food & Drinks
    { name: 'Restaurants', type: TransactionType.EXPENSE, icon: 'restaurant', color: '#F59E0B', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Street Food & Snacks', type: TransactionType.EXPENSE, icon: 'fastfood', color: '#EF4444', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Tea / Coffee', type: TransactionType.EXPENSE, icon: 'local_cafe', color: '#92400E', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    // 🎟️ Activities
    { name: 'Entry Tickets', type: TransactionType.EXPENSE, icon: 'confirmation_number', color: '#F43F5E', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Adventure Activities', type: TransactionType.EXPENSE, icon: 'hiking', color: '#14B8A6', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Guide Charges', type: TransactionType.EXPENSE, icon: 'person', color: '#06B6D4', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    // 🛍️ Shopping
    { name: 'Souvenirs & Shopping', type: TransactionType.EXPENSE, icon: 'shopping_bag', color: '#A855F7', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    // 📶 Connectivity
    { name: 'Mobile & SIM', type: TransactionType.EXPENSE, icon: 'sim_card', color: '#22C55E', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    // 🧾 Travel Essentials
    { name: 'Travel Insurance', type: TransactionType.EXPENSE, icon: 'policy', color: '#1E3A8A', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Medicines & Toiletries', type: TransactionType.EXPENSE, icon: 'medication', color: '#0EA5E9', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    // 💰 Fees & Misc
    { name: 'Tips & Service Charges', type: TransactionType.EXPENSE, icon: 'payments', color: '#D4AF37', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Luggage & Misc Fees', type: TransactionType.EXPENSE, icon: 'luggage', color: '#64748B', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    // 💵 Income
    { name: 'Travel Budget', type: TransactionType.INCOME, icon: 'account_balance_wallet', color: '#22C55E', isSystem: false, familyId: '', userId: '', createdAt: 0 },
  ],

  // ⚽ Sports & Fitness
  sports_soccer: [
    { name: 'Gym Membership', type: TransactionType.EXPENSE, icon: 'fitness_center', color: '#EF4444', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Sports Equipment', type: TransactionType.EXPENSE, icon: 'sports_soccer', color: '#F97316', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Sport Fees / Court', type: TransactionType.EXPENSE, icon: 'sports', color: '#F59E0B', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Supplements / Nutrition', type: TransactionType.EXPENSE, icon: 'medication', color: '#10B981', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Sportswear', type: TransactionType.EXPENSE, icon: 'checkroom', color: '#6366F1', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Events & Matches', type: TransactionType.EXPENSE, icon: 'emoji_events', color: '#8B5CF6', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Coaching / Training', type: TransactionType.EXPENSE, icon: 'school', color: '#0EA5E9', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Transport', type: TransactionType.EXPENSE, icon: 'directions_car', color: '#64748B', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Contributions', type: TransactionType.INCOME, icon: 'account_balance_wallet', color: '#22C55E', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Other', type: TransactionType.EXPENSE, icon: 'category', color: '#64748B', isSystem: false, familyId: '', userId: '', createdAt: 0 },
  ],

  // 🎉 Events & Parties
  celebration: [
    { name: 'Venue', type: TransactionType.EXPENSE, icon: 'location_on', color: '#F43F5E', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Food & Catering', type: TransactionType.EXPENSE, icon: 'restaurant', color: '#F59E0B', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Decoration', type: TransactionType.EXPENSE, icon: 'palette', color: '#A855F7', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Entertainment', type: TransactionType.EXPENSE, icon: 'music_note', color: '#8B5CF6', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Gifts', type: TransactionType.EXPENSE, icon: 'card_giftcard', color: '#F97316', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Photography', type: TransactionType.EXPENSE, icon: 'camera_alt', color: '#0EA5E9', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Travel & Transport', type: TransactionType.EXPENSE, icon: 'directions_car', color: '#14B8A6', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Invitations & Printing', type: TransactionType.EXPENSE, icon: 'print', color: '#64748B', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Contributions', type: TransactionType.INCOME, icon: 'account_balance_wallet', color: '#22C55E', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Other', type: TransactionType.EXPENSE, icon: 'category', color: '#64748B', isSystem: false, familyId: '', userId: '', createdAt: 0 },
  ],

  // 🤲 Donations
  volunteer_activism: [
    { name: 'Charity', type: TransactionType.EXPENSE, icon: 'volunteer_activism', color: '#F43F5E', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Religious / Temple', type: TransactionType.EXPENSE, icon: 'temple_hindu', color: '#F59E0B', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Medical Aid', type: TransactionType.EXPENSE, icon: 'local_hospital', color: '#EF4444', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Education Support', type: TransactionType.EXPENSE, icon: 'school', color: '#6366F1', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Animal Welfare', type: TransactionType.EXPENSE, icon: 'pets', color: '#10B981', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Community Service', type: TransactionType.EXPENSE, icon: 'groups', color: '#0EA5E9', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Fundraising Income', type: TransactionType.INCOME, icon: 'account_balance_wallet', color: '#22C55E', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Other', type: TransactionType.EXPENSE, icon: 'category', color: '#64748B', isSystem: false, familyId: '', userId: '', createdAt: 0 },
  ],

  // 🐾 Pets
  pets: [
    { name: 'Pet Food', type: TransactionType.EXPENSE, icon: 'pets', color: '#F59E0B', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Vet / Medical', type: TransactionType.EXPENSE, icon: 'local_hospital', color: '#EF4444', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Grooming', type: TransactionType.EXPENSE, icon: 'content_cut', color: '#8B5CF6', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Accessories', type: TransactionType.EXPENSE, icon: 'shopping_bag', color: '#F97316', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Toys', type: TransactionType.EXPENSE, icon: 'toys', color: '#10B981', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Training', type: TransactionType.EXPENSE, icon: 'school', color: '#6366F1', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Boarding / Sitting', type: TransactionType.EXPENSE, icon: 'home', color: '#0EA5E9', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Contributions', type: TransactionType.INCOME, icon: 'account_balance_wallet', color: '#22C55E', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Other', type: TransactionType.EXPENSE, icon: 'category', color: '#64748B', isSystem: false, familyId: '', userId: '', createdAt: 0 },
  ],

  // 🏥 Health
  health_and_safety: [
    { name: 'Doctor / Consultation', type: TransactionType.EXPENSE, icon: 'medical_services', color: '#0EA5E9', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Medicine', type: TransactionType.EXPENSE, icon: 'medication', color: '#EF4444', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Lab Tests / Diagnostics', type: TransactionType.EXPENSE, icon: 'biotech', color: '#F97316', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Hospital / Surgery', type: TransactionType.EXPENSE, icon: 'local_hospital', color: '#F43F5E', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Health Insurance', type: TransactionType.EXPENSE, icon: 'policy', color: '#6366F1', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Gym & Fitness', type: TransactionType.EXPENSE, icon: 'fitness_center', color: '#10B981', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Mental Health / Therapy', type: TransactionType.EXPENSE, icon: 'self_improvement', color: '#8B5CF6', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Dental & Eye Care', type: TransactionType.EXPENSE, icon: 'health_and_safety', color: '#14B8A6', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Contributions', type: TransactionType.INCOME, icon: 'account_balance_wallet', color: '#22C55E', isSystem: false, familyId: '', userId: '', createdAt: 0 },
    { name: 'Other', type: TransactionType.EXPENSE, icon: 'category', color: '#64748B', isSystem: false, familyId: '', userId: '', createdAt: 0 },
  ],
};