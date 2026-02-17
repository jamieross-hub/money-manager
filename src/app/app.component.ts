import { Component, OnInit, OnDestroy , ChangeDetectionStrategy} from '@angular/core';
import { ThemeSwitchingService } from './util/service/theme-switching.service';
import { Location } from '@angular/common';
import { LoaderService } from './util/service/loader.service';
import { PwaNavigationService, NavigationState } from './util/service/pwa-navigation.service';
import { CommonSyncService } from './util/service/common-sync.service';
import { Subject, takeUntil } from 'rxjs';
import { APP_CONFIG } from './util/config/config';
import { SsrService } from './util/service/ssr.service';
import { FirebaseMessagingService } from './util/service/firebase-messaging.service';
import { LanguageService } from './util/service/language.service';
import { LocalIndexDBStorageService } from './util/service/indexdb-storage.service';
import { LocalStorageKey } from './util/models/local-storage.model';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit, OnDestroy {
  public title = APP_CONFIG.APP_NAME;
  isOnline = false; // Will be set properly in ngOnInit
  navigationState: NavigationState;
  private destroy$ = new Subject<void>();

  constructor(
    private location: Location,
    private loaderService: LoaderService,
    private pwaNavigationService: PwaNavigationService,
    private commonSyncService: CommonSyncService,
    private ssrService: SsrService,
    private firebaseMessagingService: FirebaseMessagingService,
    public themeSwitchingService: ThemeSwitchingService,
    private languageService: LanguageService,
    private localStorageService: LocalIndexDBStorageService,
  ) {
    this.navigationState = {
      canGoBack: false,
      currentRoute: '',
      previousRoute: '',
      navigationStack: [],
      isStandalone: false,
      isMobile: false
    };
  }

  ngOnInit() {
    this.themeSwitchingService; // Initialize theme service
    if (this.ssrService.isClientSide()) {
      this.isOnline = navigator.onLine;
    }
    this.initializePwaFeatures();
    this.setupEventListeners();
    this.firebaseMessagingService.listenForMessages();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.pwaNavigationService.destroy();
  }

  private initializePwaFeatures(): void {
    // Subscribe to navigation state changes
    this.pwaNavigationService.navigationState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.navigationState = state;
      });

    // Subscribe to online/offline status
    this.commonSyncService.isOnline$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isOnline => {
        this.isOnline = isOnline;
      });
  }

  private setupEventListeners(): void {
    if (this.ssrService.isClientSide()) {
      // Handle online/offline events
      window.addEventListener('online', () => this.isOnline = true);
      window.addEventListener('offline', () => this.isOnline = false);

      // Handle beforeunload for PWA
      window.addEventListener('beforeunload', (event) => {
        if (this.navigationState.isStandalone) {
          // Save current state before app closes
          this.saveAppState();
        }
      });

      // Handle visibility change for PWA
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.handleAppBackground();
        } else if (document.visibilityState === 'visible') {
          this.handleAppForeground();
        }
      });
    }
  }

  private saveAppState(): void {
    // Save current navigation state and other app data
    const appState = {
      currentRoute: this.navigationState.currentRoute,
      navigationStack: this.navigationState.navigationStack,
      timestamp: Date.now()
    };

    try {
      this.localStorageService.setItem(LocalStorageKey.NAVIGATION_STATE, appState);
    } catch (error) {
      console.warn('Failed to save app state:', error);
    }
  }

  private handleAppBackground(): void {
    // App is going to background
    this.saveAppState();

    // Pause any ongoing operations
    this.loaderService.hide();
  }

  private handleAppForeground(): void {
    // App is coming to foreground
    // Check if we need to refresh data
    if (this.isOnline) {
      // Refresh data if needed
      this.refreshDataIfNeeded();
    }
  }

  private refreshDataIfNeeded(): void {
    const lastRefresh = this.localStorageService.getItem<string>(LocalStorageKey.LAST_DATA_REFRESH);
    const now = Date.now();
    const refreshInterval = APP_CONFIG.OFFLINE.SYNC_INTERVAL; // Use config sync interval

    if (!lastRefresh || (now - parseInt(lastRefresh)) > refreshInterval) {
      // Trigger data refresh
      this.localStorageService.setItem(LocalStorageKey.LAST_DATA_REFRESH, now.toString());
      // You can emit an event here to refresh data in components
    }
  }

  goBack() {
    this.pwaNavigationService.goBack();
  }

  goForward() {
    this.pwaNavigationService.goForward();
  }

  // Method to handle PWA-specific actions
  handlePwaAction(action: string): void {
    if (this.ssrService.isClientSide()) {
      switch (action) {
        case 'back':
          this.goBack();
          break;
        case 'forward':
          this.goForward();
          break;
        case 'home':
          this.pwaNavigationService.navigateTo('/dashboard');
          break;
        case 'refresh':
          window.location.reload();
          break;
        default:
          console.warn('Unknown PWA action:', action);
      }
    }
  }

  // PWA Install Prompt handlers
  onInstallClicked(): void {
    console.log('PWA install clicked');
    // You can add analytics tracking here
  }

  onDismissClicked(): void {
    console.log('PWA install dismissed');
    // You can add analytics tracking here
  }
}
