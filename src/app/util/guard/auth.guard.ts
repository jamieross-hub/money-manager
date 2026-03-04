import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { map, take, finalize } from 'rxjs/operators';
import { UserService } from '../service/db/user.service';
import { UserRole } from '../models/user.model';
import { LoaderService } from '../service/loader.service';

/**
 * Functional AuthGuard for minimalist routing protection.
 * Resolve immediately if auth state is cached, otherwise wait for Firebase initialization.
 */
export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);
  const userService = inject(UserService);
  const loaderService = inject(LoaderService);

  // 1. Check for valid roles requirement
  const hasRolePermission = (): boolean => {
    const requiredRoles = route.data?.['roles'] as UserRole[];
    const user = userService.getCurrentUserSnapshot();
    if (!requiredRoles?.length) return true;
    return !!(user && requiredRoles.includes(user.role));
  };

  // 2. FAST PATH: Already authenticated or guest mode
  if (auth.currentUser || userService.isGuestUser()) {
    if (hasRolePermission()) return true;
    
    // Unauthorized: Redirect to dashboard
    return router.createUrlTree(['/dashboard'], { queryParams: { error: 'unauthorized' } });
  }

  // 3. SLOW PATH: Wait for Firebase Auth initialization
  loaderService.show();
  return authState(auth).pipe(
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
    finalize(() => loaderService.hide())
  );
};
