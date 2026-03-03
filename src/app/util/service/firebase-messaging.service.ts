import { Injectable, NgZone, Inject, PLATFORM_ID } from '@angular/core';
import { getMessaging, getToken, onMessage, Messaging } from '@angular/fire/messaging';
import { BehaviorSubject, Observable, from } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { environment } from '@env/environment';
import { APP_CONFIG } from '../config/config';
import { isPlatformServer } from '@angular/common';
import { LocalIndexDBStorageService } from 'src/app/util/service/indexdb-storage.service';
import { LocalStorageKey } from 'src/app/util/models/local-storage.model';

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  data?: { [key: string]: string };
  actions?: NotificationAction[];
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
  timestamp?: number;
}

export interface NotificationAction {
  action: string;
  title: string;
}

export interface PlatformInfo {
  isAndroid: boolean;
  isIOS: boolean;
  isChrome: boolean;
  isSafari: boolean;
  isFirefox: boolean;
  isEdge: boolean;
  isMobile: boolean;
  isDesktop: boolean;
  isPWA: boolean;
  isStandalone: boolean;
  supportsNotifications: boolean;
  supportsServiceWorker: boolean;
  supportsPushManager: boolean;
}

// Use the built-in NotificationPermission type instead of custom interface

@Injectable({
  providedIn: 'root'
})
export class FirebaseMessagingService {
  private messaging!: Messaging;
  private tokenSubject = new BehaviorSubject<string | null>(null);
  private permissionSubject = new BehaviorSubject<NotificationPermission>('default');
  private notificationSubject = new BehaviorSubject<NotificationPayload | null>(null);
  private swRegistration: ServiceWorkerRegistration | null = null;
  private platformInfo: PlatformInfo;

  public token$: Observable<string | null> = this.tokenSubject.asObservable();
  public permission$: Observable<NotificationPermission> = this.permissionSubject.asObservable();
  public notifications$: Observable<NotificationPayload | null> = this.notificationSubject.asObservable();

