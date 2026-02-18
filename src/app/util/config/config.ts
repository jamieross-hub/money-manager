import { Category } from '../models';
import { CurrencyCode, LanguageCode, ThemeType, DateRangePreset, TransactionType } from './enums';

/**
 * Application configuration constants
 */
export const APP_CONFIG = {
  // App metadata
  APP_NAME: 'Money Manager',
  APP_VERSION: '1.0.0',
  APP_DESCRIPTION: 'Personal finance management application',
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
    MAX_ACCOUNT_BALANCE: 999999999.99
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
    UPDATED: 'Item updated successfully'
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
}

export const CATEGORY_ICONS: CategoryIcon[] = [
  // 💰 Finance & Budgeting
  { icon: 'account_balance', name: 'Bank' },
  { icon: 'account_balance_wallet', name: 'Wallet' },
  { icon: 'monetization_on', name: 'Money' },
  { icon: 'payments', name: 'Payments' },
  { icon: 'receipt', name: 'Receipt' },
  { icon: 'receipt_long', name: 'Bills' },
  { icon: 'savings', name: 'Savings' },
  { icon: 'trending_up', name: 'Growth' },
  { icon: 'attach_money', name: 'Cash' },

  // 🛒 Shopping & Purchases
  { icon: 'card_giftcard', name: 'Gift Card' },
  { icon: 'local_offer', name: 'Deals' },
  { icon: 'shopping_bag', name: 'Shopping Bag' },
  { icon: 'shopping_cart', name: 'Shopping' },
  { icon: 'store', name: 'Store' },
  { icon: 'storefront', name: 'Market' },

  // 🍽️ Food & Dining
  { icon: 'fastfood', name: 'Fast Food' },
  { icon: 'liquor', name: 'Drinks' },
  { icon: 'local_cafe', name: 'Cafe' },
  { icon: 'local_dining', name: 'Dining' },
  { icon: 'restaurant', name: 'Restaurant' },

  // 🚗 Transportation & Travel
  { icon: 'commute', name: 'Commute' },
  { icon: 'directions_bus', name: 'Bus' },
  { icon: 'directions_car', name: 'Car' },
  { icon: 'flight', name: 'Flight' },
  { icon: 'two_wheeler', name: 'Bike' },
  { icon: 'local_gas_station', name: 'Fuel' },

  // 🏠 Home & Bills
  { icon: 'home', name: 'Home' },
  { icon: 'electrical_services', name: 'Electricity' },
  { icon: 'kitchen', name: 'Kitchen' },
  { icon: 'lightbulb', name: 'Utilities' },
  { icon: 'phone', name: 'Phone' },
  { icon: 'water_drop', name: 'Water' },
  { icon: 'wifi', name: 'Internet' },

  // 🏥 Health & Wellness
  { icon: 'health_and_safety', name: 'Health' },
  { icon: 'local_hospital', name: 'Hospital' },
  { icon: 'fitness_center', name: 'Gym' },
  { icon: 'spa', name: 'Spa' },
  { icon: 'self_improvement', name: 'Wellness' },

  // 🎓 Education
  { icon: 'menu_book', name: 'Books' },
  { icon: 'school', name: 'School' },

  // 🧒 Family & Children
  { icon: 'child_care', name: 'Childcare' },
  { icon: 'child_friendly', name: 'Kids' },
  { icon: 'family_restroom', name: 'Family' },

  // 🎉 Entertainment & Leisure
  { icon: 'celebration', name: 'Party' },
  { icon: 'movie', name: 'Movies' },
  { icon: 'music_note', name: 'Music' },
  { icon: 'sports_esports', name: 'Gaming' },
  { icon: 'live_tv', name: 'Streaming' },

  // 📈 Investment & Income
  { icon: 'show_chart', name: 'Stocks' },
  { icon: 'insights', name: 'Insights' },

  // 💼 Work & Business
  { icon: 'business_center', name: 'Business' },
  { icon: 'work', name: 'Work' },
  { icon: 'schedule', name: 'Schedule' },
  { icon: 'computer', name: 'Tech' },

  // 🤝 Charity & Giving
  { icon: 'redeem', name: 'Gifts' },
  { icon: 'volunteer_activism', name: 'Charity' },

  // 🧾 Tax & Insurance
  { icon: 'description', name: 'Documents' },
  { icon: 'gavel', name: 'Legal' },
  { icon: 'policy', name: 'Insurance' },

  // 🐾 Pets
  { icon: 'pets', name: 'Pets' },

  // 🏷️ General
  { icon: 'category', name: 'Category' },
  { icon: 'label', name: 'Label' },
  { icon: 'star', name: 'Favorite' },
  { icon: 'bookmark', name: 'Bookmark' },
];


