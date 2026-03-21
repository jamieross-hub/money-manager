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

  }

  /**
   * Initializes the real-time listener for the given family
   */
  private setupTransactionListener(familyId: string): void {
    this.stopListener();
    this.currentFamilyId = familyId;


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
            
            // Trigger the shared notification manager (push notification)
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
