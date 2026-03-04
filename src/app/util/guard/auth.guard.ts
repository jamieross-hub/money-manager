import { Injectable } from "@angular/core";
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
  CanActivateChild
} from "@angular/router";
import { Observable, of } from "rxjs";
import { catchError, map, take } from "rxjs/operators";
import { UserService } from "../service/db/user.service";
import { Auth, authState } from '@angular/fire/auth';
import { UserRole } from "../models/user.model";
import { LoaderService } from "../service/loader.service";

/**
 * Optimized AuthGuard for snappy navigation.
 * Prioritizes synchronous checks for logged-in users to eliminate flickering/loading states.
 */
@Injectable({
  providedIn: "root",
})
export class AuthGuard implements CanActivate, CanActivateChild {

  constructor(
    private router: Router,
    private userService: UserService,
    private loaderService: LoaderService,
    private auth: Auth
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
    return this.checkAuth(route, state);
  }

  canActivateChild(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
    return this.checkAuth(route, state);
  }

  /**
   * Core authentication check logic
   */
  private checkAuth(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
    // 1. FAST PATH: Synchronous check (Firebase holds auth state in local persistence)
    // This allows instant navigation for already authenticated users.
    if (this.auth.currentUser || this.userService.isGuestUser()) {
      return of(this.hasPermission(route));
    }

    // 2. SLOW PATH: Wait for Firebase Initialization
    // Only triggered on hard refreshes or when the authentication state is unknown.
    this.loaderService.show();
    return authState(this.auth).pipe(
      take(1),
      map(user => {
        this.loaderService.hide();
        if (user || this.userService.isGuestUser()) {
          return this.hasPermission(route);
        }
        
        // Not logged in: Redirect to sign-in with original URL for return navigation
        this.router.navigate(['/sign-in'], { 
          queryParams: { redirect: state.url } 
        });
        return false;
      }),
      catchError((err) => {
        console.error('[AuthGuard] Auth check error:', err);
        this.loaderService.hide();
        this.router.navigate(['/sign-in']);
        return of(false);
      })
    );
  }

  /**
   * Role-based permission check
   */
  private hasPermission(route: ActivatedRouteSnapshot): boolean {
    const requiredRoles = route.data?.['roles'] as UserRole[];
    const user = this.userService.getCurrentUserSnapshot();

    // If no roles are defined for the route, anyone authenticated can enter
    if (!requiredRoles?.length) {
      return true;
    }

    // Verify user role matches route requirements
    if (user && requiredRoles.includes(user.role)) {
      return true;
    }

    // Insufficient permissions: Redirect to dashboard
    console.warn('[AuthGuard] Access denied: User lacks required role', { required: requiredRoles, actual: user?.role });
    this.router.navigate(['/dashboard'], { 
      queryParams: { error: 'unauthorized_access' } 
    });
    return false;
  }
}
