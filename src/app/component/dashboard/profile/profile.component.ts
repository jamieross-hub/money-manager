import { Component, ChangeDetectionStrategy, signal, computed, inject, effect, WritableSignal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Action } from '@ngrx/store';
import { Actions, ofType } from '@ngrx/effects';
import { FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { Auth } from '@angular/fire/auth';
import { UserService } from 'src/app/util/service/db/user.service';
import { Router, RouterLink } from '@angular/router';
import { TranslationService, Language } from 'src/app/util/service/translation.service';
import { User, UserPreferences } from 'src/app/util/models';
import { NotificationService } from 'src/app/util/service/notification.service';
import { ValidationService } from 'src/app/util/service/validation.service';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from 'src/app/util/components/confirm-dialog/confirm-dialog.component';
import dayjs from 'dayjs';
import { Store } from '@ngrx/store';
import { DateService } from 'src/app/util/service/date.service';
import { SecurityService } from 'src/app/util/service/security.service';
import { AppState } from '../../../store/app.state';
import * as ProfileActions from '../../../store/profile/profile.actions';
import * as ProfileSelectors from '../../../store/profile/profile.selectors';
import * as TransactionsActions from '../../../store/transactions/transactions.actions';
import * as AccountsActions from '../../../store/accounts/accounts.actions';
import * as CategoriesActions from '../../../store/categories/categories.actions';
import * as BudgetsActions from '../../../store/budgets/budgets.actions';
import * as GoalsActions from '../../../store/goals/goals.actions';
import { filter, take, delay, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import {
  APP_CONFIG,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  TIMEZONES
} from 'src/app/util/config/config';
import {
  UserRole,
  CurrencyCode,
} from 'src/app/util/config/enums';
import { QuickActionsFabConfig } from 'src/app/util/components/floating-action-buttons/quick-actions-fab/quick-actions-fab.component';
import { BackupRestoreService } from 'src/app/util/service/backupRestore.service';
import { ThemeSwitchingService } from 'src/app/util/service/theme-switching.service';
import { ThemeType } from 'src/app/util/models/theme.model';
import { FamilyService } from 'src/app/modules/family/services/family.service';
import { Family } from 'src/app/util/models/family.model';
import { FamilyCreateDialogComponent } from 'src/app/modules/family/dialogs/family-create-dialog/family-create-dialog.component';
import { FamilyJoinDialogComponent } from 'src/app/modules/family/dialogs/family-join-dialog/family-join-dialog.component';
import { MatBottomSheet, MatBottomSheetModule } from '@angular/material/bottom-sheet';


import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatExpansionModule } from '@angular/material/expansion';
import { TranslateModule } from '@ngx-translate/core';
import { QuickActionsFabComponent } from 'src/app/util/components/floating-action-buttons/quick-actions-fab/quick-actions-fab.component';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';
import { ThemeToggleComponent } from 'src/app/util/components/theme-toggle/theme-toggle.component';
import { SsrService } from 'src/app/util/service/ssr.service';
import { of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { DestroyRef } from '@angular/core';

import { CommonSyncService } from 'src/app/util/service/common-sync.service';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    TranslateModule,
    MatExpansionModule,
    // ThemeToggleComponent,
    MatBottomSheetModule,
    RouterLink,
    MatMenuModule,
    MatDividerModule,
],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileComponent {
  // Injected services via inject()
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);
  private readonly validationService = inject(ValidationService);
  private readonly dialog = inject(MatDialog);
  private readonly bottomSheet = inject(MatBottomSheet);
  private readonly dateService = inject(DateService);
  private readonly store = inject(Store<AppState>);
  readonly breakpointService = inject(BreakpointService);
  private readonly userService = inject(UserService);
  private readonly translationService = inject(TranslationService);
  private readonly familyService = inject(FamilyService);
  private readonly backupRestoreService = inject(BackupRestoreService);
  readonly themeSwitchingService = inject(ThemeSwitchingService);
  private readonly securityService = inject(SecurityService);
  private readonly ssrService = inject(SsrService);
  private readonly syncService = inject(CommonSyncService);
  private readonly destroyRef = inject(DestroyRef);

  // ─── Signals (State) ───────────────────────────────────────────────
  private readonly storeProfile = toSignal(this.store.select(ProfileSelectors.selectProfile));
  private readonly storeLoading = toSignal(this.store.select(ProfileSelectors.selectProfileLoading), { initialValue: false });
  private readonly storeError = toSignal(this.store.select(ProfileSelectors.selectProfileError), { initialValue: null });

  private ignoreLoader = false;
  readonly isLoading = computed(() => (this.storeLoading() && !this.ignoreLoader) || this.isActionLoading());
  private readonly isActionLoading: WritableSignal<boolean> = signal(false);

  readonly isGoogleLoading: WritableSignal<boolean> = signal(false);
  readonly isLogoutLoading: WritableSignal<boolean> = signal(false);
  readonly isEditingPersonal: WritableSignal<boolean> = signal(false);
  readonly isEditingPreferences: WritableSignal<boolean> = signal(false);
  readonly userProfile: WritableSignal<User | null> = signal<User | null>(null);
  readonly familyGroups: WritableSignal<Family[]> = signal<Family[]>([]);
  readonly activeFamilyId = this.familyService.activeFamilyId;
  readonly familyMembers: WritableSignal<any[]> = signal<any[]>([]);
  readonly isFamilyLoading: WritableSignal<boolean> = signal(false);
  readonly currentTheme = this.themeSwitchingService.currentTheme;
  readonly showPinSetup: WritableSignal<boolean> = signal(false);
  readonly isFamilyMode: WritableSignal<boolean> = signal(false);
  readonly newPinControl = new FormControl('', [Validators.required, Validators.pattern(/^\d{4}$/)]);

  private readonly PREFERENCE_TOGGLES = [
    'notifications',
    'emailUpdates',
    'budgetAlerts',
    'categoryListViewMode',
    'pinEnabled'
  ];

  private readonly BASIC_INFO_FIELDS = [
    'firstName',
    'lastName',
    'phone',
    'dateOfBirth',
    'occupation',
    'monthlyIncome'
  ];

  private readonly EDITABLE_PREFERENCES = [
    'defaultCurrency',
    'timezone',
    'language',
    'country',
    'appView'
  ];



  readonly quickActionsFabConfig = signal<QuickActionsFabConfig>({
    title: 'Profile',
    mainButtonIcon: 'settings',
    mainButtonColor: 'primary',
    mainButtonTooltip: 'Settings',
    showLabels: false,
    animations: true,
    autoHide: false,
    autoHideDelay: 3000,
    theme: 'auto',
    actions: [],
  });

  // ─── Computed Signals ──────────────────────────────────────────────
  readonly fullName = computed(() => {
    const profile = this.userProfile();
    if (profile) {
      return `${profile.firstName} ${profile.lastName}`.trim() || 'User';
    }
    return 'User';
  });

  readonly memberCount = computed(() => this.familyMembers().length);

  readonly isAdmin = computed(() => {
    const activeId = this.activeFamilyId();
    const activeFamily = this.familyGroups().find(f => f.id === activeId);
    const user = this.userProfile();
    return activeFamily && user && activeFamily.ownerUserId === user.uid;
  });

  readonly activeFamilyName = computed(() => {
    const activeId = this.activeFamilyId();
    const family = this.familyGroups().find(f => f.id === activeId);
    return family ? family.name : null;
  });

  // ─── Theme Selection ──────────────────────────────────────────────
  readonly themePreference = this.themeSwitchingService.themePreference;
  readonly isSpecialTheme = computed(() => {
    return !['light-theme', 'dark-theme', 'system'].includes(this.themePreference() || '');
  });

  async selectTheme(theme: 'light-theme' | 'dark-theme' | 'midnight-theme' | 'system'): Promise<void> {
    this.themeSwitchingService.setTheme(theme);
    await this.applyPreferenceChanges({ theme: theme });
    this.notificationService.info(`Theme set to ${theme === 'system' ? 'System' : theme === 'dark-theme' ? 'Dark' : theme === 'midnight-theme' ? 'Midnight' : 'Light'}`);
  }

  // ─── Reactive Form ────────────────────────────────────────────────
  readonly profileForm: FormGroup;

  // ─── Static Config ────────────────────────────────────────────────
  readonly currencies = Object.values(CurrencyCode);
  readonly defaultCurrency = APP_CONFIG.REGIONAL.CURRENCY_DEFAULT;
  readonly validation = APP_CONFIG.VALIDATION;
  timezones = [...TIMEZONES];

  readonly countries = Object.entries(APP_CONFIG.REGIONAL.COUNTRY_MAPPING).map(([code, config]) => ({
    code,
    languageName: (config as any).languages?.[0]?.name || code,
    countryName: (config as any).countryName || code,
    language: (config as any).languages?.[0]?.code,
    currency: (config as any).currency
  })).sort((a, b) => a.countryName.localeCompare(b.countryName));

  readonly languages = (() => {
    const allLangs = Object.values(APP_CONFIG.REGIONAL.COUNTRY_MAPPING)
      .flatMap(config => (config as any).languages || []);
    const seen = new Set<string>();
    return allLangs
      .filter(lang => {
        if (seen.has(lang.code)) return false;
        seen.add(lang.code);
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  })();

  readonly appViewOptions = [
    { value: 'WEEKLY', label: 'PROFILE.APP_VIEW_WEEKLY' },
    { value: 'MONTHLY', label: 'PROFILE.APP_VIEW_MONTHLY' },
    { value: 'YEARLY', label: 'PROFILE.APP_VIEW_YEARLY' }
  ];

  constructor() {
    this.ensureCurrentTimezoneInList();

    // Initialize form
    this.profileForm = this.fb.group({
      firstName: [{ value: '', disabled: true }, this.validationService.getProfileNameValidators()],
      lastName: [{ value: '', disabled: true }, this.validationService.getProfileNameValidators()],
      email: [{ value: '', disabled: true }, this.validationService.getProfileEmailValidators()],
      phone: [{ value: '', disabled: true }, this.validationService.getProfilePhoneValidators()],
      dateOfBirth: [{ value: '', disabled: true }],
      occupation: [{ value: '', disabled: true }, this.validationService.getProfileOccupationValidators()],
      monthlyIncome: [{ value: 0, disabled: true }, this.validationService.getProfileIncomeValidators()],
      preferences: this.fb.group({
        defaultCurrency: [{ value: this.defaultCurrency, disabled: true }, Validators.required],
        timezone: [{ value: 'UTC', disabled: true }, Validators.required],
        language: [{ value: '', disabled: true }, Validators.required],
        country: [{ value: 'IN', disabled: true }],
        notifications: [{ value: true, disabled: true }],
        emailUpdates: [{ value: true, disabled: true }],
        budgetAlerts: [{ value: true, disabled: true }],
        categoryListViewMode: [{ value: false, disabled: true }],
        appView: [{ value: 'MONTHLY', disabled: true }],
        pinEnabled: [{ value: false, disabled: true }],
      }),
    });


    // Dispatch profile load
    const uid = this.userService.isGuestUser()
      ? 'offline-guest'
      : (this.store.selectSignal(ProfileSelectors.selectProfile)()?.uid ?? null);
    if (uid) {
      this.store.dispatch(ProfileActions.loadProfile({ userId: uid }));
    }

    // Effect for store profile updates
    effect(() => {
      const profile = this.storeProfile();
      if (profile) {
        const mappedProfile = this.mapUserToProfile(profile);
        this.userProfile.set(mappedProfile);
        this.isFamilyMode.set(mappedProfile.preferences?.isFamilyMode || false);
        this.populateForm(mappedProfile);
      }
    });

    // Effect for error handling
    effect(() => {
      const error = this.storeError();
      if (error) {
        console.error('Error loading profile:', error);
        this.notificationService.error(ERROR_MESSAGES.NETWORK.SERVER_ERROR);
      }
    });

    // Auth state monitoring
    this.userService.userAuth$.pipe(
      takeUntilDestroyed()
    ).subscribe(user => {
      if (user) {
        if (this.userService.isGuestUser() && !this.userProfile()) {
          const mapped = this.mapUserToProfile(user);
          this.userProfile.set(mapped);
          this.populateForm(mapped);
        }
        this.loadFamilies();
      }
    });

    this.setupPreferencesAutoSaveListeners();
    this.enablePreferenceToggles();
  }

  /**
   * Enables specific preference controls that should stay interactable even in view mode.
   */
  private enablePreferenceToggles(): void {
    this.PREFERENCE_TOGGLES.forEach(controlName => {
      const control = this.profileForm.get(`preferences.${controlName}`);
      if (control) {
        const isPin = controlName === 'pinEnabled';
        const hasPinHash = !!this.userProfile()?.preferences?.pinHash;
        
        if (isPin && !hasPinHash) {
          control.disable({ emitEvent: false });
        } else {
          control.enable({ emitEvent: false });
        }
      }
    });
  }

  /**
   * Sets up value-change listeners to auto-save specific settings when changed in view mode.
   */
  private setupPreferencesAutoSaveListeners(): void {
    this.PREFERENCE_TOGGLES.forEach(controlName => {
      const control = this.profileForm.get(`preferences.${controlName}`);
      if (control) {
        control.valueChanges.pipe(
          takeUntilDestroyed(),
          debounceTime(500),
          distinctUntilChanged()
        ).subscribe(value => {
          if (!this.isEditingPreferences()) {
            const profile = this.userProfile();
            // Only save if the value is actually different from the current profile state
            if (profile && profile.preferences?.[controlName as keyof UserPreferences] !== value) {
              this.applyPreferenceChanges({ [controlName]: value });
            }
          }
        });
      }
    });
  }





  // ─── Family Group ──────────────────────────────────────────────────

  private familiesSubscription?: Subscription;
  private loadFamilies(): void {
    this.isFamilyLoading.set(true);
    this.familiesSubscription?.unsubscribe();

    this.familiesSubscription = this.familyService.getMyFamilies()
      .pipe(
        switchMap(families => {
          this.familyGroups.set(families);
          const activeId = this.activeFamilyId();
          if (activeId) {
            return this.familyService.getMembers(activeId).pipe(take(1));
          }
          return of([]);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (members) => {
          this.familyMembers.set(members);
          this.isFamilyLoading.set(false);
        },
        error: () => {
          this.isFamilyLoading.set(false);
        }
      });
  }
  async switchActiveFamily(familyId: string): Promise<void> {
    const profile = this.userProfile();
    if (!profile || (this.activeFamilyId() === familyId && this.isFamilyMode())) return;

    this.isActionLoading.set(true);
    try {
      this.familyService.setActiveFamily(familyId);

      await this.applyPreferenceChanges({
        isFamilyMode: true,
        activeFamilyId: familyId
      });

      this.notificationService.info('Switched to active family');

      // Clear stores and sync
      this.clearLocalStores();
      this.syncService.syncAll().subscribe({
        complete: () => this.isActionLoading.set(false),
        error: () => this.isActionLoading.set(false)
      });
    } catch (error) {
      console.error('Error switching family:', error);
      this.notificationService.error('Failed to switch family');
      this.isActionLoading.set(false);
    }
  }

  async switchToPersonalMode(): Promise<void> {
    if (!this.isFamilyMode()) return;

    this.isActionLoading.set(true);
    try {
      await this.applyPreferenceChanges({
        isFamilyMode: false
      });

      this.notificationService.info('Switched to Personal Mode');

      this.clearLocalStores();
      this.syncService.syncAll().subscribe({
        complete: () => this.isActionLoading.set(false),
        error: () => this.isActionLoading.set(false)
      });
    } catch (error) {
      console.error('Error switching to personal mode:', error);
      this.notificationService.error('Failed to switch mode');
      this.isActionLoading.set(false);
    }
  }

  private clearLocalStores() {
    this.store.dispatch(TransactionsActions.clearTransactions());
    this.store.dispatch(AccountsActions.clearAccounts());
    this.store.dispatch(CategoriesActions.clearCategories());
    this.store.dispatch(BudgetsActions.clearBudgets());
    this.store.dispatch(GoalsActions.clearGoals());
  }

  createFamilyGroup(): void {
    const ref = this.dialog.open(FamilyCreateDialogComponent, { disableClose: true });
    ref.afterClosed().subscribe(async result => {
      if (result) {
        try {
          this.isActionLoading.set(true);
          const family = await this.familyService.createFamily(result);
          this.loadFamilies();
          this.notificationService.info('Family created! Share the invite code with family members.');
          this.router.navigate(['/dashboard/family/groups']);
        } catch (error: any) {
          this.notificationService.error(error?.message || ERROR_MESSAGES.NETWORK.SERVER_ERROR);
        } finally {
          this.isActionLoading.set(false);
        }
      }
    });
  }

  joinFamilyGroup(): void {
    const ref = this.dialog.open(FamilyJoinDialogComponent, { disableClose: true });
    ref.afterClosed().subscribe(async code => {
      if (code) {
        if (code) {
          try {
            this.isActionLoading.set(true);
            const family = await this.familyService.joinByCode(code);
            // After successfully joining, switch to the new family
            if (family.id) {
              await this.switchActiveFamily(family.id);
            }
            this.loadFamilies();
            this.notificationService.info(`Joined "${family.name}" family!`);
            this.router.navigate(['/dashboard/family/groups']);
          } catch (error: any) {
            this.notificationService.error(error?.message || ERROR_MESSAGES.NETWORK.SERVER_ERROR);
          } finally {
            this.isActionLoading.set(false);
          }
        }
      }
    });
  }





  async deleteFamilyGroup(family: Family): Promise<void> {
    if (!family || !family.id) return;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Family Wallet',
        message: 'Are you sure you want to delete this family wallet? All shared transactions and data will be hidden and other members will be disconnected. This action cannot be undone.',
        confirmText: 'Delete Family',
        cancelText: 'Cancel',
        confirmColor: 'warn',
      },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        try {
          this.isActionLoading.set(true);
          await this.familyService.deleteFamily(family.id!);
          this.familyService.setActiveFamily(null);
          await this.applyPreferenceChanges({
            isFamilyMode: false,
            activeFamilyId: null
          });

          this.loadFamilies();
          if (this.activeFamilyId() === family.id) {
            this.familyMembers.set([]);
          }
          this.notificationService.info('Family Group deleted successfully.');
        } catch (error: any) {
          console.error('Error deleting family:', error);
          this.notificationService.error(error?.message || 'Failed to delete family wallet');
        } finally {
          this.isActionLoading.set(false);
        }
      }
    });
  }

  viewFamilyGroup(familyId?: string): void {
    this.router.navigate(['/dashboard/family']);
  }

  copyFamilyCode(code: string): void {
    navigator.clipboard.writeText(code).then(() => {
      this.notificationService.info('Invite code copied!');
    });
  }


  // ─── Timezone ──────────────────────────────────────────────────────

  private ensureCurrentTimezoneInList(): void {
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (userTimezone && !this.timezones.find(tz => tz.value === userTimezone)) {
      this.timezones = [...this.timezones, {
        value: userTimezone,
        label: `${userTimezone} (Detected)`
      }];
    }
  }

  // ─── Form Helpers ──────────────────────────────────────────────────

  private mapUserToProfile(user: User): User {
    return {
      uid: user.uid,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email,
      phone: user.phone || '',
      dateOfBirth: this.dateService.toDate(user.dateOfBirth || 0) || new Date(),
      occupation: user.occupation || '',
      monthlyIncome: user.monthlyIncome || 0,
      photoURL: user.photoURL || '',
      displayName: user.displayName || '',
      preferences: {
        defaultCurrency: user.preferences?.defaultCurrency || this.defaultCurrency,
        timezone: user.preferences?.timezone || 'UTC',
        language: this.translationService.normalizeLanguageCode(user.preferences?.language || APP_CONFIG.REGIONAL.LANGUAGE_DEFAULT),
        country: user.preferences?.country || this.deriveCountryFromLanguage(user.preferences?.language || APP_CONFIG.REGIONAL.LANGUAGE_DEFAULT),
        notifications: user.preferences?.notifications || true,
        emailUpdates: user.preferences?.emailUpdates || true,
        budgetAlerts: user.preferences?.budgetAlerts || true,
        categoryListViewMode: user.preferences?.categoryListViewMode || false,
        appView: user.preferences?.appView || 'MONTHLY',
        pinEnabled: user.preferences?.pinEnabled || false,
        pinHash: user.preferences?.pinHash || '',
        isFamilyMode: user.preferences?.isFamilyMode || false,
        activeFamilyId: user.preferences?.activeFamilyId,
      },
      role: user.role,

      createdAt: user.createdAt,
      updatedAt: this.dateService.toTimestamp(user.updatedAt) || new Date(),
    };
  }

  private populateForm(profile: User | null): void {
    if (profile) {
      this.profileForm.patchValue({
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        phone: profile.phone || '',
        dateOfBirth: profile.dateOfBirth || '',
        occupation: profile.occupation || '',
        monthlyIncome: profile.monthlyIncome || 0,
        preferences: {
          defaultCurrency: profile.preferences?.defaultCurrency || this.defaultCurrency,
          timezone: profile.preferences?.timezone || 'UTC',
          language: profile.preferences?.language || APP_CONFIG.REGIONAL.LANGUAGE_DEFAULT,
          country: profile.preferences?.country || this.deriveCountryFromLanguage(profile.preferences?.language || APP_CONFIG.REGIONAL.LANGUAGE_DEFAULT),
          appView: profile.preferences?.appView || 'MONTHLY',
          pinEnabled: profile.preferences?.pinEnabled || false,
        },
      }, { emitEvent: false });

      // Ensure preference toggles remain enabled
      this.enablePreferenceToggles();




      // Ensure form's current timezone is in the list
      const formTimezone = this.profileForm.get('preferences.timezone')?.value;
      if (formTimezone && !this.timezones.find(tz => tz.value === formTimezone)) {
        this.timezones = [...this.timezones, {
          value: formTimezone,
          label: `${formTimezone} (Preference)`
        }];
      }
    }
  }

  // ─── Edit / Save ──────────────────────────────────────────────────

  // ─── Edit / Save / Cancel Logic ───────────────────────────────────

  toggleEdit(section: 'personal' | 'preferences'): void {
    if (section === 'personal') {
      this.isEditingPersonal.set(true);
      this.BASIC_INFO_FIELDS.forEach(field => this.profileForm.get(field)?.enable());
    } else {
      this.isEditingPreferences.set(true);
      this.EDITABLE_PREFERENCES.forEach(field => this.profileForm.get(`preferences.${field}`)?.enable());
    }
  }

  cancelEdit(section: 'personal' | 'preferences'): void {
    const profile = this.userProfile();
    if (profile) {
      if (section === 'personal') {
        this.isEditingPersonal.set(false);
        // Reset only personal fields
        this.BASIC_INFO_FIELDS.forEach(field => {
          const val = (profile as any)[field];
          this.profileForm.get(field)?.patchValue(val, { emitEvent: false });
          this.profileForm.get(field)?.disable({ emitEvent: false });
        });
      } else {
        this.isEditingPreferences.set(false);
        // Reset only preference fields
        this.EDITABLE_PREFERENCES.forEach(field => {
          const val = (profile.preferences as any)?.[field];
          this.profileForm.get(`preferences.${field}`)?.patchValue(val, { emitEvent: false });
          this.profileForm.get(`preferences.${field}`)?.disable({ emitEvent: false });
        });
      }
    }
  }

  async saveProfile(section: 'personal' | 'preferences'): Promise<void> {
    // Check validation for the relevant section if needed, but since we save whole form:
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      this.notificationService.warning(ERROR_MESSAGES.VALIDATION.REQUIRED_FIELD);
      return;
    }

    try {
      this.isActionLoading.set(true);
      const formValue = this.profileForm.value;
      const profile = this.userProfile();

      if (profile) {
        const updatedUser: User = {
          ...profile,
          ...formValue,
          preferences: {
            ...profile.preferences,
            ...formValue.preferences
          },
          updatedAt: new Date(),
        };

        if (this.userService.isGuestUser()) {
          this.userService.storageService.setItem(`user-data-${updatedUser.uid}`, updatedUser);
          this.store.dispatch(ProfileActions.setProfile({ profile: updatedUser }));
          this.userProfile.set(updatedUser);
          this.notificationService.info('Profile updated successfully.');
        } else {
          this.store.dispatch(ProfileActions.updateProfile({
            userId: profile.uid,
            profile: updatedUser
          }));
          this.notificationService.success(SUCCESS_MESSAGES.GENERAL.PROFILE_UPDATED);
        }

        // Sync language with translation service
        if (updatedUser.preferences?.language) {
          this.translationService.setLanguage(updatedUser.preferences.language as Language);
        }

        if (section === 'personal') {
          this.isEditingPersonal.set(false);
          this.BASIC_INFO_FIELDS.forEach(field => this.profileForm.get(field)?.disable({ emitEvent: false }));
        } else {
          this.isEditingPreferences.set(false);
          this.EDITABLE_PREFERENCES.forEach(field => this.profileForm.get(`preferences.${field}`)?.disable({ emitEvent: false }));
        }
        
        // Ensure preference toggles remain enabled
        this.enablePreferenceToggles();
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      this.notificationService.error(ERROR_MESSAGES.NETWORK.SERVER_ERROR);
    } finally {
      this.isActionLoading.set(false);
    }
  }



  // ─── Auth Actions ──────────────────────────────────────────────────

  async signInWithGoogle(): Promise<void> {
    try {
      this.isGoogleLoading.set(true);
      this.isActionLoading.set(true);
      await this.userService.signInWithGoogle();
      this.notificationService.info('Successfully signed in with Google');
      window.location.reload();
    } catch (error) {
      console.error('Error signing in with Google:', error);
      this.notificationService.error(ERROR_MESSAGES.NETWORK.SERVER_ERROR);
    } finally {
      this.isGoogleLoading.set(false);
      this.isActionLoading.set(false);
    }
  }

  async logout(): Promise<void> {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Sign Out',
        message: 'Are you sure you want to log out from your account?',
        confirmText: 'Sign Out',
        cancelText: 'Cancel',
        type: 'info'
      },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        try {
          this.isLogoutLoading.set(true);
          this.isActionLoading.set(true);
          await this.userService.logout();
          this.notificationService.info('Logged out successfully');
          window.location.reload();
        } catch (error) {
          console.error('Error logging out:', error);
          this.notificationService.error(ERROR_MESSAGES.NETWORK.SERVER_ERROR);
        } finally {
          this.isLogoutLoading.set(false);
          this.isActionLoading.set(false);
        }
      }
    });
  }

  async deleteAccount(): Promise<void> {
    if (this.userService.isGuestUser()) {
      const dialogRef = this.dialog.open(ConfirmDialogComponent, {
        data: {
          title: 'Sign Out?',
          message: 'Are you sure you want to sign out? All your guest data will be permanently deleted.',
          confirmText: 'Sign Out',
          cancelText: 'Cancel',
          type: 'warning'
        }
      });

      dialogRef.afterClosed().subscribe(async (result) => {
        if (result) {
          try {
            await this.userService.storageService.clear();
            await this.userService.signOut();
            this.notificationService.success('Signed out and guest data cleared');
            this.router.navigate(['/sign-in']);
          } catch (error) {
            console.error('Error signing out guest:', error);
            this.notificationService.error('Failed to sign out');
          }
        }
      });
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Account',
        message:
          'Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently lost.',
        confirmText: 'Delete Account',
        cancelText: 'Cancel',
        confirmColor: 'warn',
      },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        try {
          this.isActionLoading.set(true);
          // Use Auth directly for the Firebase account deletion call
          await this.auth.currentUser?.delete();
          this.notificationService.info('Account deleted successfully');
          this.router.navigate(['/sign-in']);
        } catch (error) {
          console.error('Error deleting account:', error);
          this.notificationService.error(ERROR_MESSAGES.NETWORK.SERVER_ERROR);
        } finally {
          this.isActionLoading.set(false);
        }
      }
    });
  }

  // ─── Export / Import ──────────────────────────────────────────────

  async exportData(): Promise<void> {
    try {
      if (!APP_CONFIG.FEATURES.EXPORT_FUNCTIONALITY) {
        this.notificationService.warning(ERROR_MESSAGES.PERMISSION.FEATURE_NOT_AVAILABLE);
        return;
      }
      await this.backupRestoreService.exportData();
      this.notificationService.success(SUCCESS_MESSAGES.BACKUP.EXPORT_SUCCESS);
    } catch (error) {
      console.error('Error exporting data:', error);
      this.notificationService.error(ERROR_MESSAGES.NETWORK.SERVER_ERROR);
    }
  }

  importData(): void {
    const fileInput = document.getElementById('importFileInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    event.target.value = '';
    this.isActionLoading.set(true);

    this.backupRestoreService.handleRestore(file).subscribe({
      next: (result) => {
        if (result.success) {
          this.notificationService.success(result.message);
        } else if (result.message) {
          this.notificationService.error(result.message);
        }
        this.isActionLoading.set(false);
      },
      error: (error) => {
        console.error('Restore failed:', error);
        this.notificationService.error('BACKUP.IMPORT_FAILED');
        this.isActionLoading.set(false);
      }
    });
  }

  onProfileImageSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 256;
        const MAX_HEIGHT = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const base64Image = canvas.toDataURL('image/jpeg', 0.8);
        const profile = this.userProfile();
        if (profile) {
          const updatedProfile: User = { ...profile, photoURL: base64Image, updatedAt: new Date() };
          this.userProfile.set(updatedProfile);
          
          this.isActionLoading.set(true);
          try {
            if (this.userService.isGuestUser()) {
              this.userService.storageService.setItem(`user-data-${updatedProfile.uid}`, updatedProfile);
              this.store.dispatch(ProfileActions.setProfile({ profile: updatedProfile }));
              this.notificationService.info('Profile picture updated successfully.');
            } else {
              this.store.dispatch(ProfileActions.updateProfile({
                userId: updatedProfile.uid,
                profile: updatedProfile
              }));
              this.notificationService.success(SUCCESS_MESSAGES.GENERAL.PROFILE_UPDATED);
            }
          } catch (error) {
            console.error('Error saving profile picture:', error);
            this.notificationService.error(ERROR_MESSAGES.NETWORK.SERVER_ERROR);
          } finally {
            this.isActionLoading.set(false);
          }
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  // ─── Utility Methods ──────────────────────────────────────────────

  private deriveCountryFromLanguage(language: string): string {
    return this.countries.find(c => c.language === language)?.code || 'IN';
  }


  onlyNumbers(event: KeyboardEvent): boolean {
    const charCode = event.which || event.keyCode;
    return charCode <= 31 || (charCode >= 48 && charCode <= 57);
  }

  async updatePin(): Promise<void> {
    const newPin = this.newPinControl.value;
    if (newPin && /^\d{4}$/.test(newPin)) {
      const pinHash = await this.securityService.hashPin(newPin);

      await this.applyPreferenceChanges({
        pinHash: pinHash,
        pinEnabled: true
      });

      this.profileForm.get('preferences.pinEnabled')?.setValue(true, { emitEvent: false });
      this.profileForm.get('preferences.pinEnabled')?.enable({ emitEvent: false });
      this.newPinControl.reset();
      this.showPinSetup.set(false);
      this.notificationService.success('PIN updated successfully. Remember to save your changes.');
    }
  }

  isGuestMode(): boolean {
    return this.userService.isGuestUser();
  }



  /**
   * Common function to apply preference changes both locally and remotely
   */
  private async applyPreferenceChanges(changes: Partial<UserPreferences>): Promise<void> {
    const profile = this.userProfile();
    if (!profile) return;

    // 1. Prepare updated preferences with required fields fallback
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

    // 2. Prepare updated user object
    const updatedUser: User = {
      ...profile,
      preferences: updatedPrefs,
      updatedAt: new Date()
    };

    // 3. Update local state
    this.userProfile.set(updatedUser);

    if (changes.isFamilyMode !== undefined) {
      this.isFamilyMode.set(changes.isFamilyMode);
    }

    // 4. Persist changes
    if (this.userService.isGuestUser()) {
      this.userService.storageService.setItem(`user-data-${updatedUser.uid}`, updatedUser);
      this.store.dispatch(ProfileActions.setProfile({ profile: updatedUser }));
    } else {
      this.store.dispatch(ProfileActions.updatePreferences({
        userId: profile.uid,
        preferences: changes
      }));
    }
  }

}
