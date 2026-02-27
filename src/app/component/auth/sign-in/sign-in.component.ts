import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { loadAccounts } from 'src/app/store/accounts/accounts.actions';
import { AppState } from 'src/app/store/app.state';
import { loadBudgets } from 'src/app/store/budgets/budgets.actions';
import { loadCategories } from 'src/app/store/categories/categories.actions';
import { loadGoals } from 'src/app/store/goals/goals.actions';
import { loadProfile } from 'src/app/store/profile/profile.actions';
import { loadTransactions } from 'src/app/store/transactions/transactions.actions';
import { NotificationService } from 'src/app/util/service/notification.service';
import { ValidationService } from 'src/app/util/service/validation.service';
import { UserService } from 'src/app/util/service/db/user.service';
import { SecurityService, SecurityEventType, SecurityLevel } from 'src/app/util/service/security.service';
import { BreakpointObserver } from '@angular/cdk/layout';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';
import { CommonModule } from '@angular/common';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatRippleModule } from '@angular/material/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSortModule } from '@angular/material/sort';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PreLoginHeaderComponent } from '../../landing/pre-login-header/pre-login-header.component';

/**
 * Enhanced SignInComponent with comprehensive security validation
 * Implements rate limiting, input validation, security monitoring, and audit logging
 */
