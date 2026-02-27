import { Injectable } from "@angular/core";
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
  CanActivateChild
} from "@angular/router";
import { Observable, of } from "rxjs";
import { catchError, timeout, map, take, finalize } from "rxjs/operators";
import { UserService } from "../service/db/user.service";
import { Auth, authState, User } from '@angular/fire/auth';
import { NotificationService } from "../service/notification.service";
import { User as AppUser, UserRole } from "../models/user.model";
import { LoaderService } from "../service/loader.service";
import { CommonSyncService } from "../service/common-sync.service";

interface SecurityConfig {
  readonly SESSION_TIMEOUT: number;
  readonly INACTIVITY_TIMEOUT: number;
  readonly MAX_LOGIN_ATTEMPTS: number;
  readonly LOCKOUT_DURATION: number;
  readonly PASSWORD_MIN_LENGTH: number;
  readonly REQUIRE_EMAIL_VERIFICATION: boolean;
  readonly ENABLE_RATE_LIMITING: boolean;
  readonly SECURE_HEADERS: boolean;
}

const SECURITY_CONFIG: SecurityConfig = {
  SESSION_TIMEOUT: 30 * 60 * 1000,
  INACTIVITY_TIMEOUT: 60 * 60 * 1000,
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 15 * 60 * 1000,
  PASSWORD_MIN_LENGTH: 8,
  REQUIRE_EMAIL_VERIFICATION: true,
  ENABLE_RATE_LIMITING: true,
  SECURE_HEADERS: true
};

interface RoutePermission {
  readonly roles: UserRole[];
  readonly requireEmailVerification: boolean;
  readonly requireTwoFactor: boolean;
  readonly requireActiveSession: boolean;
}

@Injectable({
  providedIn: "root",
})
export class AuthGuard implements CanActivate, CanActivateChild {

  private readonly sessionStartTime = new Map<string, number>();

