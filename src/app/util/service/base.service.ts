import { Injectable } from '@angular/core';
import { Firestore, collection, doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, Timestamp, addDoc, onSnapshot, writeBatch, serverTimestamp } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { APP_CONFIG, ERROR_MESSAGES } from '../config/config';
import { SyncStatus } from '../config/enums';
import { CurrencyService } from './currency.service';

/**
 * Base service class providing common functionality for all services
 */
@Injectable()
export abstract class BaseService {
  protected readonly isOnlineSubject = new BehaviorSubject<boolean>(true);
  public readonly isOnline$ = this.isOnlineSubject.asObservable();

  constructor(
    protected readonly firestore: Firestore,
    protected readonly auth: Auth,
    protected readonly currencyService: CurrencyService
  ) { }

  /**
   * Get current user ID
   */
  protected getCurrentUserId(): string | null {
    return this.auth.currentUser?.uid || null;
  }

  /**
   * Check if user is authenticated
   */
  protected isAuthenticated(): boolean {
    return !!this.auth.currentUser;
  }

  /**
   * Generate a unique ID
   */
  protected generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Get Firestore collection reference
   */
  protected getCollectionRef(collectionName: string) {
    const userId = this.getCurrentUserId();
    if (!userId) {
      throw new Error(ERROR_MESSAGES.AUTH.SESSION_EXPIRED);
    }
    return collection(this.firestore, `users/${userId}/${collectionName}`);
  }

  /**
   * Get Firestore document reference
   */
  protected getDocumentRef(collectionName: string, documentId: string) {
    const userId = this.getCurrentUserId();
    if (!userId) {
      throw new Error(ERROR_MESSAGES.AUTH.SESSION_EXPIRED);
    }
    return doc(this.firestore, `users/${userId}/${collectionName}/${documentId}`);
  }

  /**
   * Handle errors with proper error messages
   */
  protected handleError(error: any, context: string): Observable<never> {
    console.error(`Error in ${context}:`, error);

    let errorMessage: string = ERROR_MESSAGES.NETWORK.SERVER_ERROR;

    if (error.code) {
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = ERROR_MESSAGES.AUTH.USER_NOT_FOUND;
          break;
        case 'auth/wrong-password':
          errorMessage = ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS;
          break;
        case 'auth/email-already-in-use':
          errorMessage = ERROR_MESSAGES.AUTH.EMAIL_ALREADY_EXISTS;
          break;
        case 'auth/weak-password':
          errorMessage = ERROR_MESSAGES.AUTH.WEAK_PASSWORD;
          break;
        case 'permission-denied':
          errorMessage = ERROR_MESSAGES.PERMISSION.ACCESS_DENIED;
          break;
        case 'unavailable':
          errorMessage = ERROR_MESSAGES.NETWORK.CONNECTION_ERROR;
          break;
        default:
          errorMessage = error.message || ERROR_MESSAGES.NETWORK.SERVER_ERROR;
      }
    }

    return throwError(() => new Error(errorMessage));
  }

  /**
   * Validate required fields
   */
  protected validateRequiredFields(data: any, requiredFields: string[]): void {
    const missingFields = requiredFields.filter(field => !data[field]);
    if (missingFields.length > 0) {
      throw new Error(`${ERROR_MESSAGES.VALIDATION.REQUIRED_FIELD}: ${missingFields.join(', ')}`);
    }
  }

  /**
   * Validate amount
   */
  protected validateAmount(amount: number): void {
    if (amount < APP_CONFIG.VALIDATION.MIN_AMOUNT || amount > APP_CONFIG.VALIDATION.MAX_AMOUNT) {
      throw new Error(ERROR_MESSAGES.VALIDATION.INVALID_AMOUNT);
    }
  }

  /**
   * Validate string length
   */
  protected validateStringLength(value: string, minLength: number, maxLength: number, fieldName: string): void {
    if (value.length < minLength) {
      throw new Error(`${ERROR_MESSAGES.VALIDATION.MIN_LENGTH.replace('{min}', minLength.toString())} for ${fieldName}`);
    }
    if (value.length > maxLength) {
      throw new Error(`${ERROR_MESSAGES.VALIDATION.MAX_LENGTH.replace('{max}', maxLength.toString())} for ${fieldName}`);
    }
  }

  /**
   * Add sync status to data
   */
  protected addSyncStatus(data: any, status: SyncStatus = SyncStatus.SYNCED): any {
    return {
      ...data,
      syncStatus: status,
      lastSyncedAt: serverTimestamp()
    };
  }

  /**
   * Add metadata to data
   */
  protected addMetadata(data: any, userId: string): any {
    return {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId,
      updatedBy: userId
    };
  }

  /**
   * Update metadata for existing data
   */
  protected updateMetadata(data: any, userId: string): any {
    return {
      ...data,
      updatedAt: serverTimestamp(),
      updatedBy: userId
    };
  }

  /**
   * Cache data in localStorage
   */
  protected cacheData(key: string, data: any): void {
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
        expiry: Date.now() + APP_CONFIG.OFFLINE.CACHE_EXPIRY
      };
      localStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Failed to cache data:', error);
    }
  }

  /**
   * Get cached data from localStorage
   */
  protected getCachedData<T>(key: string): T | null {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      if (Date.now() > cacheData.expiry) {
        localStorage.removeItem(key);
        return null;
      }

      return cacheData.data;
    } catch (error) {
      console.error('Failed to get cached data:', error);
      return null;
    }
  }

  /**
   * Clear cached data
   */
  protected clearCachedData(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to clear cached data:', error);
    }
  }

  /**
   * Debounce function for performance optimization
   */
  protected debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number = APP_CONFIG.PERFORMANCE.DEBOUNCE_DELAY
  ): (...args: Parameters<T>) => void {
    let timeoutId: any;
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  }

  /**
   * Throttle function for performance optimization
   */
  protected throttle<T extends (...args: any[]) => any>(
    func: T,
    delay: number = APP_CONFIG.PERFORMANCE.THROTTLE_DELAY
  ): (...args: Parameters<T>) => void {
    let lastCall = 0;
    return (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        func(...args);
      }
    };
  }

  /**
   * Format currency amount
   */
  protected formatCurrency(amount: number, currency?: string): string {
    return this.currencyService.formatAmount(amount);
  }

  /**
   * Format date
   */
  protected formatDate(date: Date, format: string = 'MM/dd/yyyy'): string {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    };
    return new Intl.DateTimeFormat('en-US', options).format(date);
  }

  /**
   * Check if data is expired
   */
  protected isDataExpired(timestamp: number, expiryTime: number = APP_CONFIG.OFFLINE.CACHE_EXPIRY): boolean {
    return Date.now() - timestamp > expiryTime;
  }

  /**
   * Retry operation with exponential backoff
   */
  protected async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = APP_CONFIG.OFFLINE.MAX_RETRY_ATTEMPTS,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt === maxRetries) {
          throw error;
        }

        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }
} 