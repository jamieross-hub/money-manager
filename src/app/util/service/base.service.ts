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
   * Get current user ID
   */
  protected getCurrentUserId(): string | null {
    return this.auth.currentUser?.uid || null;
  }

  /**
   * Generate a unique ID (Firestore style)
   */
  protected generateId(): string {
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
}