// Available colors for category selection
export const CATEGORY_COLORS: { label: string; value: string }[] = [
  { label: 'Emerald', value: '#10B981' },
  { label: 'Teal', value: '#14B8A6' },
  { label: 'Cyan', value: '#06B6D4' },
  { label: 'Sky', value: '#0EA5E9' },
  { label: 'Blue', value: '#3B82F6' },
  { label: 'Indigo', value: '#6366F1' },
  { label: 'Violet', value: '#8B5CF6' },
  { label: 'Purple', value: '#A855F7' },
  { label: 'Fuchsia', value: '#D946EF' },
  { label: 'Pink', value: '#EC4899' },
  { label: 'Rose', value: '#F43F5E' },
  { label: 'Red', value: '#EF4444' },
  { label: 'Orange', value: '#F97316' },
  { label: 'Amber', value: '#F59E0B' },
  { label: 'Yellow', value: '#EAB308' },
  { label: 'Lime', value: '#84CC16' },
  { label: 'Green', value: '#22C55E' },
  { label: 'Slate', value: '#64748B' },
  { label: 'Gold', value: '#FFD700' },
  { label: 'Platinum', value: '#E5E4E2' },
];


export const defaultCategoriesForNewUser: Category[] = [
  // Income Categories
  {
    name: 'Salary',
    type: TransactionType.INCOME,
    color: '#40916c', // Emerald 500
    icon: 'work',
    createdAt: Date.now(),
  },
  {
    name: 'Freelance',
    type: TransactionType.INCOME,
    color: '#40916c', // Teal 500
    icon: 'computer',
    createdAt: Date.now(),
  },
  {
    name: 'Investments',
    type: TransactionType.INCOME,
    color: '#40916c', // Gold
    icon: 'trending_up',
    createdAt: Date.now(),
  },
  {
    name: 'Gifts & Rewards',
    type: TransactionType.INCOME,
    color: '#40916c', // Fuchsia 500
    icon: 'card_giftcard',
    createdAt: Date.now(),
  },
  {
    name: 'Other Income',
    type: TransactionType.INCOME,
    color: '#40916c', // Slate 500
    icon: 'attach_money',
    createdAt: Date.now(),
  },

  // Expense Categories
  {
    name: 'Food & Dining',
    type: TransactionType.EXPENSE,
    color: '#40916c', // Amber 500
    icon: 'restaurant',
    createdAt: Date.now(),
  },
  {
    name: 'Transport & Fuel',
    type: TransactionType.EXPENSE,
    color: '#40916c', // Orange 500
    icon: 'directions_car',
    createdAt: Date.now(),
  },
  {
    name: 'Shopping',
    type: TransactionType.EXPENSE,
    color: '#40916c', // Pink 500
    icon: 'shopping_cart',
    createdAt: Date.now(),
  },
  {
    name: 'Bills & Utilities',
    type: TransactionType.EXPENSE,
    color: '#40916c', // Red 500
    icon: 'receipt_long',
    createdAt: Date.now(),
  },
  {
    name: 'Healthcare',
    type: TransactionType.EXPENSE,
    color: '#40916c', // Sky 500
    icon: 'local_hospital',
    createdAt: Date.now(),
  },
  {
    name: 'Entertainment',
    type: TransactionType.EXPENSE,
    color: '#40916c', // Violet 500
    icon: 'sports_esports',
    createdAt: Date.now(),
  },
  {
    name: 'Education',
    type: TransactionType.EXPENSE,
    color: '#40916c', // Indigo 500
    icon: 'school',
    createdAt: Date.now(),
  },
  {
    name: 'Travel',
    type: TransactionType.EXPENSE,
    color: '#40916c', // Blue 500
    icon: 'flight',
    createdAt: Date.now(),
  },
  {
    name: 'Family & Kids',
    type: TransactionType.EXPENSE,
    color: '#40916c', // Lime 500
    icon: 'family_restroom',
    createdAt: Date.now(),
  },
  {
    name: 'Charity',
    type: TransactionType.EXPENSE,
    color: '#40916c', // Yellow 500
    icon: 'volunteer_activism',
    createdAt: Date.now(),
  },
  {
    name: 'Other Expenses',
    type: TransactionType.EXPENSE,
    color: '#40916c', // Slate 400
    icon: 'category',
    createdAt: Date.now(),
  },
];