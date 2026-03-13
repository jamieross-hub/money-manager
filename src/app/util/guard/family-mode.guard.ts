import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { Store } from '@ngrx/store';
import { AppState } from '../../store/app.state';
import * as ProfileSelectors from '../../store/profile/profile.selectors';
import { take, map } from 'rxjs/operators';

/**
 * Redirects to Family Dashboard if Family Mode is enabled.
 * Used on the root dashboard/home route to ensure users land in the correct mode.
 */
export const familyModeGuard: CanActivateFn = () => {
  const store = inject(Store<AppState>);
  const router = inject(Router);

  return store.select(ProfileSelectors.selectUserPreferences).pipe(
    take(1),
    map(prefs => {
      if (prefs?.isFamilyMode) {
        // If an active family is already selected, go directly to its dashboard
        if (prefs.activeFamilyId) {
          return router.createUrlTree(['/dashboard/family/dashboard', prefs.activeFamilyId]);
        }
        // Otherwise go to group selection
        return router.createUrlTree(['/dashboard/family']);
      }
      // Stay on current route (Personal Mode / Chat)
      return true;
    })
  );
};
