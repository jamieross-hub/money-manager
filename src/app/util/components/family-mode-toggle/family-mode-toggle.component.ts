import { Actions, ofType } from '@ngrx/effects';
import { Router } from '@angular/router';
import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, signal, inject, Input, input, computed } from '@angular/core';
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
import { filter, take, delay, Subject, takeUntil } from 'rxjs';
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
export class FamilyModeToggleComponent implements OnInit, OnDestroy {
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
  private isProcessing = false;
  private readonly pendingState = signal<boolean | null>(null);
  private readonly destroy$ = new Subject<void>();

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
    // Guard against rapid clicks or missing profile
    if (!profile || this.isUpdating() || this.isProcessing) return;

    // 1. Immediate UI Feedback (Vibration & Loading state)
    this.notificationService.buttonClick();
    this.isUpdating.set(true);
    this.isProcessing = true;
    this.pendingState.set(enabled);

    try {
      // 2. Prepare subscriptions for background result
      const success$ = this.actions$.pipe(
        ofType(ProfileActions.updatePreferencesSuccess),
        filter((action: any) => action.profile.preferences?.isFamilyMode === enabled),
        take(1),
        takeUntil(this.destroy$)
      );

      const failure$ = this.actions$.pipe(
        ofType(ProfileActions.updatePreferencesFailure),
        take(1),
        takeUntil(this.destroy$)
      );

      const timeoutTimer = setTimeout(() => {
          this.isUpdating.set(false);
          this.isProcessing = false;
          this.pendingState.set(null);
      }, 10000);

      // 3. Determine changes
      let changes: Partial<UserPreferences> = {
        isFamilyMode: enabled,
      };

      if (enabled && !profile.preferences?.activeFamilyId) {
        const families = this.familyService.getCachedFamiliesSync();
        if (families && families.length > 0) {
          changes.activeFamilyId = families[0].id;
        }
      }

      const activeIdForNavigation = changes.activeFamilyId || profile.preferences?.activeFamilyId;

      // 4. Dispatch the preference update (Optimistic in reducer)
      this.applyPreferenceChanges(changes);

      // 5. OPTIMISTIC UI SWITCH: Load family data and switch context immediately
      if (enabled && activeIdForNavigation) {
        this.store.dispatch(FamilyActions.loadFamily({ familyId: activeIdForNavigation }));
        this.familyProcessor.loadFamilyData(activeIdForNavigation);
      }

      const newContext = enabled ? 'family' : 'personal';
      this.store.dispatch(AccountsActions.setAccountsContext({ context: newContext }));
      this.store.dispatch(CategoriesActions.setCategoriesContext({ context: newContext }));

      // Clear non-dual-context stores
      this.store.dispatch(TransactionsActions.clearTransactions());
      this.store.dispatch(BudgetsActions.clearBudgets());
      this.store.dispatch(GoalsActions.clearGoals());

      // 6. Navigate immediately
      const targetRoute = enabled 
        ? (activeIdForNavigation ? `/dashboard/family/dashboard/${activeIdForNavigation}` : '/dashboard/groups')
        : '/dashboard/home';

      await this.router.navigate([targetRoute]).catch(err => {
        if (err?.message !== 'Transition was skipped') throw err;
      });

      // 7. Cleanup optimistic state
      this.isUpdating.set(false);
      this.isProcessing = false;
      this.pendingState.set(null);

      // 8. Background result handling
      success$.subscribe(() => {
        clearTimeout(timeoutTimer);
        this.notificationService.info(`Family mode ${enabled ? 'enabled' : 'disabled'}`);
      });

      failure$.subscribe((error) => {
        clearTimeout(timeoutTimer);
        console.error('Failed to update family mode preference:', error);
        this.notificationService.error('Failed to update family mode preference');
        if (profile.uid) {
           this.store.dispatch(ProfileActions.loadProfile({ userId: profile.uid }));
        }
      });

    } catch (error) {
      console.error('Error toggling family mode:', error);
      this.notificationService.error('Failed to toggle family mode');
      this.isUpdating.set(false);
      this.isProcessing = false;
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
      emailUpdates: changes.emailUpdates ?? currentPrefs.emailUpdates ?? true
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
