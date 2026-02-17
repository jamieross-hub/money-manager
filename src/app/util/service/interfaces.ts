import { Observable } from 'rxjs';
import {
  Transaction,
  CreateTransactionRequest,
  UpdateTransactionRequest,
  TransactionFilter,
  TransactionQueryParams,
  TransactionSummary,
  BulkImportResult,
  TransactionExportOptions
} from '../models/transaction.model';
import {
  Account,
  CreateAccountRequest,
  UpdateAccountRequest
} from '../models/account.model';
import {
  User,
  UserPreferences
} from '../models/user.model';
import {
  Category,
} from '../models/category.model';
import {
  Budget,
  CreateBudgetRequest,
  UpdateBudgetRequest
} from '../models/budget.model';
import {
  Goal,
  CreateGoalRequest,
  UpdateGoalRequest
} from '../models/goal.model';

/**
 * Base service interface for common CRUD operations
 */
export interface IBaseService<T, CreateRequest, UpdateRequest> {
  create(userId: string, data: CreateRequest): Observable<string>;
  get(userId: string, id: string): Observable<T | undefined>;
  getAll(userId: string): Observable<T[]>;
  update(userId: string, id: string, data: UpdateRequest): Observable<void>;
  delete(userId: string, id: string): Observable<void>;
}

/**
 * Transaction service interface
 */
export interface ITransactionService extends IBaseService<Transaction, CreateTransactionRequest, UpdateTransactionRequest> {
  getTransactionsWithFilter(userId: string, params: TransactionQueryParams): Observable<Transaction[]>;
  getTransactionSummary(userId: string, filter?: TransactionFilter): Observable<TransactionSummary>;
  getTransactionsByDateRange(userId: string, startDate: Date, endDate: Date): Observable<Transaction[]>;
  getRecurringTransactions(userId: string): Observable<Transaction[]>;
  bulkImport(userId: string, transactions: CreateTransactionRequest[]): Observable<BulkImportResult>;
  exportTransactions(userId: string, options: TransactionExportOptions): Observable<Blob>;
  getTransactionTrends(userId: string, period: string): Observable<any[]>;
  reconcileTransaction(userId: string, transactionId: string, reconciliationData: any): Observable<void>;
}

/**
 * Account service interface
 */
export interface IAccountService extends IBaseService<Account, CreateAccountRequest, UpdateAccountRequest> {
  getAccountBalance(userId: string, accountId: string): Observable<number>;
  updateAccountBalance(userId: string, accountId: string, newBalance: number): Observable<void>;
  getAccountsByType(userId: string, type: string): Observable<Account[]>;
  getTotalBalance(userId: string): Observable<number>;
  transferBetweenAccounts(userId: string, fromAccountId: string, toAccountId: string, amount: number): Observable<void>;
}

/**
 * User service interface
 */
export interface IUserService {
  signUp(email: string, password: string, name: string): Observable<any>;
  signIn(email: string, password: string): Observable<any>;
  signInWithGoogle(): Observable<void>;
  signOut(): Observable<void>;
  getCurrentUser(): Observable<User | null>;
  updateUserProfile(userId: string, profile: Partial<User>): Observable<void>;
  updateUserPreferences(userId: string, preferences: UserPreferences): Observable<void>;
  deleteUser(userId: string): Observable<void>;
  resetPassword(email: string): Observable<void>;
  isAuthenticated(): boolean;
  getUser(): any;
}

/**
 * Budget service interface
 */
export interface IBudgetService extends IBaseService<Budget, CreateBudgetRequest, UpdateBudgetRequest> {
  getBudgetProgress(userId: string, budgetId: string): Observable<any>;
  getBudgetsByPeriod(userId: string, period: string): Observable<Budget[]>;
  checkBudgetAlerts(userId: string): Observable<any[]>;
  resetBudget(userId: string, budgetId: string): Observable<void>;
}

/**
 * Goal service interface
 */
export interface IGoalService extends IBaseService<Goal, CreateGoalRequest, UpdateGoalRequest> {
  getGoalProgress(userId: string, goalId: string): Observable<any>;
  updateGoalProgress(userId: string, goalId: string, amount: number): Observable<void>;
  getGoalsByStatus(userId: string, status: string): Observable<Goal[]>;
  getGoalsByType(userId: string, type: string): Observable<Goal[]>;
  checkGoalMilestones(userId: string): Observable<any[]>;
}

/**
 * Notification service interface
 */
export interface INotificationService {
  showSuccess(message: string, title?: string): void;
  showError(message: string, title?: string): void;
  showWarning(message: string, title?: string): void;
  showInfo(message: string, title?: string): void;
  showConfirm(message: string, title?: string): Observable<boolean>;
  clearAll(): void;
}

/**
 * Offline service interface
 */
export interface IOfflineService {
  isOnline$: Observable<boolean>;
  isOnline: boolean;
  cacheData(key: string, data: any): Promise<void>;
  getCachedData<T>(key: string): Promise<T | null>;
  clearCache(): Promise<void>;
  syncPendingOperations(): Promise<void>;
  getOfflineQueueStatus(): { count: number; hasPendingOperations: boolean };
}

/**
 * Currency service interface
 */
export interface ICurrencyService {
  getSupportedCurrencies(): Observable<any[]>;
  getExchangeRate(fromCurrency: string, toCurrency: string): Observable<number>;
  convertCurrency(amount: number, fromCurrency: string, toCurrency: string): Observable<number>;
  formatCurrency(amount: number, currency: string): string;
  getCurrencySymbol(currency: string): string;
}

/**
 * Theme service interface
 */
export interface IThemeService {
  currentTheme$: Observable<string>;
  setTheme(theme: string): void;
  getTheme(): string;
  toggleTheme(): void;
  isDarkMode(): boolean;
}

/**
 * Language service interface
 */
export interface ILanguageService {
  currentLanguage$: Observable<string>;
  setLanguage(language: string): void;
  getLanguage(): string;
  getSupportedLanguages(): any[];
  translate(key: string, params?: any): string;
}

/**
 * Export service interface
 */
export interface IExportService {
  exportToJSON(data: any, filename: string): void;
  generateReport(data: any, format: string): Observable<Blob>;
}

/**
 * Analytics service interface
 */
export interface IAnalyticsService {
  trackEvent(eventName: string, properties?: any): void;
  trackPageView(pageName: string): void;
  trackUserAction(action: string, properties?: any): void;
  trackError(error: Error, context?: any): void;
  setUserProperties(properties: any): void;
}

/**
 * Security service interface
 */
export interface ISecurityService {
  encryptData(data: any): string;
  decryptData(encryptedData: string): any;
  hashPassword(password: string): string;
  validatePassword(password: string): boolean;
  generateSecureToken(): string;
  validateToken(token: string): boolean;
}



/**
 * Validation service interface
 */
export interface IValidationService {
  validateEmail(email: string): boolean;
  validatePassword(password: string): { isValid: boolean; errors: string[] };
  validateAmount(amount: number): boolean;
  validateDate(date: Date): boolean;
  validateRequired(value: any): boolean;
  validateLength(value: string, min: number, max: number): boolean;
} 