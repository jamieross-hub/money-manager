import { Injectable, Inject, PLATFORM_ID, Injector, signal, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, fromEvent, interval, from, of, Subject, combineLatest, merge, forkJoin, Subscription } from 'rxjs';
import { map, switchMap, catchError, tap, take, filter, distinctUntilChanged, takeUntil, delay, startWith, timeout } from 'rxjs/operators';
import { Firestore, collection, doc, writeBatch } from '@angular/fire/firestore';
import { Auth, getAuth } from '@angular/fire/auth';
import { SwUpdate } from '@angular/service-worker';
import { isPlatformServer } from '@angular/common';
import { toObservable } from '@angular/core/rxjs-interop';
import { ValidationService } from './validation.service';
import { Store } from '@ngrx/store';
import { AppState } from '../../store/app.state';
import * as TransactionsActions from '../../store/transactions/transactions.actions';
import { Transaction } from '../models/transaction.model';
import { APP_CONFIG } from '../config/config';
import { LocalIndexDBStorageService } from './indexdb-storage.service';
import { LocalStorageKey, LocalStorageKeyHelper } from '../models/local-storage.model';
import { TransactionsFacadeService } from './db/transactions-facade.service';
import { AccountsFacadeService } from './db/accounts-facade.service';
import { CategoryFacadeService } from './db/category-facade.service';
import { TransactionsService } from './db/transactions.service';
import { AccountsService } from './db/accounts.service';
import { CategoryService } from './db/category.service';
import { BudgetsService } from './db/budgets.service';
import { GoalsService } from './db/goals.service';
import { UserService } from './db/user.service';
import { FamilyService } from '../../modules/family/services/family.service';
import { PwaSwService } from './pwa-sw.service';
import { GoogleSheetsService } from './google-sheets.service';
import { SubscriptionService } from './subscription.service';
import { FeedbackService } from './feedback.service';
import { ContactService } from './db/contact.service';
import { NotificationService } from './notification.service';

export interface NetworkStatus {
  online: boolean;
  connectionType?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

export interface SyncItem {
  id: string;
  type: 'transaction' | 'budget' | 'account' | 'goal';
  operation: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
  retryCount: number;
  maxRetries?: number;
  validationErrors?: string[];
}

export interface SyncStatus {
  isOnline: boolean;
  pendingItems: number;
  lastSyncTime: number | null;
  isSyncing: boolean;
  failedItems: number;
  invalidItems: number;
}

export interface SyncStats {
  totalPending: number;
  totalFailed: number;
  totalInvalid: number;
  lastSyncTime: number | null;
  syncSuccessRate: number;
}

export interface CacheOptions {
  expiry?: number;
  priority?: 'high' | 'normal' | 'low';
  maxSize?: number;
}

export interface CacheItem<T = any> {
  key: string;
  data: T;
  timestamp: number;
  expiry?: number;
  size: number;
  priority: 'high' | 'normal' | 'low';
}

@Injectable({
  providedIn: 'root'
})
export class CommonSyncService implements OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private syncSubscription: Subscription | null = null;
  private transactionSubscription: Subscription | null = null;
  private readonly SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private observersInitialized = false;
  private readonly DEFAULT_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
  private readonly DEFAULT_MAX_SIZE = 50 * 1024 * 1024; // 50MB
  private readonly HIGH_PRIORITY_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days
  private readonly LOW_PRIORITY_EXPIRY = 60 * 60 * 1000; // 1 hour

  private networkStatusSubject = new BehaviorSubject<NetworkStatus>({
    online: false
  });

  private syncStatusSubject = new BehaviorSubject<SyncStatus>({
    isOnline: navigator.onLine,
    pendingItems: 0,
    lastSyncTime: null,
    isSyncing: false,
    failedItems: 0,
    invalidItems: 0
  });
  
  private activeFamilyId$ = toObservable(this.familyService.activeFamilyId);

  public networkStatus$: Observable<NetworkStatus> = this.networkStatusSubject.asObservable();
  public isOnline$: Observable<boolean> = this.networkStatus$.pipe(
    map(status => status.online)
  );

  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
  private syncQueue: SyncItem[] = [];

