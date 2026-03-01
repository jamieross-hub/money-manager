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

    // ── Offline-first: Firebase keeps auth state in IndexedDB. auth.currentUser
    // is populated synchronously from that cache even when fully offline.
    // We resolve immediately from it and skip waiting for the authState observable,
    // which requires a network round-trip to fully initialise.
    const immediateUser = this.auth.currentUser;
    if (immediateUser || this.userService.isGuestUser()) {
      console.log('[AuthGuard] Resolved from cached auth state immediately');
      this.backgroundSecurityCheck(route, state, immediateUser as User);
      // loaderService.hide() is called inside backgroundSecurityCheck's finally block
      return of(true);
    }

    // No synchronous user found — wait for authState (network may be needed).
    return authState(this.auth).pipe(
      take(1),
      map(firebaseUser => {
        if (firebaseUser || this.userService.isGuestUser()) {
          this.backgroundSecurityCheck(route, state, firebaseUser as User);
          return true;
        }

        // Truly unauthenticated — auto-enable guest mode.
        this.handleUnauthenticatedUser(state);
        return false;
      }),
      // 20s timeout: Firebase can be slow resolving persistence on a bad connection.
      // On timeout, fall back to auth.currentUser (synchronous cache) one more time.
      timeout(20000),
      catchError(error => {
        if (error?.name === 'TimeoutError') {
          console.warn('[AuthGuard] authState timed out — falling back to cached auth state');
          const cachedUser = this.auth.currentUser;
          if (cachedUser || this.userService.isGuestUser()) {
            this.backgroundSecurityCheck(route, state, cachedUser as User);
            this.loaderService.hide();
            return of(true);
          }
        }
        console.error('[AuthGuard] Timeout or error:', error);
        this.loaderService.hide();
        this.router.navigate(['/sign-in'], {
          queryParams: { error: 'auth_timeout', redirect: state.url }
        });
        return of(false);
      }),
      finalize(() => {
        // backgroundSecurityCheck handles hide() in its finally block.
      })
    );
  }

  private backgroundSecurityCheck(route: ActivatedRouteSnapshot, state: RouterStateSnapshot, firebaseUser: User): void {
    setTimeout(async () => {
      try {
        if (firebaseUser && !this.sessionStartTime.has(firebaseUser.uid)) {
          this.updateSessionTimestamp(firebaseUser.uid);
        }

        // Guest users: nothing else to check.
        if (this.userService.isGuestUser()) {
          this.loaderService.hide();
          return;
        }

        const isOffline = !this.commonSyncService.isCurrentlyOnline();

        // ── Session expiry: skip while offline.
        // If the device goes offline for a while, the in-memory session timer
        // would expire but the user cannot re-authenticate without a connection.
        // Suspend the expiry check until back online.
        if (!isOffline && firebaseUser && this.isSessionExpired(firebaseUser.uid)) {
          await this.handleSessionExpired(firebaseUser, state);
          return;
        }

        // ── User data: use IndexedDB cache when offline.
        let userData: AppUser | null;
        if (isOffline) {
          userData = this.userService.getCachedUserData(firebaseUser?.uid);
          console.log('[AuthGuard] Offline mode - using cached user data:', userData ? 'found' : 'not found');
        } else {
          userData = await this.userService.getCurrentUser();
        }

        if (!userData) {
          if (isOffline) {
            // No cache but we have a valid Firebase token locally — allow access.
            console.warn('[AuthGuard] Offline - no cached user data, allowing access with Firebase token');
            this.updateSessionTimestamp(firebaseUser?.uid);
            return;
          } else {
            await this.handleInvalidUserData(firebaseUser, state);
            return;
          }
        }

        // ── Route permissions: getIdTokenResult() makes a network call.
        // Skip it when offline and grant access based on cached data.
        const hasPermission = await this.checkRoutePermissions(route, userData, firebaseUser, isOffline);
        if (!hasPermission) {
          const routeData = route.data as RoutePermission;
          // Skip email-verification enforcement offline (can't sign out & back in anyway).
          if (!isOffline && routeData?.requireEmailVerification && !firebaseUser.emailVerified) {
            this.notificationService.error('Please verify your email address.');
            await this.userService.signOut();
            this.router.navigate(['/sign-in']);
            return;
          }

          await this.handleInsufficientPermissions(userData, state);
          return;
        }

        this.updateSessionTimestamp(firebaseUser?.uid);
      } catch (error) {
        console.error('[AuthGuard] Background error:', error);

        // Any error while offline → allow access. The user cannot help the
        // situation by logging in again — they have no connectivity.
        if (!this.commonSyncService.isCurrentlyOnline()) {
          console.warn('[AuthGuard] Offline - error in background check, allowing access');
          if (firebaseUser?.uid) this.updateSessionTimestamp(firebaseUser.uid);
          return;
        }

        // Network-related errors even when navigator.onLine says true
        // (can happen briefly during network transitions).
        const errorCode: string = (error as any)?.code ?? '';
        const isNetworkError =
          errorCode.includes('network') ||
          errorCode.includes('unavailable') ||
          (error as any)?.name === 'TimeoutError' ||
          (error as any)?.message?.toLowerCase().includes('network');

        if (isNetworkError) {
          console.warn('[AuthGuard] Network error in background check, allowing access:', errorCode);
          if (firebaseUser?.uid) this.updateSessionTimestamp(firebaseUser.uid);
          return;
        }

        await this.handleSecurityError(error, state);
      } finally {
        this.loaderService.hide();
      }
    }, 0);
  }

  private async checkRoutePermissions(
    route: ActivatedRouteSnapshot,
    userData: AppUser,
    firebaseUser: User,
    isOffline = false
  ): Promise<boolean> {
    const routeData = route.data as RoutePermission;

    // ── getIdTokenResult() makes a network call to validate/refresh the token.
    // When offline, skip it and default isAdmin to false (safe default).
    let isAdmin = false;
    if (!isOffline) {
      try {
        const idTokenResult = await firebaseUser.getIdTokenResult();
        isAdmin = !!idTokenResult.claims['admin'];
      } catch (err) {
        console.warn('[AuthGuard] getIdTokenResult failed (network issue?), defaulting isAdmin=false:', err);
        // Non-fatal: continue without admin escalation.
      }
    }

    if (isAdmin) {
      return true;
    }

    // Skip email-verification check offline to avoid forcing sign-out.
    if (!isOffline && routeData?.requireEmailVerification && !firebaseUser.emailVerified) {
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

    // Pause the inactivity timer when the device goes offline and resume on reconnect.
    // Going offline (e.g. losing signal) must not be treated as user inactivity.
    window.addEventListener('online', resetTimer);
    window.addEventListener('offline', () => clearTimeout(inactivityTimer));

    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
      document.addEventListener(event, resetTimer, true);
    });

    resetTimer();
  }

  private handleInactivity(): void {
    // Never log out while offline — the user cannot re-authenticate without a connection.
    if (!this.commonSyncService.isCurrentlyOnline()) {
      console.log('[AuthGuard] Inactivity timeout skipped: device is offline');
      return;
    }

    const currentUser = this.userService.getCurrentUserSnapshot();
    // Skip guest users — they are always offline-only
    if (currentUser && currentUser.uid !== 'offline-guest') {
      console.log('[AuthGuard] Inactivity detected. Logging out user:', currentUser.uid);
      this.userService.signOut();
    }
  }

  private hasTwoFactorEnabled(userData: AppUser): boolean {
    return false; // Replace with actual logic
  }

}
