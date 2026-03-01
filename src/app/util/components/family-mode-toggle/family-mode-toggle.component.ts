import { Actions, ofType } from '@ngrx/effects';
import { Component, OnInit, ChangeDetectionStrategy, signal, inject, Input, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Store } from '@ngrx/store';
import { toSignal } from '@angular/core/rxjs-interop';
import { AppState } from '../../../store/app.state';
import * as ProfileSelectors from '../../../store/profile/profile.selectors';
import * as ProfileActions from '../../../store/profile/profile.actions';
import * as TransactionsActions from '../../../store/transactions/transactions.actions';
import * as AccountsActions from '../../../store/accounts/accounts.actions';
import * as CategoriesActions from '../../../store/categories/categories.actions';
import * as BudgetsActions from '../../../store/budgets/budgets.actions';
import * as GoalsActions from '../../../store/goals/goals.actions';
import { UserService } from '../../service/db/user.service';
import { FamilyService } from 'src/app/modules/family/services/family.service';
import { BreakpointService } from '../../service/breakpoint.service';
import { CommonSyncService } from '../../service/common-sync.service';
import { NotificationService } from '../../service/notification.service';
import { User, UserPreferences } from '../../models';
import { Family } from '../../models/family.model';
import { filter, take, delay } from 'rxjs';

@Component({
  selector: 'app-family-mode-toggle',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatSlideToggleModule],
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

  // Signal Inputs
  readonly isFlat = input(false);

  // Read-only signals from store/services
  readonly userProfile = toSignal(this.store.select(ProfileSelectors.selectProfile));

  // Computed signals
  readonly isFamilyMode = computed(() => this.userProfile()?.preferences?.isFamilyMode || false);
  readonly isGuestMode = computed(() => this.userService.isGuestUser());

  readonly familyGroup = signal<Family | null>(null);
  private ignoreLoader = false;

  ngOnInit() {
    if (!this.userService.isGuestUser()) {
      this.loadFamily();
    }
  }

  private loadFamily(): void {
    this.familyService.getMyFamily().then(family => {
      this.familyGroup.set(family);
    }).catch(() => {
      this.familyGroup.set(null);
    });
  }

  async toggleFamilyMode(enabled: boolean): Promise<void> {
    const profile = this.userProfile();
    if (!profile) return;

    this.ignoreLoader = true;

    try {
      await this.applyPreferenceChanges({
        isFamilyMode: enabled,
      });

      this.notificationService.success(`Family mode ${enabled ? 'enabled' : 'disabled'}`);

      // Clear all stores for personal/family switch to avoid data mixing
      this.store.dispatch(TransactionsActions.clearTransactions());
      this.store.dispatch(AccountsActions.clearAccounts());
      this.store.dispatch(CategoriesActions.clearCategories());
      this.store.dispatch(BudgetsActions.clearBudgets());
      this.store.dispatch(GoalsActions.clearGoals());

      this.actions$.pipe(
        ofType(ProfileActions.updatePreferencesSuccess),
        filter(action => action.profile.preferences?.isFamilyMode === enabled),
        take(1),
      ).subscribe(() => {
       // window.location.reload();
      });
    } catch (error) {
      console.error('Error toggling family mode:', error);
      this.notificationService.error('Failed to toggle family mode');
    }
  }

  private async applyPreferenceChanges(changes: Partial<UserPreferences>): Promise<void> {
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