  constructor(
    private firestore: Firestore,
    private auth: Auth,
    private validationService: ValidationService,
    private swUpdate: SwUpdate,
    private store: Store<AppState>,
    private storageService: LocalIndexDBStorageService,
    private userService: UserService,
    private pwaSwService: PwaSwService,
    private notificationService: NotificationService,
    private injector: Injector,
    private familyService: FamilyService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    if (!isPlatformServer(this.platformId)) {
      this.networkStatusSubject.next({ online: navigator.onLine });
      this.initializeServices();
      this.setupServiceWorkerSyncListener();
    }
  }

  /**
   * Initialize all services
   */
  private async initializeServices(): Promise<void> {
    await Promise.all([
      this.initializeNetworkMonitoring(),
      this.initializeBackgroundSync(),
      this.loadSyncQueue()
    ]);
  }

  /**
   * Initialize network monitoring
   */
  private initializeNetworkMonitoring(): void {
    if (isPlatformServer(this.platformId)) {
      return;
    }

    // Monitor online/offline events
    const online$ = fromEvent(window, 'online').pipe(map(() => true));
    const offline$ = fromEvent(window, 'offline').pipe(map(() => false));

    // Combine online/offline events with initial state
    merge(online$, offline$)
      .pipe(startWith(navigator.onLine))
      .subscribe(online => {
        this.updateNetworkStatus({ online });
        this.handleNetworkChange(online);
      });

    // Monitor connection quality if available
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        connection.addEventListener('change', () => {
          this.updateNetworkStatus({
            online: navigator.onLine,
            connectionType: connection.effectiveType,
            effectiveType: connection.effectiveType,
            downlink: connection.downlink,
            rtt: connection.rtt
          });
        });
      }
    }
  }



  /**
   * Initialize background sync functionality
   */
  private async initializeBackgroundSync(): Promise<void> {
    try {
      if (!('serviceWorker' in navigator) || !('sync' in window)) {
        console.warn('Background Sync API not supported');
        return;
      }

      const registrations = await navigator.serviceWorker.getRegistrations();
      this.serviceWorkerRegistration = registrations.find(reg =>
        reg.scope.includes('/') || reg.scope.includes('/money-manager/')
      ) || null;

      if (!this.serviceWorkerRegistration) {
        console.warn('Service worker not registered for background sync');
        return;
      }

      console.log('Background sync initialized successfully');
      this.updateSyncStatus({ isOnline: navigator.onLine });

    } catch (error) {
      console.error('Failed to initialize background sync:', error);
    }
  }

  /**
   * Handle network status changes
   */
  private handleNetworkChange(online: boolean): void {
    if (online) {
      this.showOnlineNotification();
      this.processSyncQueue();
    } else {
      this.showOfflineNotification();
    }
  }

  /**
   * Show online notification
   */
  private showOnlineNotification(): void {
    console.log('You are back online!', 'Your data will sync automatically.');
  }

  /**
   * Show offline notification
   */
  private showOfflineNotification(): void {
    console.log('You are offline', 'Changes will be saved locally and synced when you reconnect.');
  }





  /**
   * Check if mobile device
   */
  private isMobileDevice(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

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

    console.log('🔄 Starting Sync Service (Interval: 5m)');

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

  private initializeObservers(): void {
    if (this.observersInitialized) return;
    this.observersInitialized = true;

    // Listen for user login and mode changes
    combineLatest([
      this.userService.userAuth$,
      this.activeFamilyId$
    ]).pipe(
      takeUntil(this.destroy$),
      filter((result): result is [any, string | null] => !!result[0] && result[0].uid !== 'offline-guest'),
      distinctUntilChanged((prev, curr) => 
        prev[0]?.uid === curr[0]?.uid && 
        prev[0]?.preferences?.isFamilyMode === curr[0]?.preferences?.isFamilyMode &&
        prev[1] === curr[1]
      ),
      tap(([user, familyId]) => console.log(`🔄 Sync context changed for user: ${user.uid}, Mode: ${user.preferences?.isFamilyMode ? 'Family' : 'Personal'}, FamilyId: ${familyId}`)),
      switchMap(([user, familyId]) => {
        // 1. Initial full sync (already has internal network check)
        const initialSync$ = this.syncAll();
        
        // 2. Start real-time transaction listener reactively based on network
        // We add a delay to ensure app startup always starts with IndexedDB
        const transactionsService = this.injector.get(TransactionsFacadeService);
        const realTimeSync$ = this.isOnline$.pipe(
          delay(10000), // Delay to ensure startup completes with local data
          switchMap(online => {
            if (online) {
              console.log('🌐 Online: Enabling real-time transaction listener');
              return transactionsService.listenToTransactions(user.uid).pipe(
                catchError(error => {
                  console.error('❌ Real-time transaction listener failed:', error);
                  return of(null);
                })
              );
            } else {
              console.log('📴 Offline: Real-time sync disabled (using IndexedDB)');
              return of(null);
            }
          })
        );

        return merge(initialSync$, realTimeSync$);
      })
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
          console.log('💤 App went to passive state: Pausing Sync');
          this.stopSync();
        } else {
          console.log('✨ App resumed: Restarting Sync');
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
    if (!this.isCurrentlyOnline()) {
      console.log('🔄 Sync skipped: Device is Offline');
      return of(null);
    }

    console.log('🔄 Performing full sync...');

    // Resolve services lazily to avoid circular dependencies
    // Using Facades ensures we pull from the correct source (Personal vs Family)
    const transactionsService = this.injector.get(TransactionsFacadeService);
    const accountsService = this.injector.get(AccountsFacadeService);
    const categoryService = this.injector.get(CategoryFacadeService);
    const budgetsService = this.injector.get(BudgetsService);
    const goalsService = this.injector.get(GoalsService);
    const googleSheetsService = this.injector.get(GoogleSheetsService);
    const subscriptionService = this.injector.get(SubscriptionService);
    const feedbackService = this.injector.get(FeedbackService);
    const contactService = this.injector.get(ContactService);

    // 1. Push pending changes first
    return from(this.manualSync()).pipe(
      timeout(10000), // Timeout after 10s if push hangs
      // 2. Pull changes from all collections
      switchMap(() => {
        return forkJoin([
          transactionsService.pullFromFirestore(userId),
          accountsService.pullFromFirestore(userId),
          categoryService.pullFromFirestore(userId),
          budgetsService.pullFromFirestore(userId),
          goalsService.pullFromFirestore(userId),
          googleSheetsService.pullFromFirestore(userId),
          subscriptionService.pullFromFirestore(userId),
          feedbackService.pullFromFirestore(),
          contactService.pullFromFirestore()
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

  // ==================== CACHE OPERATIONS ====================

  /**
   * Get sync status observable
   */
  get syncStatus$(): Observable<SyncStatus> {
    return this.syncStatusSubject.asObservable();
  }

  /**
   * Get current sync status
   */
  get syncStatus(): SyncStatus {
    return this.syncStatusSubject.value;
  }

  /**
   * Register a sync item for processing
   */
  async registerSyncItem(item: Omit<SyncItem, 'timestamp' | 'retryCount'>): Promise<{ success: boolean; errors?: string[] }> {
    try {
      const validationResult = this.validateSyncItem(item);

      if (!validationResult.isValid) {
        console.error('Invalid sync item data:', item.id, validationResult.errors);
        this.updateSyncStatus({
          invalidItems: this.syncStatus.invalidItems + 1
        });
        return { success: false, errors: validationResult.errors };
      }

      const syncItem: SyncItem = {
        ...item,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: item.maxRetries || 3
      };

      this.syncQueue.push(syncItem);
      await this.saveSyncQueue();

      this.updateSyncStatus({
        pendingItems: this.syncStatus.pendingItems + 1
      });

      if (navigator.onLine) {
        await this.processSyncQueue();
      } else {
        await this.triggerBackgroundSync('sync-all-data');
      }

      console.log('Sync item registered:', syncItem.id);
      return { success: true };

    } catch (error) {
      console.error('Failed to register sync item:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to register sync item';
      return { success: false, errors: [errorMessage] };
    }
  }

  /**
   * Process the sync queue
   */
  private async processSyncQueue(): Promise<void> {
    if (this.syncQueue.length === 0) return;

    this.updateSyncStatus({ isSyncing: true });

    const batch = writeBatch(this.firestore);
    const processedItems: string[] = [];
    const failedItems: string[] = [];

    for (const item of this.syncQueue) {
      try {
        const userId = this.getCurrentUserId();
        if (!userId) continue;

        switch (item.type) {
          case 'transaction':
            await this.processTransactionSync(item, batch, userId);
            break;
          case 'budget':
            await this.processBudgetSync(item, batch, userId);
            break;
          case 'account':
            await this.processAccountSync(item, batch, userId);
            break;
          case 'goal':
            await this.processGoalSync(item, batch, userId);
            break;
        }

        processedItems.push(item.id);

        // Update sync status for successful transactions
        if (item.type === 'transaction') {
          await this.updateTransactionSyncStatus(item.data.id || item.id, 'synced');
        }
      } catch (error) {
        console.error(`Failed to process sync item ${item.id}:`, error);

        item.retryCount++;
        if (item.retryCount >= (item.maxRetries || 3)) {
          failedItems.push(item.id);
          // Update sync status to failed for transactions
          if (item.type === 'transaction') {
            await this.updateTransactionSyncStatus(item.data.id || item.id, 'failed');
          }
        }
      }
    }

    if (processedItems.length > 0) {
      try {
        await batch.commit();

        this.syncQueue = this.syncQueue.filter(item => !processedItems.includes(item.id));
        await this.saveSyncQueue();

        this.updateSyncStatus({
          lastSyncTime: Date.now(),
          pendingItems: this.syncQueue.length,
          failedItems: failedItems.length,
          isSyncing: false
        });

        console.log(`✅ Processed ${processedItems.length} sync items`);
      } catch (error) {
        console.error('Failed to commit sync operations:', error);
        this.updateSyncStatus({ isSyncing: false });
      }
    } else {
      this.updateSyncStatus({ isSyncing: false });
    }
  }

  /**
   * Process transaction sync operations
   */
  private async processTransactionSync(item: SyncItem, batch: any, userId: string): Promise<void> {
    const transactionsRef = collection(this.firestore, `users/${userId}/transactions`);

    switch (item.operation) {
      case 'create':
        const transactionRef = doc(this.firestore, `users/${userId}/transactions/${item.data.id}`);
        batch.set(transactionRef, item.data);
        break;
      case 'update':
        const updateRef = doc(this.firestore, `users/${userId}/transactions/${item.data.id}`);
        batch.update(updateRef, item.data);
        break;
      case 'delete':
        const deleteRef = doc(this.firestore, `users/${userId}/transactions/${item.data.id}`);
        batch.delete(deleteRef);
        break;
    }
  }

  /**
   * Update transaction sync status after successful sync
   */
  private async updateTransactionSyncStatus(transactionId: string, status: 'synced' | 'failed'): Promise<void> {
    try {
      // Update in store
      this.store.dispatch(TransactionsActions.updateTransactionSuccess({
        transaction: {
          id: transactionId,
          syncStatus: status,
          lastSyncedAt: new Date()
        } as Transaction
      }));

      console.log(`Transaction ${transactionId} sync status updated to: ${status}`);
    } catch (error) {
      console.error('Failed to update transaction sync status:', error);
    }
  }



  /**
   * Process budget sync operations
   */
  private async processBudgetSync(item: SyncItem, batch: any, userId: string): Promise<void> {
    const budgetsRef = collection(this.firestore, `users/${userId}/budgets`);

    switch (item.operation) {
      case 'create':
        const docRef = doc(budgetsRef);
        batch.set(docRef, item.data);
        break;
      case 'update':
        const updateRef = doc(this.firestore, `users/${userId}/budgets/${item.data.id}`);
        batch.update(updateRef, item.data);
        break;
      case 'delete':
        const deleteRef = doc(this.firestore, `users/${userId}/budgets/${item.data.id}`);
        batch.delete(deleteRef);
        break;
    }
  }

  /**
   * Process account sync operations
   */
  private async processAccountSync(item: SyncItem, batch: any, userId: string): Promise<void> {
    const accountsRef = collection(this.firestore, `users/${userId}/accounts`);

    switch (item.operation) {
      case 'create':
        const docRef = doc(accountsRef);
        batch.set(docRef, item.data);
        break;
      case 'update':
        const updateRef = doc(this.firestore, `users/${userId}/accounts/${item.data.id}`);
        batch.update(updateRef, item.data);
        break;
      case 'delete':
        const deleteRef = doc(this.firestore, `users/${userId}/accounts/${item.data.id}`);
        batch.delete(deleteRef);
        break;
    }
  }

  /**
   * Process goal sync operations
   */
  private async processGoalSync(item: SyncItem, batch: any, userId: string): Promise<void> {
    const goalsRef = collection(this.firestore, `users/${userId}/goals`);

    switch (item.operation) {
      case 'create':
        const docRef = doc(goalsRef);
        batch.set(docRef, item.data);
        break;
      case 'update':
        const updateRef = doc(this.firestore, `users/${userId}/goals/${item.data.id}`);
        batch.update(updateRef, item.data);
        break;
      case 'delete':
        const deleteRef = doc(this.firestore, `users/${userId}/goals/${item.data.id}`);
        batch.delete(deleteRef);
        break;
    }
  }

  /**
   * Validate sync item data
   */
  private validateSyncItem(item: Omit<SyncItem, 'timestamp' | 'retryCount'>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!item.id || !item.type || !item.data) {
      errors.push('Missing required fields: id, type, or data');
      return { isValid: false, errors };
    }

    switch (item.type) {
      case 'transaction':
        const transactionValidation = this.validationService.validateTransactionData(item.data);
        if (!transactionValidation.isValid) {
          errors.push(...transactionValidation.errors);
        }
        break;

      case 'budget':
        const budgetValidation = this.validationService.validateCommonData(item.data);
        if (!budgetValidation.isValid) {
          errors.push(...budgetValidation.errors);
        }
        break;

      case 'account':
        const accountValidation = this.validationService.validateCommonData(item.data);
        if (!accountValidation.isValid) {
          errors.push(...accountValidation.errors);
        }
        break;

      case 'goal':
        const goalValidation = this.validationService.validateCommonData(item.data);
        if (!goalValidation.isValid) {
          errors.push(...goalValidation.errors);
        }
        break;
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Trigger background sync
   */
  async triggerBackgroundSync(syncType?: string): Promise<void> {
    if (!this.serviceWorkerRegistration) {
      console.warn('Service worker not available for background sync');
      return;
    }

    try {
      this.updateSyncStatus({ isSyncing: true });

      const syncTag = syncType || 'sync-transactions';
      if ('sync' in this.serviceWorkerRegistration) {
        // @ts-ignore: Property 'sync' may not exist on some types
        await (this.serviceWorkerRegistration as any).sync.register(syncTag);
        console.log('Background sync triggered:', syncTag);
      } else {
        console.warn('Background Sync is not supported in this browser.');
      }

      this.updateSyncStatus({
        lastSyncTime: Date.now(),
        isSyncing: false
      });

    } catch (error) {
      console.error('Failed to trigger background sync:', error);
      this.updateSyncStatus({ isSyncing: false });
    }
  }

  /**
   * Manual sync trigger
   */
  async manualSync(): Promise<void> {
    console.log('Manual sync triggered');
    await this.processSyncQueue();
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(): Promise<SyncStats> {
    const totalProcessed = this.syncQueue.length + this.syncStatus.failedItems + this.syncStatus.invalidItems;
    const successRate = totalProcessed > 0 ? (this.syncQueue.length / totalProcessed) * 100 : 0;

    return {
      totalPending: this.syncQueue.length,
      totalFailed: this.syncStatus.failedItems,
      totalInvalid: this.syncStatus.invalidItems,
      lastSyncTime: this.syncStatus.lastSyncTime,
      syncSuccessRate: successRate
    };
  }

  /**
   * Clear completed sync items
   */
  async clearCompletedItems(): Promise<void> {
    try {
      this.updateSyncStatus({
        pendingItems: this.syncQueue.length,
        failedItems: 0,
        invalidItems: 0
      });
    } catch (error) {
      console.error('Failed to clear completed items:', error);
    }
  }

  // ==================== CACHE OPERATIONS ====================

  /**
   * Cache data with options
   */
  async cacheData<T>(key: string, data: T, options: CacheOptions = {}): Promise<void> {
    if (isPlatformServer(this.platformId)) {
      return;
    }

    try {
      const cacheItem: CacheItem<T> = {
        key,
        data,
        timestamp: Date.now(),
        expiry: options.expiry || this.getDefaultExpiry(options.priority),
        size: this.calculateSize(data),
        priority: options.priority || 'normal'
      };

      await this.storeInCacheStorage(key, cacheItem);
      await this.storeInIndexedDB(key, cacheItem);
      await this.cleanupCache();

    } catch (error) {
      console.error('Failed to cache data:', error);
    }
  }

  /**
   * Get cached data
   */
  async getCachedData<T>(key: string): Promise<T | null> {
    if (isPlatformServer(this.platformId)) {
      return null;
    }

    try {
      let cacheItem = await this.getFromCacheStorage<T>(key);

      if (!cacheItem) {
        cacheItem = await this.getFromIndexedDB<T>(key);
      }

      if (!cacheItem) {
        return null;
      }

      if (this.isExpired(cacheItem)) {
        await this.removeCachedData(key);
        return null;
      }

      return cacheItem.data;
    } catch (error) {
      console.error('Failed to get cached data:', error);
      return null;
    }
  }

  /**
   * Remove cached data
   */
  async removeCachedData(key: string): Promise<void> {
    if (isPlatformServer(this.platformId)) {
      return;
    }

    try {
      await Promise.all([
        this.removeFromCacheStorage(key),
        this.removeFromIndexedDB(key)
      ]);
    } catch (error) {
      console.error('Failed to remove cached data:', error);
    }
  }

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<void> {
    if (isPlatformServer(this.platformId)) {
      return;
    }

    try {
      await Promise.all([
        this.clearCacheStorage(),
        this.clearIndexedDB()
      ]);
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalItems: number;
    totalSize: number;
    expiredItems: number;
    cacheStorageSize: number;
    indexedDBSize: number;
  }> {
    if (isPlatformServer(this.platformId)) {
      return {
        totalItems: 0,
        totalSize: 0,
        expiredItems: 0,
        cacheStorageSize: 0,
        indexedDBSize: 0
      };
    }

    try {
      const [cacheStorageItems, indexedDBItems] = await Promise.all([
        this.getAllFromCacheStorage(),
        this.getAllFromIndexedDB()
      ]);

      const allItems = [...cacheStorageItems, ...indexedDBItems];
      const uniqueItems = this.deduplicateItems(allItems);

      const expiredItems = uniqueItems.filter(item => this.isExpired(item));
      const totalSize = uniqueItems.reduce((sum, item) => sum + item.size, 0);

      return {
        totalItems: uniqueItems.length,
        totalSize,
        expiredItems: expiredItems.length,
        cacheStorageSize: cacheStorageItems.length,
        indexedDBSize: indexedDBItems.length
      };
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return {
        totalItems: 0,
        totalSize: 0,
        expiredItems: 0,
        cacheStorageSize: 0,
        indexedDBSize: 0
      };
    }
  }

  // ==================== NETWORK STATUS ====================

  /**
   * Get current network status
   */
  public getCurrentNetworkStatus(): NetworkStatus {
    return this.networkStatusSubject.value;
  }

  /**
   * Check if currently online
   */
  public isCurrentlyOnline(): boolean {
    return this.networkStatusSubject.value.online;
  }

  /**
   * Check if app should work in offline mode
   */
  public shouldWorkOffline(): boolean {
    // App should work offline if:
    // 1. User is authenticated (has cached auth data)
    // 2. Has cached user data
    // 3. Has cached app data
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;

      if (!currentUser) {
        return false;
      }

      // Check if user data is cached
      const cachedUserData = this.storageService.getItem(LocalStorageKeyHelper.getUserDataKey(currentUser.uid));
      if (!cachedUserData) {
        return false;
      }

      // Check if app has some cached data
      const hasCachedData = this.storageService.getItem(LocalStorageKey.APP_CACHE_VERSION) ||
        this.storageService.getItem(LocalStorageKeyHelper.getTransactionsCacheKey(currentUser.uid)) ||
        this.storageService.getItem(LocalStorageKeyHelper.getCategoriesCacheKey(currentUser.uid));

      return !!hasCachedData;
    } catch (error) {
      console.error('Error checking offline capability:', error);
      return false;
    }
  }

  /**
   * Get connection quality
   */
  public getConnectionQuality(): string {
    const status = this.networkStatusSubject.value;
    if (!status.online) return 'offline';
    if (status.effectiveType === '4g') return 'excellent';
    if (status.effectiveType === '3g') return 'good';
    if (status.effectiveType === '2g') return 'poor';
    return 'unknown';
  }

  /**
   * Request notification permission
   */
  public requestNotificationPermission(): Promise<NotificationPermission> {
    if ('Notification' in window) {
      return Notification.requestPermission();
    }
    return Promise.resolve('denied' as NotificationPermission);
  }

  // ==================== PRIVATE HELPER METHODS ====================

  /**
   * Update network status
   */
  private updateNetworkStatus(status: Partial<NetworkStatus>): void {
    const currentStatus = this.networkStatusSubject.value;
    const newStatus = { ...currentStatus, ...status };
    this.networkStatusSubject.next(newStatus);
  }

  /**
   * Update sync status
   */
  private updateSyncStatus(updates: Partial<SyncStatus>): void {
    const currentStatus = this.syncStatusSubject.value;
    const newStatus = { ...currentStatus, ...updates };
    this.syncStatusSubject.next(newStatus);
  }

  /**
   * Get current user ID
   */
  private getCurrentUserId(): string | null {
    return this.auth.currentUser?.uid || null;
  }

  /**
   * Load sync queue from storage
   */
  private async loadSyncQueue(): Promise<void> {
    try {
      const queue = await this.getCachedData<SyncItem[]>(LocalStorageKey.SYNC_QUEUE);
      if (queue && Array.isArray(queue)) {
        this.syncQueue = queue;
        this.updateSyncStatus({ pendingItems: this.syncQueue.length });
      } else {
        // If queue is not an array, initialize as empty array
        this.syncQueue = [];
        this.updateSyncStatus({ pendingItems: 0 });
      }
    } catch (error) {
      console.error('Failed to load sync queue:', error);
      // Initialize as empty array on error
      this.syncQueue = [];
      this.updateSyncStatus({ pendingItems: 0 });
    }
  }

  /**
   * Save sync queue to storage
   */
  private async saveSyncQueue(): Promise<void> {
    try {
      await this.cacheData(LocalStorageKey.SYNC_QUEUE, this.syncQueue);
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }

  /**
   * Get default expiry based on priority
   */
  private getDefaultExpiry(priority?: 'high' | 'normal' | 'low'): number {
    switch (priority) {
      case 'high':
        return this.HIGH_PRIORITY_EXPIRY;
      case 'low':
        return this.LOW_PRIORITY_EXPIRY;
      default:
        return this.DEFAULT_EXPIRY;
    }
  }

  /**
   * Calculate data size in bytes
   */
  private calculateSize(data: any): number {
    try {
      const jsonString = JSON.stringify(data);
      return new Blob([jsonString]).size;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Check if cache item is expired
   */
  private isExpired(cacheItem: CacheItem): boolean {
    if (!cacheItem.expiry) {
      return false;
    }
    return Date.now() > cacheItem.timestamp + cacheItem.expiry;
  }

  /**
   * Clean up expired and old items
   */
  private async cleanupCache(): Promise<void> {
    try {
      const stats = await this.getCacheStats();

      const keys = await this.getCacheKeys();
      for (const key of keys) {
        const data = await this.getCachedData(key);
        if (data === null) {
          await this.removeCachedData(key);
        }
      }

      if (stats.totalSize > this.DEFAULT_MAX_SIZE) {
        const allItems = await this.getAllFromCacheStorage();
        const sortedItems = allItems
          .filter(item => !this.isExpired(item))
          .sort((a, b) => {
            const priorityOrder = { high: 3, normal: 2, low: 1 };
            const aPriority = priorityOrder[a.priority];
            const bPriority = priorityOrder[b.priority];

            if (aPriority !== bPriority) {
              return bPriority - aPriority;
            }
            return a.timestamp - b.timestamp;
          });

        for (const item of sortedItems) {
          if (item.priority === 'low') {
            await this.removeCachedData(item.key);
            const newStats = await this.getCacheStats();
            if (newStats.totalSize <= this.DEFAULT_MAX_SIZE * 0.8) {
              break;
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup cache:', error);
    }
  }

  /**
   * Get cache keys
   */
  private async getCacheKeys(): Promise<string[]> {
    if (isPlatformServer(this.platformId)) {
      return [];
    }

    try {
      const [cacheStorageKeys, indexedDBKeys] = await Promise.all([
        this.getCacheStorageKeys(),
        this.getIndexedDBKeys()
      ]);

      return [...new Set([...cacheStorageKeys, ...indexedDBKeys])];
    } catch (error) {
      console.error('Failed to get cache keys:', error);
      return [];
    }
  }

  /**
   * Store data in Cache Storage
   */
  private async storeInCacheStorage(key: string, cacheItem: CacheItem): Promise<void> {
    if ('caches' in window) {
      try {
        const cache = await caches.open('money-manager-data');
        const response = new Response(JSON.stringify(cacheItem));
        await cache.put(key, response);
      } catch (error) {
        console.warn('Failed to store in Cache Storage:', error);
      }
    }
  }

  /**
   * Store data in Local Storage
   */
  private async storeInIndexedDB(key: string, cacheItem: CacheItem): Promise<void> {
    try {
      this.storageService.setItem(key, cacheItem);
    } catch (error) {
      console.warn('Failed to store in IndexedDB:', error);
    }
  }

  /**
   * Get data from Cache Storage
   */
  private async getFromCacheStorage<T>(key: string): Promise<CacheItem<T> | null> {
    if ('caches' in window) {
      try {
        const cache = await caches.open('money-manager-data');
        const response = await cache.match(key);
        if (response) {
          const data = await response.json();
          return data as CacheItem<T>;
        }
      } catch (error) {
        console.warn('Failed to get from Cache Storage:', error);
      }
    }
    return null;
  }

  /**
   * Get data from Local Storage
   */
  private async getFromIndexedDB<T>(key: string): Promise<CacheItem<T> | null> {
    try {
      return this.storageService.getItem<CacheItem<T>>(key);
    } catch (error) {
      console.warn('Failed to get from IndexedDB:', error);
    }
    return null;
  }

  /**
   * Remove data from Cache Storage
   */
  private async removeFromCacheStorage(key: string): Promise<void> {
    if ('caches' in window) {
      try {
        const cache = await caches.open('money-manager-data');
        await cache.delete(key);
      } catch (error) {
        console.warn('Failed to remove from Cache Storage:', error);
      }
    }
  }

  /**
   * Remove data from Local Storage
   */
  private async removeFromIndexedDB(key: string): Promise<void> {
    try {
      this.storageService.removeItem(key);
    } catch (error) {
      console.warn('Failed to remove from IndexedDB:', error);
    }
  }

  /**
   * Clear Cache Storage
   */
  private async clearCacheStorage(): Promise<void> {
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      } catch (error) {
        console.warn('Failed to clear Cache Storage:', error);
      }
    }
  }

  /**
   * Clear Local Storage
   */
  private async clearIndexedDB(): Promise<void> {
    try {
      this.storageService.clear();
    } catch (error) {
      console.warn('Failed to clear IndexedDB:', error);
    }
  }

  /**
   * Get all items from Cache Storage
   */
  private async getAllFromCacheStorage(): Promise<CacheItem[]> {
    if ('caches' in window) {
      try {
        const cache = await caches.open('money-manager-data');
        const keys = await cache.keys();
        const items: CacheItem[] = [];

        for (const request of keys) {
          const response = await cache.match(request);
          if (response) {
            const data = await response.json();
            items.push(data);
          }
        }

        return items;
      } catch (error) {
        console.warn('Failed to get all from Cache Storage:', error);
      }
    }
    return [];
  }

  /**
   * Get all items from Local Storage
   */
  private async getAllFromIndexedDB(): Promise<CacheItem[]> {
    try {
      const keys = this.storageService.getAllKeys();
      const items: CacheItem[] = [];
      for (const key of keys) {
        const item = this.storageService.getItem<CacheItem>(key);
        if (item) {
          items.push(item);
        }
      }
      return items;
    } catch (error) {
      console.warn('Failed to get all from Local Storage:', error);
      return [];
    }
  }

  /**
   * Get Cache Storage keys
   */
  private async getCacheStorageKeys(): Promise<string[]> {
    if ('caches' in window) {
      try {
        const cache = await caches.open('money-manager-data');
        const keys = await cache.keys();
        return keys.map(request => request.url);
      } catch (error) {
        console.warn('Failed to get Cache Storage keys:', error);
      }
    }
    return [];
  }

  /**
   * Get Local Storage keys
   */
  private async getIndexedDBKeys(): Promise<string[]> {
    try {
      return this.storageService.getAllKeys();
    } catch (error) {
      console.warn('Failed to get Local Storage keys:', error);
      return [];
    }
  }

  /**
   * Deduplicate items by key, keeping the most recent
   */
  private deduplicateItems(items: CacheItem[]): CacheItem[] {
    const uniqueItems = new Map<string, CacheItem>();

    for (const item of items) {
      const existing = uniqueItems.get(item.key);
      if (!existing || item.timestamp > existing.timestamp) {
        uniqueItems.set(item.key, item);
      }
    }

    return Array.from(uniqueItems.values());
  }

  /**
   * Check if background sync is supported
   */
  isSupported(): boolean {
    return 'serviceWorker' in navigator && 'sync' in window;
  }

  /**
   * Listen for sync events from service worker
   */
  private setupServiceWorkerSyncListener(): void {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SYNC_COMPLETED') {
          const { transactionId, success } = event.data;
          if (transactionId) {
            this.updateTransactionSyncStatus(
              transactionId,
              success ? 'synced' : 'failed'
            );
          }
        }
      });
    }
  }

  ngOnDestroy(): void {
    this.stopSync();
    this.destroy$.next();
    this.destroy$.complete();
  }
}