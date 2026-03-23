import { Injectable, Inject, PLATFORM_ID, Injector, signal, OnDestroy, computed, Signal } from '@angular/core';
import { BehaviorSubject, Observable, fromEvent, interval, from, of, Subject, combineLatest, merge, forkJoin, Subscription } from 'rxjs';
import { map, switchMap, catchError, tap, take, first, filter, distinctUntilChanged, takeUntil, delay, startWith, timeout, debounceTime, finalize } from 'rxjs/operators';
import { Firestore, collection, doc, serverTimestamp, Timestamp, getDoc, getDocFromServer, setDoc, deleteDoc, writeBatch, WriteBatch } from '@angular/fire/firestore';
import { Auth, getAuth } from '@angular/fire/auth';
import { SwUpdate } from '@angular/service-worker';
import { isPlatformServer } from '@angular/common';
import { toObservable } from '@angular/core/rxjs-interop';
import { ValidationService } from './validation.service';
import { Store } from '@ngrx/store';
import { AppState } from '../../store/app.state';
import * as TransactionsActions from '../../store/transactions/transactions.actions';
import * as BudgetsActions from '../../store/budgets/budgets.actions';
import * as AccountsActions from '../../store/accounts/accounts.actions';
import * as GoalsActions from '../../store/goals/goals.actions';
import * as CategoriesActions from '../../store/categories/categories.actions';
import { Transaction } from '../models/transaction.model';
import { APP_CONFIG } from '../config/config';
import { LocalIndexDBStorageService } from './indexdb-storage.service';
import { LocalStorageKey, LocalStorageKeyHelper } from '../models/local-storage.model';

import { TransactionsService } from './db/transactions.service';
import { AccountsService } from './db/accounts.service';
import { CategoryService } from './db/category.service';
import { AccountsFacadeService } from './db/accounts-facade.service';
import { CategoryFacadeService } from './db/category-facade.service';
import { TransactionsFacadeService } from './db/transactions-facade.service';
import { BudgetsService } from './db/budgets.service';
import { GoalsService } from './db/goals.service';
import { UserService } from './db/user.service';
import * as ProfileSelectors from 'src/app/store/profile/profile.selectors';
import { FamilyService } from '../../modules/family/services/family.service';
import { PwaSwService } from './pwa-sw.service';
import { GoogleSheetsService } from './google-sheets.service';
import { SubscriptionService } from './subscription.service';
import { FeedbackService } from './feedback.service';
import { ContactService } from './db/contact.service';
import { NotificationService } from './notification.service';
import { environment } from '@env/environment';

/**
 * Interface and Types
 */
export interface NetworkStatus {
  online: boolean;
  connectionType?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  isSlow?: boolean;
}

export interface SyncItem {
  id: string;
  type: 'transaction' | 'budget' | 'account' | 'goal' | 'category' | 'user';
  operation: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
  retryCount: number;
  maxRetries?: number;
  validationErrors?: string[];
  collectionPath?: string;
}

export interface SyncStatus {
  isOnline: boolean;
  pendingItems: number;
  lastSyncTime: number | null;
  isSyncing: boolean;
  isFullSyncing: boolean;
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
  private log(message: string, ...args: any[]): void {
    console.log(`[CommonSyncService] ${message}`, ...args);
  }

  private warn(message: string, ...args: any[]): void {
    console.warn(`[CommonSyncService] ${message}`, ...args);
  }

  private error(message: string, ...args: any[]): void {
    console.error(`[CommonSyncService] ${message}`, ...args);
  }

  // #region Properties & State
  private readonly destroy$ = new Subject<void>();
  private syncSubscription: Subscription | null = null;
  private transactionSubscription: Subscription | null = null;
  
  private readonly SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly DEFAULT_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
  private readonly DEFAULT_MAX_SIZE = 50 * 1024 * 1024; // 50MB
  private readonly HIGH_PRIORITY_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days
  private readonly LOW_PRIORITY_EXPIRY = 60 * 60 * 1000; // 1 hour
  
  // Slow connection thresholds
  private readonly SLOW_RTT_THRESHOLD = 2000; // 2 seconds
  private readonly SLOW_DOWNLINK_THRESHOLD = 0.15; // 150 kbps
  private readonly SLOW_EFFECTIVE_TYPES = ['slow-2g', '2g'];
  
  private observersInitialized = false;
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
  private syncQueue: SyncItem[] = [];
  private readonly triggerFullSync$ = new Subject<void>();
  private networkWorker: Worker | null = null;

  private networkStatusSignal = signal<NetworkStatus>({
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSlow: false
  });

