import { Injectable, inject, DestroyRef } from '@angular/core';
import { Firestore, collection, query, orderBy, limit, onSnapshot, where } from '@angular/fire/firestore';
import { FamilyService } from './family.service';
import { NotificationManagerService } from 'src/app/util/service/notification-manager.service';
import { UserService } from 'src/app/util/service/db/user.service';
import { effect } from '@angular/core';
import { Transaction } from 'src/app/util/models/transaction.model';
import { TransactionStatus } from 'src/app/util/config/enums';

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

          // Only notify if:
          // 1. Transaction is not deleted
          // 2. Created by ANOTHER user
          // 3. Not by a system process (creatorId exists)
          if (tx.status !== TransactionStatus.DELETED && creatorId && creatorId !== currentUserId) {
            console.log(`[FamilyNotificationService] New transaction detected by member ${creatorId}`);
            
            // Construct notification details
            // We use the human-readable description and amount
            this.notificationManager.sendTransactionAlert({
              id: change.doc.id,
              description: tx.notes || tx.category || 'New Transaction',
              amount: tx.amount,
              userDisplayName: tx.userDisplayName || 'A family member'
            });
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
