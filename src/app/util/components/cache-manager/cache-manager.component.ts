import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CommonSyncService } from '../../service/common-sync.service';
import { SsrService } from '../../service/ssr.service';
import { LocalIndexDBStorageService } from 'src/app/util/service/indexdb-storage.service';
import { LocalStorageKey } from 'src/app/util/models/local-storage.model';

@Component({
  selector: 'app-cache-manager',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div class="p-4 bg-white rounded-lg shadow-sm border">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Smart Cache Management</h3>
      
      <div class="space-y-4">
        <!-- Cache Status -->
        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div>
            <h4 class="font-medium text-gray-900">Cache Status</h4>
            <p class="text-sm text-gray-600">Smart cache management preserves your login and data</p>
          </div>
          <div class="flex items-center space-x-2">
            <div class="w-2 h-2 bg-green-500 rounded-full"></div>
            <span class="text-sm text-gray-600">Smart Mode</span>
          </div>
        </div>

        <!-- Clear Application Cache Button -->
        <button 
          (click)="clearApplicationCache()"
          [disabled]="isClearing"
          class="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <mat-icon class="text-sm">{{ isClearing ? 'hourglass_empty' : 'clear_all' }}</mat-icon>
          <span>{{ isClearing ? 'Clearing App Cache...' : 'Clear Application Cache' }}</span>
        </button>

        <!-- Force Update Button -->
        <button 
          (click)="forceUpdate()"
          [disabled]="isUpdating"
          class="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <mat-icon class="text-sm">{{ isUpdating ? 'hourglass_empty' : 'system_update' }}</mat-icon>
          <span>{{ isUpdating ? 'Updating...' : 'Force Full Update (Logs Out)' }}</span>
        </button>

        <!-- Check for Updates Button -->
        <button 
          (click)="checkForUpdates()"
          [disabled]="isChecking"
          class="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <mat-icon class="text-sm">{{ isChecking ? 'hourglass_empty' : 'refresh' }}</mat-icon>
          <span>{{ isChecking ? 'Checking...' : 'Check for Updates' }}</span>
        </button>

        <!-- Network Status -->
        <div class="p-3 bg-gray-50 rounded-lg">
          <h4 class="font-medium text-gray-900 mb-2">Network Status</h4>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">Connection:</span>
            <div class="flex items-center space-x-2">
              <div 
                class="w-2 h-2 rounded-full"
                [class]="getNetworkStatusClass()"
              ></div>
              <span class="text-sm font-medium">{{ getNetworkStatusText() }}</span>
            </div>
          </div>
        </div>

        <!-- App Version -->
        <div class="p-3 bg-gray-50 rounded-lg">
          <h4 class="font-medium text-gray-900 mb-2">App Information</h4>
          <div class="space-y-1">
            <div class="flex justify-between">
              <span class="text-sm text-gray-600">Version:</span>
              <span class="text-sm font-medium">{{ getAppVersion() }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-600">Last Updated:</span>
              <span class="text-sm font-medium">{{ getLastUpdated() }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-600">Cache Strategy:</span>
              <span class="text-sm font-medium text-green-600">Smart Mode</span>
            </div>
          </div>
        </div>

        <!-- Info Section -->
        <div class="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <h4 class="font-medium text-blue-900 mb-2">Smart Cache Features</h4>
          <ul class="text-sm text-blue-800 space-y-1">
            <li>• Preserves your login during updates</li>
            <li>• Maintains user preferences and settings</li>
            <li>• Only clears application data, not user data</li>
            <li>• Weekly versioning reduces unnecessary clears</li>
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
export class CacheManagerComponent {
  isClearing = false;
  isUpdating = false;
  isChecking = false;

  constructor(
    private commonSyncService: CommonSyncService,
    private ssrService: SsrService,
    private storageService: LocalIndexDBStorageService
  ) { }

  async clearApplicationCache(): Promise<void> {
    this.isClearing = true;
    try {
      await this.commonSyncService.clearCache();
      alert('Application cache cleared successfully! Your login and data are preserved.');
    } catch (error) {
      console.error('Failed to clear application cache:', error);
      alert('Failed to clear application cache. Please try again.');
    } finally {
      this.isClearing = false;
    }
  }

  async forceUpdate(): Promise<void> {
    if (confirm('This will clear ALL cache including your login. You will need to sign in again. Continue?')) {
      this.isUpdating = true;
      try {
        await this.commonSyncService.clearCache();
        window.location.reload();
      } catch (error) {
        console.error('Failed to force update:', error);
        alert('Failed to force update. Please try again.');
        this.isUpdating = false;
      }
    }
  }

  async checkForUpdates(): Promise<void> {
    this.isChecking = true;
    try {
      if (this.ssrService.isClientSide()) {
        // This will trigger the service worker update check
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
      alert('Failed to check for updates. Please try again.');
    } finally {
      this.isChecking = false;
    }
  }

  getNetworkStatusClass(): string {
    const status = this.commonSyncService.getCurrentNetworkStatus();
    if (!status.online) return 'bg-red-500';
    if (status.effectiveType === '4g') return 'bg-green-500';
    if (status.effectiveType === '3g') return 'bg-yellow-500';
    return 'bg-gray-500';
  }

  getNetworkStatusText(): string {
    const status = this.commonSyncService.getCurrentNetworkStatus();
    if (!status.online) return 'Offline';
    if (status.effectiveType === '4g') return '4G';
    if (status.effectiveType === '3g') return '3G';
    if (status.effectiveType === '2g') return '2G';
    return 'Unknown';
  }

  getAppVersion(): string {
    const now = new Date();
    const weekNumber = Math.ceil(now.getDate() / 7);
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    return `${year}-${month.toString().padStart(2, '0')}-W${weekNumber}`;
  }

  getLastUpdated(): string {
    const lastUpdated = this.storageService.getItem<string>(LocalStorageKey.APP_VERSION) || this.getAppVersion();
    return new Date(lastUpdated).toLocaleDateString();
  }
} 