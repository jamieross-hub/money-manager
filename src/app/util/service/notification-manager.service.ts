import { Injectable } from '@angular/core';
import { FirebaseMessagingService, NotificationPayload } from './firebase-messaging.service';
import { APP_CONFIG } from '../config/config';
import { environment } from '@env/environment';
import { CurrencyService } from './currency.service';
import { LocalStorageService } from './local-storage.service';

export interface NotificationType {
  key: string;
  title: string;
  body: string;
  icon?: string;
  data?: { [key: string]: string };
  actions?: Array<{ action: string; title: string; icon?: string }>;
  requireInteraction?: boolean;
  silent?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationManagerService {
  private notificationSettings: { [key: string]: boolean } = {};
  private advancedSettings: {
    soundEnabled: boolean;
    vibrationEnabled: boolean;
    requireInteraction: boolean;
  } = {
      soundEnabled: true,
      vibrationEnabled: true,
      requireInteraction: false
    };

  constructor(
    private messagingService: FirebaseMessagingService,
    private currencyService: CurrencyService,
    private localStorageService: LocalStorageService
  ) {
    this.loadSettings();
  }

  private loadSettings(): void {
    // Load notification type settings
    const savedTypes = this.localStorageService.getItem<any>('notification-types');
    if (savedTypes) {
      this.notificationSettings = savedTypes;
    }

    // Load advanced settings
    const savedSettings = this.localStorageService.getItem<any>('notification-settings');
    if (savedSettings) {
      this.advancedSettings = { ...this.advancedSettings, ...savedSettings };
    }
  }

  /**
   * Send a transaction alert notification
   */
  async sendTransactionAlert(transaction: any): Promise<void> {
    if (!this.isNotificationTypeEnabled('transactions')) {
      return;
    }

    const notification: NotificationPayload = {
      title: 'New Transaction',
      body: `${transaction.description} - ${this.formatCurrency(transaction.amount)}`,
      icon: environment.baseUrl + '/assets/icon/app-icon/icon-192x192.png',
      badge: environment.baseUrl + '/assets/icon/app-icon/icon-72x72.png',
      data: {
        type: 'transaction',
        transactionId: transaction.id,
        route: '/dashboard/transactions'
      },
      actions: [
        {
          action: 'view',
          title: 'View Details'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ],
      requireInteraction: this.advancedSettings.requireInteraction,
      silent: !this.advancedSettings.soundEnabled
    };

    this.messagingService.showNotification(notification);
  }

  /**
   * Send a budget reminder notification
   */
  async sendBudgetReminder(budget: any, currentSpending: number, limit: number): Promise<void> {
    if (!this.isNotificationTypeEnabled('budgets')) {
      return;
    }

    const percentage = (currentSpending / limit) * 100;
    const remaining = limit - currentSpending;

    const notification: NotificationPayload = {
      title: 'Budget Alert',
      body: `${budget.name}: ${percentage.toFixed(1)}% used (${this.formatCurrency(remaining)} remaining)`,
      icon: environment.baseUrl + '/assets/icon/app-icon/icon-192x192.png',
      badge: environment.baseUrl + '/assets/icon/app-icon/icon-72x72.png',
      data: {
        type: 'budget',
        budgetId: budget.id,
        route: '/dashboard/budgets'
      },
      actions: [
        {
          action: 'view',
          title: 'View Budget'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ],
      requireInteraction: this.advancedSettings.requireInteraction,
      silent: !this.advancedSettings.soundEnabled
    };

    this.messagingService.showNotification(notification);
  }

  /**
   * Send a goal update notification
   */
  async sendGoalUpdate(goal: any, progress: number): Promise<void> {
    if (!this.isNotificationTypeEnabled('goals')) {
      return;
    }

    const percentage = (progress / goal.targetAmount) * 100;

    const notification: NotificationPayload = {
      title: 'Goal Progress',
      body: `${goal.name}: ${percentage.toFixed(1)}% complete (${this.formatCurrency(progress)} / ${this.formatCurrency(goal.targetAmount)})`,
      icon: environment.baseUrl + '/assets/icon/app-icon/icon-192x192.png',
      badge: environment.baseUrl + '/assets/icon/app-icon/icon-72x72.png',
      data: {
        type: 'goal',
        goalId: goal.id,
        route: '/dashboard/goals'
      },
      actions: [
        {
          action: 'view',
          title: 'View Goal'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ],
      requireInteraction: this.advancedSettings.requireInteraction,
      silent: !this.advancedSettings.soundEnabled
    };

    this.messagingService.showNotification(notification);
  }

  /**
   * Send a bill reminder notification
   */
  async sendBillReminder(bill: any, daysUntilDue: number): Promise<void> {
    if (!this.isNotificationTypeEnabled('bills')) {
      return;
    }

    const notification: NotificationPayload = {
      title: 'Bill Reminder',
      body: `${bill.name} due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''} - ${this.formatCurrency(bill.amount)}`,
      icon: environment.baseUrl + '/assets/icon/app-icon/icon-192x192.png',
      badge: environment.baseUrl + '/assets/icon/app-icon/icon-72x72.png',
      data: {
        type: 'bill',
        billId: bill.id,
        route: '/dashboard/transactions'
      },
      actions: [
        {
          action: 'view',
          title: 'View Bill'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ],
      requireInteraction: this.advancedSettings.requireInteraction,
      silent: !this.advancedSettings.soundEnabled
    };

    this.messagingService.showNotification(notification);
  }

  /**
   * Send a security alert notification
   */
  async sendSecurityAlert(alert: any): Promise<void> {
    if (!this.isNotificationTypeEnabled('security')) {
      return;
    }

    const notification: NotificationPayload = {
      title: 'Security Alert',
      body: alert.message,
      icon: environment.baseUrl + '/assets/icon/app-icon/icon-192x192.png',
      badge: environment.baseUrl + '/assets/icon/app-icon/icon-72x72.png',
      data: {
        type: 'security',
        alertId: alert.id,
        route: '/dashboard/profile'
      },
      actions: [
        {
          action: 'view',
          title: 'Review'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ],
      requireInteraction: true, // Security alerts should require interaction
      silent: false // Security alerts should always make sound
    };

    this.messagingService.showNotification(notification);
  }

  /**
   * Send a custom notification
   */
  async sendCustomNotification(type: NotificationType): Promise<void> {
    if (!this.isNotificationTypeEnabled(type.key)) {
      return;
    }

    const notification: NotificationPayload = {
      title: type.title,
      body: type.body,
      icon: type.icon || environment.baseUrl + '/assets/icon/app-icon/icon-192x192.png',
      badge: environment.baseUrl + '/assets/icon/app-icon/icon-72x72.png',
      data: type.data || {},
      actions: type.actions || [
        {
          action: 'view',
          title: 'View'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ],
      requireInteraction: type.requireInteraction || this.advancedSettings.requireInteraction,
      silent: type.silent || !this.advancedSettings.soundEnabled
    };

    this.messagingService.showNotification(notification);
  }

  /**
   * Send a welcome notification for new users
   */
  async sendWelcomeNotification(userName: string): Promise<void> {
    const notification: NotificationPayload = {
      title: `Welcome to ${APP_CONFIG.APP_NAME}!`,
      body: `Hi ${userName}, we're excited to help you manage your finances. Get started by adding your first transaction!`,
      icon: environment.baseUrl + '/assets/icon/app-icon/icon-192x192.png',
      badge: environment.baseUrl + '/assets/icon/app-icon/icon-72x72.png',
      data: {
        type: 'welcome',
        route: '/dashboard/transactions'
      },
      actions: [
        {
          action: 'view',
          title: 'Get Started'
        },
        {
          action: 'dismiss',
          title: 'Later'
        }
      ],
      requireInteraction: false,
      silent: false
    };

    this.messagingService.showNotification(notification);
  }

  /**
   * Send a weekly summary notification
   */
  async sendWeeklySummary(summary: any): Promise<void> {
    const notification: NotificationPayload = {
      title: 'Weekly Summary',
      body: `You spent ${this.formatCurrency(summary.totalSpent)} this week. ${summary.budgetStatus}`,
      icon: environment.baseUrl + '/assets/icon/app-icon/icon-192x192.png',
      badge: environment.baseUrl + '/assets/icon/app-icon/icon-72x72.png',
      data: {
        type: 'summary',
        route: '/dashboard/reports'
      },
      actions: [
        {
          action: 'view',
          title: 'View Report'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ],
      requireInteraction: false,
      silent: !this.advancedSettings.soundEnabled
    };

    this.messagingService.showNotification(notification);
  }

  /**
   * Check if a notification type is enabled
   */
  private isNotificationTypeEnabled(type: string): boolean {
    return this.notificationSettings[type] !== false; // Default to true if not set
  }

  /**
   * Format currency for display
   */
  private formatCurrency(amount: number): string {
    return this.currencyService.formatAmount(amount);
  }

  /**
   * Get the current FCM token
   */
  async getToken(): Promise<string | null> {
    return this.messagingService.getToken();
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<NotificationPermission> {
    return this.messagingService.requestPermission();
  }

  /**
   * Check if notifications are supported
   */
  isSupported(): boolean {
    return this.messagingService.isSupported();
  }

  /**
   * Get notification permission status
   */
  getPermissionStatus(): NotificationPermission {
    // Get current permission status from the browser
    return Notification.permission;
  }

  /**
   * Send a test notification
   */
  sendTestNotification(): void {
    this.messagingService.sendTestNotification();
  }

  /**
   * Update notification settings
   */
  updateNotificationSettings(type: string, enabled: boolean): void {
    this.notificationSettings[type] = enabled;
    this.localStorageService.setItem('notification-types', this.notificationSettings);
  }

  /**
   * Update advanced settings
   */
  updateAdvancedSettings(setting: string, value: boolean): void {
    this.advancedSettings[setting as keyof typeof this.advancedSettings] = value;
    this.localStorageService.setItem('notification-settings', this.advancedSettings);
  }

  /**
   * Get current notification settings
   */
  getNotificationSettings(): { [key: string]: boolean } {
    return { ...this.notificationSettings };
  }

  /**
   * Get current advanced settings
   */
  getAdvancedSettings(): typeof this.advancedSettings {
    return { ...this.advancedSettings };
  }
} 