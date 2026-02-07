/**
 * Application-wide enums for better type safety and maintainability
 */

/**
 * User role types
 */
export enum UserRole {
  FREE = 'free',
  PREMIUM = 'premium',
  ADMIN = 'admin'
}

/**
 * Account types
 */
export enum AccountType {
  BANK = 'bank',
  CASH = 'cash',
  CREDIT = 'credit',
  LOAN = 'loan',
  INVESTMENT = 'investment'

}

/**
 * Transaction types
 */
export enum TransactionType {
  INCOME = 'income',
  EXPENSE = 'expense',
  TRANSFER = 'transfer'
}

/**
 * Recurring transaction intervals
 */
export enum RecurringInterval {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly'
}

/**
 * Sync status for offline operations
 */
export enum SyncStatus {
  SYNCED = 'synced',
  PENDING = 'pending',
  FAILED = 'failed'
}

/**
 * Operation types for offline queue
 */
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete'
}

/**
 * Notification types
 */
export enum NotificationType {
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}

/**
 * Theme types
 */
export enum ThemeType {
  LIGHT = 'light',
  DARK = 'dark',
  AUTO = 'auto'
}

/**
 * Language codes
 */
export enum LanguageCode {
  EN = 'en',
  ES = 'es',
  FR = 'fr',
  DE = 'de',
  HI = 'hi',
  ZH = 'zh',
  // Europe
  IT = 'it',
  NL = 'nl',
  PT = 'pt',
  PL = 'pl',
  RU = 'ru',
  TR = 'tr',
  SV = 'sv',
  NO = 'no',
  DA = 'da',
  FI = 'fi',
  // Americas
  PT_BR = 'pt-BR', // Portuguese (Brazil)
  ES_MX = 'es-MX', // Spanish (Mexico)
  ES_AR = 'es-AR', // Spanish (Argentina)
  // Asia
  JA = 'ja',
  KO = 'ko',
  TH = 'th',
  ID = 'id',
  MS = 'ms',
  VI = 'vi',
  AR = 'ar',
  HE = 'he'
}

/**
 * Currency codes
 */
export enum CurrencyCode {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
  INR = 'INR',
  CAD = 'CAD',
  AUD = 'AUD',
  JPY = 'JPY',
  CNY = 'CNY',
  // Europe
  CHF = 'CHF',
  SEK = 'SEK',
  NOK = 'NOK',
  DKK = 'DKK',
  PLN = 'PLN',
  RUB = 'RUB',
  TRY = 'TRY',
  // Americas
  BRL = 'BRL',
  ARS = 'ARS',
  CLP = 'CLP',
  COP = 'COP',
  PEN = 'PEN',
  MXN = 'MXN',
  // Asia/Pacific
  TWD = 'TWD',
  KRW = 'KRW',
  THB = 'THB',
  IDR = 'IDR',
  MYR = 'MYR',
  PHP = 'PHP',
  VND = 'VND',
  SAR = 'SAR',
  AED = 'AED',
  ILS = 'ILS',
  NZD = 'NZD',
  HKD = 'HKD',
  SGD = 'SGD',
  // Africa
  ZAR = 'ZAR',
  NGN = 'NGN',
  EGP = 'EGP',
  KES = 'KES',
  GHS = 'GHS',
  MAD = 'MAD'
}

/**
 * Category types
 */
export enum CategoryType {
  INCOME = 'income',
  EXPENSE = 'expense',
  TRANSFER = 'transfer'
}

/**
 * Budget periods
 */
export enum BudgetPeriod {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly'
}

/**
 * Goal types
 */
export enum GoalType {
  SAVINGS = 'savings',
  DEBT_PAYOFF = 'debt_payoff',
  INVESTMENT = 'investment',
  PURCHASE = 'purchase'
}

/**
 * Goal status
 */
export enum GoalStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  PAUSED = 'paused',
  CANCELLED = 'cancelled'
}

/**
 * Tax filing status
 */
export enum TaxFilingStatus {
  NOT_FILED = 'not_filed',
  FILED = 'filed',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

/**
 * Subscription plans
 */
export enum SubscriptionPlan {
  FREE = 'free',
  BASIC = 'basic',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise'
}

/**
 * Payment methods
 */
export enum PaymentMethod {
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  BANK_TRANSFER = 'bank_transfer',
  CASH = 'cash',
  DIGITAL_WALLET = 'digital_wallet'
}

/**
 * Transaction status
 */
export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  FAILED = 'failed'
}

/**
 * Export formats
 */
export enum ExportFormat {
  CSV = 'csv',
  PDF = 'pdf',
  EXCEL = 'excel',
  JSON = 'json'
}

/**
 * Chart types for reports
 */
export enum ChartType {
  PIE = 'pie',
  BAR = 'bar',
  LINE = 'line',
  DOUGHNUT = 'doughnut',
  AREA = 'area'
}

/**
 * Date range presets
 */
export enum DateRangePreset {
  TODAY = 'today',
  YESTERDAY = 'yesterday',
  THIS_WEEK = 'this_week',
  LAST_WEEK = 'last_week',
  THIS_MONTH = 'this_month',
  LAST_MONTH = 'last_month',
  THIS_YEAR = 'this_year',
  LAST_YEAR = 'last_year',
  CUSTOM = 'custom'
} 