import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  signal,
  effect,
  DestroyRef,
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
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { ThemeSwitchingService } from 'src/app/util/service/theme-switching.service';
import { ThemeType } from 'src/app/util/models/theme.model';
import { LocalIndexDBStorageService } from 'src/app/util/service/indexdb-storage.service';
import { ClickOutsideDirective } from 'src/app/util/directives/click-outside.directive';
import { LocalStorageKey } from 'src/app/util/models/local-storage.model';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import * as ProfileSelectors from 'src/app/store/profile/profile.selectors';
import { ThemeToggleComponent } from 'src/app/util/components/theme-toggle/theme-toggle.component';
import { FamilyModeToggleComponent } from 'src/app/util/components/family-mode-toggle/family-mode-toggle.component';
import { ImageFallbackDirective } from 'src/app/util/directives/image-fallback.directive';
import { FamilyService } from 'src/app/modules/family/services/family.service';
import { FamilyMember } from 'src/app/util/models/family.model';
import { PwaNavigationService } from 'src/app/util/service/pwa-navigation.service';
import { map, switchMap, of, combineLatest } from 'rxjs';

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
    // ThemeToggleComponent,
    FamilyModeToggleComponent,
    ImageFallbackDirective,
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
  private readonly swUpdate            = inject(SwUpdate);
  private readonly pwaNavigationService = inject(PwaNavigationService);
  private readonly destroyRef          = inject(DestroyRef);

  // ── Observables → signals ──────────────────────────────────────────────────
  private readonly userAuth    = toSignal(this.userService.userAuth$);
  private readonly userProfile = toSignal(this.store.select(ProfileSelectors.selectProfile));
  readonly isMobile   = toSignal(
    this.breakpointObserver.observe(Breakpoints.Handset).pipe(map(r => r.matches)),
    { initialValue: false }
  );
  readonly isDarkTheme = computed(() => this.themeSwitchingService.currentTheme() === 'dark-theme');

  // ── Computed signals ───────────────────────────────────────────────────────
  readonly isGuest = computed(() => this.userService.isGuestUser());

  readonly user = computed(() => {
    if (this.isGuest()) {
      return { displayName: 'Guest User', photoURL: 'assets/images/profile.png', firstName: undefined as string | undefined };
    }
    const profile = this.userProfile();
    const auth = this.userAuth() as any;
    
    return {
      displayName: profile?.displayName || auth?.displayName || 'User',
      photoURL:    profile?.photoURL || auth?.photoURL || 'assets/images/profile.png',
      firstName:   profile?.firstName || (auth?.displayName?.split(' ')[0]) || undefined as string | undefined,
    };
  });

  readonly profileImage = computed(() => {
    // Priority: custom photo from firestore profile > google photo from auth > safe default
    const customUrl = this.userProfile()?.photoURL;
    if (customUrl && customUrl !== 'undefined' && customUrl !== 'null' && !customUrl.includes('assets/images')) {
      return customUrl;
    }
    
    return this.user()?.photoURL;
  });

  readonly currentUserId = computed(() => this.userService.getCurrentUserId());

  readonly isFamilyMode = computed(() => this.userProfile()?.preferences?.isFamilyMode || false);

  readonly myFamilies = toSignal(this.familyService.getMyFamilies(), { initialValue: [] });

  // ── Writable signals ───────────────────────────────────────────────────────
  readonly isOpen        = signal(false);
  
  private readonly members$ = combineLatest([
    toObservable(this.familyService.activeFamilyId),
    toObservable(this.isFamilyMode)
  ]).pipe(
    switchMap(([id, mode]) => (mode && id) ? this.familyService.getMembers(id) : of([] as FamilyMember[]))
  );

  readonly familyMembers = toSignal(this.members$, { initialValue: [] as FamilyMember[] });

  // photoURL override for image-error fallback
  private readonly photoURLOverride = signal<string | null>(null);

  readonly updateAvailable = signal(false);
  private updateInterval?: any;

  constructor() {
    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates.subscribe(evt => {
        if (evt.type === 'VERSION_READY') {
          this.updateAvailable.set(true);
        }
      });
  
      // Poll for updates every 15 minutes
      this.updateInterval = setInterval(() => {
        this.swUpdate.checkForUpdate();
      }, 15 * 60 * 1000);
    }
  
    this.destroyRef.onDestroy(() => {
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
      }
    });

    // ── Handle back button for menu close ──────────────────────────────────
    effect((onCleanup) => {
      const open = this.isOpen();
      if (open) {
        const unregister = this.pwaNavigationService.registerBackHandler(() => {
          if (this.isOpen()) {
            this.isOpen.set(false);
            return true; // handled
          }
          return false;
        });
        onCleanup(() => unregister());
      }
    });
  }

  readonly sortedMembers = computed(() => {
    const members = this.familyMembers();
    const userId = this.currentUserId();
    return [...members]
      .filter(m => m.isActive)
      .sort((a, b) => {
        if (a.userId === userId) return -1; // Current user first
        if (b.userId === userId) return 1;
        return 0;
      });
  });

  // ── Template helpers ───────────────────────────────────────────────────────
  getMemberAvatarUrl(member: FamilyMember): any {
    return member.photoURL;
  }


  // ── UI actions ─────────────────────────────────────────────────────────────
  toggle(event?: Event): void {
    event?.stopPropagation();
    this.isOpen.update(v => !v);
  }

  close(event?: Event): void {
    this.isOpen.set(false);
    event?.stopPropagation();
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

  updateApp(): void {
    this.close();
    
    // Create and show update overlay to inform the user
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4';
    overlay.innerHTML = `
      <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center transform transition-all animate-in fade-in zoom-in duration-300">
        <div class="mb-6 flex justify-center">
          <div class="relative">
            <div class="w-16 h-16 border-4 border-indigo-100 dark:border-indigo-900/30 rounded-full"></div>
            <div class="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
          </div>
        </div>
        <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">Updating App</h3>
        <p class="text-gray-500 dark:text-gray-400 text-sm">Please wait while we prepare the latest version...</p>
      </div>
    `;
    document.body.appendChild(overlay);

    setTimeout(async () => {
      try {
        // 1. Clear known browser storage that might hold old state
        if (typeof window !== 'undefined') {
          // Clear Cache Storage (PWA assets)
          if ('caches' in window) {
            try {
              const cacheNames = await caches.keys();
              await Promise.all(cacheNames.map(name => caches.delete(name)));
            } catch (cErr) { console.warn('Cache clear error:', cErr); }
          }
          
          // Clear ALL Local IndexedDB Caches safely
          try {
            await this.localStorageService.clear();
          } catch (idbErr) { console.warn('IndexedDB clearance error:', idbErr); }

          // Activate update if ready
          if (this.swUpdate.isEnabled && this.updateAvailable()) {
            try {
              await this.swUpdate.activateUpdate();
            } catch (swErr) {
              console.warn('SW activation failed, continuing...', swErr);
            }
          }
          
          // Save a flag to indicate we just updated
          localStorage.setItem('app-updated', new Date().toISOString());
        }

        // 2. Final Hard Reload
        console.log('🔄 Reloading application for update...');
        window.location.reload();
      } catch (error) {
        console.error('Update reload sequence failed:', error);
        window.location.reload();
      }
    }, 0);
  }

  openHelp(): void {
    this.notificationService.info('Help feature coming soon');
    this.close();
  }

  shareApp(): void {
    const playStoreUrl = 'https://play.google.com/store/apps/details?id=io.github.prashiln79.twa';
    if (navigator.share) {
      navigator.share({
        title: 'Money Manager',
        text: 'Track your finances with Money Manager!',
        url: playStoreUrl,
      }).catch(() => {});
    } else {
      // Fallback for browsers that don't support navigator.share
      window.open(playStoreUrl, '_blank');
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
        closeOnNavigation: false,
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
            await this.userService.signOut();
            this.notificationService.success('Signed out and guest data cleared');
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
        this.close();
      } catch (error) {
        console.error('Error signing out:', error);
        this.notificationService.error('Failed to sign out');
      }
    }
  }

}
