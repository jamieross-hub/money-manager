import { Component, OnInit, ChangeDetectionStrategy, signal, inject, effect, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Store } from '@ngrx/store';
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
  private readonly userService = inject(UserService);
  private readonly familyService = inject(FamilyService);
  private readonly syncService = inject(CommonSyncService);
  private readonly notificationService = inject(NotificationService);
  readonly breakpointService = inject(BreakpointService);
  @Input() isFlat: boolean = false;

  readonly userProfile = signal<User | null>(null);
  readonly familyGroup = signal<Family | null>(null);
  readonly isFamilyMode = signal(false);
  private ignoreLoader = false;

  constructor() {
    // React to store profile changes
    this.store.select(ProfileSelectors.selectProfile).subscribe(profile => {
      if (profile) {
        this.userProfile.set(profile);
        this.isFamilyMode.set(profile.preferences?.isFamilyMode || false);
      }
    });
  }

  ngOnInit() {
    this.loadFamily();
  }

  private loadFamily(): void {
    this.familyService.getMyFamily().then(family => {
      this.familyGroup.set(family);
    }).catch(() => {
      this.familyGroup.set(null);
    });
  }

  isGuestMode(): boolean {
    return this.userService.isGuestUser();
  }

  async toggleFamilyMode(enabled: boolean): Promise<void> {
    const profile = this.userProfile();
    if (!profile) return;

    this.ignoreLoader = true;
    const familyId = this.familyService.activeFamilyId();

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

      // Wait for UserService to pick up the new mode before syncing
      this.userService.userAuth$.pipe(
        filter(u => u?.preferences?.isFamilyMode === enabled),
        take(1),
        delay(100)
      ).subscribe(() => {
        this.syncService.syncAll().subscribe();
        window.location.reload();
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

    this.userProfile.set(updatedUser);
    
    if (changes.isFamilyMode !== undefined) {
      this.isFamilyMode.set(changes.isFamilyMode);
    }

    if (this.userService.isGuestUser()) {
      this.userService.storageService.setItem(`user-data-${updatedUser.uid}`, updatedUser);
      this.userService.userAuth$.next(updatedUser);
    } else {
      this.store.dispatch(ProfileActions.updatePreferences({
        userId: profile.uid,
        preferences: changes
      }));
    }
  }
}
