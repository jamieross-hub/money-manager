import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { LocalIndexDBStorageService } from 'src/app/util/service/indexdb-storage.service';
import { LocalStorageKey, LocalStorageKeyHelper } from 'src/app/util/models/local-storage.model';
import { Subject, takeUntil, Subscription } from 'rxjs';
import { MatSlideToggle, MatSlideToggleModule, MatSlideToggleChange } from '@angular/material/slide-toggle';
import { FirebaseMessagingService, NotificationPayload } from '../../service/firebase-messaging.service';
import { APP_CONFIG } from '../../config/config';
import { NotificationService } from '../../service/notification.service';
import { environment } from '@env/environment';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSliderModule } from '@angular/material/slider';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSortModule } from '@angular/material/sort';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-notification-settings',
  templateUrl: './notification-settings.component.html',
  styleUrls: ['./notification-settings.component.scss'],
  standalone: true,
  imports: [
    CommonModule,

    MatSlideToggle,
    MatCardModule,
    MatListModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSidenavModule,
    MatFormFieldModule,
    MatSelectModule,
    MatMenuModule,
    MatToolbarModule,
    MatButtonToggleModule,
    MatInputModule,
    MatDialogModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatTabsModule,
    MatCheckboxModule,
    MatTooltipModule,
    MatSlideToggleModule,
    MatAutocompleteModule,
    MatExpansionModule,
    MatDividerModule,
    MatChipsModule,
    MatSnackBarModule,
    MatSliderModule,
    MatStepperModule,
    MatBottomSheetModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotificationSettingsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  APP_CONFIG = APP_CONFIG;

  permissionStatus: NotificationPermission = 'default';
  fcmToken: string | null = null;
  isLoading = false;
  notificationsEnabled = true;
  debugInfo: any = {};

  notificationTypes = [
    {
      key: 'transactions',
      title: 'Transaction Alerts',
      description: 'Get notified about new transactions and spending limits',
      icon: '💰',
      enabled: true
    },
    {
      key: 'budgets',
      title: 'Budget Reminders',
      description: 'Receive alerts when approaching budget limits',
      icon: '💳',
      enabled: true
    },
    {
      key: 'goals',
      title: 'Goal Updates',
      description: 'Track progress on your financial goals',
      icon: '🎯',
      enabled: true
    },
    {
      key: 'bills',
      title: 'Bill Reminders',
      description: 'Never miss a bill payment',
      icon: '📅',
      enabled: true
    },
    {
      key: 'security',
      title: 'Security Alerts',
      description: 'Important security notifications',
      icon: '🔒',
      enabled: true
    }
  ];

  advancedSettings = [
    {
      key: 'soundEnabled',
      title: 'Sound',
      description: 'Play sound for notifications',
      icon: '🔊',
      value: true
    },
    {
      key: 'vibrationEnabled',
      title: 'Vibration',
      description: 'Vibrate device for notifications',
      icon: '📳',
      value: true
    },
    {
      key: 'requireInteraction',
      title: 'Require Interaction',
      description: 'Keep notifications until user interacts',
      icon: '👆',
      value: false
    }
  ];

  constructor(
    private router: Router,
    private messagingService: FirebaseMessagingService,
    private notificationService: NotificationService,
    private snackBar: MatSnackBar,
    private storageService: LocalIndexDBStorageService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadSettings();
    this.subscribeToMessagingEvents();
    this.collectDebugInfo();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadSettings(): void {
    // Load notification types settings
    this.notificationTypes.forEach(type => {
      const storageKey = `${LocalStorageKey.NOTIFICATION_PREFIX}${type.key}`;
      const stored = this.storageService.getItem<string>(storageKey);
      type.enabled = stored ? JSON.parse(stored) : true;
    });

    // Load advanced settings
    this.advancedSettings.forEach(setting => {
      const storageKey = `${LocalStorageKey.NOTIFICATION_ADVANCED_PREFIX}${setting.key}`;
      const stored = this.storageService.getItem<string>(storageKey);
      setting.value = stored ? JSON.parse(stored) : setting.value;
    });

    // Load master toggle state
    const masterState = this.storageService.getItem<string>(LocalStorageKey.NOTIFICATIONS_ENABLED);
    this.notificationsEnabled = masterState ? JSON.parse(masterState) : true;
  }

  private saveSettings(): void {
    // Save notification types settings
    this.notificationTypes.forEach(type => {
      const storageKey = `${LocalStorageKey.NOTIFICATION_PREFIX}${type.key}`;
      this.storageService.setItem(storageKey, JSON.stringify(type.enabled));
    });

    // Save advanced settings
    this.advancedSettings.forEach(setting => {
      const storageKey = `${LocalStorageKey.NOTIFICATION_ADVANCED_PREFIX}${setting.key}`;
      this.storageService.setItem(storageKey, JSON.stringify(setting.value));
    });

    // Save master toggle state
    this.storageService.setItem(LocalStorageKey.NOTIFICATIONS_ENABLED, JSON.stringify(this.notificationsEnabled));
  }

  private subscribeToMessagingEvents(): void {
    this.messagingService.permission$
      .pipe(takeUntil(this.destroy$))
      .subscribe(permission => {
        this.permissionStatus = permission;
        // Auto-disable if permission is denied
        if (permission === 'denied') {
          this.notificationsEnabled = false;
          this.saveNotificationsEnabled();
        }
        this.cdr.markForCheck();
      });

    this.messagingService.token$
      .pipe(takeUntil(this.destroy$))
      .subscribe(token => {
        this.fcmToken = token;
        this.fcmToken = token;
        this.collectDebugInfo();
        this.cdr.markForCheck();
      });
  }

  private collectDebugInfo(): void {
    this.debugInfo = {
      browser: navigator.userAgent,
      serviceWorker: 'serviceWorker' in navigator,
      notifications: 'Notification' in window,
      permission: Notification.permission,
      fcmToken: this.fcmToken,
      swRegistration: this.messagingService.getServiceWorkerRegistration(),
      isSupported: this.messagingService.isSupported(),
      storedToken: this.messagingService.getStoredToken(),
      timestamp: new Date().toISOString()
    };
  }

  async requestPermission(): Promise<void> {
    this.isLoading = true;
    try {
      // First initialize messaging with permission request
      await this.messagingService.initializeMessagingWithPermission();

      // Then get the permission status
      const permission = await this.messagingService.requestPermission();
      console.log('Permission result:', permission);

      if (permission === 'granted') {
        this.notificationsEnabled = true;
        this.saveNotificationsEnabled();
        this.notificationService.success('Notifications enabled successfully!');
      } else {
        this.notificationService.error('Notification permission denied');
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
      this.notificationService.error('Failed to request notification permission');
    } finally {
      this.isLoading = false;
    }
  }

  async testNotification(): Promise<void> {
    this.isLoading = true;
    try {
      this.messagingService.sendTestNotification();
      this.notificationService.success('Test notification sent!');
    } catch (error) {
      console.error('Error sending test notification:', error);
      this.notificationService.error('Failed to send test notification');
    } finally {
      this.isLoading = false;
    }
  }

  async refreshToken(): Promise<void> {
    this.isLoading = true;
    try {
      const token = await this.messagingService.refreshToken();
      if (token) {
        this.notificationService.success('Token refreshed successfully!');
      } else {
        this.notificationService.error('Failed to refresh token');
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      this.notificationService.error('Failed to refresh token');
    } finally {
      this.isLoading = false;
    }
  }

  copyToken(): void {
    if (this.fcmToken) {
      navigator.clipboard.writeText(this.fcmToken).then(() => {
        this.notificationService.success('Token copied to clipboard!');
      }).catch(() => {
        this.notificationService.error('Failed to copy token');
      });
    }
  }

  toggleMasterNotifications(event: MatSlideToggleChange): void {
    this.notificationsEnabled = event.checked;
    this.saveNotificationsEnabled();

    if (this.notificationsEnabled && this.permissionStatus === 'default') {
      this.requestPermission();
    }
  }

  toggleNotificationType(typeKey: string, event: MatSlideToggleChange): void {
    const type = this.notificationTypes.find(t => t.key === typeKey);
    if (type) {
      type.enabled = event.checked;
      this.saveSettings();
    }
  }

  updateSetting(settingKey: string, event: MatSlideToggleChange): void {
    const setting = this.advancedSettings.find(s => s.key === settingKey);
    if (setting) {
      setting.value = event.checked;
      this.saveSettings();
    }
  }

  getSettingValue(settingKey: string): boolean {
    const setting = this.advancedSettings.find(s => s.key === settingKey);
    return setting ? setting.value : false;
  }

  private saveNotificationsEnabled(): void {
    this.storageService.setItem(LocalStorageKey.NOTIFICATIONS_ENABLED, JSON.stringify(this.notificationsEnabled));
  }

  getStatusIcon(): string {
    switch (this.permissionStatus) {
      case 'granted': return '✅';
      case 'denied': return '❌';
      default: return '❓';
    }
  }

  getPermissionText(): string {
    switch (this.permissionStatus) {
      case 'granted': return 'Granted';
      case 'denied': return 'Denied';
      default: return 'Not Set';
    }
  }

  openPermissionHelp(): void {
    const helpText = 'To enable notifications:\n1. Click the lock / info icon in your browser\'s address bar\n2. Find "Notifications" in the site settings\n3. Change it from "Block" to "Allow"\n4. Refresh the page';
    alert(helpText);
  }

  // Debug methods
  async debugServiceWorker(): Promise<void> {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      console.log('All service worker registrations:', registrations);

      const firebaseSW = registrations.find(reg =>
        reg.scope.includes(environment.serviceWorkerScope) ||
        reg.active?.scriptURL.includes(environment.serviceWorkerScope + 'firebase-messaging-sw.js')
      );

      if (firebaseSW) {
        console.log('Firebase SW found:', firebaseSW);
        console.log('Firebase SW state:', firebaseSW.active?.state);
        console.log('Firebase SW script URL:', firebaseSW.active?.scriptURL);
      } else {
        console.log('No Firebase service worker found');
      }

      this.collectDebugInfo();
      console.log('Debug info:', this.debugInfo);
    } catch (error) {
      console.error('Debug error:', error);
    }
  }

  async forceServiceWorkerRegistration(): Promise<void> {
    try {
      // Force re-registration of Firebase messaging service worker
      const registrations = await navigator.serviceWorker.getRegistrations();
      const firebaseSW = registrations.find(reg =>
        reg.scope.includes(environment.serviceWorkerScope)
      );

      if (firebaseSW) {
        await firebaseSW.unregister();
        console.log('Unregistered existing Firebase SW');
      }

      // Wait a bit then try to get token again
      setTimeout(async () => {
        await this.messagingService.refreshToken();
        this.collectDebugInfo();
      }, 1000);

    } catch (error) {
      console.error('Force registration error:', error);
    }
  }
}
