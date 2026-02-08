import { Component } from '@angular/core';
import { CommonSyncService } from '../../service/common-sync.service';
import { SsrService } from '../../service/ssr.service';
import { NotificationService } from '../../service/notification.service';

@Component({
  selector: 'app-offline-page',
  template: `
    <div class="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div class="max-w-md w-full text-center">
        <!-- Offline Icon -->
        <div class="mb-8">
          <div class="mx-auto w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center">
            <mat-icon class="text-4xl text-yellow-600">wifi_off</mat-icon>
          </div>
        </div>

        <!-- Heading -->
        <h1 class="text-2xl font-bold text-gray-900 mb-2">Offline Mode</h1>
        <p class="text-gray-600 mb-8">
          The app is currently running in offline mode. You can continue to track your finances, and your data will sync once you're back online.
        </p>

        <!-- Connection Status -->
        <div class="bg-white rounded-lg p-4 mb-6 shadow-sm border">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">Connection Status:</span>
            <span class="text-sm font-medium text-yellow-600">Offline</span>
          </div>
        </div>

        <!-- Actions -->
        <div class="space-y-3">
          <button 
            mat-raised-button 
            color="primary" 
            class="w-full"
            (click)="retryConnection()"
          >
            <mat-icon class="mr-2">refresh</mat-icon>
            Try Again
          </button>
          
          <button 
            mat-stroked-button 
            class="w-full"
            (click)="openOfflineData()"
          >
            <mat-icon class="mr-2">storage</mat-icon>
            View Offline Data
          </button>
        </div>

        <!-- Tips -->
        <div class="mt-8 p-4 bg-blue-50 rounded-lg">
          <h3 class="text-sm font-medium text-blue-900 mb-2">Offline Tips:</h3>
          <ul class="text-xs text-blue-800 space-y-1">
            <li>• Your transactions are saved locally</li>
            <li>• Changes will sync when connection is restored</li>
            <li>• Check your internet connection</li>
            <li>• Try refreshing the page</li>
          </ul>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class OfflinePageComponent {
  constructor(
    private commonSyncService: CommonSyncService,
    private ssrService: SsrService,
    private notificationService: NotificationService
  ) { }

  retryConnection(): void {
    // Check if we're back online
    if (this.commonSyncService.isCurrentlyOnline()) {
      if (this.ssrService.isClientSide()) {
        // Navigate back to dashboard instead of reloading
        window.location.href = '/dashboard';
      }
    } else {
      // Show a message that we're still offline
      this.notificationService.warning('Still in offline mode. Please check your internet connection.');
    }
  }

  openOfflineData(): void {
    // Navigate to dashboard to view cached data
    if (this.ssrService.isClientSide()) {
      window.location.href = '/dashboard';
    }
  }
} 