  constructor(
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) private platformId: Object,
    private storageService: LocalIndexDBStorageService
  ) {
    this.platformInfo = this.detectPlatform();
    this.initializeMessagingWithoutPermission();
  }

  private detectPlatform(): PlatformInfo {
    if (isPlatformServer(this.platformId)) {
      return {
        isAndroid: false,
        isIOS: false,
        isChrome: false,
        isSafari: false,
        isFirefox: false,
        isEdge: false,
        isMobile: false,
        isDesktop: false,
        isPWA: false,
        isStandalone: false,
        supportsNotifications: false,
        supportsServiceWorker: false,
        supportsPushManager: false
      };
    }

    const userAgent = navigator.userAgent;
    const isAndroid = /Android/i.test(userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isChrome = /Chrome/.test(userAgent) && !/Edge/.test(userAgent);
    const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
    const isFirefox = /Firefox/.test(userAgent);
    const isEdge = /Edge/.test(userAgent);
    const isMobile = isAndroid || isIOS || /webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const isDesktop = !isMobile;
    const isPWA = window.matchMedia('(display-mode: standalone)').matches;
    const isStandalone = isPWA || (window.navigator as any).standalone === true;
    const supportsNotifications = 'Notification' in window;
    const supportsServiceWorker = 'serviceWorker' in navigator;
    const supportsPushManager = 'PushManager' in window;

    return {
      isAndroid,
      isIOS,
      isChrome,
      isSafari,
      isFirefox,
      isEdge,
      isMobile,
      isDesktop,
      isPWA,
      isStandalone,
      supportsNotifications,
      supportsServiceWorker,
      supportsPushManager
    };
  }

  public getPlatformInfo(): PlatformInfo {
    return this.platformInfo;
  }

  private async initializeMessagingWithoutPermission(): Promise<void> {
    try {
      // Skip initialization on server-side
      if (isPlatformServer(this.platformId)) {
        console.log('Skipping Firebase messaging initialization on server-side');
        return;
      }

      // Check platform support
      if (!this.platformInfo.supportsNotifications) {
        console.warn('This browser does not support notifications');
        return;
      }

      if (!this.platformInfo.supportsServiceWorker) {
        console.warn('Service Worker not supported');
        return;
      }

      // Platform-specific initialization
      await this.initializePlatformSpecific();

      // Register Firebase messaging service worker first
      await this.registerFirebaseMessagingSW();

      // Initialize Firebase messaging
      this.messaging = getMessaging();

      // Set up permission observer
      this.permissionSubject.next(Notification.permission);

      // Listen for permission changes
      if ('permissions' in navigator) {
        navigator.permissions.query({ name: 'notifications' as PermissionName }).then(permission => {
          permission.onchange = () => {
            this.ngZone.run(() => {
              this.permissionSubject.next(Notification.permission);
            });
          };
        });
      }

      // Set up foreground message handler
      onMessage(this.messaging, (payload) => {
        this.ngZone.run(async () => {
          console.log('Foreground message received:', payload);
          await this.handleForegroundMessage(payload);
        });
      });

      // Don't automatically request permission - let user do it manually
      console.log('Firebase messaging initialized without automatic permission request');

    } catch (error) {
      console.error('Failed to initialize Firebase messaging:', error);
    }
  }

  private async initializeMessaging(): Promise<void> {
    try {
      // Skip initialization on server-side
      if (isPlatformServer(this.platformId)) {
        console.log('Skipping Firebase messaging initialization on server-side');
        return;
      }

      // Check platform support
      if (!this.platformInfo.supportsNotifications) {
        console.warn('This browser does not support notifications');
        return;
      }

      if (!this.platformInfo.supportsServiceWorker) {
        console.warn('Service Worker not supported');
        return;
      }

      // Platform-specific initialization
      await this.initializePlatformSpecific();

      // Register Firebase messaging service worker first
      await this.registerFirebaseMessagingSW();

      // Initialize Firebase messaging
      this.messaging = getMessaging();

      // Set up permission observer
      this.permissionSubject.next(Notification.permission);

      // Listen for permission changes
      if ('permissions' in navigator) {
        navigator.permissions.query({ name: 'notifications' as PermissionName }).then(permission => {
          permission.onchange = () => {
            this.ngZone.run(() => {
              this.permissionSubject.next(Notification.permission);
            });
          };
        });
      }

      // Set up foreground message handler
      onMessage(this.messaging, (payload) => {
        this.ngZone.run(async () => {
          console.log('Foreground message received:', payload);
          await this.handleForegroundMessage(payload);
        });
      });

      // Request permission and get token
      await this.requestPermission();

    } catch (error) {
      console.error('Failed to initialize Firebase messaging:', error);
    }
  }

  private async initializePlatformSpecific(): Promise<void> {
    console.log('Platform info:', this.platformInfo);

    // iOS-specific handling
    if (this.platformInfo.isIOS) {
      console.log('Initializing for iOS platform');
      await this.initializeIOS();
    }

    // Android-specific handling
    if (this.platformInfo.isAndroid) {
      console.log('Initializing for Android platform');
      await this.initializeAndroid();
    }

    // Chrome desktop-specific handling
    if (this.platformInfo.isChrome && this.platformInfo.isDesktop) {
      console.log('Initializing for Chrome desktop platform');
      await this.initializeChromeDesktop();
    }

    // Safari-specific handling
    if (this.platformInfo.isSafari) {
      console.log('Initializing for Safari platform');
      await this.initializeSafari();
    }
  }

  private async initializeIOS(): Promise<void> {
    // iOS has specific requirements for notifications
    // 1. Must be served over HTTPS (except localhost)
    // 2. Must have proper manifest.json
    // 3. Must be added to home screen for best results

    if (!this.platformInfo.isStandalone) {
      console.warn('iOS notifications work best when app is added to home screen');
    }

    // Check for iOS version compatibility
    const iosVersion = this.getIOSVersion();
    if (iosVersion && iosVersion < 14) {
      console.warn('iOS version may have limited notification support');
    }
  }

  private async initializeAndroid(): Promise<void> {
    // Android Chrome has good support for FCM
    // Check for Chrome version
    const chromeVersion = this.getChromeVersion();
    if (chromeVersion && chromeVersion < 79) {
      console.warn('Chrome version may have limited notification support');
    }

    // Check for Android version
    const androidVersion = this.getAndroidVersion();
    if (androidVersion && androidVersion < 6) {
      console.warn('Android version may have limited notification support');
    }
  }

  private async initializeChromeDesktop(): Promise<void> {
    // Chrome desktop has excellent FCM support
    // Check for Chrome version
    const chromeVersion = this.getChromeVersion();
    if (chromeVersion && chromeVersion < 79) {
      console.warn('Chrome version may have limited notification support');
    }
  }

  private async initializeSafari(): Promise<void> {
    // Safari has limited FCM support
    // Safari 16.4+ has better support for web push notifications
    const safariVersion = this.getSafariVersion();
    if (safariVersion && safariVersion < 16.4) {
      console.warn('Safari version may have limited notification support');
    }
  }

  private getIOSVersion(): number | null {
    const match = navigator.userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/);
    if (match) {
      return parseInt(match[1], 10);
    }
    return null;
  }

  private getAndroidVersion(): number | null {
    const match = navigator.userAgent.match(/Android (\d+)/);
    if (match) {
      return parseInt(match[1], 10);
    }
    return null;
  }

  private getChromeVersion(): number | null {
    const match = navigator.userAgent.match(/Chrome\/(\d+)/);
    if (match) {
      return parseInt(match[1], 10);
    }
    return null;
  }

  private getSafariVersion(): number | null {
    const match = navigator.userAgent.match(/Version\/(\d+)/);
    if (match) {
      return parseInt(match[1], 10);
    }
    return null;
  }

  private async registerFirebaseMessagingSW(): Promise<void> {
    try {
      if (!this.platformInfo.supportsServiceWorker) return;
      
      console.log('Registering Firebase Service Worker manually...');
      const registration = await navigator.serviceWorker.register(
        './firebase-messaging-sw.js'
      );
      this.swRegistration = registration;
      console.log('Firebase messaging service worker is ready:', this.swRegistration);
      
    } catch (error) {
      console.error('Failed to get service worker registration:', error);
      throw error;
    }
  }

  private getServiceWorkerOptions(): any {
    const baseOptions = {
      scope: environment.serviceWorkerScope
    };

    // Platform-specific options
    if (this.platformInfo.isIOS) {
      // iOS may need specific handling
      return baseOptions;
    } else if (this.platformInfo.isAndroid) {
      // Android Chrome has good SW support
      return baseOptions;
    } else if (this.platformInfo.isChrome && this.platformInfo.isDesktop) {
      // Chrome desktop has excellent SW support
      return baseOptions;
    }

    return baseOptions;
  }

  private async handleForegroundMessage(payload: any): Promise<void> {
    const notification: NotificationPayload = {
      title: payload.notification?.title || 'New Notification',
      body: payload.notification?.body || '',
      icon: this.getPlatformSpecificIcon(payload.notification?.icon),
      badge: this.getPlatformSpecificBadge(payload.notification?.badge),
      image: payload.notification?.image,
      data: payload.data || {},
      tag: payload.notification?.tag,
      requireInteraction: payload.notification?.requireInteraction || false,
      silent: payload.notification?.silent || false,
      timestamp: payload.notification?.timestamp || Date.now()
    };

    this.notificationSubject.next(notification);
    await this.showNotification(notification);
  }

  private getPlatformSpecificIcon(defaultIcon?: string): string {
    if (defaultIcon) return defaultIcon;

    // Platform-specific default icons
    if (this.platformInfo.isIOS) {
      return environment.baseUrl + '/assets/icon/app-icon/icon-152x152.png'; // iOS prefers 152x152
    } else if (this.platformInfo.isAndroid) {
      return environment.baseUrl + '/assets/icon/app-icon/icon-192x192.png'; // Android prefers 192x192
    } else {
      return environment.baseUrl + '/assets/icon/app-icon/icon-192x192.png'; // Desktop default
    }
  }

  private getPlatformSpecificBadge(defaultBadge?: string): string {
    if (defaultBadge) return defaultBadge;

    // Platform-specific default badges
    if (this.platformInfo.isIOS) {
      return '/icons/icon-72x72.png'; // iOS badge
    } else if (this.platformInfo.isAndroid) {
      return '/icons/icon-72x72.png'; // Android badge
    } else {
      return '/icons/icon-72x72.png'; // Desktop default
    }
  }

  public async requestPermission(): Promise<NotificationPermission> {
    try {
      if (!this.platformInfo.supportsNotifications) {
        throw new Error('Notifications not supported');
      }

      // Platform-specific permission request
      const permission = await this.requestPlatformSpecificPermission();
      this.permissionSubject.next(permission);

      if (permission === 'granted') {
        await this.getToken();
      }

      return permission;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return 'denied';
    }
  }

  private async requestPlatformSpecificPermission(): Promise<NotificationPermission> {
    // iOS Safari has specific requirements
    if (this.platformInfo.isSafari) {
      console.log('Requesting permission for Safari');
      // Safari may need user interaction
      return Notification.requestPermission();
    }

    // Android Chrome
    if (this.platformInfo.isAndroid) {
      console.log('Requesting permission for Android Chrome');
      return Notification.requestPermission();
    }

    // Chrome desktop
    if (this.platformInfo.isChrome && this.platformInfo.isDesktop) {
      console.log('Requesting permission for Chrome desktop');
      return Notification.requestPermission();
    }

    // Default
    return Notification.requestPermission();
  }

  public async getToken(): Promise<string | null> {
    try {
      if (!this.messaging) {
        console.warn('Messaging not initialized');
        return null;
      }

      let registration = this.swRegistration;

      // Ensure service worker is registered
      if (this.platformInfo.supportsServiceWorker) {
        registration = await navigator.serviceWorker.register(
          './firebase-messaging-sw.js'
        );
        this.swRegistration = registration;
      }

      if (this.swRegistration) {
        await this.swRegistration.update();
      }

      const tokenOptions = this.getPlatformSpecificTokenOptions();

      if (registration) {
        tokenOptions.serviceWorkerRegistration = registration; // 🔥 THIS IS IMPORTANT
      }

      const token = await getToken(this.messaging, tokenOptions);

      if (token) {
        this.tokenSubject.next(token);

        // Store token in localStorage for persistence
        this.storageService.setItem(LocalStorageKey.FCM_TOKEN, token);

        return token;
      } else {
        console.warn('No registration token available');
        return null;
      }
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  }

  private getPlatformSpecificTokenOptions(): any {
    const baseOptions = {
      vapidKey: environment.vapidKey,
      serviceWorkerRegistration: this.swRegistration || undefined
    };

    // Platform-specific token options
    if (this.platformInfo.isIOS) {
      // iOS may need specific options
      return baseOptions;
    } else if (this.platformInfo.isAndroid) {
      // Android Chrome options
      return baseOptions;
    } else if (this.platformInfo.isChrome && this.platformInfo.isDesktop) {
      // Chrome desktop options
      return baseOptions;
    }

    return baseOptions;
  }

  public async refreshToken(): Promise<string | null> {
    try {
      if (!this.messaging) {
        return null;
      }

      let registration = this.swRegistration;

      if (this.platformInfo.supportsServiceWorker) {
        registration = await navigator.serviceWorker.register(
          './firebase-messaging-sw.js'
        );
        this.swRegistration = registration;
      }

      // Force token refresh
      const token = await getToken(this.messaging, {
        vapidKey: environment.vapidKey,
        serviceWorkerRegistration: registration || undefined // 🔥 THIS IS IMPORTANT
      });

      if (token) {
        this.tokenSubject.next(token);
        this.storageService.setItem(LocalStorageKey.FCM_TOKEN, token);
        return token;
      }

      return null;
    } catch (error) {
      console.error('Error refreshing FCM token:', error);
      return null;
    }
  }

  public async showNotification(notification: NotificationPayload): Promise<void> {
    if (Notification.permission !== 'granted') {
      console.warn('Notification permission not granted');
      return;
    }

    // For Android and mobile devices, use Service Worker to show notifications
    if (this.platformInfo.isMobile || this.platformInfo.isAndroid) {
      await this.showNotificationViaServiceWorker(notification);
    } else {
      // For desktop browsers, we can use direct Notification API
      this.showNotificationDirect(notification);
    }
  }

  private async showNotificationViaServiceWorker(notification: NotificationPayload): Promise<void> {
    try {
      if (!this.swRegistration) {
        console.warn('Service Worker not registered, falling back to direct notification');
        this.showNotificationDirect(notification);
        return;
      }

      // Ensure service worker is active
      if (!this.swRegistration.active) {
        console.warn('Service Worker not active, waiting for activation...');
        await this.swRegistration.update();

        if (!this.swRegistration.active) {
          console.warn('Service Worker still not active, falling back to direct notification');
          this.showNotificationDirect(notification);
          return;
        }
      }

      // Send message to service worker to show notification
      const message = {
        type: 'SHOW_NOTIFICATION',
        notification: {
          title: notification.title,
          body: notification.body,
          icon: notification.icon,
          badge: notification.badge,
          image: notification.image,
          data: notification.data,
          tag: notification.tag,
          requireInteraction: notification.requireInteraction,
          silent: notification.silent,
          timestamp: notification.timestamp,
          actions: notification.actions
        }
      };

      // Send message to service worker
      this.swRegistration.active.postMessage(message);

      console.log('Notification request sent to Service Worker');

    } catch (error) {
      console.error('Error showing notification via Service Worker:', error);
      // Fallback to direct notification
      this.showNotificationDirect(notification);
    }
  }

  private showNotificationDirect(notification: NotificationPayload): void {
    try {
      const options: NotificationOptions = {
        body: notification.body,
        icon: notification.icon,
        badge: notification.badge,
        data: notification.data,
        tag: notification.tag,
        requireInteraction: notification.requireInteraction,
        silent: notification.silent
      };

      const nativeNotification = new Notification(notification.title, options);

      // Handle notification click
      nativeNotification.onclick = (event) => {
        event.preventDefault();
        this.handleNotificationClick(notification, event);
        nativeNotification.close();
      };

      // Auto-close notification after 5 seconds (unless requireInteraction is true)
      if (!notification.requireInteraction) {
        setTimeout(() => {
          nativeNotification.close();
        }, 5000);
      }

      console.log('Notification shown directly');

    } catch (error) {
      console.error('Error showing direct notification:', error);
    }
  }

  private handleNotificationClick(notification: NotificationPayload, event: Event): void {
    console.log('Notification clicked:', notification);

    // Focus the window if it's not focused
    if (window.focus) {
      window.focus();
    }

    // Handle custom click logic based on notification data
    if (notification.data?.['url']) {
      window.open(notification.data['url'], '_blank');
    } else if (notification.data?.['route']) {
      // Navigate to specific route in the app
      window.location.href = notification.data['route'];
    }

    // Emit click event for components to handle
    this.notificationSubject.next({
      ...notification,
      data: { ...notification.data, action: 'click' }
    });
  }

  private handleNotificationAction(notification: NotificationPayload, event: any): void {
    console.log('Notification action clicked:', event.action, notification);

    // Handle specific actions
    switch (event.action) {
      case 'view':
        this.handleNotificationClick(notification, event);
        break;
      case 'dismiss':
        // Just close the notification
        break;
      default:
        // Handle custom actions
        if (notification.data?.['actionUrl']) {
          window.open(notification.data['actionUrl'], '_blank');
        }
    }

    // Emit action event for components to handle
    this.notificationSubject.next({
      ...notification,
      data: { ...notification.data, action: event.action }
    });
  }

  public getStoredToken(): string | null {
    return this.storageService.getItem<string>(LocalStorageKey.FCM_TOKEN);
  }

  public clearStoredToken(): void {
    this.storageService.removeItem(LocalStorageKey.FCM_TOKEN);
    this.tokenSubject.next(null);
  }

  public isSupported(): boolean {
    return this.platformInfo.supportsNotifications && this.platformInfo.supportsServiceWorker;
  }

  public isPlatformSupported(): boolean {
    // Check if current platform has good FCM support
    if (this.platformInfo.isAndroid) {
      return true; // Android Chrome has excellent support
    }

    if (this.platformInfo.isChrome && this.platformInfo.isDesktop) {
      return true; // Chrome desktop has excellent support
    }

    if (this.platformInfo.isIOS) {
      // iOS has limited support, but it's improving
      const iosVersion = this.getIOSVersion();
      return iosVersion ? iosVersion >= 14 : false;
    }

    if (this.platformInfo.isSafari) {
      // Safari 16.4+ has better support
      const safariVersion = this.getSafariVersion();
      return safariVersion ? safariVersion >= 16.4 : false;
    }

    return false;
  }

  public getPlatformSupportInfo(): string {
    if (this.platformInfo.isAndroid) {
      return 'Excellent support on Android Chrome';
    }

    if (this.platformInfo.isChrome && this.platformInfo.isDesktop) {
      return 'Excellent support on Chrome desktop';
    }

    if (this.platformInfo.isIOS) {
      const iosVersion = this.getIOSVersion();
      if (iosVersion && iosVersion >= 14) {
        return 'Good support on iOS (requires home screen installation for best results)';
      } else {
        return 'Limited support on iOS (requires iOS 14+ and home screen installation)';
      }
    }

    if (this.platformInfo.isSafari) {
      const safariVersion = this.getSafariVersion();
      if (safariVersion && safariVersion >= 16.4) {
        return 'Good support on Safari 16.4+';
      } else {
        return 'Limited support on Safari (requires Safari 16.4+)';
      }
    }

    return 'Limited or no support on this platform';
  }

  public getServiceWorkerRegistration(): ServiceWorkerRegistration | null {
    return this.swRegistration;
  }

  /**
   * Manually initialize messaging with permission request
   * This method should be called when the user explicitly wants to enable notifications
   */
  public async initializeMessagingWithPermission(): Promise<void> {
    await this.initializeMessaging();
  }

  // Method to send test notification
  public async sendTestNotification(): Promise<void> {
    const testNotification: NotificationPayload = {
      title: 'Test Notification',
      body: 'This is a test notification from Money Manager',
      icon: environment.baseUrl + '/assets/icons/icon-192x192.png',
      badge: environment.baseUrl + '/assets/icons/icon-72x72.png',
      data: {
        type: 'test',
        timestamp: Date.now().toString()
      },
      actions: [
        {
          action: 'view',
          title: 'View'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ]
    };

    await this.showNotification(testNotification);
  }

  listenForMessages() {
    const messaging = getMessaging();

    onMessage(messaging, (payload) => {
      console.log('Message received: ', payload);
      // Show toast or notification manually if needed
      alert('Message received: ' + payload);
    });
  }
} 