@Component({
  selector: 'app-sign-in',
  templateUrl: './sign-in.component.html',
  styleUrl: './sign-in.component.scss',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatRippleModule,
    MatTooltipModule,
    MatDividerModule,
    MatListModule,
    MatTabsModule,
    MatCardModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    MatAutocompleteModule,
    MatExpansionModule,
    MatChipsModule,
    MatSnackBarModule,
    MatSliderModule,
    MatStepperModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    TranslateModule,
    MatProgressSpinnerModule,
    PreLoginHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SignInComponent implements OnInit, OnDestroy {
  public readonly isSignInPage = signal(true);
  public readonly isLoading = signal(false);
  public readonly isAccountLocked = signal(false);
  public readonly lockoutTimeRemaining = signal(0);
  public readonly loginAttempts = signal(0);
  public readonly maxLoginAttempts = signal(5);
  public readonly showPassword = signal(false);
  public readonly showConfirmPassword = signal(false);
  public readonly passwordStrength = signal(0);
  public readonly securityLevel = signal('moderate');
  public readonly showSecurityNotice = signal(false);

  signInForm!: FormGroup;
  private readonly destroy$ = new Subject<void>();
  private readonly loginAttemptCount = signal(0);
  private readonly lastLoginAttempt = signal(0);
  private readonly rateLimitWindow = 60000; // 1 minute
  private readonly maxAttemptsPerWindow = 3;

  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly userService = inject(UserService);
  private readonly notificationService = inject(NotificationService);
  private readonly securityService = inject(SecurityService);
  private readonly validationService = inject(ValidationService);
  private readonly store = inject(Store<AppState>);
  public readonly breakpointService = inject(BreakpointService);

  public readonly lockoutTimeRemainingMinutes = computed(() =>
    Math.ceil(this.lockoutTimeRemaining() / 60000)
  );

  public readonly passwordStrengthText = computed(() => {
    switch (this.passwordStrength()) {
      case 0: return 'Very Weak';
      case 1: return 'Weak';
      case 2: return 'Fair';
      case 3: return 'Good';
      case 4: return 'Strong';
      default: return 'Very Weak';
    }
  });

  public readonly passwordStrengthColor = computed(() => {
    switch (this.passwordStrength()) {
      case 0: return 'text-red-500';
      case 1: return 'text-orange-500';
      case 2: return 'text-yellow-500';
      case 3: return 'text-blue-500';
      case 4: return 'text-green-500';
      default: return 'text-red-500';
    }
  });

  constructor() {
    this.initializeForm();
    this._setIsSignInPage(this.router.url.includes('/sign-in'));
    this.checkQueryParams();
  }

  ngOnInit(): void {
    // Check if user is already in guest/offline mode
    if (this.userService.isGuestModeEnabled()) {
      this.continueAsGuest();
      return;
    }

    this.setupFormValidation();
    this.checkSecurityStatus();
    this.startSecurityMonitoring();

    // Show security notice after main form is loaded for better LCP
    setTimeout(() => {
      this.showSecurityNotice.set(true);
    }, 100);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Initialize the form with enhanced validation
   */
  private initializeForm(): void {
    this.signInForm = this.fb.group({
      email: ['', [
        ...this.validationService.getProfileEmailValidators(),
        this.emailDomainValidator.bind(this)
      ]],
      password: ['', [
        ...this.validationService.getAuthPasswordValidators(),
        this.passwordStrengthValidator.bind(this)
      ]],
    });
  }

  /**
   * Setup form validation with real-time feedback
   */
  private setupFormValidation(): void {
    // Monitor password strength in real-time
    this.signInForm.get('password')?.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(password => {
        this.passwordStrength.set(this.calculatePasswordStrength(password));
      });

    // Monitor email for suspicious patterns
    this.signInForm.get('email')?.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe(email => {
        this.monitorEmailInput(email);
      });
  }

  /**
   * Check query parameters for security-related messages
   */
  private checkQueryParams(): void {
    this.route.queryParams.subscribe(params => {
      if (params['error']) {
        this.handleSecurityError(params['error'], params['message']);
      }
      if (params['session'] === 'expired') {
        this.notificationService.warning('Your session has expired. Please sign in again.');
      }
      if (params['cacheUpdate'] === 'true') {
        this.notificationService.info('Application updated. Please sign in again.');
      }
    });
  }

  /**
   * Check current security status
   */
  private checkSecurityStatus(): void {
    const securityStatus = this.userService.getSecurityStatus();
    if (securityStatus) {
      this.isAccountLocked.set(securityStatus.isLocked);
      this.loginAttempts.set(securityStatus.loginAttempts);
      this.maxLoginAttempts.set(securityStatus.remainingAttempts + securityStatus.loginAttempts);

      if (this.isAccountLocked()) {
        this.calculateLockoutTime();
      }
    }
  }

  /**
   * Start security monitoring
   */
  private startSecurityMonitoring(): void {
    // Monitor for suspicious activity
    setInterval(() => {
      this.checkSecurityStatus();
    }, 10000); // Check every 10 seconds
  }

  /**
   * Enhanced sign-in with security validation
   */
  async onSignIn(): Promise<void> {
    if (!this.signInForm.valid) {
      this.notificationService.error('Please fill all required fields correctly');
      this.markFormGroupTouched();
      return;
    }

    // Check rate limiting
    if (this.isRateLimited()) {
      this.notificationService.error('Too many login attempts. Please wait before trying again.');
      return;
    }

    // Check if account is locked
    if (this.isAccountLocked()) {
      this.notificationService.error(`Account is temporarily locked. Please try again in ${this.lockoutTimeRemainingMinutes()} minutes.`);
      return;
    }

    const email = this.signInForm.get('email')?.value;
    const password = this.signInForm.get('password')?.value;

    // Log login attempt
    this.securityService.logSecurityEvent(
      SecurityEventType.LOGIN_ATTEMPT,
      SecurityLevel.MEDIUM,
      { email, timestamp: new Date().toISOString() }
    );

    try {
      this.isLoading.set(true);
      this.loginAttemptCount.update(c => c + 1);
      this.lastLoginAttempt.set(Date.now());

      const user = await this.userService.signIn(email, password);

      // Log successful login
      this.securityService.logSecurityEvent(
        SecurityEventType.LOGIN_SUCCESS,
        SecurityLevel.LOW,
        { email, timestamp: new Date().toISOString() }
      );

      if (!user.user?.emailVerified) {
        await this.userService.signOut();
        this.notificationService.error('Please verify your email address for access!');
        return;
      }

      // Load user data
      if (user.user?.uid) {
        await this.loadUserData(user.user.uid);
      }

      this.navigateAfterSignIn();

    } catch (error: any) {
      this.handleSignInError(error, email);
    } finally {
      this.isLoading.set(false);
    }
  }


  /**
   * Enhanced sign-up with security validation
   */
  async onSignUp(): Promise<void> {
    if (!this.signInForm.valid) {
      this.notificationService.error('Please fill all required fields correctly');
      this.markFormGroupTouched();
      return;
    }

    // Check password strength
    if (this.passwordStrength() < 3) {
      this.notificationService.error('Password is too weak. Please choose a stronger password.');
      return;
    }

    // Check password confirmation
    if (this.signInForm.get('password')?.value !== this.signInForm.get('confirmPassword')?.value) {
      this.notificationService.error('Passwords do not match');
      this.signInForm.get('confirmPassword')?.setErrors({ 'notMatch': true });
      return;
    }

    const email = this.signInForm.get('email')?.value;
    const password = this.signInForm.get('password')?.value;
    const name = this.signInForm.get('name')?.value || 'User';

    // Log registration attempt
    this.securityService.logSecurityEvent(
      SecurityEventType.SECURITY_ALERT,
      SecurityLevel.MEDIUM,
      {
        type: 'registration_attempt',
        email,
        timestamp: new Date().toISOString()
      }
    );

    try {
      this.isLoading.set(true);

      await this.userService.signUp(email, password, name);

      // Log successful registration
      this.securityService.logSecurityEvent(
        SecurityEventType.SECURITY_ALERT,
        SecurityLevel.LOW,
        {
          type: 'registration_success',
          email,
          timestamp: new Date().toISOString()
        }
      );

      this.notificationService.success('Account created successfully! Please check your email for verification.');
      this._setIsSignInPage(true);

    } catch (error: any) {
      this.handleSignUpError(error, email);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Enhanced Google sign-in with security monitoring
   */
  public async signInWithGoogle(): Promise<void> {
    // Check rate limiting
    if (this.isRateLimited()) {
      this.notificationService.error('Too many sign-in attempts. Please wait before trying again.');
      return;
    }

    try {
      this.isLoading.set(true);

      // Force sign out first to clear any stale state
      try {
        await this.userService.signOut();
      } catch (e) {
        // Ignore error if already signed out
        console.log('Pre-sign-in logout skipped or failed', e);
      }

      // Log Google sign-in attempt
      this.securityService.logSecurityEvent(
        SecurityEventType.LOGIN_ATTEMPT,
        SecurityLevel.MEDIUM,
        {
          method: 'google',
          timestamp: new Date().toISOString()
        }
      );

      await this.userService.signInWithGoogle();

      // Log successful Google sign-in
      this.securityService.logSecurityEvent(
        SecurityEventType.LOGIN_SUCCESS,
        SecurityLevel.LOW,
        {
          method: 'google',
          timestamp: new Date().toISOString()
        }
      );

      this.notificationService.success('Successfully signed in with Google!');

      // Load user data
      await this.loadUserData();

      this.navigateAfterSignIn();

    } catch (error: any) {
      this.handleGoogleSignInError(error);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Continue as guest (Offline Mode)
   */
  public async continueAsGuest(): Promise<void> {
    this.isLoading.set(true);
    try {
      await this.userService.enableGuestMode();

      // Load user data for the guest user
      const guestUid = 'offline-guest';
      await this.loadUserData(guestUid);

      this.notificationService.success('Logged in as Guest (Offline Mode)');
      this.navigateAfterSignIn();
    } catch (error) {
      console.error('Guest mode error:', error);
      this.notificationService.error('Failed to enable guest mode');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Load user data after successful authentication
   */
  private async loadUserData(specificUserId?: string): Promise<void> {
    try {
      const uid = specificUserId || this.userService.getCurrentUserId();

      if (!uid) {
        console.warn('No user ID available for loading data');
        return;
      }

      await Promise.all([
        this.store.dispatch(loadTransactions({ userId: uid })),
        this.store.dispatch(loadCategories({ userId: uid })),
        this.store.dispatch(loadAccounts({ userId: uid })),
        this.store.dispatch(loadBudgets({ userId: uid })),
        this.store.dispatch(loadGoals({ userId: uid })),
        this.store.dispatch(loadProfile({ userId: uid }))
      ]);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }

  /**
   * Centralized navigation after successful sign-in
   */
  private navigateAfterSignIn(): void {
    if (this.userService.getCurrentUserSnapshot()?.preferences?.isFamilyMode) {
      this.router.navigate(['/dashboard/family']);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  /**
   * Handle sign-in errors with security logging
   */
  private handleSignInError(error: any, email: string): void {
    console.error('Sign-in error:', error);

    // Log failed login attempt
    this.securityService.logSecurityEvent(
      SecurityEventType.LOGIN_FAILED,
      SecurityLevel.HIGH,
      {
        email,
        error: error.message || 'Unknown error',
        timestamp: new Date().toISOString()
      }
    );

    // Handle specific error cases
    switch (error.code) {
      case 'auth/user-not-found':
        this.notificationService.error('No account found with this email address.');
        break;
      case 'auth/wrong-password':
        this.notificationService.error('Incorrect password. Please try again.');
        break;
      case 'auth/too-many-requests':
        this.notificationService.error('Too many failed attempts. Please try again later.');
        this.isAccountLocked.set(true);
        break;
      case 'auth/user-disabled':
        this.notificationService.error('This account has been disabled. Please contact support.');
        break;
      case 'auth/invalid-email':
        this.notificationService.error('Invalid email address format.');
        break;
      default:
        this.notificationService.error(error.message || 'Sign-in failed. Please try again.');
    }
  }

  /**
   * Handle sign-up errors with security logging
   */
  private handleSignUpError(error: any, email: string): void {
    console.error('Sign-up error:', error);

    // Log failed registration
    this.securityService.logSecurityEvent(
      SecurityEventType.SECURITY_ALERT,
      SecurityLevel.HIGH,
      {
        type: 'registration_failed',
        email,
        error: error.message || 'Unknown error',
        timestamp: new Date().toISOString()
      }
    );

    // Handle specific error cases
    switch (error.code) {
      case 'auth/email-already-in-use':
        this.notificationService.error('An account with this email already exists.');
        break;
      case 'auth/weak-password':
        this.notificationService.error('Password is too weak. Please choose a stronger password.');
        break;
      case 'auth/invalid-email':
        this.notificationService.error('Invalid email address format.');
        break;
      default:
        this.notificationService.error(error.message || 'Registration failed. Please try again.');
    }
  }

  /**
   * Handle Google sign-in errors
   */
  private handleGoogleSignInError(error: any): void {
    console.error('Google sign-in error:', error);

    // Log failed Google sign-in
    this.securityService.logSecurityEvent(
      SecurityEventType.LOGIN_FAILED,
      SecurityLevel.MEDIUM,
      {
        method: 'google',
        error: error.message || 'Unknown error',
        code: error.code || 'no_code',
        timestamp: new Date().toISOString()
      }
    );

    // Handle specific error cases
    if (error.code === 'auth/popup-closed-by-user') {
      // Don't show error for explicit cancellation
      console.log('Sign-in was cancelled by user');
    } else if (error.code === 'auth/popup-blocked') {
      this.notificationService.error('Popup was blocked. Please allow popups for this site and try again.');
    } else if (error.code === 'auth/cancelled-popup-request') {
      this.notificationService.error('Sign-in request was cancelled. Please try again.');
    } else if (error.code === 'auth/account-exists-with-different-credential') {
      this.notificationService.error('An account already exists with the same email address but different sign-in credentials. Sign in using a provider associated with this email address.');
    } else {
      this.notificationService.error(`Google sign-in failed: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Handle security errors from query parameters
   */
  private handleSecurityError(errorType: string, message?: string): void {
    switch (errorType) {
      case 'unauthorized':
        this.notificationService.error('Session expired. Please sign in again.');
        break;
      case 'insufficient_permissions':
        this.notificationService.error('You do not have permission to access that page.');
        break;
      case 'security_error':
        this.notificationService.error(message || 'A security error occurred.');
        break;
      case 'auth_failed':
        this.notificationService.error('Authentication failed. Please try again.');
        break;
      default:
        this.notificationService.error('An error occurred. Please try again.');
    }
  }

  /**
   * Check if user is rate limited
   */
  private isRateLimited(): boolean {
    const now = Date.now();
    const timeSinceLastAttempt = now - this.lastLoginAttempt();

    if (timeSinceLastAttempt < this.rateLimitWindow && this.loginAttemptCount() >= this.maxAttemptsPerWindow) {
      return true;
    }

    if (timeSinceLastAttempt >= this.rateLimitWindow) {
      this.loginAttemptCount.set(0);
    }

    return false;
  }

  /**
   * Calculate lockout time remaining
   */
  private calculateLockoutTime(): void {
    const securityStatus = this.userService.getSecurityStatus();
    if (securityStatus && securityStatus.lockoutTime) {
      const now = Date.now();
      this.lockoutTimeRemaining.set(Math.max(0, securityStatus.lockoutTime - now));
    }
  }

  /**
   * Calculate password strength (0-4)
   */
  private calculatePasswordStrength(password: string): number {
    if (!password) return 0;

    let strength = 0;

    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    return Math.min(strength, 4);
  }

  /**
   * Monitor email input for suspicious patterns
   */
  private monitorEmailInput(email: string): void {
    if (!email) return;

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /test/i,
      /admin/i,
      /root/i,
      /temp/i,
      /fake/i
    ];

    if (suspiciousPatterns.some(pattern => pattern.test(email))) {
      this.securityService.logSecurityEvent(
        SecurityEventType.SUSPICIOUS_ACTIVITY,
        SecurityLevel.MEDIUM,
        {
          type: 'suspicious_email',
          email,
          timestamp: new Date().toISOString()
        }
      );
    }
  }

  /**
   * Custom email domain validator
   */
  private emailDomainValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;

    const email = control.value.toLowerCase();
    const disposableDomains = [
      'tempmail.org', '10minutemail.com', 'guerrillamail.com',
      'mailinator.com', 'throwaway.email', 'temp-mail.org'
    ];

    const domain = email.split('@')[1];
    if (disposableDomains.includes(domain)) {
      return { disposableEmail: true };
    }

    return null;
  }

  /**
   * Custom password strength validator
   */
  private passwordStrengthValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;

    const password = control.value;
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (password.length < minLength) {
      return { minLength: { requiredLength: minLength, actualLength: password.length } };
    }

    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
      return { passwordStrength: true };
    }

    return null;
  }

  /**
   * Mark all form controls as touched
   */
  private markFormGroupTouched(): void {
    Object.keys(this.signInForm.controls).forEach(key => {
      const control = this.signInForm.get(key);
      control?.markAsTouched();
    });
  }

  /**
   * Toggle password visibility
   */
  public togglePasswordVisibility(): void {
    this.showPassword.update(v => !v);
  }

  public toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update(v => !v);
  }

  /**
   * Get password strength text
   */
  public getPasswordStrengthText(): string {
    return this.passwordStrengthText();
  }

  /**
   * Get password strength color
   */
  public getPasswordStrengthColor(): string {
    return this.passwordStrengthColor();
  }

  /**
   * Get lockout time remaining in minutes
   */
  public getLockoutTimeRemaining(): number {
    return this.lockoutTimeRemainingMinutes();
  }

  public gotoPage(): void {
    this._setIsSignInPage(!this.isSignInPage());
  }

  private _setIsSignInPage(flag: boolean): void {
    this.isSignInPage.set(flag);

    if (!this.isSignInPage()) {
      this.signInForm.addControl('confirmPassword', this.fb.control('', [Validators.required]));
      this.signInForm.addControl('name', this.fb.control('', [Validators.required, Validators.minLength(2)]));
    } else {
      this.signInForm.removeControl('confirmPassword');
      this.signInForm.removeControl('name');
    }
  }
}
