import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { UserService } from 'src/app/util/service/db/user.service';
import { NotificationService } from 'src/app/util/service/notification.service';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { User } from 'src/app/util/models/user.model';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { SplitwiseService } from 'src/app/modules/splitwise/services/splitwise.service';
import { ThemeSwitchingService } from 'src/app/util/service/theme-switching.service';
import { ThemeType } from 'src/app/util/models/theme.model';
import { take } from 'rxjs';
import { LocalIndexDBStorageService } from 'src/app/util/service/indexdb-storage.service';


@Component({
  selector: 'app-user',
  templateUrl: './user.component.html',
  styleUrl: './user.component.scss',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule, RouterModule, TranslateModule],
  animations: [
    trigger('slideDown', [
      state('void', style({
        opacity: 0,
        transform: 'translateY(-10px) scale(0.95)'
      })),
      state('*', style({
        opacity: 1,
        transform: 'translateY(0) scale(1)'
      })),
      transition('void => *', [
        animate('200ms ease-out')
      ]),
      transition('* => void', [
        animate('150ms ease-in')
      ])
    ])
  ]
})
export class UserComponent {
  isOpen = false;
  public isMobile = false;
  public isDarkTheme = false;
  user: {
    displayName: string;
    photoURL: string;
  } = {
      displayName: '',
      photoURL: '',
    };

  constructor(
    private userService: UserService,
    private notificationService: NotificationService,
    private router: Router,
    private breakpointObserver: BreakpointObserver,
    private splitwiseService: SplitwiseService,
    private themeSwitchingService: ThemeSwitchingService,
    private localStorageService: LocalIndexDBStorageService
  ) {
    this.breakpointObserver.observe(Breakpoints.Handset).subscribe((result) => {
      this.isMobile = result.matches;
    });
  }

  isGuest = false;

  ngOnInit() {
    this.userService.userAuth$.subscribe((user: any) => {
      this.isGuest = this.userService.isGuestUser();
      if (this.isGuest) {
        this.user = {
          displayName: 'Guest User',
          photoURL: 'assets/images/profile.png'
        };
      } else {
        this.user = {
          displayName: user?.displayName,
          photoURL: user?.photoURL,
        };
      }
    });

    // Subscribe to theme changes
    this.themeSwitchingService.currentTheme.subscribe(theme => {
      this.isDarkTheme = theme === 'dark-theme';
    });
  }

  toggle(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    console.log('toggling');
    this.isOpen = !this.isOpen;
  }

  toggleTheme(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    const newTheme: ThemeType = this.isDarkTheme ? 'light-theme' : 'dark-theme';
    this.themeSwitchingService.setTheme(newTheme);
    // Note: We don't close the menu here so user can see the change immediately
  }

  close() {
    this.isOpen = false;
  }

  viewProfile() {
    console.log('View profile clicked');
    this.router.navigate(['/dashboard/profile']);
    this.close();
  }

  openSettings() {
    console.log('Settings clicked');
    this.notificationService.info('Settings feature coming soon');
    // TODO: Implement settings functionality
    this.close();
  }

  openCacheManager() {
    console.log('Cache management clicked');
    this.notificationService.info('Opening cache management');
    // Show cache manager dialog or navigate to cache management page
    this.showCacheManagerDialog();
    this.close();
  }

  private showCacheManagerDialog() {
    // Create a modal dialog for cache management
    const dialog = document.createElement('div');
    dialog.className = 'fixed inset-0 z-[9999] bg-black bg-opacity-50 flex items-center justify-center p-4';
    dialog.innerHTML = `
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto">
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900">Cache Management</h3>
            <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          
          <div class="space-y-4">
            <!-- Clear Cache Button -->
            <button 
              onclick="clearAppCache()"
              class="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
              <span>Clear Cache</span>
            </button>

            <!-- Force Update Button -->
            <button 
              onclick="forceAppUpdate()"
              class="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
              <span>Force Update</span>
            </button>

            <!-- App Info -->
            <div class="p-3 bg-gray-50 rounded-lg">
              <h4 class="font-medium text-gray-900 mb-2">App Information</h4>
              <div class="space-y-1">
                <div class="flex justify-between">
                  <span class="text-sm text-gray-600">Version:</span>
                  <span class="text-sm font-medium">${new Date().toISOString().split('T')[0]}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-sm text-gray-600">Last Updated:</span>
                  <span class="text-sm font-medium">${new Date(this.localStorageService.getItem('app-version') || new Date().toISOString().split('T')[0]).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add JavaScript functions to the global scope
    (window as any).clearAppCache = async () => {
      try {
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
        }
        if ('indexedDB' in window) {
          const databases = await indexedDB.databases();
          databases.forEach(db => {
            if (db.name) {
              indexedDB.deleteDatabase(db.name);
            }
          });
        }
        this.notificationService.success('Cache cleared successfully!');
        dialog.remove();
      } catch (error) {
        console.error('Failed to clear cache:', error);
        this.notificationService.error('Failed to clear cache. Please try again.');
      }
    };

    (window as any).forceAppUpdate = () => {
      this.localStorageService.setItem('app-version', new Date().toISOString().split('T')[0]);
      this.notificationService.info('App update initiated');
      window.location.reload();
    };

    document.body.appendChild(dialog);

    // Close dialog when clicking outside
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        dialog.remove();
      }
    });
  }

  openHelp() {
    console.log('Help clicked');
    this.notificationService.info('Help feature coming soon');
    // TODO: Implement help functionality
    this.close();
  }

  async signOut(e: any) {
    console.log('signing out');
    try {
      await this.userService.signOut();
      this.notificationService.success('Signed out successfully');
      e.stopPropagation();
      this.close();
    } catch (error) {
      console.error('Error signing out:', error);
      this.notificationService.error('Failed to sign out');
    }
  }

  shareApp() {
    this.splitwiseService.sharePWA();
    this.close();
  }

  navigateToSignUp() {
    this.router.navigate(['/dashboard/sync-to-cloud']);
    this.close();
  }
}
