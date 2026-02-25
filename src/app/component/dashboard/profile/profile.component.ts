import { Component, ChangeDetectionStrategy, signal, computed, inject, effect } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { Auth } from '@angular/fire/auth';
import { UserService } from 'src/app/util/service/db/user.service';
import { Router } from '@angular/router';
import { TranslationService, Language } from 'src/app/util/service/translation.service';
import { User } from 'src/app/util/models';
import { NotificationService } from 'src/app/util/service/notification.service';
import { ValidationService } from 'src/app/util/service/validation.service';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from 'src/app/util/components/confirm-dialog/confirm-dialog.component';
import dayjs from 'dayjs';
import { Store } from '@ngrx/store';
import { AppState } from '../../../store/app.state';
import * as ProfileActions from '../../../store/profile/profile.actions';
import * as ProfileSelectors from '../../../store/profile/profile.selectors';
import * as TransactionsActions from '../../../store/transactions/transactions.actions';
import * as AccountsActions from '../../../store/accounts/accounts.actions';
import * as CategoriesActions from '../../../store/categories/categories.actions';
import * as BudgetsActions from '../../../store/budgets/budgets.actions';
import * as GoalsActions from '../../../store/goals/goals.actions';
import { DateService } from 'src/app/util/service/date.service';
import { SecurityService } from 'src/app/util/service/security.service';
import { filter, take, delay } from 'rxjs';
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

import { CommonModule } from '@angular/common';
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

