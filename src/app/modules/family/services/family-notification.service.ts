import { Injectable, inject, DestroyRef } from '@angular/core';
import { Firestore, collection, query, orderBy, limit, onSnapshot, where } from '@angular/fire/firestore';
import { FamilyService } from './family.service';
import { NotificationManagerService } from 'src/app/util/service/notification-manager.service';
import { UserService } from 'src/app/util/service/db/user.service';
import { effect } from '@angular/core';
import { Transaction } from 'src/app/util/models/transaction.model';
import { TransactionStatus } from 'src/app/util/config/enums';

import { environment } from 'src/environments/environment';

/**
 * Service responsible for monitoring family activity and triggering notifications.
 * It listens for new transactions added by other family members in real-time.
 */
@Injectable({
  providedIn: 'root'
})
export class FamilyNotificationService {
  private firestore = inject(Firestore);
  private familyService = inject(FamilyService);
  private notificationManager = inject(NotificationManagerService);
  private userService = inject(UserService);
  private destroyRef = inject(DestroyRef);

  private unsubscribe: (() => void) | null = null;
  private currentFamilyId: string | null = null;

  constructor() {
    // Automatically start/stop listening when the active family changes
    effect(() => {
      const familyId = this.familyService.activeFamilyId();
      if (familyId && familyId !== this.currentFamilyId) {
        this.setupTransactionListener(familyId);
      } else if (!familyId) {
        this.stopListener();
      }
    });

    // Cleanup on service destruction
    this.destroyRef.onDestroy(() => {
      this.stopListener();
    });

    // TEST: Trigger a test notification after 10 seconds in dev mode to verify browser support
    if (!environment.production) {
      setTimeout(() => {
        this.showLocalNotification('System Test', 'If you see this, notifications are working correctly!');
      }, 10000);
    }
  }

  /**
   * Initializes the real-time listener for the given family
   */
  private setupTransactionListener(familyId: string): void {
    this.stopListener();
    this.currentFamilyId = familyId;

    // Proactively request notification permission when setting up family notifications
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          console.log(`[FamilyNotificationService] Notification permission status: ${permission}`);
        });
      }
    }

    // We listen for the most recent transactions
    const q = query(
      collection(this.firestore, `family-groups/${familyId}/transactions`),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    let isInitialLoad = true;

    this.unsubscribe = onSnapshot(q, (snap) => {
      // The first snapshot contains all current transactions in the query.
      // We skip it to avoid notifying for historical transactions.
      if (isInitialLoad) {
        isInitialLoad = false;
        console.log(`[FamilyNotificationService] Listener initialized for family: ${familyId}`);
        return;
      }

      snap.docChanges().forEach(change => {
        // We only care about NEW additions
        if (change.type === 'added') {
          const tx = change.doc.data() as Transaction;
          const currentUserId = this.userService.getCurrentUserId();
          const creatorId = tx.createdBy || tx.userId;

          const isDeleted = tx.status === TransactionStatus.DELETED;
          const isOtherUser = creatorId && currentUserId && creatorId !== currentUserId;
          
          console.log(`[FamilyNotificationService] New transaction detected:`, {
            id: change.doc.id,
            notes: tx.notes,
            creatorId,
            currentUserId,
            isOtherUser,
            isDeleted
          });

          // In production: only notify for other members' transactions
          // In development: notify for ANY addition (including yours) to verify it works
          const shouldNotify = !isDeleted && creatorId && (isOtherUser || !environment.production);

          if (shouldNotify) {
            console.log(`[FamilyNotificationService] Triggering notification for transaction ${change.doc.id}`);
            
            const title = isOtherUser ? 'New Family Transaction' : 'Transaction Added (Test)';
            const body = `${tx.userDisplayName || 'A member'} added: ${tx.notes || tx.category || 'Transaction'} (${tx.amount})`;
            
            // Show local browser notification
            this.showLocalNotification(title, body);

            // Also trigger the shared notification manager alert
            this.notificationManager.sendTransactionAlert({
              id: change.doc.id,
              description: tx.notes || tx.category || 'New Transaction',
              amount: tx.amount,
              userDisplayName: tx.userDisplayName || 'Family Member'
            });
          } else {
            console.log(`[FamilyNotificationService] Notification skipped: isDeleted=${isDeleted}, isOtherUser=${isOtherUser}`);
          }
        }
      });
    }, (error) => {
      console.error('[FamilyNotificationService] Listener error:', error);
    });
  }

  /**
   * Shows a native browser notification
   */
  private showLocalNotification(title: string, body: string): void {
    console.log(`[FamilyNotificationService] Attempting to show notification: ${title}`);
    
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('[FamilyNotificationService] Notifications not supported');
      return;
    }

    if (Notification.permission !== 'granted') {
      console.warn(`[FamilyNotificationService] Notification permission status: ${Notification.permission}`);
      // Try to request it once more if default
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(p => {
           if (p === 'granted') this.showLocalNotification(title, body);
        });
      }
      return;
    }

    try {
      const options: any = {
        body: body,
        icon: environment.baseUrl + '/assets/icon/app-icon/icon-192x192.png',
        badge: environment.baseUrl + '/assets/icon/app-icon/icon-72x72.png',
        vibrate: [100, 50, 100],
        timestamp: Date.now(),
        data: {
          url: window.location.origin + '/dashboard/transactions'
        }
      };

      // In development, force direct notifications to bypass Service Worker complexities.
      // This is because `ng serve` doesn't always handle SW properly.
      if (!environment.production) {
        console.log('[FamilyNotificationService] Dev mode: Using direct notification');
        this.showDirectNotification(title, options);
        return;
      }

      // In production, try Service Worker first
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        // Use a timeout to avoid hanging on a SW that isn't responding
        const swPromise = Promise.race([
          navigator.serviceWorker.ready,
          new Promise((_, reject) => setTimeout(() => reject('SW Timeout'), 2000))
        ]) as Promise<ServiceWorkerRegistration>;

        swPromise.then(registration => {
          registration.showNotification(title, options);
          console.log('[FamilyNotificationService] Notification sent to Service Worker');
        }).catch(err => {
          console.warn('[FamilyNotificationService] Falling back to direct notification:', err);
          this.showDirectNotification(title, options);
        });
      } else {
        this.showDirectNotification(title, options);
      }
    } catch (error) {
      console.error('[FamilyNotificationService] Error in showLocalNotification:', error);
    }
  }

  private showDirectNotification(title: string, options: any): void {
    try {
      const n = new Notification(title, options);
      console.log('[FamilyNotificationService] Direct notification shown');
      
      n.onclick = () => {
        window.focus();
        if (options.data?.url) {
          window.location.href = options.data.url;
        }
        n.close();
      };
    } catch (err) {
      console.error('[FamilyNotificationService] Direct notification failed:', err);
    }
  }

  /**
   * Stops the current Firestore listener
   */
  private stopListener(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.currentFamilyId = null;
  }
}
