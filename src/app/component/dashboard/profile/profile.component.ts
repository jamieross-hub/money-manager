import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Auth } from '@angular/fire/auth';
import { UserService } from 'src/app/util/service/db/user.service';
import { Router } from '@angular/router';
import { Subject, Observable, Subscription } from 'rxjs';
import { TranslationService, Language } from 'src/app/util/service/translation.service';
import {
  User,
} from 'src/app/util/models';
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
import {
  APP_CONFIG,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  TIMEZONES
} from 'src/app/util/config/config';
import {
  UserRole,
  CurrencyCode,
  LanguageCode
} from 'src/app/util/config/enums';
import { BreakpointObserver } from '@angular/cdk/layout';
import { QuickActionsFabConfig } from 'src/app/util/components/floating-action-buttons/quick-actions-fab/quick-actions-fab.component';
import { BackupRestoreService } from 'src/app/util/service/db/backup-restore.service';
import { SplitwiseService } from 'src/app/modules/splitwise/services/splitwise.service';
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
    MatExpansionModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileComponent implements OnInit, OnDestroy {
  // Observables from store
  profile$: Observable<User | null>;
  profileLoading$: Observable<boolean>;
  profileError$: Observable<any>;

  profileForm: FormGroup;
  isLoading = false;
  isEditing = false;
  currentUser: any;
  userProfile: User | null = null;

  // Use configurations from config.ts
  currencies = Object.values(CurrencyCode);
  defaultCurrency = APP_CONFIG.REGIONAL.CURRENCY_DEFAULT;

  quickActionsFabConfig: QuickActionsFabConfig = {
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
    onMainButtonClick: () => this.isEditing ? this.saveProfile() : this.toggleEdit(),
  };



  countries = Object.entries(APP_CONFIG.REGIONAL.COUNTRY_MAPPING).map(([code, config]) => ({
    code,
    languageName: (config as any).languages?.[0]?.name || code,
    countryName: (config as any).countryName || code,
    language: (config as any).languages?.[0]?.code,
    currency: (config as any).currency
  })).sort((a, b) => a.countryName.localeCompare(b.countryName));

  languages = Object.values(APP_CONFIG.REGIONAL.COUNTRY_MAPPING)
    .flatMap(config => (config as any).languages || [])
    .filter((v, i, a) => a.findIndex(t => t.code === v.code) === i)
    .sort((a, b) => a.name.localeCompare(b.name));

  appViewOptions = [
    { value: 'WEEKLY', label: 'PROFILE.APP_VIEW_WEEKLY' },
    { value: 'MONTHLY', label: 'PROFILE.APP_VIEW_MONTHLY' },
    { value: 'YEARLY', label: 'PROFILE.APP_VIEW_YEARLY' }
  ];



  // Validation constants from config
  validation = APP_CONFIG.VALIDATION;
  timezones = TIMEZONES;
  isMobile = false;

  private destroy$ = new Subject<void>();
  private subscriptions = new Subscription();

  constructor(
    private fb: FormBuilder,
    private auth: Auth,
    private router: Router,
    private notificationService: NotificationService,
    private validationService: ValidationService,
    private dialog: MatDialog,
    private dateService: DateService,
    private store: Store<AppState>,
    public breakpointService: BreakpointService,
    private userService: UserService,
    private translationService: TranslationService,
    private backupRestoreService: BackupRestoreService,
    private splitwiseService: SplitwiseService,
    private cdr: ChangeDetectorRef
  ) {
    this.currentUser = this.auth.currentUser;
    // Initialize selectors
    this.profile$ = this.store.select(ProfileSelectors.selectProfile);
    this.profileLoading$ = this.store.select(ProfileSelectors.selectProfileLoading);
    this.profileError$ = this.store.select(ProfileSelectors.selectProfileError);

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
        country: [{ value: 'IN', disabled: true }], // Default to IN or derive from language
        notifications: [{ value: true, disabled: true }],
        emailUpdates: [{ value: true, disabled: true }],
        budgetAlerts: [{ value: true, disabled: true }],
        categoryListViewMode: [{ value: false, disabled: true }],
        appView: [{ value: 'MONTHLY', disabled: true }],
      }),
    });

    // Listen to country changes to sync language and currency
    // this.profileForm.get('preferences.country')?.valueChanges.subscribe(countryCode => {
    //   if (this.isEditing && countryCode) {
    //     const country = APP_CONFIG.REGIONAL.COUNTRY_MAPPING[countryCode as keyof typeof APP_CONFIG.REGIONAL.COUNTRY_MAPPING];
    //     if (country) {
    //       this.profileForm.get('preferences')?.patchValue({
    //         language: (country as any).language,
    //         defaultCurrency: (country as any).currency
    //       }, { emitEvent: false });
    //     }
    //   }
    // });
  }

  ngOnInit(): void {
    // Add current user's timezone to list if missing
    this.ensureCurrentTimezoneInList();

    // Subscribe to store data (works for both real and guest users now)
    this.subscribeToStoreData();

    // Dispatch action to load profile
    const uid = this.userService.isGuestUser() ? 'offline-guest' : this.currentUser?.uid;
    if (uid) {
      this.store.dispatch(ProfileActions.loadProfile({ userId: uid }));
    }

    // Also listen to userAuth$ for direct updates (important for guests)
    this.subscriptions.add(
      this.userService.userAuth$.subscribe(user => {
        if (user) {
          if (this.userService.isGuestUser() && !this.userProfile) {
            this.userProfile = this.mapUserToProfile(user);
            this.populateForm();
          }
          // Load family group if exists
          if (user.preferences?.familyGroupId) {
            this.loadFamilyGroup(user.preferences.familyGroupId);
          }
        }
        this.cdr.markForCheck();
      })
    );
  }

  familyGroup$: Observable<SplitwiseGroup | null> = new Subject<SplitwiseGroup | null>();

  private loadFamilyGroup(groupId: string): void {
    if (!groupId) return;
    this.familyGroup$ = this.splitwiseService.getGroup(groupId);
    this.cdr.markForCheck();
  }

  async createFamilyGroup(): Promise<void> {
    const dialogRef = this.dialog.open(CreateGroupDialogComponent, {
      disableClose: true,
      panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : 'desktop-dialog',
    });

    dialogRef.afterClosed().subscribe(async (result: CreateGroupRequest) => {
      if (result) {
        try {
          this.isLoading = true;
          // 1. Create the group
          const group = await this.splitwiseService.createGroup(result, this.currentUser.uid).toPromise();

          if (group && group.id) {
            // 2. Update user profile with familyGroupId
            await this.updateFamilyGroupId(group.id);
            this.notificationService.success('Family group created successfully');
            this.loadFamilyGroup(group.id);
          }
        } catch (error) {
          console.error('Error creating family group:', error);
          this.notificationService.error(ERROR_MESSAGES.NETWORK.SERVER_ERROR);
        } finally {
          this.isLoading = false;
        }
      }
    });
  }

  async updateFamilyGroupId(groupId: string): Promise<void> {
    if (!this.userProfile) return;

    const updatedUser: User = {
      ...this.userProfile,
      preferences: {
        ...this.userProfile.preferences,
        familyGroupId: groupId,
        // Ensure required properties are present
        defaultCurrency: this.userProfile.preferences?.defaultCurrency || this.defaultCurrency,
        timezone: this.userProfile.preferences?.timezone || 'UTC',
        notifications: this.userProfile.preferences?.notifications ?? true,
        emailUpdates: this.userProfile.preferences?.emailUpdates ?? true,
        budgetAlerts: this.userProfile.preferences?.budgetAlerts ?? true,
      }
    };

    if (this.userService.isGuestUser()) {
      this.userService.storageService.setItem(`user-data-${updatedUser.uid}`, updatedUser);
      this.userService.userAuth$.next(updatedUser);
      this.userProfile = updatedUser;
    } else {
      this.store.dispatch(ProfileActions.updateProfile({
        userId: this.userProfile.uid,
        profile: updatedUser
      }));
    }
  }

  viewFamilyGroup(groupId: string): void {
    this.router.navigate(['/dashboard/splitwise/group', groupId]);
  }

  private ensureCurrentTimezoneInList(): void {
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (userTimezone && !this.timezones.find(tz => tz.value === userTimezone)) {
      this.timezones = [...this.timezones, {
        value: userTimezone,
        label: `${userTimezone} (Detected)`
      }];
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Subscribe to store data for backward compatibility
  private subscribeToStoreData(): void {
    this.subscriptions.add(
      this.profile$.subscribe(profile => {
        if (profile) {
          this.userProfile = this.mapUserToProfile(profile);
          this.populateForm();
        }
        this.cdr.markForCheck();
      })
    );

    this.subscriptions.add(
      this.profileLoading$.subscribe(loading => {
        this.isLoading = loading;
        this.cdr.markForCheck();
      })
    );

    this.subscriptions.add(
      this.profileError$.subscribe(error => {
        if (error) {
          console.error('Error loading profile:', error);
          this.notificationService.error(ERROR_MESSAGES.NETWORK.SERVER_ERROR);
        }
      })
    );
  }

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
      },
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: this.dateService.toTimestamp(user.updatedAt) || new Date(),
    };
  }

  private populateForm(): void {
    if (this.userProfile) {
      this.profileForm.patchValue({
        firstName: this.userProfile.firstName,
        lastName: this.userProfile.lastName,
        email: this.userProfile.email,
        phone: this.userProfile.phone || '',
        dateOfBirth: this.userProfile.dateOfBirth || '',
        occupation: this.userProfile.occupation || '',
        monthlyIncome: this.userProfile.monthlyIncome || 0,
        preferences: {
          defaultCurrency: this.userProfile.preferences?.defaultCurrency || this.defaultCurrency,
          timezone: this.userProfile.preferences?.timezone || 'UTC',
          language: this.userProfile.preferences?.language || APP_CONFIG.REGIONAL.LANGUAGE_DEFAULT,
          country: this.userProfile.preferences?.country || this.deriveCountryFromLanguage(this.userProfile.preferences?.language || APP_CONFIG.REGIONAL.LANGUAGE_DEFAULT),
          notifications: this.userProfile.preferences?.notifications || true,
          emailUpdates: this.userProfile.preferences?.emailUpdates || true,
          budgetAlerts: this.userProfile.preferences?.budgetAlerts || true,
          categoryListViewMode: this.userProfile.preferences?.categoryListViewMode || false,
          appView: this.userProfile.preferences?.appView || 'MONTHLY',
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

  toggleEdit(): void {
    if (this.isEditing) {
      // Trying to save
      this.saveProfile();
    } else {
      // Trying to edit
      this.isEditing = true;
      this.profileForm.enable();
      this.quickActionsFabConfig = {
        ...this.quickActionsFabConfig,
        mainButtonIcon: 'save',
        mainButtonTooltip: 'Save Profile'
      };
    }
  }

  async saveProfile(): Promise<void> {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      this.notificationService.warning(
        ERROR_MESSAGES.VALIDATION.REQUIRED_FIELD
      );
      return;
    }

    try {
      this.isLoading = true;
      const formValue = this.profileForm.value;

      if (this.userProfile) {
        const updatedUser: User = {
          uid: this.userProfile.uid,
          email: formValue.email,
          role: this.userProfile.role || UserRole.FREE,
          createdAt: this.userProfile.createdAt,
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
          // For guest users, save to storage and update userAuth$
          this.userService.storageService.setItem(`user-data-${updatedUser.uid}`, updatedUser);
          this.userService.userAuth$.next(updatedUser);

          // Update local userProfile
          this.userProfile = updatedUser;

          this.notificationService.success('Profile updated successfully (saved locally)');
        } else {
          // For authenticated users, dispatch to store (which will update Firestore)
          this.store.dispatch(ProfileActions.updateProfile({
            userId: this.userProfile.uid,
            profile: updatedUser
          }));

          this.notificationService.success(SUCCESS_MESSAGES.GENERAL.UPDATED);
        }

        // Sync language with translation service
        if (updatedUser.preferences?.language) {
          this.translationService.setLanguage(updatedUser.preferences.language as Language);
        }

        this.isEditing = false;
        this.profileForm.disable();

        // Reset FAB state
        this.quickActionsFabConfig = {
          ...this.quickActionsFabConfig,
          mainButtonIcon: 'edit',
          mainButtonTooltip: 'Edit Profile'
        };
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      this.notificationService.error(ERROR_MESSAGES.NETWORK.SERVER_ERROR);
    } finally {
      this.isLoading = false;
    }
  }

  async signInWithGoogle(): Promise<void> {
    try {
      this.isLoading = true;
      await this.userService.signInWithGoogle();

      // After successful sign-in, the auth state change listener in UserService 
      // will update the userAuth$ subject, which we are subscribed to.
      // However, we might want to manually refresh the profile or navigate if needed.
      // For now, the existing subscription should handle the UI update.

      this.notificationService.success('Successfully signed in with Google');
      window.location.reload();
    } catch (error) {
      console.error('Error signing in with Google:', error);
      this.notificationService.error(ERROR_MESSAGES.NETWORK.SERVER_ERROR);
    } finally {
      this.isLoading = false;
    }
  }

  cancelEdit(): void {
    this.populateForm();
    this.isEditing = false;
    this.profileForm.disable();

    // Reset FAB state
    this.quickActionsFabConfig = {
      ...this.quickActionsFabConfig,
      mainButtonIcon: 'edit',
      mainButtonTooltip: 'Edit Profile'
    };

    this.notificationService.info('Changes cancelled');
  }

  async deleteAccount(): Promise<void> {
    if (this.userService.isGuestUser()) {
      this.notificationService.warning('Guest accounts cannot be deleted. Simply logout or clear browser data.');
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
          this.isLoading = true;
          // Delete user account from Firebase Auth
          await this.currentUser.delete();
          this.notificationService.success('Account deleted successfully');
          this.router.navigate(['/sign-in']);
        } catch (error) {
          console.error('Error deleting account:', error);
          this.notificationService.error(ERROR_MESSAGES.NETWORK.SERVER_ERROR);
        } finally {
          this.isLoading = false;
        }
      }
    });
  }

  async changePassword(): Promise<void> {
    if (this.userService.isGuestUser()) {
      this.notificationService.warning('Password change is not available for guest users.');
      return;
    }
    this.notificationService.info('Password change feature coming soon');
  }

  async exportData(): Promise<void> {
    try {
      // Check if export functionality is enabled
      if (!APP_CONFIG.FEATURES.EXPORT_FUNCTIONALITY) {
        this.notificationService.warning(ERROR_MESSAGES.PERMISSION.FEATURE_NOT_AVAILABLE);
        return;
      }

      // Use the newly implemented local backup service
      await this.backupRestoreService.exportData();

      this.notificationService.success(SUCCESS_MESSAGES.BACKUP.EXPORT_SUCCESS);
    } catch (error) {
      console.error('Error exporting data:', error);
      this.notificationService.error(ERROR_MESSAGES.NETWORK.SERVER_ERROR);
    }
  }

  getFullName(): string {
    if (this.userProfile) {
      return `${this.userProfile.firstName} ${this.userProfile.lastName}`.trim();
    }
    return 'User';
  }

  // getCurrencySymbol(currencyCode: string): string {
  //   return CurrencyPipe.getCurrencySymbol(currencyCode);
  // }

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
    if (!date) {
      return 'N/A';
    }

    // Handle Firestore Timestamp
    if (date?.seconds) {
      return dayjs(date.seconds * 1000).format('MMM DD, YYYY');
    }

    // Handle Date object or timestamp
    return dayjs(date).format('MMM DD, YYYY');
  }

  // Error handling methods
  getFirstNameError(): string {
    const control = this.profileForm.get('firstName');
    return control ? this.validationService.getProfileNameError(control) : '';
  }

  getLastNameError(): string {
    const control = this.profileForm.get('lastName');
    return control ? this.validationService.getProfileNameError(control) : '';
  }

  getEmailError(): string {
    const control = this.profileForm.get('email');
    return control ? this.validationService.getProfileEmailError(control) : '';
  }

  getPhoneError(): string {
    const control = this.profileForm.get('phone');
    return control ? this.validationService.getProfilePhoneError(control) : '';
  }

  getOccupationError(): string {
    const control = this.profileForm.get('occupation');
    return control ? this.validationService.getProfileOccupationError(control) : '';
  }

  getIncomeError(): string {
    const control = this.profileForm.get('monthlyIncome');
    return control ? this.validationService.getProfileIncomeError(control) : '';
  }

  /**
   * Check if current user is in guest mode
   */
  isGuestMode(): boolean {
    return this.userService.isGuestUser();
  }

}
