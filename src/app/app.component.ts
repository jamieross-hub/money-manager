import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, isDevMode } from '@angular/core';
import { ThemeSwitchingService } from './util/service/theme-switching.service';
import { Location, CommonModule } from '@angular/common';
import { LoaderService } from './util/service/loader.service';
import { PwaNavigationService, NavigationState } from './util/service/pwa-navigation.service';
import { BackButtonService } from './util/service/back-button.service';
import { CommonSyncService } from './util/service/common-sync.service';
import { filter, Subject, takeUntil, take } from 'rxjs';
import { APP_CONFIG } from './util/config/config';
import { SsrService } from './util/service/ssr.service';
import { FirebaseMessagingService } from './util/service/firebase-messaging.service';
import { LanguageService } from './util/service/language.service';
import { LocalIndexDBStorageService } from './util/service/indexdb-storage.service';
import { LocalStorageKey } from './util/models/local-storage.model';
import { UserService } from './util/service/db/user.service';
import { SecurityService } from './util/service/security.service';
import { ActivatedRoute, NavigationEnd, NavigationStart, Router, RouterModule } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { MatDialog } from '@angular/material/dialog';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { OverlayContainer } from '@angular/cdk/overlay';

import { FamilyNotificationService } from './modules/family/services/family-notification.service';
import { PwaInstallPromptComponent } from './util/components/pwa-install-prompt/pwa-install-prompt.component';
import { LoaderComponent } from './util/components/loader/loader.component';
import { PinLockComponent } from './util/components/pin-lock/pin-lock.component';
import { TransactionProcessorService } from './util/service/transaction-processor.service';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    PwaInstallPromptComponent,
    LoaderComponent,
    PinLockComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit, OnDestroy {
  public title = APP_CONFIG.APP_NAME;
  public isLocked = this.securityService.isLocked;
  isOnline = false; // Will be set properly in ngOnInit
  navigationState: NavigationState;
  private destroy$ = new Subject<void>();

  constructor(
    private location: Location,
    private loaderService: LoaderService,
    private pwaNavigationService: PwaNavigationService,
    private backButtonService: BackButtonService,
    private commonSyncService: CommonSyncService,
    private ssrService: SsrService,
    private firebaseMessagingService: FirebaseMessagingService,
    public themeSwitchingService: ThemeSwitchingService,
    private languageService: LanguageService,
    private localStorageService: LocalIndexDBStorageService,
    private userService: UserService,
    private securityService: SecurityService,
    private router: Router,
    private route: ActivatedRoute,
    private swUpdate: SwUpdate,
    private dialog: MatDialog,
    private bottomSheet: MatBottomSheet,
    private overlayContainer: OverlayContainer,

    private familyNotificationService: FamilyNotificationService,
    private transactionProcessorService: TransactionProcessorService
  ) {
    this.navigationState = {
      canGoBack: false,
      currentRoute: '',
      previousRoute: '',
      navigationStack: [],
      isStandalone: false,
      isMobile: false
    };

    // Track page views
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        const pageTitle = this.getDeepestTitle(this.route) || document.title || 'Unknown';
      });
  }



 private getDeepestTitle(route: ActivatedRoute): string | null {
    let current = route;
    while (current.firstChild) {
      current = current.firstChild;
    }
    return current.snapshot.data?.['title'] || null;
  }


  ngOnInit() {
    this.themeSwitchingService; // Initialize theme service
    if (this.ssrService.isClientSide()) {
      this.isOnline = navigator.onLine;
    }
    this.initializePwaFeatures();
    this.backButtonService.init();
    this.setupEventListeners();
    this.firebaseMessagingService.listenForMessages();
    this.commonSyncService.startSync();
    this.refreshFcmToken();


  }


  private refreshFcmToken(): void {
    if (this.ssrService.isClientSide() && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        this.userService.userAuth$.pipe(
          filter(user => !!user && user.uid !== 'offline-guest'),
          take(1)
        ).subscribe(async () => {
          try {
            const token = await this.firebaseMessagingService.refreshToken();
            if (token) {
              await this.userService.updateFcmToken(token);
              console.log('FCM token refreshed on app start');
            }
          } catch (error) {
            console.error('Error refreshing FCM token:', error);
          }
        });
      }
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.pwaNavigationService.ngOnDestroy();
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

    // PWA Version Updates
    // if (this.swUpdate.isEnabled) {
    //   this.swUpdate.versionUpdates
    //     .pipe(takeUntil(this.destroy$))
    //     .subscribe(() => {
    //       // Close any open overlays
    //       this.dialog.closeAll();
    //       this.bottomSheet.dismiss();

    //       // Extra safety: clear overlay container
    //       const container = this.overlayContainer.getContainerElement();
    //       container.innerHTML = '';

    //       // Reload app
    //       window.location.reload();
    //     });
    // }
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
      // Refresh data
      this.commonSyncService.syncAll().subscribe();
    }
  }


  async logout(): Promise<void> {
    try {
      await this.userService.signOut();
      this.securityService.setPinVerified(false);
      window.location.reload();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }





  private refreshDataIfNeeded(): void {
    if (this.isOnline) {
      this.commonSyncService.syncAll().subscribe();
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