  private syncStatusSignal = signal<SyncStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : false,
    pendingItems: 0,
    lastSyncTime: null,
    isSyncing: false,
    isFullSyncing: false,
    failedItems: 0,
    invalidItems: 0
  });
  
  private activeFamilyId$ = toObservable(this.familyService.activeFamilyId);

  public readonly networkStatus = this.networkStatusSignal.asReadonly();
  public readonly networkStatus$: Observable<NetworkStatus> = toObservable(this.networkStatus);
  public readonly isOnline: Signal<boolean> = computed(() => {
    const status = this.networkStatusSignal();
    return status.online && !status.isSlow;
  });
  public readonly isOnline$: Observable<boolean> = toObservable(this.isOnline);
  public readonly isSlowConnection: Signal<boolean> = computed(() => !!this.networkStatusSignal().isSlow);
  // #endregion

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
      this.initializeServices();
      this.setupServiceWorkerSyncListener();
    }
  }

  ngOnDestroy(): void {
    this.stopSync();
    if (this.networkWorker) {
      this.networkWorker.terminate();
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  // #region Initialization
  /**
   * Initialize all services
   */
  private async initializeServices(): Promise<void> {
    const isGuest = this.userService.isGuestModeEnabled() || this.userService.getCurrentUserId() === 'offline-guest';

    if (!isGuest) {
      this.initializeNetworkMonitoring();
    }

    await Promise.all([
      this.initializeBackgroundSync(),
      this.loadSyncQueue()
    ]);
  }

  private async checkFirebaseConnection(timeoutMs: number = 2500): Promise<boolean> {
    try {
      const ref = doc(this.firestore, "health", "ping");
      // Use getDocFromServer to bypass cache and enforce real network request
      const pingPromise = getDocFromServer(ref);
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), timeoutMs)
      );

      await Promise.race([pingPromise, timeoutPromise]);
      return true;
    } catch (e: any) {
      // Treat specific errors as "online" since we reached the server
      if (
        e?.code === 'permission-denied' || 
        e?.message?.includes('Missing or insufficient permissions') ||
        e?.code === 'unauthenticated' ||
        e?.code === 'resource-exhausted'
      ) {
        return true;
      }
      return false;
    }
  }

  private initializeNetworkMonitoring(): void {
    if (isPlatformServer(this.platformId)) {
      return;
    }

    if (typeof Worker !== 'undefined') {
      try {
        this.networkWorker = new Worker(new URL('../../worker/network-monitor.worker', import.meta.url));
        
        this.networkWorker.onmessage = ({ data }) => {
          if (data && data.type === 'NETWORK_UPDATE') {
            this.updateNetworkStatus(data.payload);
          }
        };

        this.networkWorker.postMessage({
          type: 'INITIALIZE',
          payload: {
            config: {
              baseUrl: environment.baseUrl,
              projectId: environment.firebaseConfig?.projectId
            },
            isVisible: document.visibilityState === 'visible'
          }
        });

        // Mirror visibility changes to worker
        fromEvent(document, 'visibilitychange')
          .pipe(takeUntil(this.destroy$))
          .subscribe(() => {
            this.networkWorker?.postMessage({
              type: 'VISIBILITY_CHANGE',
              payload: document.visibilityState
            });
          });

      } catch (error) {
        this.error('Failed to initialize network monitoring worker:', error);
      }
    } else {
      this.warn('Web Workers are not supported in this environment for network monitoring.');
    }
  }

  /**
   * Initialize background sync functionality
   */
  private async initializeBackgroundSync(): Promise<void> {
    try {
      if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
        this.log('Background Sync API not supported');
        return;
      }

      const registrations = await navigator.serviceWorker.getRegistrations();
      this.serviceWorkerRegistration = registrations.find(reg =>
        reg.scope.includes('/') || reg.scope.includes('/money-manager/')
      ) || null;

      if (!this.serviceWorkerRegistration) {
        this.warn('Service worker not registered for background sync');
        return;
      }

      this.log('Background sync initialized successfully');
      this.updateSyncStatus({ isOnline: this.isCurrentlyOnline() });

    } catch (error) {
      this.error('Failed to initialize background sync:', error);
    }
  }

  /**
   * Listen for sync events from service worker
   */
  private setupServiceWorkerSyncListener(): void {
    if ('serviceWorker' in navigator) {
      fromEvent(navigator.serviceWorker, 'message')
        .pipe(takeUntil(this.destroy$))
        .subscribe((event: any) => {
          if (event && event.data && event.data.type === 'SYNC_COMPLETED') {
            const { transactionId, success } = event.data;
            if (transactionId) {
              // High-performance O(1) lookup using the dedicated transactions store index
              const transaction = this.storageService.getItem<Transaction>(transactionId, 'transactions');
              
              if (transaction) {
                this.updateItemSyncStatus({
                  type: 'transaction',
                  data: transaction,
                  operation: 'update',
                  id: 'legacy-sw-sync'
                } as any, success ? 'synced' : 'failed');
              }
            }
          }
        });
    }
  }
  // #endregion

  // #region Network Monitoring & Status
  /**
   * Handle network status changes
   */
  private handleNetworkChange(online: boolean, isSlow: boolean = false): void {
    if (online) {
      this.showOnlineNotification();
      this.processSyncQueue();
    } else {
      if (isSlow) {
        this.showSlowConnectionNotification();
      } else {
        this.showOfflineNotification();
      }
    }
  }

  /**
   * Get current network status
   */
  public getCurrentNetworkStatus(): NetworkStatus {
    return this.networkStatusSignal();
  }

  /**
   * Check if currently online (Effective online status)
   */
  public isCurrentlyOnline(): boolean {
    const status = this.networkStatusSignal();
    return status.online && !status.isSlow;
  }

  /**
   * Check if the connection is slow based on current status
   */
  private calculateIsSlow(status: NetworkStatus): boolean {
    if (!status.online) return false;
    
    const isSlowType = status.effectiveType && this.SLOW_EFFECTIVE_TYPES.includes(status.effectiveType);
    const isSlowRTT = status.rtt !== undefined && status.rtt > this.SLOW_RTT_THRESHOLD;
    const isSlowDownlink = status.downlink !== undefined && status.downlink < this.SLOW_DOWNLINK_THRESHOLD;
    
    return !!(isSlowType || isSlowRTT || isSlowDownlink);
  }

  /**
   * Check if app should work in offline mode
   */
  public shouldWorkOffline(): boolean {
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
      this.error('Error checking offline capability:', error);
      return false;
    }
  }

  /**
   * Get connection quality
   */
  public getConnectionQuality(): string {
    const status = this.networkStatusSignal();
    if (!status.online) return 'offline';
    if (status.isSlow) return 'poor (slow)';
    if (status.effectiveType === '4g') return 'excellent';
    if (status.effectiveType === '3g') return 'good';
    if (status.effectiveType === '2g') return 'poor';
    return 'unknown';
  }

  /**
   * Update network status
   */
  private updateNetworkStatus(status: Partial<NetworkStatus>): void {
    const currentStatus = this.networkStatusSignal();
    const isSlow = this.calculateIsSlow({ ...currentStatus, ...status });
    const newStatus = { ...currentStatus, ...status, isSlow };
    
    // Check if effective online status changed
    const wasEffectivelyOnline = currentStatus.online && !currentStatus.isSlow;
    const isEffectivelyOnline = newStatus.online && !newStatus.isSlow;
    
    this.networkStatusSignal.set(newStatus);
    
    if (wasEffectivelyOnline !== isEffectivelyOnline) {
      this.handleNetworkChange(isEffectivelyOnline, isSlow);
    }
  }

  /**
   * Show online notification
   */
  private showOnlineNotification(): void {
    this.log('You are back online!', 'Your data will sync automatically.');
    //this.notificationService.info('Back online. Sync resumed.');
  }

  /**
   * Show offline notification
   */
  private showOfflineNotification(): void {
    this.log('You are offline', 'Changes will be saved locally and synced when you reconnect.');
    //this.notificationService.warning('You are offline.');
  }

  /**
   * Show slow connection notification
   */
  private showSlowConnectionNotification(): void {
    this.warn('Internet connection is slow. Switching to pure offline mode for better performance.');
    //this.notificationService.warning('Slow internet detected. Switching to offline mode for better performance.');
  }
  // #endregion

  // #region Sync Control
  /**
   * Start the periodic sync process
   */
  startSync(): void {
    if (this.syncSubscription) {
      return;
    }

    this.log('🔄 Starting Sync Service (Interval: 5m)');

    this.initializeObservers();

    // Set up periodic interval
    this.syncSubscription = interval(this.SYNC_INTERVAL).pipe(
      filter(() => document.visibilityState === 'visible'), // Only sync if app is visible
      switchMap(() => this.syncAll()),
      catchError(error => {
        this.error('❌ Periodic sync failed:', error);
        return of(null);
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
  syncAll(forcedFamilyId?: string | null) {
    const userId = this.userService.getCurrentUserId();
    const profile = this.store.selectSignal(ProfileSelectors.selectProfile)();
    const effectiveFamilyId = forcedFamilyId !== undefined 
          ? (forcedFamilyId || undefined) 
          : (profile?.preferences?.activeFamilyId || undefined);
    const isFamilyMode = forcedFamilyId !== undefined 
          ? !!forcedFamilyId 
          : (profile?.preferences?.isFamilyMode ?? false);

    this.log(`syncAll started. UserId: ${userId}, Mode: ${isFamilyMode ? 'Family' : 'Personal'}, FamilyId: ${effectiveFamilyId}`);

    // 1. Handle Guest Mode
    if (userId === 'offline-guest') {
      this.log('🔄 Sync skipped: Guest Mode (Local Only)');
      return of(null);
    }

    if (!userId) {
      return of(null);
    }

    // 2. Handle Network Offline
    // Fast check first: browser API is synchronous and reliable when offline
    if (!navigator.onLine) {
      this.log('🔄 Sync skipped: navigator.onLine is false (Device is Offline)');
      return of(null);
    }
    // Slower check: confirmed real connectivity state
    if (!this.isCurrentlyOnline()) {
      this.log('🔄 Sync skipped: Device is Offline');
      return of(null);
    }

    this.log('🔄 Performing full sync...');
    this.updateSyncStatus({ isFullSyncing: true });


    const transactionsService = this.injector.get(TransactionsFacadeService);
    const accountsService = this.injector.get(AccountsFacadeService);
    const categoryService = this.injector.get(CategoryFacadeService);
    const budgetsService = this.injector.get(BudgetsService);
    const goalsService = this.injector.get(GoalsService);
    //const subscriptionService = this.injector.get(SubscriptionService);
    const feedbackService = this.injector.get(FeedbackService);
    const contactService = this.injector.get(ContactService);

    const abort$ = this.isOnline$.pipe(filter(online => !online));

    // 1. Push pending changes first
    return from(this.manualSync()).pipe(
      timeout(10000), // Reduced timeout
      switchMap(() => from(new Promise<void>(resolve => setTimeout(resolve, 1000)))),
      // 2. Pull changes from all collections
      switchMap(() => {
        return forkJoin([
          budgetsService.pullFromFirestore(userId),
          goalsService.pullFromFirestore(userId),
          //subscriptionService.pullFromFirestore(userId),
          this.userService.pullFromFirestore(userId),
          this.familyService.pullFromFirestore(userId),
          feedbackService.pullFromFirestore(),
          contactService.pullFromFirestore()
        ]).pipe(
          timeout(20000) // Reduced timeout
        );
      }),
      takeUntil(abort$), // Abort immediately if network drops
      tap(() => {
        this.log('syncAll: Pull complete for all services');
        this.log('✅ Sync completed successfully');
      }),
      catchError(error => {
        if (error?.name === 'TimeoutError') {
          this.warn('⚠️ Sync timed out: Continuing in offline mode');
        } else if (error?.code === 'unavailable' || error?.message?.includes('network')) {
          this.warn('⚠️ Firestore unavailable: Continuing in offline mode');
        } else {
          this.error('❌ Sync failed:', error);
        }
        return of(null);
      }),
      finalize(() => {
        this.updateSyncStatus({ isFullSyncing: false });
      })
    );
  }

  /**
   * Manual sync trigger
   */
  async manualSync(): Promise<void> {
    this.log('Manual sync triggered');
    await this.processSyncQueue();
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
      debounceTime<[any, string | null]>(500),
      distinctUntilChanged<[any, string | null]>((prev, curr) => 
        prev[0]?.uid === curr[0]?.uid && 
        prev[0]?.preferences?.isFamilyMode === curr[0]?.preferences?.isFamilyMode &&
        prev[1] === curr[1]
      ),
      tap(([user, familyId]) => this.log(`🔄 Sync context changed for user: ${user.uid}, Mode: ${user.preferences?.isFamilyMode ? 'Family' : 'Personal'}, FamilyId: ${familyId}`)),
      switchMap(([user, familyId]) => {
        // Wait for network status to be confirmed before attempting the initial sync.
        // This prevents the "Refreshing..." spinner from showing at startup when
        // the device is offline (navigator.onLine can be true even without real internet,
        // and the async Firebase check takes up to ~5s to resolve).
        const initialSync$ = this.isOnline$.pipe(
          first(),
          switchMap(isOnline => isOnline ? this.syncAll() : of(null))
        );
        
        const transactionsService = this.injector.get(TransactionsFacadeService);
        const accountsService = this.injector.get(AccountsFacadeService);
        const categoryService = this.injector.get(CategoryFacadeService);
        const budgetsService = this.injector.get<BudgetsService>(BudgetsService);
        const goalsService = this.injector.get<GoalsService>(GoalsService);

        // ALWAYS enable listeners, even when offline.
        // They provide immediate cache emission and resume when online.
        this.log(`🔌 Activating listeners for ${user.uid} (${familyId ? 'Family' : 'Personal'})`);
        const listeners$ = merge(
            transactionsService.listenToTransactions(user.uid).pipe(catchError(() => of(null))),
            accountsService.listenToAccounts(user.uid).pipe(catchError(() => of(null))),
            categoryService.listenToCategories(user.uid).pipe(catchError(() => of(null))),
            // budgetsService.listenToBudgets(user.uid).pipe(catchError(() => of(null))),
            // goalsService.listenToGoals(user.uid).pipe(catchError(() => of(null)))
        );

        return merge(initialSync$, listeners$);
      })
    ).subscribe();

    // Listen for Background Sync API trigger
    this.pwaSwService.backgroundSync$.pipe(
      takeUntil(this.destroy$),
      filter(triggered => triggered),
      switchMap(() => {
        this.log('🔄 Triggering sync due to Background Sync SW Event');
        return this.syncAll();
      })
    ).subscribe();

    // Passive State Handling
    fromEvent(document, 'visibilitychange').pipe(
      takeUntil(this.destroy$),
      map(() => document.visibilityState),
      distinctUntilChanged(),
      tap(state => {
        if (state === 'hidden') {
          this.log('💤 App went to passive state: Pausing Sync');
          this.stopSync();
        } else {
          this.log('✨ App resumed: Restarting Sync');
          this.startSync();
        }
      })
    ).subscribe();

    // Listen for manual triggers for full sync (e.g., after item registered)
    this.triggerFullSync$.pipe(
      takeUntil(this.destroy$),
      debounceTime(100), // Minimal debounce for instant feedback
      switchMap(() => {
        this.log('🔄 Triggering full sync due to manual trigger (e.g., after creation)');
        const userId = this.userService.getCurrentUserId();
        const profile = this.store.selectSignal(ProfileSelectors.selectProfile)();
        const effectiveFamilyId = profile?.preferences?.activeFamilyId || undefined;
        return this.syncAll(effectiveFamilyId);
      })
    ).subscribe();
  }
  // #endregion

  // #region Sync Queue Management
  /**
   * Register a sync item for processing
   */
  async registerSyncItem(item: Omit<SyncItem, 'timestamp' | 'retryCount'>): Promise<{ success: boolean; errors?: string[] }> {
    try {
      let validationResult = this.validateSyncItem(item);

      // If transaction is going for deletion or being marked as deleted, and data is invalid, allow it to proceed.
      // We check for operation 'delete' or operation 'update' with status 'deleted' (soft delete).
      if (!validationResult.isValid && item.type === 'transaction' && 
          (item.operation === 'delete' || (item.operation === 'update' && item.data?.status === 'deleted'))) {
        this.warn('Transaction delete/soft-delete item is invalid, allowing it to proceed anyway', item.id, validationResult.errors);
        validationResult = { isValid: true, errors: [] };
      }

      if (!validationResult.isValid) {
        this.error('Invalid sync item data:', item.id, validationResult.errors);
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

      const syncItemRecordId = this.getRecordId(syncItem);
      const existingIndex = this.syncQueue.findIndex(qItem => 
        qItem.type === syncItem.type && 
        this.getRecordId(qItem) === syncItemRecordId &&
        syncItemRecordId !== undefined
      );

      if (existingIndex > -1) {
        const existingItem = this.syncQueue[existingIndex];
        
        if (syncItem.operation === 'delete') {
          if (existingItem.operation === 'create') {
            this.syncQueue.splice(existingIndex, 1);
            await this.saveSyncQueue();
            this.updateSyncStatus({ pendingItems: this.syncQueue.length });
            this.log('Sync item optimized: create + delete removed from queue');
            return { success: true };
          } else {
            this.syncQueue[existingIndex] = syncItem;
          }
        } else if (syncItem.operation === 'update' && existingItem.operation === 'create') {
          this.syncQueue[existingIndex] = {
            ...syncItem,
            operation: 'create',
            id: existingItem.id
          };
        } else {
          this.syncQueue[existingIndex] = syncItem;
        }
      } else {
        this.syncQueue.push(syncItem);
      }

      await this.saveSyncQueue();

      this.updateSyncStatus({
        pendingItems: this.syncQueue.length
      });

      if (this.isCurrentlyOnline()) {
        await this.processSyncQueue();
        // Removed triggerFullSync$ to avoid redundant pulls
      } else {
        await this.triggerBackgroundSync('sync-all-data');
      }

      this.log('Sync item registered:', syncItem.id);
      return { success: true };

    } catch (error) {
      this.error('Failed to register sync item:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to register sync item';
      return { success: false, errors: [errorMessage] };
    }
  }

  /**
   * Process the sync queue
   */
  private async processSyncQueue(): Promise<void> {
    if (this.syncQueue.length === 0 || this.syncStatus.isSyncing) return;

    this.updateSyncStatus({ isSyncing: true });

    try {
      while (this.syncQueue.length > 0) {
        const currentBatchItems = this.syncQueue.slice(0, 500); // Firestore max limit
        const itemsToProcess: SyncItem[] = [];
        const processedIds: string[] = [];
        const failedIds: string[] = [];
        
        const batch = writeBatch(this.firestore);
        let batchCount = 0;

        for (const item of currentBatchItems) {
          try {
            const userId = this.getCurrentUserId();
            if (!userId) continue;

            // Stage item for batch write
            switch (item.type) {
              case 'transaction': await this.processTransactionSync(item, userId, batch); break;
              case 'budget': await this.processBudgetSync(item, userId, batch); break;
              case 'account': await this.processAccountSync(item, userId, batch); break;
              case 'goal': await this.processGoalSync(item, userId, batch); break;
              case 'category': await this.processCategorySync(item, userId, batch); break;
              case 'user': await this.processUserSync(item, userId, batch); break;
            }

            itemsToProcess.push(item);
            batchCount++;
          } catch (error) {
            this.error(`Failed to stage sync item ${item.id} for batch:`, error);
            item.retryCount++;
            if (item.retryCount >= (item.maxRetries || 3)) {
              failedIds.push(item.id);
              await this.updateItemSyncStatus(item, 'failed');
            }
          }
        }

        if (batchCount > 0) {
          try {
            await batch.commit();
            this.log(`✅ Batch committed successfully for ${batchCount} items`);
          } catch (batchError: any) {
            this.error('❌ Batch commit failed, falling back to sequential processing:', batchError);
            
            // Fallback: Clear processed list for this run
            itemsToProcess.length = 0; 

            // Process sequentially to isolate errors
            for (const item of currentBatchItems) {
              if (failedIds.includes(item.id)) continue; 
              
              try {
                const userId = this.getCurrentUserId();
                if (!userId) continue;

                switch (item.type) {
                  case 'transaction': await this.processTransactionSync(item, userId); break;
                  case 'budget': await this.processBudgetSync(item, userId); break;
                  case 'account': await this.processAccountSync(item, userId); break;
                  case 'goal': await this.processGoalSync(item, userId); break;
                  case 'category': await this.processCategorySync(item, userId); break;
                  case 'user': await this.processUserSync(item, userId); break;
                }
                itemsToProcess.push(item);
              } catch (itemError) {
                this.error(`Failed to process sync item sequentially ${item.id}:`, itemError);
                item.retryCount++;
                if (item.retryCount >= (item.maxRetries || 3)) {
                  failedIds.push(item.id);
                  await this.updateItemSyncStatus(item, 'failed');
                }
              }
            }
          }
        }

        if (itemsToProcess.length > 0) {
          try {
            for (const item of itemsToProcess) {
              await this.updateItemSyncStatus(item, 'synced');
              processedIds.push(item.id);
            }

            this.log(`✅ Processed ${processedIds.length} sync items`);
          } catch (error) {
            this.error('Failed to update sync items status:', error);
            break; // Break loop to avoid infinite failure loop
          }
        }

        // Remove processed and permanently failed items from the main queue
        this.syncQueue = this.syncQueue.filter(item => 
          !processedIds.includes(item.id) && !failedIds.includes(item.id)
        );
        await this.saveSyncQueue();

        this.updateSyncStatus({
          lastSyncTime: Date.now(),
          pendingItems: this.syncQueue.length,
          failedItems: failedIds.length
        });

        // Safeguard to prevent infinite loops if items are stuck (e.g., missing userId)
        if (itemsToProcess.length === 0 && failedIds.length === 0) {
            this.warn('Sync queue draining stalled, breaking loop');
            break;
        }
      }
    } finally {
      this.updateSyncStatus({ isSyncing: false });
    }
  }

  /**
   * Trigger background sync
   */
  async triggerBackgroundSync(syncType?: string): Promise<void> {
    if (!this.serviceWorkerRegistration) {
      this.warn('Service worker not available for background sync');
      return;
    }

    try {
      this.updateSyncStatus({ isSyncing: true });

      const syncTag = syncType || 'sync-transactions';
      if ('sync' in this.serviceWorkerRegistration) {
        // @ts-ignore
        await (this.serviceWorkerRegistration as any).sync.register(syncTag);
        this.log('Background sync triggered:', syncTag);
      } else {
        this.warn('Background Sync is not supported in this browser.');
      }

      this.updateSyncStatus({
        lastSyncTime: Date.now(),
        isSyncing: false
      });

    } catch (error) {
      this.error('Failed to trigger background sync:', error);
      this.updateSyncStatus({ isSyncing: false });
    }
  }

  /**
   * Request a background sync from the Service Worker
   */
  requestBackgroundSync(): void {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready.then((swRegistration: any) => {
        return swRegistration.sync.register('sync-all-data');
      }).then(() => {
        this.log('✅ Background sync "sync-all-data" registered');
      }).catch((err) => {
        this.warn('⚠️ Background sync registration failed:', err);
      });
    }
  }

  private async loadSyncQueue(): Promise<void> {
    try {
      const queue = await this.getCachedData<SyncItem[]>(LocalStorageKey.SYNC_QUEUE);
      if (queue && Array.isArray(queue)) {
        this.syncQueue = queue;
        this.updateSyncStatus({ pendingItems: this.syncQueue.length });
      } else {
        this.syncQueue = [];
        this.updateSyncStatus({ pendingItems: 0 });
      }
    } catch (error) {
      this.error('Failed to load sync queue:', error);
      this.syncQueue = [];
      this.updateSyncStatus({ pendingItems: 0 });
    }
  }

  private async saveSyncQueue(): Promise<void> {
    try {
      await this.cacheData(LocalStorageKey.SYNC_QUEUE, this.syncQueue);
    } catch (error) {
      this.error('Failed to save sync queue:', error);
    }
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
      this.error('Failed to clear completed items:', error);
    }
  }
  // #endregion

  // #region Entity Sync Processors
  /**
   * Process transaction sync operations
   */
  private async processTransactionSync(item: SyncItem, userId: string, batch?: WriteBatch): Promise<void> {
    const basePath = item.collectionPath || `users/${userId}/transactions`;
    const recordId = this.getRecordId(item);

    if (!recordId) {
      this.error('Cannot process transaction sync: missing ID', item);
      throw new Error('Missing transaction ID');
    }

    const dataToWrite = this.restoreTimestamps(this.scrubUndefined({ ...item.data }));
    if ('syncStatus' in dataToWrite && item.operation !== 'delete') {
      dataToWrite.syncStatus = 'synced';
      dataToWrite.lastSyncedAt = Timestamp.now();
    }

    const transactionRef = doc(this.firestore, `${basePath}/${recordId}`);

    switch (item.operation) {
      case 'create':
      case 'update':
        if (batch) batch.set(transactionRef, dataToWrite, { merge: true });
        else await setDoc(transactionRef, dataToWrite, { merge: true });
        break;
      case 'delete':
        if (batch) batch.delete(transactionRef);
        else await deleteDoc(transactionRef);
        break;
    }
  }

  private async processBudgetSync(item: SyncItem, userId: string, batch?: WriteBatch): Promise<void> {
    const basePath = item.collectionPath || `users/${userId}/budgets`;
    const recordId = this.getRecordId(item);
    if (!recordId) return;
    
    const budgetRef = doc(this.firestore, `${basePath}/${recordId}`);
    const dataToWrite = this.restoreTimestamps(this.scrubUndefined({ ...item.data }));
    if ('syncStatus' in dataToWrite && item.operation !== 'delete') {
      dataToWrite.syncStatus = 'synced';
      dataToWrite.lastSyncedAt = Timestamp.now();
    }
    
    switch (item.operation) {
      case 'create':
      case 'update':
        if (batch) batch.set(budgetRef, dataToWrite, { merge: true });
        else await setDoc(budgetRef, dataToWrite, { merge: true });
        break;
      case 'delete':
        if (batch) batch.delete(budgetRef);
        else await deleteDoc(budgetRef);
        break;
    }
  }

  private async processAccountSync(item: SyncItem, userId: string, batch?: WriteBatch): Promise<void> {
    const basePath = item.collectionPath || `users/${userId}/accounts`;
    const recordId = this.getRecordId(item);
    if (!recordId) return;
    
    const accountRef = doc(this.firestore, `${basePath}/${recordId}`);
    const dataToWrite = this.restoreTimestamps(this.scrubUndefined({ ...item.data }));
    if ('syncStatus' in dataToWrite && item.operation !== 'delete') {
      dataToWrite.syncStatus = 'synced';
      dataToWrite.lastSyncAt = Timestamp.now();
    }

    switch (item.operation) {
      case 'create':
      case 'update':
        if (batch) batch.set(accountRef, dataToWrite, { merge: true });
        else await setDoc(accountRef, dataToWrite, { merge: true });
        break;
      case 'delete':
        if (batch) batch.delete(accountRef);
        else await deleteDoc(accountRef);
        break;
    }
  }

  private async processCategorySync(item: SyncItem, userId: string, batch?: WriteBatch): Promise<void> {
    const basePath = item.collectionPath || `users/${userId}/categories`;
    const dataToWrite = this.restoreTimestamps(this.scrubUndefined({ ...item.data }));
    if ('syncStatus' in dataToWrite && item.operation !== 'delete') {
      dataToWrite.syncStatus = 'synced';
      dataToWrite.lastSyncedAt = Timestamp.now();
    }

    switch (item.operation) {
      case 'create':
        const categoryRef = doc(this.firestore, `${basePath}/${item.data.id}`);
        if (batch) batch.set(categoryRef, dataToWrite);
        else await setDoc(categoryRef, dataToWrite);
        break;
      case 'update':
        const updateRef = doc(this.firestore, `${basePath}/${item.data.id}`);
        if (batch) batch.set(updateRef, dataToWrite, { merge: true });
        else await setDoc(updateRef, dataToWrite, { merge: true });
        break;
      case 'delete':
        const deleteRef = doc(this.firestore, `${basePath}/${item.data.id}`);
        if (batch) batch.delete(deleteRef);
        else await deleteDoc(deleteRef);
        break;
    }
  }

  private async processGoalSync(item: SyncItem, userId: string, batch?: WriteBatch): Promise<void> {
    const basePath = item.collectionPath || `users/${userId}/goals`;
    const recordId = this.getRecordId(item);
    if (!recordId) return;
    
    const goalRef = doc(this.firestore, `${basePath}/${recordId}`);
    const dataToWrite = this.restoreTimestamps(this.scrubUndefined({ ...item.data }));
    if ('syncStatus' in dataToWrite && item.operation !== 'delete') {
      dataToWrite.syncStatus = 'synced';
      dataToWrite.lastSyncedAt = Timestamp.now();
    }

    switch (item.operation) {
      case 'create':
      case 'update':
        if (batch) batch.set(goalRef, dataToWrite, { merge: true });
        else await setDoc(goalRef, dataToWrite, { merge: true });
        break;
      case 'delete':
        if (batch) batch.delete(goalRef);
        else await deleteDoc(goalRef);
        break;
    }
  }

  private async processUserSync(item: SyncItem, userId: string, batch?: WriteBatch): Promise<void> {
    const userRef = doc(this.firestore, `users/${userId}`);
    const data = { ...item.data };
    delete data.uid;

    if (item.operation === 'update' || item.operation === 'create') {
      const dataToWrite = {
        ...data,
        updatedAt: serverTimestamp()
      };
      if (batch) batch.set(userRef, dataToWrite, { merge: true });
      else await setDoc(userRef, dataToWrite, { merge: true });
    } else if (item.operation === 'delete') {
      if (batch) batch.delete(userRef);
      else await deleteDoc(userRef);
    }
  }
  // #endregion

  // #region Status & Statistics
  /**
   * Get sync status observable
   */
  get syncStatus$(): Observable<SyncStatus> {
    return toObservable(this.syncStatusSignal);
  }

  /**
   * Get current sync status
   */
  get syncStatus(): SyncStatus {
    return this.syncStatusSignal();
  }

  /**
   * Universal helper to update sync status for any item in store and cache
   */
  private async updateItemSyncStatus(item: SyncItem, status: 'synced' | 'failed'): Promise<void> {
    if (item.operation === 'delete') return;
    
    const recordId = this.getRecordId(item);
    if (!recordId) return;

    try {
      const isFamily = item.collectionPath ? item.collectionPath.includes('family-groups') : !!item.data.familyId;
      const familyId = isFamily ? (item.data.familyId || (item.collectionPath?.split('/')[1])) : undefined;
      const userId = this.getCurrentUserId() || '';

      if (item.type === 'transaction') {
        this.store.dispatch(TransactionsActions.updateTransactionSuccess({
          transaction: { ...item.data, syncStatus: status, lastSyncedAt: Timestamp.now() } as Transaction
        }));

        const itemKey = LocalStorageKeyHelper.getTransactionItemKey(recordId, familyId);
        const existing = this.storageService.getItem<Transaction>(itemKey, 'transactions');
        this.storageService.setItem(itemKey, {
          ...(existing || item.data),
          syncStatus: status as any,
          lastSyncedAt: Timestamp.now()
        }, 'transactions');
      } 
      else if (item.type === 'budget') {
        const budget = { ...item.data, syncStatus: status, lastSyncedAt: Timestamp.now() };
        this.store.dispatch(BudgetsActions.updateBudgetSuccess({ budget }));
        
        const cacheKey = LocalStorageKeyHelper.getBudgetsCacheKey(userId, familyId);
        const budgets = this.storageService.getItem<any[]>(cacheKey) || [];
        const index = budgets.findIndex(b => b.budgetId === recordId || b.id === recordId);
        if (index !== -1) {
          budgets[index] = { ...budgets[index], ...budget };
          this.storageService.setItem(cacheKey, budgets);
        }
      }
      else if (item.type === 'account') {
        const account = { ...item.data, syncStatus: status, lastSyncAt: Timestamp.now() };
        this.store.dispatch(AccountsActions.updateAccountSuccess({ account }));
        
        const cacheKey = LocalStorageKeyHelper.getAccountsCacheKey(userId, familyId);
        const accounts = this.storageService.getItem<any[]>(cacheKey) || [];
        const index = accounts.findIndex(a => a.accountId === recordId);
        if (index !== -1) {
          accounts[index] = { ...accounts[index], ...account };
          this.storageService.setItem(cacheKey, accounts);
        }
      }
      else if (item.type === 'goal') {
        const goal = { ...item.data, syncStatus: status, lastSyncedAt: Timestamp.now() };
        this.store.dispatch(GoalsActions.updateGoalSuccess({ goal }));
        
        const cacheKey = LocalStorageKeyHelper.getGoalsCacheKey(userId);
        const goals = this.storageService.getItem<any[]>(cacheKey) || [];
        const index = goals.findIndex(g => g.goalId === recordId);
        if (index !== -1) {
          goals[index] = { ...goals[index], ...goal };
          this.storageService.setItem(cacheKey, goals);
        }
      }
      else if (item.type === 'category') {
        const category = { ...item.data, syncStatus: status, lastSyncAt: Timestamp.now() };
        this.store.dispatch(CategoriesActions.updateCategorySuccess({ category }));
        
        const cacheKey = LocalStorageKeyHelper.getCategoriesCacheKey(userId, familyId);
        const categories = this.storageService.getItem<any[]>(cacheKey) || [];
        const index = categories.findIndex(c => c.id === recordId);
        if (index !== -1) {
          categories[index] = { ...categories[index], ...category };
          this.storageService.setItem(cacheKey, categories);
        }
      }
      
      this.log(`${item.type} ${recordId} sync status updated to: ${status}`);
    } catch (error) {
      this.error(`Failed to update ${item.type} sync status:`, error);
    }
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

  private updateSyncStatus(updates: Partial<SyncStatus>): void {
    const currentStatus = this.syncStatusSignal();
    const newStatus = { ...currentStatus, ...updates, isOnline: this.isCurrentlyOnline() };
    this.syncStatusSignal.set(newStatus);
  }
  // #endregion

  // #region Cache Operations (Public)
  /**
   * Cache data with options
   */
  async cacheData<T>(key: string, data: T, options: CacheOptions = {}): Promise<void> {
    if (isPlatformServer(this.platformId)) return;

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
      this.error('Failed to cache data:', error);
    }
  }

  /**
   * Get cached data
   */
  async getCachedData<T>(key: string): Promise<T | null> {
    if (isPlatformServer(this.platformId)) return null;

    try {
      let cacheItem = await this.getFromCacheStorage<T>(key);
      if (!cacheItem) {
        cacheItem = await this.getFromIndexedDB<T>(key);
      }

      if (!cacheItem) return null;

      if (this.isExpired(cacheItem)) {
        await this.removeCachedData(key);
        return null;
      }

      return cacheItem.data;
    } catch (error) {
      this.error('Failed to get cached data:', error);
      return null;
    }
  }

  /**
   * Remove cached data
   */
  async removeCachedData(key: string): Promise<void> {
    if (isPlatformServer(this.platformId)) return;

    try {
      await Promise.all([
        this.removeFromCacheStorage(key),
        this.removeFromIndexedDB(key)
      ]);
    } catch (error) {
      this.error('Failed to remove cached data:', error);
    }
  }

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<void> {
    if (isPlatformServer(this.platformId)) return;

    try {
      await Promise.all([
        this.clearCacheStorage(),
        this.clearIndexedDB()
      ]);
    } catch (error) {
      this.error('Failed to clear cache:', error);
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
      return { totalItems: 0, totalSize: 0, expiredItems: 0, cacheStorageSize: 0, indexedDBSize: 0 };
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
      this.error('Failed to get cache stats:', error);
      return { totalItems: 0, totalSize: 0, expiredItems: 0, cacheStorageSize: 0, indexedDBSize: 0 };
    }
  }
  // #endregion

  // #region Storage Implementation (Private)
  private async storeInCacheStorage(key: string, cacheItem: CacheItem): Promise<void> {
    if ('caches' in window) {
      try {
        const cache = await caches.open('money-manager-data');
        const response = new Response(JSON.stringify(cacheItem));
        await cache.put(key, response);
      } catch (error) {
        this.warn('Failed to store in Cache Storage:', error);
      }
    }
  }

  private async storeInIndexedDB(key: string, cacheItem: CacheItem): Promise<void> {
    try {
      this.storageService.setItem(key, cacheItem);
    } catch (error) {
      this.warn('Failed to store in IndexedDB:', error);
    }
  }

  private async getFromCacheStorage<T>(key: string): Promise<CacheItem<T> | null> {
    if ('caches' in window) {
      try {
        const cache = await caches.open('money-manager-data');
        const response = await cache.match(key);
        if (response) return await response.json();
      } catch (error) {
        this.warn('Failed to get from Cache Storage:', error);
      }
    }
    return null;
  }

  private async getFromIndexedDB<T>(key: string): Promise<CacheItem<T> | null> {
    try {
      return this.storageService.getItem<CacheItem<T>>(key);
    } catch (error) {
      this.warn('Failed to get from IndexedDB:', error);
    }
    return null;
  }

  private async removeFromCacheStorage(key: string): Promise<void> {
    if ('caches' in window) {
      try {
        const cache = await caches.open('money-manager-data');
        await cache.delete(key);
      } catch (error) {
        this.warn('Failed to remove from Cache Storage:', error);
      }
    }
  }

  private async removeFromIndexedDB(key: string): Promise<void> {
    try {
      this.storageService.removeItem(key);
    } catch (error) {
      this.warn('Failed to remove from IndexedDB:', error);
    }
  }

  private async clearCacheStorage(): Promise<void> {
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
      } catch (error) {
        this.warn('Failed to clear Cache Storage:', error);
      }
    }
  }

  private async clearIndexedDB(): Promise<void> {
    try {
      this.storageService.clear();
    } catch (error) {
      this.warn('Failed to clear IndexedDB:', error);
    }
  }

  private async getAllFromCacheStorage(): Promise<CacheItem[]> {
    if ('caches' in window) {
      try {
        const cache = await caches.open('money-manager-data');
        const keys = await cache.keys();
        const items: CacheItem[] = [];
        for (const request of keys) {
          const response = await cache.match(request);
          if (response) items.push(await response.json());
        }
        return items;
      } catch (error) {
        this.warn('Failed to get all from Cache Storage:', error);
      }
    }
    return [];
  }

  private async getAllFromIndexedDB(): Promise<CacheItem[]> {
    try {
      const keys = this.storageService.getAllKeys();
      const items: CacheItem[] = [];
      for (const key of keys) {
        const item = this.storageService.getItem<CacheItem>(key);
        if (item) items.push(item);
      }
      return items;
    } catch (error) {
      this.warn('Failed to get all from Local Storage:', error);
      return [];
    }
  }

  private async getCacheStorageKeys(): Promise<string[]> {
    if ('caches' in window) {
      try {
        const cache = await caches.open('money-manager-data');
        const keys = await cache.keys();
        return keys.map(request => request.url);
      } catch (error) {
        this.warn('Failed to get Cache Storage keys:', error);
      }
    }
    return [];
  }

  private async getIndexedDBKeys(): Promise<string[]> {
    try {
      return this.storageService.getAllKeys();
    } catch (error) {
      this.warn('Failed to get Local Storage keys:', error);
      return [];
    }
  }
  // #endregion

  // #region Private Helpers
  private getCurrentUserId(): string | null {
    return this.userService.getCurrentUserId();
  }

  private getRecordId(item: SyncItem): string | undefined {
    if (!item || !item.data) return undefined;
    switch (item.type) {
      case 'transaction':
      case 'budget':
      case 'category':
        return item.data.id || item.data.budgetId;
      case 'account':
        return item.data.accountId;
      case 'goal':
        return item.data.goalId;
      case 'user':
        return item.data.uid;
      default:
        return item.data.id;
    }
  }

  private validateSyncItem(item: Omit<SyncItem, 'timestamp' | 'retryCount'>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!item.id || !item.type || !item.data) {
      errors.push('Missing required fields: id, type, or data');
      return { isValid: false, errors };
    }

    switch (item.type) {
      case 'transaction':
        const txVal = this.validationService.validateTransactionData(item.data, item.operation);
        if (!txVal.isValid) errors.push(...txVal.errors);
        break;
      case 'budget':
      case 'account':
      case 'goal':
        const val = this.validationService.validateCommonData(item.data);
        if (!val.isValid) errors.push(...val.errors);
        break;
    }
    return { isValid: errors.length === 0, errors };
  }

  private scrubUndefined(obj: any): any {
    if (obj === null || typeof obj !== 'object' || obj instanceof Date || obj instanceof Timestamp) return obj;
    if (Array.isArray(obj)) return obj.map(item => this.scrubUndefined(item));

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
      this.log(`Scrubbed ${scrubbedCount} undefined properties from object`, obj.id || '');
    }
    return result;
  }

  /**
   * Restore plain {seconds, nanoseconds} objects into valid Firestore Timestamps
   */
  private restoreTimestamps(obj: any): any {
    if (obj === null || typeof obj !== 'object' || obj instanceof Date || obj instanceof Timestamp) return obj;

    if ('seconds' in obj && 'nanoseconds' in obj && Object.keys(obj).length === 2) {
      return new Timestamp(obj.seconds, obj.nanoseconds);
    }

    if (Array.isArray(obj)) return obj.map(item => this.restoreTimestamps(item));

    const result: any = {};
    Object.keys(obj).forEach(key => {
      result[key] = this.restoreTimestamps(obj[key]);
    });
    return result;
  }

  /**
   * Recursively convert undefined values to empty strings
   */
  private convertUndefinedToEmpty(obj: any): any {
    if (obj === null || typeof obj !== 'object' || obj instanceof Date || obj instanceof Timestamp) return obj;
    if (Array.isArray(obj)) return obj.map(item => this.convertUndefinedToEmpty(item));

    const result: any = {};
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      if (value !== undefined) {
        result[key] = this.convertUndefinedToEmpty(value);
      } else {
        result[key] = '';
      }
    });
    return result;
  }

  private getDefaultExpiry(priority?: 'high' | 'normal' | 'low'): number {
    switch (priority) {
      case 'high': return this.HIGH_PRIORITY_EXPIRY;
      case 'low': return this.LOW_PRIORITY_EXPIRY;
      default: return this.DEFAULT_EXPIRY;
    }
  }

  private calculateSize(data: any): number {
    try {
      const jsonString = JSON.stringify(data);
      return new Blob([jsonString]).size;
    } catch (error) {
      return 0;
    }
  }

  private isExpired(cacheItem: CacheItem): boolean {
    if (!cacheItem.expiry) return false;
    return Date.now() > cacheItem.timestamp + cacheItem.expiry;
  }

  private async cleanupCache(): Promise<void> {
    try {
      const stats = await this.getCacheStats();
      const keys = await this.getCacheKeys();
      for (const key of keys) {
        const data = await this.getCachedData(key);
        if (data === null) await this.removeCachedData(key);
      }

      if (stats.totalSize > this.DEFAULT_MAX_SIZE) {
        const allItems = await this.getAllFromCacheStorage();
        const sortedItems = allItems
          .filter(item => !this.isExpired(item))
          .sort((a, b) => {
            const priorityOrder = { high: 3, normal: 2, low: 1 };
            const aP = priorityOrder[a.priority];
            const bP = priorityOrder[b.priority];
            return aP !== bP ? bP - aP : a.timestamp - b.timestamp;
          });

        for (const item of sortedItems) {
          if (item.priority === 'low') {
            await this.removeCachedData(item.key);
            const newStats = await this.getCacheStats();
            if (newStats.totalSize <= this.DEFAULT_MAX_SIZE * 0.8) break;
          }
        }
      }
    } catch (error) {
      this.error('Failed to cleanup cache:', error);
    }
  }

  private async getCacheKeys(): Promise<string[]> {
    if (isPlatformServer(this.platformId)) return [];
    try {
      const [cacheStorageKeys, indexedDBKeys] = await Promise.all([
        this.getCacheStorageKeys(),
        this.getIndexedDBKeys()
      ]);
      return [...new Set([...cacheStorageKeys, ...indexedDBKeys])];
    } catch (error) {
      this.error('Failed to get cache keys:', error);
      return [];
    }
  }

  private deduplicateItems(items: CacheItem[]): CacheItem[] {
    const uniqueItems = new Map<string, CacheItem>();
    for (const item of items) {
      const existing = uniqueItems.get(item.key);
      if (!existing || item.timestamp > existing.timestamp) uniqueItems.set(item.key, item);
    }
    return Array.from(uniqueItems.values());
  }

  public requestNotificationPermission(): Promise<NotificationPermission> {
    if ('Notification' in window) return Notification.requestPermission();
    return Promise.resolve('denied' as NotificationPermission);
  }

  isSupported(): boolean {
    return 'serviceWorker' in navigator && 'sync' in window;
  }
  // #endregion
}