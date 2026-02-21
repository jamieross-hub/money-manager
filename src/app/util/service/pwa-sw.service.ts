import { Injectable } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, map } from 'rxjs/operators';
import { BehaviorSubject, Observable } from 'rxjs';
import { APP_CONFIG } from '../config/config';
import { LocalIndexDBStorageService } from 'src/app/util/service/indexdb-storage.service';
import { LocalStorageKey } from 'src/app/util/models/local-storage.model';

export interface PwaUpdateInfo {
  available: boolean;
  currentVersion: string;
  newVersion: string;
  updateReady: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PwaSwService {
  private updateInfoSubject = new BehaviorSubject<PwaUpdateInfo>({
    available: false,
    currentVersion: '',
    newVersion: '',
    updateReady: false
  });

  public updateInfo$: Observable<PwaUpdateInfo> = this.updateInfoSubject.asObservable();

  private backgroundSyncSubject = new BehaviorSubject<boolean>(false);
  public backgroundSync$ = this.backgroundSyncSubject.asObservable();

  constructor(
    private swUpdate: SwUpdate,
    private storageService: LocalIndexDBStorageService
  ) {
    this.initializeServiceWorker();
  }

  private initializeServiceWorker(): void {
    if (this.swUpdate.isEnabled) {
      // Check for updates
      this.checkForUpdates();

      // Listen for version ready events
      this.swUpdate.versionUpdates
        .pipe(
          filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY')
        )
        .subscribe(evt => {
          console.log('New version ready:', evt);
          this.handleVersionReady(evt);
        });

      // Listen for unrecoverable errors
      this.swUpdate.unrecoverable.subscribe(event => {
        console.error('Unrecoverable service worker error:', event);
        this.handleUnrecoverableError(event);
      });

      // Set up periodic update checks based on configuration
      const updateInterval = APP_CONFIG.PWA.UPDATE_CHECK_INTERVAL;
      setInterval(() => {
        this.checkForUpdates();
      }, updateInterval);

      // Check for updates when app becomes visible
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          this.checkForUpdates();
        }
      });
    }
  }

  private checkForUpdates(): void {
    this.swUpdate.checkForUpdate()
      .then(() => {
        console.log('Service worker update check completed');
      })
      .catch(err => {
        console.error('Service worker update check failed:', err);
      });
  }

  private handleVersionReady(event: VersionReadyEvent): void {
    const updateInfo: PwaUpdateInfo = {
      available: true,
      currentVersion: this.getVersionFromAppData(event.currentVersion.appData) || 'unknown',
      newVersion: this.getVersionFromAppData(event.latestVersion.appData) || 'unknown',
      updateReady: true
    };

    this.updateInfoSubject.next(updateInfo);
    // Don't auto-reload — let the UI show an update banner
  }

  private getVersionFromAppData(appData: any): string | undefined {
    if (appData && typeof appData === 'object') {
      return appData['version'] || appData.version;
    }
    return undefined;
  }

  private handleUnrecoverableError(event: any): void {
    // Force reload the page to get a fresh service worker
    window.location.reload();
  }

  /** Called by the UI when the user clicks "Refresh" on the update banner */
  public activateUpdate(): Promise<boolean> {
    return this.swUpdate.activateUpdate()
      .then(() => {
        console.log('Service worker update activated');
        this.updateInfoSubject.next({
          available: false,
          currentVersion: '',
          newVersion: '',
          updateReady: false
        });
        window.location.reload();
        return true;
      })
      .catch(err => {
        console.error('Failed to activate service worker update:', err);
        return false;
      });
  }

  /** Dismiss the update banner without refreshing */
  public dismissUpdate(): void {
    this.updateInfoSubject.next({
      ...this.updateInfoSubject.value,
      available: false
    });
  }

  public checkForUpdate(): Promise<boolean> {
    return this.swUpdate.checkForUpdate()
      .then(updateAvailable => {
        if (updateAvailable) {
          console.log('Update available');
        } else {
          console.log('No update available');
        }
        return updateAvailable;
      })
      .catch(err => {
        console.error('Update check failed:', err);
        return false;
      });
  }

  public getCurrentVersion(): string {
    return this.updateInfoSubject.value.currentVersion;
  }

  public isUpdateAvailable(): boolean {
    return this.updateInfoSubject.value.available;
  }

  public isUpdateReady(): boolean {
    return this.updateInfoSubject.value.updateReady;
  }

  // Method to handle PWA navigation events
  public handleNavigationEvent(event: any): void {
    // Handle navigation events from service worker
    if (event && event.type === 'NAVIGATION') {
      console.log('Navigation event received:', event);
      // You can add custom navigation handling here
    }
  }

  // Method to register custom service worker event handlers
  public registerCustomHandlers(): void {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type) {
          switch (event.data.type) {
            case 'NAVIGATION':
              this.handleNavigationEvent(event.data);
              break;
            case 'CACHE_UPDATED':
              console.log('Cache updated:', event.data);
              break;
            case 'OFFLINE_MODE':
              console.log('Offline mode activated');
              break;
            case 'BACKGROUND_SYNC':
              console.log('Background sync event received from SW:', event.data);
              this.backgroundSyncSubject.next(true);
              break;
            default:
              console.log('Unknown service worker message:', event.data);
          }
        }
      });
    }
  }

  // Method to send messages to service worker
  public sendMessageToSw(message: any): void {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(message);
    }
  }

  // Method to handle app installation
  public handleInstallPrompt(): void {
    // This will be called when the app is ready to be installed
    console.log('App ready for installation');
  }

  // Method to check if app is installed
  public isAppInstalled(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
  }

  // Method to handle app visibility changes
  public handleVisibilityChange(): void {
    if (document.hidden) {
      // App is in background
      console.log('App went to background');
      this.saveAppState();
    } else {
      // App is in foreground
      console.log('App came to foreground');
      this.checkForUpdates();
    }
  }

  private saveAppState(): void {
    // Save current app state before going to background
    const appState = {
      timestamp: Date.now(),
      url: window.location.href,
      scrollPosition: window.scrollY
    };

    try {
      this.storageService.setItem(LocalStorageKey.APP_BACKGROUND_STATE, JSON.stringify(appState));
    } catch (error) {
      console.warn('Failed to save app state:', error);
    }
  }
} 