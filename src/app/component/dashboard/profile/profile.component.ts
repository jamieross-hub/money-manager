import { Component, OnInit, OnDestroy } from '@angular/core';
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
import moment from 'moment';
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

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
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

  fabConfig: QuickActionsFabConfig = {
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
    onMainButtonClick: () => this.toggleEdit(),

  };

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
    private breakpointObserver: BreakpointObserver,
    private userService: UserService,
    private translationService: TranslationService
  ) {
    this.currentUser = this.auth.currentUser;
    this.isMobile = this.breakpointObserver.isMatched('(max-width: 600px)');
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

    // Dispatch action to load profile
    if (this.currentUser) {
      this.store.dispatch(ProfileActions.loadProfile({ userId: this.currentUser.uid }));
    }
    this.subscribeToStoreData();
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
        } else if (this.userService.isGuestUser()) {
          // For guest users, fall back to userAuth$ if store doesn't have profile
          const guestProfile = this.userService.userAuth$.value;
          if (guestProfile) {
            this.userProfile = this.mapUserToProfile(guestProfile);
            this.populateForm();
          }
        }
      })
    );

    this.subscriptions.add(
      this.profileLoading$.subscribe(loading => {
        this.isLoading = loading;
      })
    );

    this.subscriptions.add(
      this.profileError$.subscribe(error => {
        if (error) {
          console.error('Error loading profile:', error);
          // Don't show error for guest users - it's expected that they might not have Firestore data
          if (!this.userService.isGuestUser()) {
            this.notificationService.error(ERROR_MESSAGES.NETWORK.SERVER_ERROR);
          }
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
        language: user.preferences?.language || APP_CONFIG.REGIONAL.LANGUAGE_DEFAULT,
        country: user.preferences?.country || this.deriveCountryFromLanguage(user.preferences?.language || APP_CONFIG.REGIONAL.LANGUAGE_DEFAULT),
        notifications: user.preferences?.notifications || true,
        emailUpdates: user.preferences?.emailUpdates || true,
        budgetAlerts: user.preferences?.budgetAlerts || true,
        categoryListViewMode: user.preferences?.categoryListViewMode || false,
      },
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: this.dateService.toTimestamp(user.updatedAt) || new Date(),
    };
  }

  // private createDefaultProfile(): User {
  //   return {
  //     uid: this.currentUser.uid,
  //     firstName: this.currentUser.displayName?.split(' ')[0] || '',
  //     lastName:
  //       this.currentUser.displayName?.split(' ').slice(1).join(' ') || '',
  //     email: this.currentUser.email || '',
  //     phone: '',
  //     dateOfBirth: undefined,
  //     occupation: '',
  //     monthlyIncome: 0,
  //     preferences: {
  //       defaultCurrency: this.defaultCurrency,
  //       timezone: 'UTC',
  //       language: APP_CONFIG.LANGUAGE.DEFAULT,
  //       notifications: true,
  //       emailUpdates: true,
  //       budgetAlerts: true,
  //       categoryListViewMode: false,
  //     },
  //     role: UserRole.FREE,
  //     createdAt: new Date(),
  //     updatedAt: new Date(),
  //   };
  // }

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
      this.fabConfig.mainButtonIcon = 'save';
      this.fabConfig.mainButtonTooltip = 'Save Profile';
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
        this.fabConfig.mainButtonIcon = 'edit';
        this.fabConfig.mainButtonTooltip = 'Edit Profile';
      }
    } catch (error) {
      console.error('Error saving profile:', error);
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
    this.fabConfig.mainButtonIcon = 'edit';
    this.fabConfig.mainButtonTooltip = 'Edit Profile';

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

      // TODO: Implement data export functionality
      this.notificationService.info('Data export feature coming soon');
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
      return moment(date.seconds * 1000).format('MMM DD, YYYY');
    }

    // Handle Date object or timestamp
    return moment(date).format('MMM DD, YYYY');
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
