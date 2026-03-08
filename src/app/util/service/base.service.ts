import { Injectable, signal, Signal } from '@angular/core';
import { Firestore, collection, doc, collectionData, docData, setDoc, updateDoc, deleteDoc, getDoc, getDocs, Timestamp, addDoc, onSnapshot, writeBatch, serverTimestamp, CollectionReference, DocumentReference } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, throwError } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { CurrencyService } from './currency.service';

/**
 * Base service class providing common functionality for all services
 */
@Injectable()
export abstract class BaseService {
  protected readonly isOnlineSignal = signal<boolean>(true);
  public readonly isOnline: Signal<boolean> = this.isOnlineSignal.asReadonly();
  public readonly isOnline$: Observable<boolean> = toObservable(this.isOnline);

  constructor(
    protected readonly firestore: Firestore,
    protected readonly auth: Auth,
    protected readonly currencyService: CurrencyService
  ) { }

    /**
     * Get the current user ID - ⚠️ SLOW VERSION
     * @deprecated Use UserService.getCurrentUserId() for faster, context-aware access.
     * This method relies on Firebase Auth which may not be initialized immediately on startup.
     */
    protected getCurrentUserId(): string | null {
        return this.auth.currentUser?.uid || null;
    }

  /**
   * Generate a unique ID (Firestore style)
   */
  public generateId(): string {
    return doc(collection(this.firestore, '_')).id;
  }

  /**
   * Get a collection reference
   */
  protected getCollectionRef(collectionName: string): CollectionReference {
    return collection(this.firestore, collectionName);
  }

  /**
   * Get a document reference
   */
  protected getDocumentRef(collectionName: string, id: string): DocumentReference {
    return doc(this.firestore, `${collectionName}/${id}`);
  }

  /**
   * Common error handler
   */
  protected handleError(error: any, context: string): Observable<never> {
    console.error(`Error in ${context}:`, error);
    return throwError(() => error);
  }

  /**
   * Recursively remove keys with undefined values from an object
   */
  protected scrubUndefined(obj: any): any {
    if (obj === null || typeof obj !== 'object' || obj instanceof Date || obj instanceof Timestamp) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.scrubUndefined(item));
    }

    const result: any = {};
    let scrubbedCount = 0;
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      if (value !== undefined) {
        result[key] = this.scrubUndefined(value);
      } else {
        scrubbedCount++;
      }
    });

    if (scrubbedCount > 0) {
      console.log(`[BaseService] Scrubbed ${scrubbedCount} undefined properties from object`, obj.id || '');
    }

    return result;
  }
}