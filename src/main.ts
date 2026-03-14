import { LocalIndexDBStorageService } from './app/util/service/indexdb-storage.service';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

// PWA Navigation and Service Worker initialization
function initializePwaFeatures() {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    return; // Skip on server-side
  }

  // Handle PWA installation
  let deferredPrompt: any;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log('PWA install prompt ready');
  });

  // Handle app installed event
  window.addEventListener('appinstalled', () => {
    console.log('PWA installed successfully');
    deferredPrompt = null;
  });

  // Handle navigation events for PWA
  window.addEventListener('popstate', (event) => {
    console.log('Navigation event:', event);
  });

  // Handle visibility change for PWA
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      console.log('App went to background');
    } else {
      console.log('App came to foreground');
    }
  });

  // Handle beforeunload for PWA
  window.addEventListener('beforeunload', (event) => {
    // Save app state before unload
    const appState = {
      timestamp: Date.now(),
      url: window.location.href,
      scrollPosition: window.scrollY
    };

    try {
      LocalIndexDBStorageService.getInstance().setItem('app-state', appState);
    } catch (error) {
      console.warn('Failed to save app state:', error);
    }
  });

  // Handle dynamically loading chunk errors (e.g. after a new deploy)
  window.addEventListener('unhandledrejection', (event: any) => {
    if (
      event?.reason?.message?.includes('ChunkLoadError') ||
      event?.reason?.message?.includes('Loading chunk')
    ) {
      console.warn('Unhandled chunk error detected. Reloading application...');
      window.location.reload();
    }
  });
}

// Intelligent cache management that preserves authentication
function initializeCacheManagement() {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    return; // Skip on server-side
  }

  // Check if this is a mobile device
  const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  if (isMobile) {
    // Use weekly versioning to reduce unnecessary cache clears
    const now = new Date();
    const weekNumber = Math.ceil(now.getDate() / 7);
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const currentVersion = `${year}-${month.toString().padStart(2, '0')}-W${weekNumber}`;

    const storedVersion = LocalIndexDBStorageService.getInstance().getItem<string>('app-version');

    if (storedVersion && storedVersion !== currentVersion) {
      console.log('App version changed on mobile, performing smart cache update');
      performSmartCacheUpdate(storedVersion, currentVersion);
    } else {
      LocalIndexDBStorageService.getInstance().setItem('app-version', currentVersion);
    }
  }
}

async function performSmartCacheUpdate(oldVersion: string, newVersion: string): Promise<void> {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    return; // Skip on server-side
  }

  try {
    console.log(`Performing smart cache update from ${oldVersion} to ${newVersion}`);

    // Preserve authentication state
    const authData = preserveAuthData();

    // Clear only application caches, not authentication data
    await clearApplicationCaches();

    // Restore authentication state
    restoreAuthData(authData);

    // Update version
    LocalIndexDBStorageService.getInstance().setItem('app-version', newVersion);

    console.log('Smart cache update completed successfully');
  } catch (error) {
    console.error('Smart cache update failed:', error);
    // Don't force reload on failure - let the app continue
  }
}

function preserveAuthData(): any {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    return {}; // Return empty object on server-side
  }

  const authData: any = {};
  const storageService = LocalIndexDBStorageService.getInstance();

  // Preserve Firebase Auth state (stored in IndexedDB via storageService)
  const authKeys = storageService.getAllKeys().filter(key =>
    key.startsWith('firebase:authUser:') ||
    key.startsWith('firebase:persistence:')
  );
  authKeys.forEach(key => {
    authData[key] = storageService.getItem(key);
  });

  // Preserve user preferences
  const userPrefs = ['theme', 'language', 'user-settings'];
  userPrefs.forEach(pref => {
    const value = storageService.getItem(pref);
    if (value) authData[pref] = value;
  });

  return authData;
}

function restoreAuthData(authData: any): void {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    return; // Skip on server-side
  }

  // Restore preserved data
  Object.keys(authData).forEach(key => {
    LocalIndexDBStorageService.getInstance().setItem(key, authData[key]);
  });
}

async function clearApplicationCaches(): Promise<void> {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    return; // Skip on server-side
  }

  try {
    // Clear service worker caches (excluding auth-related caches)
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      const appCaches = cacheNames.filter(name =>
        !name.includes('firebase') &&
        !name.includes('auth') &&
        !name.includes('user')
      );

      await Promise.all(
        appCaches.map(cacheName => caches.delete(cacheName))
      );
    }

    // Clear application-specific storage items (via IndexedDB-backed service)
    const storageService = LocalIndexDBStorageService.getInstance();
    const keysToRemove = storageService.getAllKeys().filter(key =>
      !key.startsWith('firebase:') &&
      !key.startsWith('user') &&
      !key.startsWith('theme') &&
      !key.startsWith('language') &&
      key !== 'app-version'
    );

    keysToRemove.forEach(key => storageService.removeItem(key));

    console.log('Application caches cleared successfully');
  } catch (error) {
    console.error('Failed to clear application caches:', error);
    throw error;
  }
}

// Bootstrap app immediately for fastest startup
bootstrapApplication(AppComponent, appConfig)
  .then(() => {
    console.log('✅ App bootstrapped successfully');

    // Defer non-critical PWA features until after initial render
    // setTimeout(() => {
      console.log('⏱️ Initializing deferred features...');
      initializePwaFeatures();
      initializeCacheManagement();
    // }, 1000); // Wait 1s after bootstrap
  })
  .catch(err => console.error(err));
