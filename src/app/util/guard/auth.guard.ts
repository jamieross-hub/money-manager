import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { map, take, finalize, timeout, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { UserService } from '../service/db/user.service';
import { UserRole } from '../models/user.model';
import { LoaderService } from '../service/loader.service';
import { CommonSyncService } from '../service/common-sync.service';

import { LocalIndexDBStorageService } from '../service/indexdb-storage.service';
import { LocalStorageKey } from '../models/local-storage.model';

/**
 * Functional AuthGuard for minimalist routing protection.
 * Resolve immediately if auth state is cached, otherwise wait for Firebase initialization.
 */
export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);
  const userService = inject(UserService);
  const loaderService = inject(LoaderService);
  const syncService = inject(CommonSyncService);
  const storageService = inject(LocalIndexDBStorageService);

  // 1. Check for valid roles requirement
  const hasRolePermission = (): boolean => {
    const requiredRoles = route.data?.['roles'] as UserRole[];
    const user = userService.getCurrentUserSnapshot();
    if (!requiredRoles?.length) return true;
    return !!(user && requiredRoles.includes(user.role));
  };

  const cachedUser = userService.getCurrentUserSnapshot();
  const lastActiveUid = storageService.getItem<string>(LocalStorageKey.LAST_ACTIVE_UID);

  // 2. FAST PATH: Already authenticated, guest mode, OR use synchronous cache
  // If we have a cached user, we trust it immediately to prevent the "keep on loading" issue.
  if (auth.currentUser || userService.isGuestUser() || cachedUser || lastActiveUid) {
    // If we only have lastActiveUid but no cachedUser, we should still let them through
    // The rest of the app will try to fetch the profile from IDB or network
    if (hasRolePermission() || !cachedUser) {
      loaderService.hide();
      return true;
    }
    
    // Unauthorized: Redirect to dashboard
    return router.createUrlTree(['/dashboard'], { queryParams: { error: 'unauthorized' } });
  }

  // 3. SLOW PATH: Only if we have NO session info at all (new visitor or logged out)
  loaderService.show();
  return authState(auth).pipe(
    timeout(15000), // Wait max 15 seconds for Firebase response (can be slow offline on older devices)
    take(1),
    map(user => {
      // If user is authenticated or guest mode is active
      if (user || userService.isGuestUser()) {
        if (hasRolePermission()) return true;
        return router.createUrlTree(['/dashboard'], { queryParams: { error: 'unauthorized' } });
      }

      // Truly unauthenticated: Redirect to sign-in
      return router.createUrlTree(['/sign-in'], { 
        queryParams: { redirect: state.url } 
      });
    }),
    catchError(() => {
      // On timeout or error, redirect to sign-in
      return of(router.createUrlTree(['/sign-in'], { 
        queryParams: { redirect: state.url, error: 'network_timeout' } 
      }));
    }),
    finalize(() => loaderService.hide())
  );
};
