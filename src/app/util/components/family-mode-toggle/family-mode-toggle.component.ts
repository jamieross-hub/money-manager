import { Actions, ofType } from '@ngrx/effects';
import { Router } from '@angular/router';
import { Component, OnInit, ChangeDetectionStrategy, signal, inject, Input, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { Store } from '@ngrx/store';
import { toSignal } from '@angular/core/rxjs-interop';
import { AppState } from '../../../store/app.state';
import * as ProfileSelectors from '../../../store/profile/profile.selectors';
import * as BudgetsActions from '../../../store/budgets/budgets.actions';
import * as GoalsActions from '../../../store/goals/goals.actions';
import * as ProfileActions from '../../../store/profile/profile.actions';
import * as FamilySelectors from '../../../modules/family/store/family.selectors';
import * as TransactionsActions from '../../../store/transactions/transactions.actions';
import * as AccountsActions from '../../../store/accounts/accounts.actions';
import * as CategoriesActions from '../../../store/categories/categories.actions';
import { UserService } from '../../service/db/user.service';
import { FamilyService } from 'src/app/modules/family/services/family.service';
import { BreakpointService } from '../../service/breakpoint.service';
import { CommonSyncService } from '../../service/common-sync.service';
import { NotificationService } from '../../service/notification.service';
import { User, UserPreferences } from '../../models';
import { Family } from '../../models/family.model';
import { filter, take, delay } from 'rxjs';
import * as FamilyActions from '../../../modules/family/store/family.actions';
import { FamilyProcessorService } from '../../service/family-processor.service';

@Component({
  selector: 'app-family-mode-toggle',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatSlideToggleModule, MatProgressSpinnerModule, TranslateModule],
  templateUrl: './family-mode-toggle.component.html',
  styleUrl: './family-mode-toggle.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FamilyModeToggleComponent implements OnInit {
  private readonly store = inject(Store<AppState>);
  private readonly actions$ = inject(Actions);
  private readonly userService = inject(UserService);
  private readonly familyService = inject(FamilyService);
  private readonly syncService = inject(CommonSyncService);
  private readonly notificationService = inject(NotificationService);
  readonly breakpointService = inject(BreakpointService);
  private readonly familyProcessor = inject(FamilyProcessorService);

  // Signal Inputs
  readonly isFlat = input(false);

  // Read-only signals from store/services
  readonly userProfile = toSignal(this.store.select(ProfileSelectors.selectProfile));

  // Computed signals
  readonly isFamilyMode = computed(() => this.userProfile()?.preferences?.isFamilyMode || false);
  readonly isGuestMode = computed(() => this.userService.isGuestUser());

  readonly familyGroup = toSignal(this.store.select(FamilySelectors.selectFamily), { initialValue: null });
  readonly isUpdating = signal(false);
  private readonly pendingState = signal<boolean | null>(null);

  // Optimistic UI state
  readonly displayFamilyMode = computed(() => {
    const pending = this.pendingState();
    return pending !== null ? pending : this.isFamilyMode();
  });

  ngOnInit() {
    // Optionally trigger an initial load if needed, but standard logic 
    // usually preloads this upon login/startup if family mode is active.
    if (!this.userService.isGuestUser() && this.isFamilyMode() && !this.familyGroup()) {
       const userProfile = this.userProfile();
       if (userProfile?.preferences?.activeFamilyId) {
           this.familyService.getMyFamily(); // Warms up store if missing
       }
    }
  }

  private readonly router = inject(Router);

  async toggleFamilyMode(enabled: boolean): Promise<void> {
    const profile = this.userProfile();
    if (!profile || this.isUpdating()) return;

    // Optimistic update
    this.isUpdating.set(true);
    this.pendingState.set(enabled);

    try {
      // 1. Prepare subscriptions BEFORE dispatching to avoid race conditions
      const success$ = this.actions$.pipe(
        ofType(ProfileActions.updatePreferencesSuccess),
        filter((action: any) => action.profile.preferences?.isFamilyMode === enabled),
        take(1)
      );

      const failure$ = this.actions$.pipe(
        ofType(ProfileActions.updatePreferencesFailure),
        take(1)
      );

      // 2. Set up safety timeout
      const timeoutTimer = setTimeout(() => {
          this.isUpdating.set(false);
          this.pendingState.set(null);
          console.warn('Family mode toggle timed out');
      }, 10000); // 10s fallback

      // 5. Determine changes
      let changes: Partial<UserPreferences> = {
        isFamilyMode: enabled,
      };

      if (enabled && !profile.preferences?.activeFamilyId) {
        const families = this.familyService.getCachedFamiliesSync();
        if (families && families.length > 0) {
          changes = {
            ...changes,
            activeFamilyId: families[0].id
          };
        }
      }

      const activeIdForNavigation = changes.activeFamilyId || profile.preferences?.activeFamilyId;

      if (enabled && activeIdForNavigation) {
        this.store.dispatch(FamilyActions.loadFamily({ familyId: activeIdForNavigation }));
        this.familyProcessor.loadFamilyData(activeIdForNavigation);
      }

      // 6. Dispatch the preference update (now optimistic in reducer)
      this.applyPreferenceChanges(changes);

      // 7. OPTIMISTIC UI SWITCH: Perform the switch immediately for offline support
      const newContext = enabled ? 'family' : 'personal';
      
      this.store.dispatch(AccountsActions.setAccountsContext({ context: newContext }));
      this.store.dispatch(CategoriesActions.setCategoriesContext({ context: newContext }));

      // Clear non-dual-context stores so they re-fetch from the correct source
      this.store.dispatch(TransactionsActions.clearTransactions());
      this.store.dispatch(BudgetsActions.clearBudgets());
      this.store.dispatch(GoalsActions.clearGoals());

      // Navigate immediately
      const targetRoute = enabled 
        ? (activeIdForNavigation ? `/dashboard/family/dashboard/${activeIdForNavigation}` : '/dashboard/groups')
        : '/dashboard/home';

      this.router.navigate([targetRoute]).then(() => {
        this.isUpdating.set(false);
        this.pendingState.set(null);
      }).catch(err => {
        this.isUpdating.set(false);
        this.pendingState.set(null);
        if (err?.message !== 'Transition was skipped') throw err;
      });

      // 8. Background result handling (for notifications and state correction on failure)
      success$.subscribe(() => {
        clearTimeout(timeoutTimer);
        this.notificationService.info(`Family mode ${enabled ? 'enabled' : 'disabled'}`);
      });

      failure$.subscribe((error) => {
        clearTimeout(timeoutTimer);
        console.error('Failed to update family mode preference:', error);
        this.notificationService.error('Failed to update family mode preference');
        
        // On failure, we might need to reset the context back if the user hasn't switched again
        if (profile.uid) {
           this.store.dispatch(ProfileActions.loadProfile({ userId: profile.uid }));
        }
      });

    } catch (error) {
      console.error('Error toggling family mode:', error);
      this.notificationService.error('Failed to toggle family mode');
      this.isUpdating.set(false);
      this.pendingState.set(null);
    }

     //add vibration
    this.notificationService.buttonClick();

  }

  private applyPreferenceChanges(changes: Partial<UserPreferences>): void {
    const profile = this.userProfile();
    if (!profile) return;

    const currentPrefs = profile.preferences || {} as UserPreferences;
    const updatedPrefs: UserPreferences = {
      ...currentPrefs,
      ...changes,
      defaultCurrency: changes.defaultCurrency ?? currentPrefs.defaultCurrency ?? 'INR',
      timezone: changes.timezone ?? currentPrefs.timezone ?? 'UTC',
      notifications: changes.notifications ?? currentPrefs.notifications ?? true,
      emailUpdates: changes.emailUpdates ?? currentPrefs.emailUpdates ?? true,
      budgetAlerts: changes.budgetAlerts ?? currentPrefs.budgetAlerts ?? true,
    };

    const updatedUser: User = {
      ...profile,
      preferences: updatedPrefs,
      updatedAt: new Date()
    };

    this.store.dispatch(ProfileActions.updatePreferences({
      userId: profile.uid,
      preferences: {
        ...changes,
        isFamilyMode: changes.isFamilyMode
      }
    }));
  }
}
