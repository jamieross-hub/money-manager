import { Injectable } from '@angular/core';
import { Firestore, collection, doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, Timestamp } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, from, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { DateService } from './date.service';
import { LocalIndexDBStorageService } from './indexdb-storage.service';

export interface Subscription {
  userId: string;
  plan: string;
  startDate: Timestamp | Date;
  endDate: Timestamp | Date;
}

@Injectable({
  providedIn: 'root'
})
export class SubscriptionService {

  constructor(
    private firestore: Firestore, 
    private auth: Auth, 
    private dateService: DateService,
    private storageService: LocalIndexDBStorageService
  ) {}

  private getCacheKey(userId: string): string {
    return `subscription_${userId}`;
  }

  // 🔹 Create a new subscription
  async createSubscription(userId: string, subscription: Subscription): Promise<void> {
    const subscriptionRef = doc(this.firestore, `users/${userId}/subscription`);
    const data = {
      ...subscription,
      startDate: this.dateService.toTimestamp(subscription.startDate),
      endDate: this.dateService.toTimestamp(subscription.endDate),
    };
    await setDoc(subscriptionRef, data);
    this.storageService.setItem(this.getCacheKey(userId), data);
  }

  // 🔹 Get the current subscription for a user (Cache-first)
  getSubscription(userId: string): Observable<Subscription | undefined> {
    const cached = this.storageService.getItem<Subscription>(this.getCacheKey(userId));
    return of(cached ?? undefined);
  }

  /**
   * Pull subscription from Firestore
   */
  pullFromFirestore(userId: string): Observable<void> {
    const subscriptionRef = doc(this.firestore, `users/${userId}/subscription`);
    return from(getDoc(subscriptionRef)).pipe(
      tap(docSnap => {
        if (docSnap.exists()) {
          const subscription = docSnap.data() as Subscription;
          this.storageService.setItem(this.getCacheKey(userId), subscription);
        }
      }),
      map(() => undefined),
      catchError(error => {
        console.error('[SubscriptionService] Pull failed:', error);
        return of(undefined);
      })
    );
  }

  // 🔹 Update the subscription plan
  async updateSubscriptionPlan(userId: string, newPlan: string): Promise<void> {
    const subscriptionRef = doc(this.firestore, `users/${userId}/subscription`);
    await updateDoc(subscriptionRef, { plan: newPlan });
    
    const cached = this.storageService.getItem<Subscription>(this.getCacheKey(userId));
    if (cached) {
      cached.plan = newPlan;
      this.storageService.setItem(this.getCacheKey(userId), cached);
    }
  }

  // 🔹 Update subscription dates
  async updateSubscriptionDates(userId: string, startDate: Date, endDate: Date): Promise<void> {
    const subscriptionRef = doc(this.firestore, `users/${userId}/subscription`);
    const updates = {
      startDate: Timestamp.fromDate(startDate),
      endDate: Timestamp.fromDate(endDate),
    };
    await updateDoc(subscriptionRef, updates);

    const cached = this.storageService.getItem<Subscription>(this.getCacheKey(userId));
    if (cached) {
      this.storageService.setItem(this.getCacheKey(userId), { ...cached, ...updates });
    }
  }

  // 🔹 Delete the subscription
  async deleteSubscription(userId: string): Promise<void> {
    const subscriptionRef = doc(this.firestore, `users/${userId}/subscription`);
    await deleteDoc(subscriptionRef);
    this.storageService.removeItem(this.getCacheKey(userId));
  }
}