import { CommonSyncService } from 'src/app/util/service/common-sync.service';
@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
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
    QuickActionsFabComponent,
    MatExpansionModule,
    ThemeToggleComponent
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

  // ─── Signals (State) ───────────────────────────────────────────────
  private ignoreLoader = false;
  readonly isLoading = signal(false);
  readonly isEditing = signal(false);
  readonly userProfile = signal<User | null>(null);
  readonly familyGroup = signal<Family | null>(null);
  readonly familyMembers = signal<any[]>([]);
  readonly isFamilyLoading = signal(false);
  readonly currentTheme = signal<ThemeType>('light-theme');
  readonly showPinSetup = signal(false);
  readonly isFamilyMode = signal(false);
  readonly newPinControl = new FormControl('', [Validators.required, Validators.pattern(/^\d{4}$/)]);



  readonly quickActionsFabConfig = signal<QuickActionsFabConfig>({
    title: 'Profile',
    mainButtonIcon: 'edit',
    mainButtonColor: 'primary',
    mainButtonTooltip: 'Edit Profile',
    showLabels: false,
    animations: true,
    autoHide: false,
    autoHideDelay: 3000,
    theme: 'auto',
    actions: [],
    onMainButtonClick: () => this.isEditing() ? this.saveProfile() : this.toggleEdit(),
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

  // ─── Reactive Form ────────────────────────────────────────────────
  readonly profileForm: FormGroup;
  readonly currentUser: any;

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

  readonly languages = Object.values(APP_CONFIG.REGIONAL.COUNTRY_MAPPING)
    .flatMap(config => (config as any).languages || [])
    .filter((v, i, a) => a.findIndex(t => t.code === v.code) === i)
    .sort((a, b) => a.name.localeCompare(b.name));

  readonly appViewOptions = [
    { value: 'WEEKLY', label: 'PROFILE.APP_VIEW_WEEKLY' },
    { value: 'MONTHLY', label: 'PROFILE.APP_VIEW_MONTHLY' },
    { value: 'YEARLY', label: 'PROFILE.APP_VIEW_YEARLY' }
  ];

  constructor() {
    this.currentUser = this.auth.currentUser;
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
    const uid = this.userService.isGuestUser() ? 'offline-guest' : this.currentUser?.uid;
    if (uid) {
      this.store.dispatch(ProfileActions.loadProfile({ userId: uid }));
    }

    // React to store profile changes
    this.store.select(ProfileSelectors.selectProfile).pipe(
      takeUntilDestroyed()
    ).subscribe(profile => {
      if (profile) {
        const mappedProfile = this.mapUserToProfile(profile);
        this.userProfile.set(mappedProfile);
        this.isFamilyMode.set(mappedProfile.preferences?.isFamilyMode || false);
        this.populateForm();
      }
    });

    // React to store loading changes
    this.store.select(ProfileSelectors.selectProfileLoading).pipe(
      takeUntilDestroyed()
    ).subscribe(loading => {
      if (!this.ignoreLoader) {
        this.isLoading.set(loading);
      }
      if (!loading) {
        this.ignoreLoader = false;
      }
    });

    // React to store error changes
    this.store.select(ProfileSelectors.selectProfileError).pipe(
      takeUntilDestroyed()
    ).subscribe(error => {
      if (error) {
        console.error('Error loading profile:', error);
        this.notificationService.error(ERROR_MESSAGES.NETWORK.SERVER_ERROR);
      }
    });

    // Listen to userAuth$ for direct updates (important for guests)
    this.userService.userAuth$.pipe(
      takeUntilDestroyed()
    ).subscribe(user => {
      if (user) {
        if (this.userService.isGuestUser() && !this.userProfile()) {
          this.userProfile.set(this.mapUserToProfile(user));
          this.populateForm();
        }
        this.loadFamily();
      }
    });

    // Listen to theme changes
    this.themeSwitchingService.currentTheme.pipe(
      takeUntilDestroyed()
    ).subscribe(theme => {
      this.currentTheme.set(theme);
    });
  }





  // ─── Family Group ──────────────────────────────────────────────────

  private loadFamily(): void {
    this.isFamilyLoading.set(true);
    this.familyService.getMyFamily().then(family => {
      this.familyGroup.set(family);
      if (family?.id) {
        this.familyService.getMembers(family.id).subscribe(members => {
          this.familyMembers.set(members);
          this.isFamilyLoading.set(false);
        });
      } else {
        this.isFamilyLoading.set(false);
      }
    }).catch(() => {
      this.familyGroup.set(null);
      this.isFamilyLoading.set(false);
    });
  }

  createFamilyGroup(): void {
    const dialogRef = this.dialog.open(FamilyCreateDialogComponent, {
      disableClose: true,
      panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : 'desktop-dialog',
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        try {
          this.isLoading.set(true);
          const family = await this.familyService.createFamily(result);
          this.familyGroup.set(family);
          this.notificationService.success('Family created! Share the invite code with family members.');
        } catch (error: any) {
          this.notificationService.error(error?.message || ERROR_MESSAGES.NETWORK.SERVER_ERROR);
        } finally {
          this.isLoading.set(false);
        }
      }
    });
  }

  joinFamilyGroup(): void {
    const dialogRef = this.dialog.open(FamilyJoinDialogComponent, {
      disableClose: true,
      panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : 'desktop-dialog',
    });

    dialogRef.afterClosed().subscribe(async (code: string) => {
      if (code) {
        try {
          this.isLoading.set(true);
          const family = await this.familyService.joinByCode(code);
          this.familyGroup.set(family);
          this.notificationService.success(`Joined "${family.name}" family!`);
        } catch (error: any) {
          this.notificationService.error(error?.message || ERROR_MESSAGES.NETWORK.SERVER_ERROR);
        } finally {
          this.isLoading.set(false);
        }
      }
    });
  }

  viewFamilyGroup(familyId?: string): void {
    this.router.navigate(['/dashboard/family']);
  }

  copyFamilyCode(code: string): void {
    navigator.clipboard.writeText(code).then(() => {
      this.notificationService.success('Invite code copied!');
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
        familyId: user.preferences?.familyId,
      },
      role: user.role,

      createdAt: user.createdAt,
      updatedAt: this.dateService.toTimestamp(user.updatedAt) || new Date(),
    };
  }

  private populateForm(): void {
    const profile = this.userProfile();
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
          notifications: profile.preferences?.notifications || true,
          emailUpdates: profile.preferences?.emailUpdates || true,
          budgetAlerts: profile.preferences?.budgetAlerts || true,
          categoryListViewMode: profile.preferences?.categoryListViewMode || false,
          appView: profile.preferences?.appView || 'MONTHLY',
          pinEnabled: profile.preferences?.pinEnabled || false,
        },
      });




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

  toggleEdit(): void {
    if (this.isEditing()) {
      this.saveProfile();
    } else {
      this.isEditing.set(true);
      this.profileForm.enable();
      // Keep pinEnabled disabled if no PIN hash exists
      if (!this.userProfile()?.preferences?.pinHash) {
        this.profileForm.get('preferences.pinEnabled')?.disable();
      }
      this.quickActionsFabConfig.update(config => ({
        ...config,
        mainButtonIcon: 'save',
        mainButtonTooltip: 'Save Profile'
      }));
    }
  }



  async saveProfile(): Promise<void> {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      this.notificationService.warning(ERROR_MESSAGES.VALIDATION.REQUIRED_FIELD);
      return;
    }

    try {
      this.isLoading.set(true);
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
          this.userService.userAuth$.next(updatedUser);
          this.userProfile.set(updatedUser);
          this.notificationService.success('Profile updated successfully.');
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

        this.isEditing.set(false);
        this.profileForm.disable();

        this.quickActionsFabConfig.update(config => ({
          ...config,
          mainButtonIcon: 'edit',
          mainButtonTooltip: 'Edit Profile'
        }));
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      this.notificationService.error(ERROR_MESSAGES.NETWORK.SERVER_ERROR);
    } finally {
      this.isLoading.set(false);
    }
  }

  cancelEdit(): void {
    this.populateForm();
    this.isEditing.set(false);
    this.profileForm.disable();

    this.quickActionsFabConfig.update(config => ({
      ...config,
      mainButtonIcon: 'edit',
      mainButtonTooltip: 'Edit Profile'
    }));

    this.notificationService.info('Changes cancelled');
  }

  // ─── Auth Actions ──────────────────────────────────────────────────

  async signInWithGoogle(): Promise<void> {
    try {
      this.isLoading.set(true);
      await this.userService.signInWithGoogle();
      this.notificationService.success('Successfully signed in with Google');
      window.location.reload();
    } catch (error) {
      console.error('Error signing in with Google:', error);
      this.notificationService.error(ERROR_MESSAGES.NETWORK.SERVER_ERROR);
    } finally {
      this.isLoading.set(false);
    }
  }

  async logout(): Promise<void> {
    try {
      this.isLoading.set(true);
      await this.userService.logout();
      this.notificationService.success('Logged out successfully');
      window.location.reload();
    } catch (error) {
      console.error('Error logging out:', error);
      this.notificationService.error(ERROR_MESSAGES.NETWORK.SERVER_ERROR);
    } finally {
      this.isLoading.set(false);
    }
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
          this.isLoading.set(true);
          await this.currentUser.delete();
          this.notificationService.success('Account deleted successfully');
          this.router.navigate(['/sign-in']);
        } catch (error) {
          console.error('Error deleting account:', error);
          this.notificationService.error(ERROR_MESSAGES.NETWORK.SERVER_ERROR);
        } finally {
          this.isLoading.set(false);
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
    this.isLoading.set(true);

    this.backupRestoreService.handleRestore(file).subscribe({
      next: (result) => {
        if (result.success) {
          this.notificationService.success(result.message);
        } else if (result.message) {
          this.notificationService.error(result.message);
        }
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Restore failed:', error);
        this.notificationService.error('BACKUP.IMPORT_FAILED');
        this.isLoading.set(false);
      }
    });
  }

  // ─── Utility Methods ──────────────────────────────────────────────

  getTimezoneLabel(timezoneValue: string): string {
    const timezone = this.timezones.find((t) => t.value === timezoneValue);
    return timezone ? timezone.label : timezoneValue;
  }

  getLanguageName(languageCode: string): string {
    const language = Object.values(APP_CONFIG.REGIONAL.COUNTRY_MAPPING)
      .flatMap(config => (config as any).languages || [])
      .find(l => l.code === languageCode);
    return language?.name || languageCode;
  }

  private deriveCountryFromLanguage(language: string): string {
    const entry = Object.entries(APP_CONFIG.REGIONAL.COUNTRY_MAPPING).find(([code, c]) =>
      (c as any).languages?.some((l: any) => l.code === language)
    );
    return entry ? entry[0] : 'IN';
  }

  getFormattedDate(date: any): string {
    if (!date) return 'N/A';
    if (date?.seconds) {
      return dayjs(date.seconds * 1000).format('MMM DD, YYYY');
    }
    return dayjs(date).format('MMM DD, YYYY');
  }

  onlyNumbers(event: any): boolean {
    const charCode = (event.which) ? event.which : event.keyCode;
    if (charCode > 31 && (charCode < 48 || charCode > 57)) {
      return false;
    }
    return true;
  }

  async updatePin(): Promise<void> {
    const newPin = this.newPinControl.value;
    if (newPin && /^\d{4}$/.test(newPin)) {
      const pinHash = await this.securityService.hashPin(newPin);
      const profile = this.userProfile();
      if (profile) {
        // Update current profile signal and form
        const updatedProfile: User = {
          ...profile,
          preferences: {
            ...profile.preferences,
            defaultCurrency: profile.preferences?.defaultCurrency || 'USD',
            timezone: profile.preferences?.timezone || 'UTC',
            notifications: profile.preferences?.notifications ?? true,
            emailUpdates: profile.preferences?.emailUpdates ?? true,
            budgetAlerts: profile.preferences?.budgetAlerts ?? true,
            pinHash: pinHash,
            pinEnabled: true
          }
        };
        this.userProfile.set(updatedProfile);
        this.profileForm.get('preferences.pinEnabled')?.setValue(true);
        this.profileForm.get('preferences.pinEnabled')?.enable();
        this.newPinControl.reset();
        this.showPinSetup.set(false);
        this.notificationService.success('PIN updated successfully. Remember to save your changes.');
      }
    }
  }

  isGuestMode(): boolean {
    return this.userService.isGuestUser();
  }

  async toggleFamilyMode(enabled: boolean): Promise<void> {
    const profile = this.userProfile();
    if (!profile) return;

    this.isFamilyMode.set(enabled);
    this.ignoreLoader = true;

    const familyId = profile.preferences?.familyId || this.familyGroup()?.id;

    // Update local state immediately for snappy UI
    const updatedProfile: User = {
      ...profile,
      preferences: {
        defaultCurrency: profile.preferences?.defaultCurrency || 'USD',
        timezone: profile.preferences?.timezone || 'UTC',
        notifications: profile.preferences?.notifications ?? true,
        emailUpdates: profile.preferences?.emailUpdates ?? true,
        budgetAlerts: profile.preferences?.budgetAlerts ?? true,
        ...profile.preferences,
        isFamilyMode: enabled,
        familyId: familyId || null
      }
    };
    this.userProfile.set(updatedProfile);

    // Persist changes
    try {
      if (this.userService.isGuestUser()) {
        this.userService.storageService.setItem(`user-data-${updatedProfile.uid}`, updatedProfile);
        this.userService.userAuth$.next(updatedProfile);
        this.notificationService.success(`Family mode ${enabled ? 'enabled' : 'disabled'}`);
      } else {
        this.store.dispatch(ProfileActions.updatePreferences({
          userId: profile.uid,
          preferences: {
            isFamilyMode: enabled,
            familyId: familyId || null
          }
        }));
        this.notificationService.success(`Family mode ${enabled ? 'enabled' : 'disabled'}`);
      }

      // Clear all stores for personal/family switch to avoid data mixing
      this.store.dispatch(TransactionsActions.clearTransactions());
      this.store.dispatch(AccountsActions.clearAccounts());
      this.store.dispatch(CategoriesActions.clearCategories());
      this.store.dispatch(BudgetsActions.clearBudgets());
      this.store.dispatch(GoalsActions.clearGoals());

      // Wait for UserService to pick up the new mode before syncing
      // This ensures the sync pulls from the correct collection path
      this.userService.userAuth$.pipe(
        filter(u => u?.preferences?.isFamilyMode === enabled),
        take(1),
        delay(100) // Small delay to allow any other secondary updates to settle
      ).subscribe(() => {
        this.syncService.syncAll().subscribe();
      });

    } catch (error) {
      console.error('Error toggling family mode:', error);
      this.notificationService.error('Failed to update family mode');
      // Rollback on error
      this.ignoreLoader = false;
      this.isFamilyMode.set(!enabled);
      this.userProfile.set(profile);
    }
  }

}
