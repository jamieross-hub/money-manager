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

      // 3. Handle success
      success$.subscribe(() => {
        clearTimeout(timeoutTimer);
        this.notificationService.success(`Family mode ${enabled ? 'enabled' : 'disabled'}`);
        
        // Clear all stores for personal/family switch to avoid data mixing
        // We do this on SUCCESS to ensure we don't clear if update fails
        this.store.dispatch(TransactionsActions.clearTransactions());
        this.store.dispatch(AccountsActions.clearAccounts());
        this.store.dispatch(CategoriesActions.clearCategories());
        this.store.dispatch(BudgetsActions.clearBudgets());
        this.store.dispatch(GoalsActions.clearGoals());

        // Re-load data for the new mode
        const userId = profile.uid;
        this.store.dispatch(TransactionsActions.loadTransactions({ userId }));
        this.store.dispatch(AccountsActions.loadAccounts({ userId }));
        this.store.dispatch(CategoriesActions.loadCategories({ userId }));
        this.store.dispatch(BudgetsActions.loadBudgets({ userId }));
        this.store.dispatch(GoalsActions.loadGoals({ userId }));

        // Determine the target route based on the new state
        const activeId = changes.activeFamilyId || profile.preferences?.activeFamilyId;
        const targetRoute = enabled 
          ? (activeId ? `/dashboard/family/dashboard/${activeId}` : '/dashboard/groups')
          : '/dashboard/home';

        // Give store a moment to propagate state before clearing loader/pending UI
        this.isUpdating.set(false);
        this.pendingState.set(null);
        
        this.router.navigate([targetRoute]).catch(err => {
          if (err?.message !== 'Transition was skipped') throw err;
        });
      });

      // 4. Handle failure
      failure$.subscribe((error) => {
        clearTimeout(timeoutTimer);
        console.error('Failed to update family mode preference:', error);
        this.notificationService.error('Failed to update family mode preference');
        this.isUpdating.set(false);
        this.pendingState.set(null);
        if (profile.uid) {
           this.store.dispatch(ProfileActions.loadProfile({ userId: profile.uid }));
        }
      });

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

      if (enabled && changes.activeFamilyId) {
        this.store.dispatch(FamilyActions.loadFamily({ familyId: changes.activeFamilyId }));
        this.familyProcessor.loadFamilyData(changes.activeFamilyId);
      }

      // 6. Finally dispatch
      this.applyPreferenceChanges(changes);

    } catch (error) {
      console.error('Error toggling family mode:', error);
      this.notificationService.error('Failed to toggle family mode');
      this.isUpdating.set(false);
      this.pendingState.set(null);
    }
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
