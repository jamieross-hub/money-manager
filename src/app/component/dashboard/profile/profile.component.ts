import { Component, ChangeDetectionStrategy, signal, computed, inject, effect } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
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
import { DateService } from 'src/app/util/service/date.service';
import { SecurityService } from 'src/app/util/service/security.service';
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
import { SplitwiseService } from 'src/app/modules/splitwise/services/splitwise.service';
import { ThemeSwitchingService } from 'src/app/util/service/theme-switching.service';
import { ThemeType } from 'src/app/util/models/theme.model';
import { CreateGroupDialogComponent } from 'src/app/modules/splitwise/create-group-dialog/create-group-dialog.component';
import { SplitwiseGroup, CreateGroupRequest } from 'src/app/util/models/splitwise.model';

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
  private readonly splitwiseService = inject(SplitwiseService);
  private readonly backupRestoreService = inject(BackupRestoreService);
  readonly themeSwitchingService = inject(ThemeSwitchingService);
  private readonly securityService = inject(SecurityService);
  private readonly ssrService = inject(SsrService);

  // ─── Signals (State) ───────────────────────────────────────────────
  readonly isLoading = signal(false);
  readonly isEditing = signal(false);
  readonly userProfile = signal<User | null>(null);
  readonly familyGroup = signal<SplitwiseGroup | null>(null);
  readonly currentTheme = signal<ThemeType>('light-theme');
  readonly isBiometricSupported = signal(false);
  readonly isBiometricRegistered = signal(false);


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
        biometricLock: [{ value: false, disabled: true }],
        biometricRegistered: [{ value: false, disabled: true }],
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
        this.userProfile.set(this.mapUserToProfile(profile));
        this.populateForm();
      }
    });

    // React to store loading changes
    this.store.select(ProfileSelectors.selectProfileLoading).pipe(
      takeUntilDestroyed()
    ).subscribe(loading => {
      this.isLoading.set(loading);
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
        if (user.preferences?.familyGroupId) {
          this.loadFamilyGroup(user.preferences.familyGroupId);
        }
      }
    });

    // Listen to theme changes
    this.themeSwitchingService.currentTheme.pipe(
      takeUntilDestroyed()
    ).subscribe(theme => {
      this.currentTheme.set(theme);
    });

    // Check biometric support
    this.checkBiometricSupport();
  }

  private async checkBiometricSupport(): Promise<void> {
    if (!this.ssrService.isClientSide()) return;
    const supported = await this.securityService.isBiometricSupported();
    this.isBiometricSupported.set(supported);
  }



  // ─── Family Group ──────────────────────────────────────────────────

  private loadFamilyGroup(groupId: string): void {
    if (!groupId) return;
    this.splitwiseService.getGroup(groupId).pipe(
      takeUntilDestroyed()
    ).subscribe(group => {
      this.familyGroup.set(group);
    });
  }

  async createFamilyGroup(): Promise<void> {
    const dialogRef = this.dialog.open(CreateGroupDialogComponent, {
      disableClose: true,
      panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : 'desktop-dialog',
    });

    dialogRef.afterClosed().subscribe(async (result: CreateGroupRequest) => {
      if (result) {
        try {
          this.isLoading.set(true);
          const group = await this.splitwiseService.createGroup(result, this.currentUser.uid).toPromise();

          if (group && group.id) {
            await this.updateFamilyGroupId(group.id);
            this.notificationService.success('Family group created successfully');
            this.loadFamilyGroup(group.id);
          }
        } catch (error) {
          console.error('Error creating family group:', error);
          this.notificationService.error(ERROR_MESSAGES.NETWORK.SERVER_ERROR);
        } finally {
          this.isLoading.set(false);
        }
      }
    });
  }

  async updateFamilyGroupId(groupId: string): Promise<void> {
    const profile = this.userProfile();
    if (!profile) return;

    const updatedUser: User = {
      ...profile,
      preferences: {
        ...profile.preferences,
        familyGroupId: groupId,
        defaultCurrency: profile.preferences?.defaultCurrency || this.defaultCurrency,
        timezone: profile.preferences?.timezone || 'UTC',
        notifications: profile.preferences?.notifications ?? true,
        emailUpdates: profile.preferences?.emailUpdates ?? true,
        budgetAlerts: profile.preferences?.budgetAlerts ?? true,
      }
    };

    if (this.userService.isGuestUser()) {
      this.userService.storageService.setItem(`user-data-${updatedUser.uid}`, updatedUser);
      this.userService.userAuth$.next(updatedUser);
      this.userProfile.set(updatedUser);
    } else {
      this.store.dispatch(ProfileActions.updateProfile({
        userId: profile.uid,
        profile: updatedUser
      }));
    }
  }

  viewFamilyGroup(groupId: string): void {
    this.router.navigate(['/dashboard/splitwise/group', groupId]);
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
        biometricLock: user.preferences?.biometricLock || false,
        biometricRegistered: user.preferences?.biometricRegistered || false,
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
          biometricLock: profile.preferences?.biometricLock || false,
          biometricRegistered: profile.preferences?.biometricRegistered || false,
        },
      });

      this.isBiometricRegistered.set(profile.preferences?.biometricRegistered || false);


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
      this.quickActionsFabConfig.update(config => ({
        ...config,
        mainButtonIcon: 'save',
        mainButtonTooltip: 'Save Profile'
      }));
    }
  }

  async onBiometricToggleChange(event: any): Promise<void> {
    if (event.checked) {
      const verified = await this.securityService.verifyBiometric();
      if (!verified) {
        // Reset toggle if verification failed
        this.profileForm.get('preferences.biometricLock')?.setValue(false);
        this.notificationService.error('Biometric verification failed. Could not enable biometric lock.');
      } else {
        // Mark as registered too since they just passed the test locally
        this.isBiometricRegistered.set(true);
        this.profileForm.get('preferences.biometricRegistered')?.setValue(true);
        this.notificationService.success('Biometric lock enabled.');
      }
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
          uid: profile.uid,
          email: formValue.email,
          role: profile.role || UserRole.FREE,
          createdAt: profile.createdAt,
          preferences: formValue.preferences,
          firstName: formValue.firstName,
          lastName: formValue.lastName,
          phone: formValue.phone,
          dateOfBirth: formValue.dateOfBirth,
          occupation: formValue.occupation,
          monthlyIncome: formValue.monthlyIncome,
          updatedAt: new Date(),
        };

        if (this.userService.isGuestUser()) {
          this.userService.storageService.setItem(`user-data-${updatedUser.uid}`, updatedUser);
          this.userService.userAuth$.next(updatedUser);
          this.userProfile.set(updatedUser);
          this.notificationService.success('Profile updated successfully (saved locally)');
        } else {
          this.store.dispatch(ProfileActions.updateProfile({
            userId: profile.uid,
            profile: updatedUser
          }));
          this.notificationService.success(SUCCESS_MESSAGES.GENERAL.UPDATED);
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

  isGuestMode(): boolean {
    return this.userService.isGuestUser();
  }
}
