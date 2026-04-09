import { Injectable, Inject, PLATFORM_ID } from "@angular/core";
import { MatSnackBar, MatSnackBarConfig } from "@angular/material/snack-bar";
import { MatDialog } from "@angular/material/dialog";
import { APP_CONFIG } from "../config/config";
import { isPlatformServer } from "@angular/common";
import { Observable, map } from "rxjs";
import { ConfirmDialogComponent, ConfirmDialogData } from "../components/confirm-dialog/confirm-dialog.component";

export interface HapticFeedbackOptions {
  duration?: number;
  pattern?: number[];
  intensity?: 'light' | 'medium' | 'heavy';
}

@Injectable({
  providedIn: "root",
})
export class NotificationService {
  private isVibrationSupported: boolean;
  private isMobileVibrationDevice: boolean;
  private hapticFeedbackEnabled: boolean = true;

  // Define a common snack bar config object using APP_CONFIG
  private defaultConfig: MatSnackBarConfig = {
    duration: APP_CONFIG.NOTIFICATIONS.AUTO_HIDE_DELAY, // Use config duration
    horizontalPosition: APP_CONFIG.NOTIFICATIONS.POSITION.split('-')[1] as 'left' | 'center' | 'right', // Extract position from config
    verticalPosition: this.isMobile() ? 'bottom' : APP_CONFIG.NOTIFICATIONS.POSITION.split('-')[0] as 'top' | 'bottom', // Extract position from config
    panelClass: this.isMobile() ? ['snack-bar-success', 'mobile-notification'] : ['snack-bar-success'], // Add mobile class for custom positioning
  };

  constructor(
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isVibrationSupported = !isPlatformServer(this.platformId) && 'vibrate' in navigator;
    this.isMobileVibrationDevice = !isPlatformServer(this.platformId) && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  // Check if device is mobile for UI purposes
  private isMobile(): boolean {
    if (isPlatformServer(this.platformId)) {
      return false; // Default to desktop on server-side
    }
    return window.innerWidth <= 768;
  }

  /**
   * Check if haptic feedback is supported
   */
  public isHapticSupported(): boolean {
    return this.isVibrationSupported && this.isMobileVibrationDevice && this.hapticFeedbackEnabled;
  }

  public setHapticPreference(enabled: boolean): void {
    this.hapticFeedbackEnabled = enabled;
  }

  // Show success message
  success(message: string, action?: string): void {
    this.snackBar.open(message, action, {
      ...this.defaultConfig,
      panelClass: this.isMobile() ? ['snack-bar-success', 'mobile-notification'] : ['snack-bar-success'],
    });
  }

  // Show error message
  error(message: string, action?: string): void {
    this.snackBar.open(message, action, {
      ...this.defaultConfig,
      panelClass: this.isMobile() ? ['snack-bar-error', 'mobile-notification'] : ['snack-bar-error'],
    });
  }

  // Show info message
  info(message: string, action?: string): void {
    this.snackBar.open(message, action, {
      ...this.defaultConfig,
      panelClass: this.isMobile() ? ['snack-bar-info', 'mobile-notification'] : ['snack-bar-info'],
    });
  }

  // Show warning message
  warning(message: string, action?: string): void {
    this.snackBar.open(message, action, {
      ...this.defaultConfig,
      panelClass: this.isMobile() ? ['snack-bar-warning', 'mobile-notification'] : ['snack-bar-warning'],
    });
  }

  // --- Haptic Feedback Methods ---

  public lightVibration(): void {
    if (!this.isHapticSupported()) return;
    try {
      navigator.vibrate(10);
    } catch (error) {
      console.warn('Vibration failed:', error);
    }
  }

  public mediumVibration(): void {
    if (!this.isHapticSupported()) return;
    try {
      navigator.vibrate(100);
    } catch (error) {
      console.warn('Vibration failed:', error);
    }
  }

  public heavyVibration(): void {
    if (!this.isHapticSupported()) return;
    try {
      navigator.vibrate(200);
    } catch (error) {
      console.warn('Vibration failed:', error);
    }
  }

  public successVibration(): void {
    if (!this.isHapticSupported()) return;
    try {
      navigator.vibrate([50, 100, 50]);
    } catch (error) {
      console.warn('Vibration failed:', error);
    }
  }

  public errorVibration(): void {
    if (!this.isHapticSupported()) return;
    try {
      navigator.vibrate([100, 50, 100, 50, 100]);
    } catch (error) {
      console.warn('Vibration failed:', error);
    }
  }

  public warningVibration(): void {
    if (!this.isHapticSupported()) return;
    try {
      navigator.vibrate([100, 100, 100]);
    } catch (error) {
      console.warn('Vibration failed:', error);
    }
  }

  public buttonClick(): void {
    this.lightVibration();
  }

  public navigationClick(): void {
    this.mediumVibration();
  }

  public importantAction(): void {
    this.heavyVibration();
  }

  public customVibration(pattern: number[]): void {
    if (!this.isHapticSupported()) return;
    try {
      navigator.vibrate(pattern);
    } catch (error) {
      console.warn('Vibration failed:', error);
    }
  }

  public vibrate(options: HapticFeedbackOptions = {}): void {
    if (!this.isHapticSupported()) return;
    const { duration = 100, pattern, intensity = 'medium' } = options;
    try {
      if (pattern) {
        navigator.vibrate(pattern);
      } else {
        let vibrationDuration = duration;
        switch (intensity) {
          case 'light': vibrationDuration = 50; break;
          case 'medium': vibrationDuration = 100; break;
          case 'heavy': vibrationDuration = 200; break;
        }
        navigator.vibrate(vibrationDuration);
      }
    } catch (error) {
      console.warn('Vibration failed:', error);
    }
  }

  public stopVibration(): void {
    if (!this.isVibrationSupported) return;
    try {
      navigator.vibrate(0);
    } catch (error) {
      console.warn('Stop vibration failed:', error);
    }
  }

  // Optionally, you can also allow dynamic config for specific cases
  showCustom(message: string, action: string = "Notification", customConfig: MatSnackBarConfig = {}): void {
    const config = { ...this.defaultConfig, ...customConfig }; // Merge default config with custom config
    this.snackBar.open(message, action, config);
  }

  /**
   * Opens a reusable confirmation dialog and returns an Observable<boolean>.
   * Resolves to `true` if the user confirms, `false` otherwise.
   *
   * @example
   * this.notificationService.confirm({
   *   title: 'Delete Item',
   *   message: 'Are you sure you want to delete this item?',
   *   confirmText: 'Delete',
   *   cancelText: 'Cancel',
   *   type: 'delete',
   * }).subscribe(confirmed => { if (confirmed) { ... } });
   */
  confirm(data: ConfirmDialogData): Observable<boolean> {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      closeOnNavigation: false,
      data,
    });
    return dialogRef.afterClosed().pipe(map(result => !!result));
  }
}
