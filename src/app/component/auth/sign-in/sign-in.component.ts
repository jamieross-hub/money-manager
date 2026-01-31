import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
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

/**
 * Enhanced SignInComponent with comprehensive security validation
 * Implements rate limiting, input validation, security monitoring, and audit logging
 */
@Component({
  selector: 'app-sign-in',
  templateUrl: './sign-in.component.html',
  styleUrl: './sign-in.component.scss'
})
export class SignInComponent implements OnInit, OnDestroy {
  public isSignInPage = true;
  public isLoading = false;
  public isAccountLocked = false;
  public lockoutTimeRemaining = 0;
  public loginAttempts = 0;
  public maxLoginAttempts = 5;
  public showPassword = false;
  public showConfirmPassword = false;
  public passwordStrength = 0;
  public securityLevel = 'moderate';
  public showSecurityNotice = false;

  signInForm!: FormGroup;
  private destroy$ = new Subject<void>();
  private loginAttemptCount = 0;
  private lastLoginAttempt = 0;
  private rateLimitWindow = 60000; // 1 minute
  private maxAttemptsPerWindow = 3;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private userService: UserService,
    private notificationService: NotificationService,
    private securityService: SecurityService,
    private validationService: ValidationService,
    private store: Store<AppState>,
    public breakpointService: BreakpointService
  ) {
    this.initializeForm();
    this._setIsSignInPage(this.router.url.includes('/sign-in'));
    this.checkQueryParams();
  }

  ngOnInit(): void {
    // Check if user is already in guest/offline mode
    if (localStorage.getItem('guest-mode') === 'true') {
      this.continueAsGuest();
      return;
    }

    this.setupFormValidation();
    this.checkSecurityStatus();
    this.startSecurityMonitoring();

    // Show security notice after main form is loaded for better LCP
    setTimeout(() => {
      this.showSecurityNotice = true;
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
        this.passwordStrength = this.calculatePasswordStrength(password);
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
      this.isAccountLocked = securityStatus.isLocked;
      this.loginAttempts = securityStatus.loginAttempts;
      this.maxLoginAttempts = securityStatus.remainingAttempts + securityStatus.loginAttempts;

      if (this.isAccountLocked) {
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
    if (this.isAccountLocked) {
      this.notificationService.error(`Account is temporarily locked. Please try again in ${Math.ceil(this.lockoutTimeRemaining / 60000)} minutes.`);
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
      this.isLoading = true;
      this.loginAttemptCount++;
      this.lastLoginAttempt = Date.now();

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

      this.router.navigate(['/dashboard']);

    } catch (error: any) {
      this.handleSignInError(error, email);
    } finally {
      this.isLoading = false;
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
    if (this.passwordStrength < 3) {
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
      this.isLoading = true;

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
      this.isLoading = false;
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
      this.isLoading = true;

      // Force sign out first to clear any stale state
      try {
        await this.userService.signOut();
      } catch (e) {
        // Ignore error if already signed out
        console.log('Pre-sign-in logout skipped or failed', e);
      }

      this.isLoading = true;

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

      this.router.navigate(['/dashboard']);

    } catch (error: any) {
      this.handleGoogleSignInError(error);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Continue as guest (Offline Mode)
   */
  public async continueAsGuest(): Promise<void> {
    this.isLoading = true;
    try {
      await this.userService.enableGuestMode();

      // Load user data for the guest user
      const guestUid = 'offline-guest';
      await this.loadUserData(guestUid);

      this.notificationService.success('Logged in as Guest (Offline Mode)');
      this.router.navigate(['/dashboard']);
    } catch (error) {
      console.error('Guest mode error:', error);
      this.notificationService.error('Failed to enable guest mode');
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Load user data after successful authentication
   */
  private async loadUserData(specificUserId?: string): Promise<void> {
    try {
      const uid = specificUserId || this.userService.userAuth$.value?.uid;

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
        this.isAccountLocked = true;
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
      this.notificationService.error('Sign-in was cancelled. Please try again.');
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
    const timeSinceLastAttempt = now - this.lastLoginAttempt;

    if (timeSinceLastAttempt < this.rateLimitWindow && this.loginAttemptCount >= this.maxAttemptsPerWindow) {
      return true;
    }

    if (timeSinceLastAttempt >= this.rateLimitWindow) {
      this.loginAttemptCount = 0;
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
      this.lockoutTimeRemaining = Math.max(0, securityStatus.lockoutTime - now);
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
    this.showPassword = !this.showPassword;
  }

  /**
   * Toggle confirm password visibility
   */
  public toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  /**
   * Get password strength text
   */
  public getPasswordStrengthText(): string {
    switch (this.passwordStrength) {
      case 0: return 'Very Weak';
      case 1: return 'Weak';
      case 2: return 'Fair';
      case 3: return 'Good';
      case 4: return 'Strong';
      default: return 'Very Weak';
    }
  }

  /**
   * Get password strength color
   */
  public getPasswordStrengthColor(): string {
    switch (this.passwordStrength) {
      case 0: return 'text-red-500';
      case 1: return 'text-orange-500';
      case 2: return 'text-yellow-500';
      case 3: return 'text-blue-500';
      case 4: return 'text-green-500';
      default: return 'text-red-500';
    }
  }

  /**
   * Get lockout time remaining in minutes
   */
  public getLockoutTimeRemaining(): number {
    return Math.ceil(this.lockoutTimeRemaining / 60000);
  }

  public gotoPage(): void {
    this._setIsSignInPage(!this.isSignInPage);
  }

  private _setIsSignInPage(flag: boolean): void {
    this.isSignInPage = flag;

    if (!this.isSignInPage) {
      this.signInForm.addControl('confirmPassword', this.fb.control('', [Validators.required]));
      this.signInForm.addControl('name', this.fb.control('', [Validators.required, Validators.minLength(2)]));
    } else {
      this.signInForm.removeControl('confirmPassword');
      this.signInForm.removeControl('name');
    }
  }
}