  constructor(
    private router: Router,
    private userService: UserService,
    private notificationService: NotificationService,
    private loaderService: LoaderService,
    private commonSyncService: CommonSyncService,
    private auth: Auth
  ) {
    this.startSessionMonitoring();
  }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
    return this.performSecurityCheck(route, state);
  }

  canActivateChild(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
    return this.performSecurityCheck(route, state);
  }

  private performSecurityCheck(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
    this.loaderService.show();

    return authState(this.auth).pipe(
      take(1),
      map(firebaseUser => {
        if (firebaseUser || this.userService.isGuestUser()) {
          this.backgroundSecurityCheck(route, state, firebaseUser as User);
          return true;
        }

        // Auto-enable guest mode for unauthenticated access
        this.handleUnauthenticatedUser(state);
        return false;
      }),
      timeout(10000),
      catchError(error => {
        console.error('[AuthGuard] Timeout or error:', error);
        this.loaderService.hide();
        this.router.navigate(['/sign-in'], {
          queryParams: { error: 'auth_timeout', redirect: state.url }
        });
        return of(false);
      }),
      finalize(() => {
        // Ensure loader is eventually hidden if not already
        // Note: backgroundSecurityCheck also calls hide() in a timeout(0),
        // so we must be careful not to hide it too early if it's still doing work.
      })
    );
  }

  private backgroundSecurityCheck(route: ActivatedRouteSnapshot, state: RouterStateSnapshot, firebaseUser: User): void {
    setTimeout(async () => {
      try {
        if (firebaseUser && !this.sessionStartTime.has(firebaseUser.uid)) {
          this.updateSessionTimestamp(firebaseUser.uid);
        }

        if (this.userService.isGuestUser()) {
          this.loaderService.hide();
          return;
        }

        if (firebaseUser && this.isSessionExpired(firebaseUser.uid)) {
          await this.handleSessionExpired(firebaseUser, state);
          return;
        }

        // Check if we're offline and use cached user data
        const isOffline = !this.commonSyncService.isCurrentlyOnline();
        let userData: AppUser | null;

        if (isOffline) {
          // Use cached user data when offline
          userData = this.userService.getCachedUserData(firebaseUser.uid);
          console.log('[AuthGuard] Offline mode - using cached user data:', userData ? 'found' : 'not found');
        } else {
          // Try to get fresh user data when online
          userData = await this.userService.getCurrentUser();
        }

        if (!userData) {
          if (isOffline) {
            // When offline and no cached data, allow access but log warning
            console.warn('[AuthGuard] Offline mode - no cached user data available, allowing access');
            this.updateSessionTimestamp(firebaseUser.uid);
            return;
          } else {
            await this.handleInvalidUserData(firebaseUser, state);
            return;
          }
        }

        const hasPermission = await this.checkRoutePermissions(route, userData, firebaseUser);
        if (!hasPermission) {
          const routeData = route.data as RoutePermission;
          if (routeData?.requireEmailVerification && !firebaseUser.emailVerified) {
            this.notificationService.error('Please verify your email address.');
            await this.userService.signOut();
            this.router.navigate(['/sign-in']);
            return;
          }

          await this.handleInsufficientPermissions(userData, state);
          return;
        }

        this.updateSessionTimestamp(firebaseUser.uid);
      } catch (error) {
        console.error('[AuthGuard] Background error:', error);

        // If we're offline and there's an error, allow access
        if (!this.commonSyncService.isCurrentlyOnline()) {
          console.warn('[AuthGuard] Offline mode - error occurred, allowing access for offline use');
          this.updateSessionTimestamp(firebaseUser.uid);
          return;
        }

        await this.handleSecurityError(error, state);
      } finally {
        this.loaderService.hide();
      }
    }, 0);
  }

  private async checkRoutePermissions(route: ActivatedRouteSnapshot, userData: AppUser, firebaseUser: User): Promise<boolean> {
    const routeData = route.data as RoutePermission;
    const idTokenResult = await firebaseUser.getIdTokenResult();
    const isAdmin = !!idTokenResult.claims['admin'];

    if (isAdmin) {
      return true;
    }

    if (routeData?.requireEmailVerification && !firebaseUser.emailVerified) {
      console.warn('[AuthGuard] Email not verified');
      return false;
    }

    if (routeData?.roles?.length > 0 && !routeData.roles.includes(userData.role)) {
      console.warn('[AuthGuard] Insufficient role:', userData.role);
      return false;
    }

    if (routeData?.requireTwoFactor && !this.hasTwoFactorEnabled(userData)) {
      console.warn('[AuthGuard] Two-factor required');
      return false;
    }

    return true;
  }

  private isSessionExpired(uid: string): boolean {
    const sessionStart = this.sessionStartTime.get(uid);
    const now = Date.now();
    return !!sessionStart && (now - sessionStart > SECURITY_CONFIG.SESSION_TIMEOUT);
  }

  private updateSessionTimestamp(uid: string): void {
    this.sessionStartTime.set(uid, Date.now());
  }

  private async handleUnauthenticatedUser(state: RouterStateSnapshot): Promise<void> {
    console.log('[AuthGuard] Auto-enabling guest mode for unauthenticated access');
    await this.userService.enableGuestMode();
    // Retry the navigation now that we are "logged in" as guest
    this.router.navigateByUrl(state.url);
  }

  private async handleSessionExpired(firebaseUser: User, state: RouterStateSnapshot): Promise<void> {
    this.sessionStartTime.delete(firebaseUser.uid);
    this.userService.clearCachedUserData();
    await this.userService.signOut();
    this.router.navigate(['/sign-in'], {
      queryParams: {
        session: 'expired',
        redirect: state.url,
        reason: 'timeout'
      }
    });
  }

  private async handleInvalidUserData(firebaseUser: User, state: RouterStateSnapshot): Promise<void> {
    this.userService.clearCachedUserData();
    await this.userService.signOut();
    this.router.navigate(['/sign-in'], {
      queryParams: {
        error: 'invalid_user_data',
        redirect: state.url
      }
    });
  }

  private async handleInsufficientPermissions(userData: AppUser, state: RouterStateSnapshot): Promise<void> {
    this.notificationService.error('Access Denied: You do not have permission to access this page.');
    this.router.navigate(['/dashboard'], {
      queryParams: {
        error: 'insufficient_permissions',
        requestedRoute: state.url
      }
    });
  }

  private async handleSecurityError(error: any, state: RouterStateSnapshot): Promise<void> {
    this.router.navigate(['/sign-in'], {
      queryParams: {
        error: 'security_error',
        redirect: state.url,
        message: error.message || 'Unknown error'
      }
    });
  }

  private startSessionMonitoring(): void {
    let inactivityTimer: any;

    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        this.handleInactivity();
      }, SECURITY_CONFIG.INACTIVITY_TIMEOUT);
    };

    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
      document.addEventListener(event, resetTimer, true);
    });

    resetTimer();
  }

  private handleInactivity(): void {
    const currentUser = this.userService.getCurrentUserSnapshot();
    if (currentUser) {
      console.log('[AuthGuard] Inactivity detected. Logging out user:', currentUser.uid);
      this.userService.signOut();
    }
  }

  private hasTwoFactorEnabled(userData: AppUser): boolean {
    return false; // Replace with actual logic
  }

}
