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
    LANGUAGE_DEFAULT: LanguageCode.IN_EN,

    COUNTRY_MAPPING: {
      // Americas - North
      'US': {
        currency: CurrencyCode.USD,
        language: LanguageCode.EN,
        languageName: 'English',
        timezones: [
          'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'America/Denver',
          'America/Phoenix', 'America/Detroit', 'America/Anchorage', 'America/Honolulu'
        ],
        symbol: '$',
        decimalPlaces: 2
      },
      'CA': {
        currency: CurrencyCode.CAD,
        language: LanguageCode.EN,
        languageName: 'English',
        timezones: ['America/Toronto', 'America/Vancouver', 'America/Montreal', 'America/Edmonton'],
        symbol: 'C$',
        decimalPlaces: 2
      },
      'MX': {
        currency: CurrencyCode.MXN,
        language: LanguageCode.ES_MX,
        languageName: 'Español (México)',
        timezones: ['America/Mexico_City'],
        symbol: '$',
        decimalPlaces: 2
      },

      // Americas - South
      'BR': {
        currency: CurrencyCode.BRL,
        language: LanguageCode.PT_BR,
        languageName: 'Português (Brasil)',
        timezones: ['America/Sao_Paulo'],
        symbol: 'R$',
        decimalPlaces: 2
      },
      'AR': {
        currency: CurrencyCode.ARS,
        language: LanguageCode.ES_AR,
        languageName: 'Español (Argentina)',
        timezones: ['America/Argentina/Buenos_Aires'],
        symbol: '$',
        decimalPlaces: 2
      },
      'CL': {
        currency: CurrencyCode.CLP,
        language: LanguageCode.ES,
        languageName: 'Español',
        timezones: ['America/Santiago'],
        symbol: '$',
        decimalPlaces: 0
      },
      'CO': {
        currency: CurrencyCode.COP,
        language: LanguageCode.ES,
        languageName: 'Español',
        timezones: ['America/Bogota'],
        symbol: '$',
        decimalPlaces: 2
      },
      'PE': {
        currency: CurrencyCode.PEN,
        language: LanguageCode.ES,
        languageName: 'Español',
        timezones: ['America/Lima'],
        symbol: 'S/',
        decimalPlaces: 2
      },

      // Europe - Major
      'GB': {
        currency: CurrencyCode.GBP,
        language: LanguageCode.EN,
        languageName: 'English',
        timezones: ['Europe/London'],
        symbol: '£',
        decimalPlaces: 2
      },
      'CH': {
        currency: CurrencyCode.CHF,
        language: LanguageCode.DE,
        languageName: 'Deutsch',
        timezones: ['Europe/Zurich'],
        symbol: 'Fr',
        decimalPlaces: 2
      },
      'SE': {
        currency: CurrencyCode.SEK,
        language: LanguageCode.SV,
        languageName: 'Svenska',
        timezones: ['Europe/Stockholm'],
        symbol: 'kr',
        decimalPlaces: 2
      },
      'NO': {
        currency: CurrencyCode.NOK,
        language: LanguageCode.NO,
        languageName: 'Norsk',
        timezones: ['Europe/Oslo'],
        symbol: 'kr',
        decimalPlaces: 2
      },
      'DK': {
        currency: CurrencyCode.DKK,
        language: LanguageCode.DA,
        languageName: 'Dansk',
        timezones: ['Europe/Copenhagen'],
        symbol: 'kr',
        decimalPlaces: 2
      },
      'PL': {
        currency: CurrencyCode.PLN,
        language: LanguageCode.PL,
        languageName: 'Polski',
        timezones: ['Europe/Warsaw'],
        symbol: 'zł',
        decimalPlaces: 2
      },
      'RU': {
        currency: CurrencyCode.RUB,
        language: LanguageCode.RU,
        languageName: 'Русский',
        timezones: ['Europe/Moscow'],
        symbol: '₽',
        decimalPlaces: 2
      },
      'TR': {
        currency: CurrencyCode.TRY,
        language: LanguageCode.TR,
        languageName: 'Türkçe',
        timezones: ['Europe/Istanbul'],
        symbol: '₺',
        decimalPlaces: 2
      },

      // Eurozone countries
      'DE': { currency: CurrencyCode.EUR, language: LanguageCode.DE, languageName: 'Deutsch', timezones: ['Europe/Berlin'], symbol: '€', decimalPlaces: 2 },
      'FR': { currency: CurrencyCode.EUR, language: LanguageCode.FR, languageName: 'Français', timezones: ['Europe/Paris'], symbol: '€', decimalPlaces: 2 },
      'IT': { currency: CurrencyCode.EUR, language: LanguageCode.IT, languageName: 'Italiano', timezones: ['Europe/Rome'], symbol: '€', decimalPlaces: 2 },
      'ES': { currency: CurrencyCode.EUR, language: LanguageCode.ES, languageName: 'Español', timezones: ['Europe/Madrid'], symbol: '€', decimalPlaces: 2 },
      'PT': { currency: CurrencyCode.EUR, language: LanguageCode.PT, languageName: 'Português', timezones: ['Europe/Lisbon'], symbol: '€', decimalPlaces: 2 },
      'NL': { currency: CurrencyCode.EUR, language: LanguageCode.NL, languageName: 'Nederlands', timezones: ['Europe/Amsterdam'], symbol: '€', decimalPlaces: 2 },
      'BE': { currency: CurrencyCode.EUR, language: LanguageCode.FR, languageName: 'Français', timezones: ['Europe/Brussels'], symbol: '€', decimalPlaces: 2 },
      'AT': { currency: CurrencyCode.EUR, language: LanguageCode.DE, languageName: 'Deutsch', timezones: ['Europe/Vienna'], symbol: '€', decimalPlaces: 2 },
      'IE': { currency: CurrencyCode.EUR, language: LanguageCode.EN, languageName: 'English', timezones: ['Europe/Dublin'], symbol: '€', decimalPlaces: 2 },
      'FI': { currency: CurrencyCode.EUR, language: LanguageCode.FI, languageName: 'Suomi', timezones: ['Europe/Helsinki'], symbol: '€', decimalPlaces: 2 },
      'GR': { currency: CurrencyCode.EUR, language: LanguageCode.EN, languageName: 'English', timezones: ['Europe/Athens'], symbol: '€', decimalPlaces: 2 },
      'UA': { currency: CurrencyCode.EUR, language: LanguageCode.EN, languageName: 'English', timezones: ['Europe/Kiev'], symbol: '€', decimalPlaces: 2 },
      'RO': { currency: CurrencyCode.EUR, language: LanguageCode.EN, languageName: 'English', timezones: ['Europe/Bucharest'], symbol: '€', decimalPlaces: 2 },

      // Asia Pacific
      'IN': {
        currency: CurrencyCode.INR,
        language: LanguageCode.IN_EN,
        languageName: 'English (India)',
        timezones: ['Asia/Kolkata', 'Asia/Calcutta'],
        symbol: '₹',
        decimalPlaces: 2
      },
      'CN': {
        currency: CurrencyCode.CNY,
        language: LanguageCode.ZH,
        languageName: '中文',
        timezones: ['Asia/Shanghai', 'Asia/Chongqing', 'Asia/Urumqi'],
        symbol: '¥',
        decimalPlaces: 2
      },
      'JP': {
        currency: CurrencyCode.JPY,
        language: LanguageCode.JA,
        languageName: '日本語',
        timezones: ['Asia/Tokyo'],
        symbol: '¥',
        decimalPlaces: 0
      },
      'AU': {
        currency: CurrencyCode.AUD,
        language: LanguageCode.EN,
        languageName: 'English',
        timezones: ['Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Perth', 'Australia/Adelaide'],
        symbol: 'A$',
        decimalPlaces: 2
      },
      'NZ': {
        currency: CurrencyCode.NZD,
        language: LanguageCode.EN,
        languageName: 'English',
        timezones: ['Pacific/Auckland'],
        symbol: 'NZ$',
        decimalPlaces: 2
      },
      'HK': {
        currency: CurrencyCode.HKD,
        language: LanguageCode.ZH,
        languageName: '中文',
        timezones: ['Asia/Hong_Kong'],
        symbol: 'HK$',
        decimalPlaces: 2
      },
      'SG': {
        currency: CurrencyCode.SGD,
        language: LanguageCode.EN,
        languageName: 'English',
        timezones: ['Asia/Singapore'],
        symbol: 'S$',
        decimalPlaces: 2
      },
      'TW': {
        currency: CurrencyCode.TWD,
        language: LanguageCode.ZH,
        languageName: '中文',
        timezones: ['Asia/Taipei'],
        symbol: 'NT$',
        decimalPlaces: 2
      },
      'KR': {
        currency: CurrencyCode.KRW,
        language: LanguageCode.KO,
        languageName: '한국어',
        timezones: ['Asia/Seoul'],
        symbol: '₩',
        decimalPlaces: 0
      },
      'TH': {
        currency: CurrencyCode.THB,
        language: LanguageCode.TH,
        languageName: 'ไทย',
        timezones: ['Asia/Bangkok'],
        symbol: '฿',
        decimalPlaces: 2
      },
      'ID': {
        currency: CurrencyCode.IDR,
        language: LanguageCode.ID,
        languageName: 'Bahasa Indonesia',
        timezones: ['Asia/Jakarta'],
        symbol: 'Rp',
        decimalPlaces: 2
      },
      'MY': {
        currency: CurrencyCode.MYR,
        language: LanguageCode.MS,
        languageName: 'Bahasa Melayu',
        timezones: ['Asia/Kuala_Lumpur'],
        symbol: 'RM',
        decimalPlaces: 2
      },
      'PH': {
        currency: CurrencyCode.PHP,
        language: LanguageCode.EN,
        languageName: 'English',
        timezones: ['Asia/Manila'],
        symbol: '₱',
        decimalPlaces: 2
      },
      'VN': {
        currency: CurrencyCode.VND,
        language: LanguageCode.VI,
        languageName: 'Tiếng Việt',
        timezones: ['Asia/Ho_Chi_Minh'],
        symbol: '₫',
        decimalPlaces: 0
      },
      'IL': {
        currency: CurrencyCode.ILS,
        language: LanguageCode.HE,
        languageName: 'עברית',
        timezones: ['Asia/Jerusalem'],
        symbol: '₪',
        decimalPlaces: 2
      },
      'IR': { currency: CurrencyCode.USD, language: LanguageCode.EN, languageName: 'English', timezones: ['Asia/Tehran'], symbol: '$', decimalPlaces: 2 }, // Fallback

      // Middle East
      'SA': {
        currency: CurrencyCode.SAR,
        language: LanguageCode.AR,
        languageName: 'العربية',
        timezones: ['Asia/Riyadh'],
        symbol: '﷼',
        decimalPlaces: 2
      },
      'AE': {
        currency: CurrencyCode.AED,
        language: LanguageCode.AR,
        languageName: 'العربية',
        timezones: ['Asia/Dubai'],
        symbol: 'د.إ',
        decimalPlaces: 2
      },

      // Africa
      'ZA': {
        currency: CurrencyCode.ZAR,
        language: LanguageCode.EN,
        languageName: 'English',
        timezones: ['Africa/Johannesburg'],
        symbol: 'R',
        decimalPlaces: 2
      },
      'NG': {
        currency: CurrencyCode.NGN,
        language: LanguageCode.EN,
        languageName: 'English',
        timezones: ['Africa/Lagos'],
        symbol: '₦',
        decimalPlaces: 2
      },
      'EG': {
        currency: CurrencyCode.EGP,
        language: LanguageCode.AR,
        languageName: 'العربية',
        timezones: ['Africa/Cairo'],
        symbol: 'E£',
        decimalPlaces: 2
      },
      'KE': {
        currency: CurrencyCode.KES,
        language: LanguageCode.EN,
        languageName: 'English',
        timezones: ['Africa/Nairobi'],
        symbol: 'KSh',
        decimalPlaces: 2
      },
      'GH': {
        currency: CurrencyCode.GHS,
        language: LanguageCode.EN,
        languageName: 'English',
        timezones: ['Africa/Accra'],
        symbol: '₵',
        decimalPlaces: 2
      },
      'MA': {
        currency: CurrencyCode.MAD,
        language: LanguageCode.AR,
        languageName: 'العربية',
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
export const CATEGORY_ICONS: string[] = [
  // 💰 Finance & Budgeting
  'account_balance',
  'account_balance_wallet',
  'calculate',
  'monetization_on',
  'payments',
  'receipt',
  'receipt_long',
  'savings',
  'trending_up',

  // 🛒 Expenses & Purchases
  'card_giftcard',
  'local_mall',
  'local_offer',
  'production_quantity_limits',
  'sell',
  'shopping_bag',
  'shopping_cart',
  'shoppingmode',
  'store',
  'storefront',

  // 🍽️ Food & Dining
  'brunch_dining',
  'dining',
  'fastfood',
  'liquor',
  'local_cafe',
  'local_dining',
  'ramen_dining',
  'restaurant',

  // 🚗 Transportation & Travel
  'airport_shuttle',
  'car_repair',
  'commute',
  'directions_boat',
  'directions_bus',
  'directions_car',
  'directions_railway',
  'directions_subway',
  'flight',
  'train',
  'two_wheeler',

  // 🏠 Home & Bills
  'cable',
  'chair',
  'electrical_services',
  'foundation',
  'home',
  'home_repair_service',
  'kitchen',
  'lightbulb',
  'phone',
  'water_drop',
  'wifi',

  // 🧾 Utilities & Services
  'admin_panel_settings',
  'app_settings_alt',
  'build',
  'construction',
  'engineering',
  'handyman',
  'plumbing',
  'settings',
  'support',
  'tune',

  // 🏥 Health & Insurance
  'health_and_safety',
  'local_hospital',
  'vaccines',

  // 🎓 Education
  'backpack',
  'cast_for_education',
  'co_present',
  'menu_book',
  'quiz',
  'school',
  'workspace_premium',

  // 🧘‍♂️ Fitness & Lifestyle
  'fitness_center',
  'hiking',
  'kayaking',
  'roller_skating',
  'self_improvement',
  'spa',

  // 🧒 Family & Children
  'child_care',
  'child_friendly',
  'crib',
  'family_restroom',

  // 🎉 Entertainment & Leisure
  'celebration',
  'event',
  'library_music',
  'live_tv',
  'movie',
  'movie_filter',
  'music_note',
  'sports_esports',
  'theater_comedy',
  'theaters',

  // 📈 Investment & Income
  'bar_chart',
  'donut_large',
  'insights',
  'leaderboard',
  'pie_chart',
  'query_stats',
  'show_chart',
  'stacked_line_chart',

  // 💼 Work & Business
  'badge',
  'business_center',
  'pending_actions',
  'schedule',
  'task_alt',
  'view_timeline',
  'work',
  'workspaces',

  // 🤝 Charity & Giving
  'diversity_1',
  'diversity_3',
  'group_add',
  'redeem',
  'volunteer_activism',

  // 🧾 Tax & Legal
  'description',
  'fact_check',
  'gavel',
  'policy',

  // 🧠 Personal Growth
  'bookmark',
  'bookmarks',
  'category',
  'emoji_people',
  'label',
  'lightbulb',
  'psychology',
  'sentiment_satisfied',
  'star',
  'tips_and_updates',

  // 🔧 Actions & Management
  'add',
  'cancel',
  'close',
  'content_copy',
  'content_paste',
  'delete',
  'done',
  'edit',
  'file_copy',
  'refresh',
  'save',
  'upload',
  'download',
  'cloud_upload',
  'cloud_download',

  // 🔔 Notifications & Status
  'campaign',
  'check_circle',
  'error',
  'help',
  'info',
  'notifications',
  'notifications_active',
  'priority_high',
  'support_agent',
  'warning',

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