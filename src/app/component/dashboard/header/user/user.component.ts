import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  signal,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ConfirmDialogComponent } from 'src/app/util/components/confirm-dialog/confirm-dialog.component';
import { UserService } from 'src/app/util/service/db/user.service';
import { NotificationService } from 'src/app/util/service/notification.service';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { ThemeSwitchingService } from 'src/app/util/service/theme-switching.service';
import { ThemeType } from 'src/app/util/models/theme.model';
import { LocalIndexDBStorageService } from 'src/app/util/service/indexdb-storage.service';
import { ClickOutsideDirective } from 'src/app/util/directives/click-outside.directive';
import { LocalStorageKey } from 'src/app/util/models/local-storage.model';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import * as ProfileSelectors from 'src/app/store/profile/profile.selectors';
import { ThemeToggleComponent } from 'src/app/util/components/theme-toggle/theme-toggle.component';
import { FamilyModeToggleComponent } from 'src/app/util/components/family-mode-toggle/family-mode-toggle.component';
import { FamilyService } from 'src/app/modules/family/services/family.service';
import { FamilyMember } from 'src/app/util/models/family.model';
import { map } from 'rxjs';

@Component({
  selector: 'app-user',
  templateUrl: './user.component.html',
  styleUrl: './user.component.scss',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatTooltipModule,
    RouterModule,
    TranslateModule,
    ClickOutsideDirective,
    MatDialogModule,
    ThemeToggleComponent,
    FamilyModeToggleComponent,
  ],
  animations: [
    trigger('slideDown', [
      state('void', style({ opacity: 0, transform: 'translateY(-10px) scale(0.95)' })),
      state('*', style({ opacity: 1, transform: 'translateY(0) scale(1)' })),
      transition('void => *', [animate('200ms ease-out')]),
      transition('* => void', [animate('150ms ease-in')]),
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserComponent {
  // ── DI via inject() ────────────────────────────────────────────────────────
  private readonly userService        = inject(UserService);
  private readonly notificationService = inject(NotificationService);
  private readonly router              = inject(Router);
  private readonly breakpointObserver  = inject(BreakpointObserver);
  private readonly themeSwitchingService = inject(ThemeSwitchingService);
  private readonly localStorageService = inject(LocalIndexDBStorageService);
  private readonly dialog              = inject(MatDialog);
  private readonly familyService       = inject(FamilyService);
  private readonly store               = inject(Store<AppState>);

  // ── Observables → signals ──────────────────────────────────────────────────
  private readonly userAuth    = toSignal(this.userService.userAuth$);
  private readonly userProfile = toSignal(this.store.select(ProfileSelectors.selectProfile));
  readonly isMobile   = toSignal(
    this.breakpointObserver.observe(Breakpoints.Handset).pipe(map(r => r.matches)),
    { initialValue: false }
  );
  readonly isDarkTheme = toSignal(
    this.themeSwitchingService.currentTheme.pipe(map(t => t === 'dark-theme')),
    { initialValue: false }
  );

  // ── Computed signals ───────────────────────────────────────────────────────
  readonly isGuest = computed(() => this.userService.isGuestUser());

  readonly user = computed(() => {
    if (this.isGuest()) {
      return { displayName: 'Guest User', photoURL: 'assets/images/profile.png', firstName: undefined as string | undefined };
    }
    const u = this.userAuth() as any;
    return {
      displayName: u?.displayName as string,
      photoURL:    u?.photoURL    as string,
      firstName:   u?.firstName   as string | undefined,
    };
  });

  readonly profileImage = computed(() => {
    // Priority: custom photo from firestore profile > google photo from auth > safe default
    const customUrl = this.userProfile()?.photoURL;
    if (customUrl && customUrl !== 'undefined' && customUrl !== 'null' && !customUrl.includes('assets/images')) {
      return this.userService.getAvatarUrl(customUrl);
    }
    
    return this.userService.getAvatarUrl(this.user()?.photoURL);
  });

  readonly currentUserId = computed(() => this.userService.getCurrentUserId());

  readonly isFamilyMode = computed(() => this.userProfile()?.preferences?.isFamilyMode || false);

  // ── Writable signals ───────────────────────────────────────────────────────
  readonly isOpen        = signal(false);
  readonly familyMembers = signal<FamilyMember[]>([]);

  // photoURL override for image-error fallback
  private readonly photoURLOverride = signal<string | null>(null);

  // ── Effect: load family members reactively ─────────────────────────────────
  constructor() {
    effect(() => {
      const activeFamilyId = this.familyService.activeFamilyId();
      if (this.isFamilyMode() && activeFamilyId) {
        this.familyService.getMembers(activeFamilyId).subscribe((members: FamilyMember[]) => {
          const userId = this.currentUserId();
          this.familyMembers.set(
            members
              .filter(m => m.isActive)
              .sort((a, b) => {
                if (a.userId === userId) return 1;
                if (b.userId === userId) return -1;
                return 0;
              })
          );
        });
      } else {
        this.familyMembers.set([]);
      }
    }, { allowSignalWrites: true });

  }

  // ── Template helpers ───────────────────────────────────────────────────────
  getMemberAvatarUrl(member: FamilyMember): string {
    return this.userService.getAvatarUrl(member.photoURL);
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'assets/images/profile.png';
  }

  // ── UI actions ─────────────────────────────────────────────────────────────
  toggle(event?: Event): void {
    event?.stopPropagation();
    this.isOpen.update(v => !v);
  }

  close(): void {
    this.isOpen.set(false);
  }

  toggleTheme(event?: Event): void {
    event?.stopPropagation();
    const newTheme: ThemeType = this.isDarkTheme() ? 'light-theme' : 'dark-theme';
    this.themeSwitchingService.setTheme(newTheme);
  }

  viewProfile(): void {
    this.router.navigate(['/dashboard/profile']);
    this.close();
  }

  openSettings(): void {
    this.notificationService.info('Settings feature coming soon');
    this.close();
  }

  openCacheManager(): void {
    this.showCacheManagerDialog();
    this.close();
  }

  openHelp(): void {
    this.notificationService.info('Help feature coming soon');
    this.close();
  }

  shareApp(): void {
    if (navigator.share) {
      navigator.share({
        title: 'Money Manager',
        text: 'Track your finances with Money Manager!',
        url: window.location.origin,
      }).catch(() => {});
    }
    this.close();
  }

  navigateToSignUp(): void {
    this.router.navigate(['/dashboard/sync-to-cloud']);
    this.close();
  }

  openFeedback(): void {
    this.router.navigate(['/dashboard/feedback']);
    this.close();
  }

  async signOut(e?: Event): Promise<void> {
    e?.stopPropagation();

    if (this.isGuest()) {
      const dialogRef = this.dialog.open(ConfirmDialogComponent, {
        data: {
          title: 'Sign Out?',
          message: 'Are you sure you want to sign out? All your guest data will be permanently deleted.',
          confirmText: 'Sign Out',
          cancelText: 'Cancel',
          type: 'warning',
        },
      });

      dialogRef.afterClosed().subscribe(async (result) => {
        if (result) {
          try {
            await this.localStorageService.clear();
            await this.userService.signOut();
            this.notificationService.success('Signed out and guest data cleared');
            this.router.navigate(['/sign-in']);
            this.close();
          } catch (error) {
            console.error('Error signing out guest:', error);
            this.notificationService.error('Failed to sign out');
          }
        }
      });
    } else {
      try {
        await this.userService.signOut();
        this.notificationService.success('Signed out successfully');
        this.router.navigate(['/sign-in']);
        this.close();
      } catch (error) {
        console.error('Error signing out:', error);
        this.notificationService.error('Failed to sign out');
      }
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────
  private showCacheManagerDialog(): void {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[9999] bg-black bg-opacity-50 flex items-center justify-center p-4';
    overlay.innerHTML = `
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
            <button onclick="clearAppCache()" class="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
              <span>Clear Cache</span>
            </button>
            <button onclick="forceAppUpdate()" class="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
              <span>Force Update</span>
            </button>
            <div class="p-3 bg-gray-50 rounded-lg">
              <h4 class="font-medium text-gray-900 mb-2">App Information</h4>
              <div class="space-y-1">
                <div class="flex justify-between">
                  <span class="text-sm text-gray-600">Version:</span>
                  <span class="text-sm font-medium">${new Date().toISOString().split('T')[0]}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-sm text-gray-600">Last Updated:</span>
                  <span class="text-sm font-medium">${new Date(this.localStorageService.getItem(LocalStorageKey.APP_VERSION) || new Date().toISOString().split('T')[0]).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    (window as any).clearAppCache = async () => {
      try {
        if ('caches' in window) {
          const names = await caches.keys();
          await Promise.all(names.map(n => caches.delete(n)));
        }
        if ('indexedDB' in window) {
          const dbs = await indexedDB.databases();
          dbs.forEach(db => { if (db.name) indexedDB.deleteDatabase(db.name); });
        }
        this.notificationService.success('Cache cleared successfully!');
        overlay.remove();
      } catch (error) {
        console.error('Failed to clear cache:', error);
        this.notificationService.error('Failed to clear cache. Please try again.');
      }
    };

    (window as any).forceAppUpdate = () => {
      this.localStorageService.setItem(LocalStorageKey.APP_VERSION, new Date().toISOString().split('T')[0]);
      this.notificationService.info('App update initiated');
      window.location.reload();
    };

    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }
}
