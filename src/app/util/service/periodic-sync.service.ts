import { Injectable, OnDestroy } from '@angular/core';
import { interval, Subscription, from, of, forkJoin, Subject, fromEvent } from 'rxjs';
import { switchMap, catchError, tap, take, map, filter, distinctUntilChanged, takeUntil, timeout } from 'rxjs/operators';
import { TransactionsService } from './db/transactions.service';
import { AccountsService } from './db/accounts.service';
import { CategoryService } from './db/category.service';
import { BudgetsService } from './db/budgets.service';
import { GoalsService } from './db/goals.service';
import { CommonSyncService } from './common-sync.service';
import { UserService } from './db/user.service';
import { NotificationService } from './notification.service';

import { PeriodicSyncService as _ } from './periodic-sync.service';
import { SplitwiseService } from '../../modules/splitwise/services/splitwise.service';
import { GoogleSheetsService } from './google-sheets.service';
import { SubscriptionService } from './subscription.service';
import { FeedbackService } from './feedback.service';
import { ContactService } from './db/contact.service';
import { PwaSwService } from './pwa-sw.service';

@Injectable({
  providedIn: 'root'
})
export class PeriodicSyncService implements OnDestroy {
  private syncSubscription: Subscription | null = null;
  private readonly destroy$ = new Subject<void>();
  private readonly SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

  constructor(
    private transactionsService: TransactionsService,
    private accountsService: AccountsService,
    private categoryService: CategoryService,
    private budgetsService: BudgetsService,
    private goalsService: GoalsService,
    private splitwiseService: SplitwiseService,
    private googleSheetsService: GoogleSheetsService,
    private subscriptionService: SubscriptionService,
    private feedbackService: FeedbackService,
    private contactService: ContactService,
    private commonSyncService: CommonSyncService,
    private userService: UserService,
    private notificationService: NotificationService,
    private pwaSwService: PwaSwService
  ) {}

  /**
   * Request a background sync from the Service Worker
   */
  requestBackgroundSync(): void {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready.then((swRegistration: any) => {
        return swRegistration.sync.register('sync-all-data');
      }).then(() => {
        console.log('✅ Background sync "sync-all-data" registered');
      }).catch((err) => {
        console.warn('⚠️ Background sync registration failed:', err);
      });
    }
  }

  /**
   * Start the periodic sync process
   */
  startSync(): void {
    if (this.syncSubscription) {
      return;
    }

    console.log('🔄 Starting Periodic Sync Service (Interval: 5m)');

    // Listen for user login to trigger immediate sync - Move this to separate init or check if already subscribed
    // However, since startSync is called multiple times, we need to be careful.
    // Let's use a one-time init for these observers.
    this.initializeObservers();

    // Set up periodic interval
    this.syncSubscription = interval(this.SYNC_INTERVAL).pipe(
      filter(() => document.visibilityState === 'visible'), // Only sync if app is visible
      switchMap(() => this.syncAll()),
      catchError(error => {
        console.error('❌ Periodic sync failed:', error);
        return of(null);
      })
    ).subscribe();
  }

  private observersInitialized = false;
  private initializeObservers(): void {
    if (this.observersInitialized) return;
    this.observersInitialized = true;

    // Listen for user login to trigger immediate sync
    this.userService.userAuth$.pipe(
      takeUntil(this.destroy$),
      filter((user): user is any => !!user && user.uid !== 'offline-guest'),
      distinctUntilChanged((prev, curr) => prev?.uid === curr?.uid),
      switchMap(() => this.syncAll())
    ).subscribe();

    // Listen for Background Sync API trigger
    this.pwaSwService.backgroundSync$.pipe(
      takeUntil(this.destroy$),
      filter(triggered => triggered),
      switchMap(() => {
        console.log('🔄 Triggering sync due to Background Sync SW Event');
        return this.syncAll();
      })
    ).subscribe();

    // Passive State Handling: Pause sync when app is in background
    fromEvent(document, 'visibilitychange').pipe(
      takeUntil(this.destroy$),
      map(() => document.visibilityState),
      distinctUntilChanged(),
      tap(state => {
        if (state === 'hidden') {
          console.log('💤 App went to passive state: Pausing Periodic Sync');
          this.stopSync();
        } else {
          console.log('✨ App resumed: Restarting Periodic Sync');
          this.startSync();
        }
      })
    ).subscribe();
  }

  /**
   * Stop the periodic sync process
   */
  stopSync(): void {
    if (this.syncSubscription) {
      this.syncSubscription.unsubscribe();
      this.syncSubscription = null;
    }
  }

  /**
   * Perform a full sync (Push pending changes + Pull from Firestore)
   */
  syncAll() {
    const userId = this.userService.getCurrentUserId();
    
    // 1. Handle Guest Mode
    if (userId === 'offline-guest') {
      console.log('🔄 Sync skipped: Guest Mode (Local Only)');
      return of(null);
    }

    if (!userId) {
      return of(null);
    }

    // 2. Handle Network Offline
    if (!this.commonSyncService.isCurrentlyOnline()) {
      console.log('🔄 Sync skipped: Device is Offline');
      return of(null);
    }

    console.log('🔄 Performing full sync...');

    // 1. Push pending changes first
    return from(this.commonSyncService.manualSync()).pipe(
      timeout(10000), // Timeout after 10s if push hangs
      // 2. Pull changes from all collections
      switchMap(() => {
        return forkJoin([
          this.transactionsService.pullFromFirestore(userId),
          this.accountsService.pullFromFirestore(userId),
          this.categoryService.pullFromFirestore(userId),
          this.budgetsService.pullFromFirestore(userId),
          this.goalsService.pullFromFirestore(userId),
          this.splitwiseService.pullGroupsFromFirestore(userId),
          this.splitwiseService.pullInvitationsFromFirestore(userId),
          this.googleSheetsService.pullFromFirestore(userId),
          this.subscriptionService.pullFromFirestore(userId),
          this.feedbackService.pullFromFirestore(),
          this.contactService.pullFromFirestore()
        ]).pipe(
          timeout(30000) // Timeout after 30s if pull hangs
        );
      }),
      tap(() => {
        console.log('✅ Sync completed successfully');
      }),
      catchError(error => {
        if (error.name === 'TimeoutError') {
          console.warn('⚠️ Sync timed out: Continuing in offline mode');
        } else if (error.code === 'unavailable' || error.message?.includes('network')) {
          console.warn('⚠️ Firestore unavailable: Continuing in offline mode');
        } else {
          console.error('❌ Sync failed:', error);
        }
        return of(null);
      })
    );
  }

  // Removed pullAll as forkJoin handles it in syncAll

  ngOnDestroy(): void {
    this.stopSync();
    this.destroy$.next();
    this.destroy$.complete();
  }
}
