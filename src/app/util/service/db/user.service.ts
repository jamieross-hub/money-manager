import { Injectable } from '@angular/core';
import {
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  UserCredential,
  onAuthStateChanged,
  getAuth,
  GoogleAuthProvider,
  updateProfile,
  signInWithPopup,
  user,
  sendEmailVerification,
  sendPasswordResetEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from '@angular/fire/auth';
import {
  Firestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  writeBatch,
  collection,
  query,
  where,
  getDocs,
  limit,
  deleteDoc
} from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, throwError, timer, firstValueFrom } from 'rxjs';
import { catchError, retry, timeout, map } from 'rxjs/operators';

import { defaultBankAccounts } from 'src/app/component/auth/registration/registration.component';
import { NotificationService } from '../notification.service';
import { TranslationService, Language } from '../translation.service';
import {
  User,
  FirebaseAuthError,
} from '../../models';
import { Timestamp } from '@angular/fire/firestore';
import { AppState } from 'src/app/store/app.state';
import { Store } from '@ngrx/store';
import { createAccount } from 'src/app/store/accounts/accounts.actions';
import { createCategory } from 'src/app/store/categories/categories.actions';
import { AccountType } from '../../config/enums';
import { APP_CONFIG, defaultCategoriesForNewUser } from '../../config/config';
import * as CategoriesActions from 'src/app/store/categories/categories.actions';
import * as AccountsActions from 'src/app/store/accounts/accounts.actions';
import { CurrencyDetectionUtil } from '../../helpers/currency-detection.util';
import { LocalIndexDBStorageService } from '../indexdb-storage.service';
import { LocalStorageKey } from '../../models/local-storage.model';

/**
 * Security configuration for user operations
 */
interface UserSecurityConfig {
  readonly MAX_LOGIN_ATTEMPTS: number;
  readonly LOCKOUT_DURATION: number;
  readonly PASSWORD_MIN_LENGTH: number;
  readonly PASSWORD_REQUIREMENTS: RegExp;
  readonly EMAIL_VERIFICATION_TIMEOUT: number;
  readonly RATE_LIMIT_WINDOW: number;
  readonly MAX_REQUESTS_PER_WINDOW: number;
}

const USER_SECURITY_CONFIG: UserSecurityConfig = {
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_REQUIREMENTS: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  EMAIL_VERIFICATION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours
  RATE_LIMIT_WINDOW: 60 * 1000, // 1 minute
  MAX_REQUESTS_PER_WINDOW: 10
};

/**
 * Rate limiting interface
 */
interface RateLimitEntry {
  count: number;
  windowStart: number;
}

/**
 * Enhanced UserService with production-level security
 * Handles user authentication, authorization, and data management with comprehensive security measures
 */
@Injectable({
  providedIn: 'root',
})
export class UserService {
  public readonly userAuth$ = new BehaviorSubject<User | null>(null);
  public readonly googleAccessToken$ = new BehaviorSubject<string | null>(null);
  public isAdmin: boolean = false;

  // Security tracking
  private readonly loginAttempts = new Map<string, { count: number; lastAttempt: number; lockedUntil?: number }>();
  private readonly rateLimitMap = new Map<string, RateLimitEntry>();
  private readonly auditLog: Array<{ timestamp: Date; event: string; userId?: string; details: any }> = [];

  constructor(
    private readonly notificationService: NotificationService,
    private readonly auth: Auth,
    private readonly router: Router,
    private readonly afAuth: Auth,
    private readonly firestore: Firestore,
    private readonly store: Store<AppState>,
    public readonly storageService: LocalIndexDBStorageService,
    private readonly translationService: TranslationService
  ) {
    this.initializeAuthState();
    this.startSecurityMonitoring();
  }

  /**
   * Initialize authentication state listener with enhanced security
   */
  private initializeAuthState(): void {
    onAuthStateChanged(getAuth(), async (user: any) => {
      // Check for guest mode
      const isGuest = this.storageService.getItem(LocalStorageKey.GUEST_MODE) === 'true';

      if (!user && isGuest) {
        console.log('Restoring guest session');
        this.enableGuestMode();
        return;
      }

      await this.checkIfAdmin(user);
      console.log(
        'Auth state changed:',
        user ? 'User logged in' : 'User logged out'
      );

      if (user) {
        let userData = await this.getCurrentUser();

        // Sync vital display info from Auth object if missing in Firestore/Cache
        if (userData) {
          userData = { ...userData };
          if (!userData.photoURL && user.photoURL) userData.photoURL = user.photoURL;
          if (!userData.displayName && user.displayName) userData.displayName = user.displayName;
        }

        this.userAuth$.next(userData);
        if (userData?.preferences?.language) {
          this.translationService.setLanguage(userData.preferences.language as Language);
        }

        this.ensureUserDataCached(user.uid);
        this.logAuditEvent('USER_LOGIN', user.uid, {
          email: user.email,
          provider: user.providerData[0]?.providerId
        });

        // Check for suspicious activity
        this.detectSuspiciousActivity(user);
      } else {
        this.userAuth$.next(null);
        this.logAuditEvent('USER_LOGOUT', undefined, { timestamp: new Date().toISOString() });
      }
    });
  }

  /**
   * Enable guest/offline mode
   */
  public async enableGuestMode(): Promise<void> {
    // Check if guest user data already exists in storageService
    const existingGuestData = this.storageService.getItem<User>('user-data-offline-guest');
    let guestUser: User;

    if (existingGuestData) {
      // Load existing guest profile
      try {
        guestUser = existingGuestData;
        console.log('Loaded existing guest user data');
      } catch (error) {
        console.error('Error parsing guest user data, creating new:', error);
        guestUser = this.createDefaultGuestUser();
        // Save the newly created guest user
        this.storageService.setItem('user-data-offline-guest', guestUser);
      }
    } else {
      // Create new guest user
      guestUser = this.createDefaultGuestUser();
      // Save to storage immediately so preferences (including currency) persist
      this.storageService.setItem('user-data-offline-guest', guestUser);
      console.log('Created new guest user with detected currency:', guestUser.preferences?.defaultCurrency);
    }

    this.storageService.setItem(LocalStorageKey.GUEST_MODE, 'true');
    this.userAuth$.next(guestUser);

    // Sync language for guest
    if (guestUser.preferences?.language) {
      this.translationService.setLanguage(guestUser.preferences.language as Language);
    }

    // Check if data is already initialized for guest
    if (!this.storageService.hasItem('guest-data-initialized')) {
      await this.setupDefaultData('offline-guest');
      this.storageService.setItem('guest-data-initialized', 'true');
    }

    // We treat the guest user as logged in for the app state
    console.log('Guest mode enabled');
  }

  private createDefaultGuestUser(): User {
    // Detect regional configuration based on user's location/locale
    const regionalConfig = CurrencyDetectionUtil.detectRegionalConfig();

    return {
      uid: 'offline-guest',
      email: 'guest@offline.local',
      role: 'free',
      firstName: 'Guest',
      lastName: 'User',
      createdAt: new Date(),
      updatedAt: new Date(),
      emailVerified: true,
      preferences: {
        defaultCurrency: regionalConfig.currency,
        timezone: regionalConfig.timezone,
        language: regionalConfig.language,
        country: regionalConfig.country,
        notifications: false,
        emailUpdates: false,
        budgetAlerts: false,
        theme: 'light-theme'
      }
    };
  }

  /**
   * Logout from the application (Firebase or Guest)
   */
  public async logout(): Promise<void> {
    if (this.isGuestUser()) {
      this.storageService.removeItem(LocalStorageKey.GUEST_MODE);
      this.storageService.removeItem('guest-data-initialized');
      this.userAuth$.next(null);
    } else {
      await this.auth.signOut();
    }
  }

  /**
   * Get current user ID (Firebase or Guest)
   */
  public getCurrentUserId(): string | null {
    return this.userAuth$.value?.uid || null;
  }

  /**
   * Check if current user is guest
   */
  public isGuestUser(): boolean {
    return this.userAuth$.value?.uid === 'offline-guest';
  }

  /**
   * Check if guest mode is enabled in storage
   */
  public isGuestModeEnabled(): boolean {
    return this.storageService.getItem(LocalStorageKey.GUEST_MODE) === 'true';
  }

  async checkIfAdmin(user: any): Promise<void> {
    try {
      if (user) {
        const idTokenResult = await user.getIdTokenResult();
        this.isAdmin = !!idTokenResult.claims['admin'];
      } else {
        this.isAdmin = false;
      }
    } catch (error) {
      console.error('Error checking admin claim:', error);
      this.isAdmin = false;
    }
  }

  /**
   * Detect suspicious login activity
   */
  private detectSuspiciousActivity(user: any): void {
    const userAgent = navigator.userAgent;
    const lastLoginInfo = this.storageService.getItem<any>(`last-login-${user.uid}`);

    if (lastLoginInfo) {
      const lastLogin = lastLoginInfo;
      const timeDiff = Date.now() - lastLogin.timestamp;

      // Alert if login from different location/device within short time
      if (timeDiff < 5 * 60 * 1000 && lastLogin.userAgent !== userAgent) {
        this.logAuditEvent('SUSPICIOUS_LOGIN', user.uid, {
          previousUserAgent: lastLogin.userAgent,
          currentUserAgent: userAgent,
          timeDiff
        });

        this.notificationService.warning('New login detected from different device');
      }
    }

    // Store current login info
    this.storageService.setItem(`last-login-${user.uid}`, {
      timestamp: Date.now(),
      userAgent,
      location: window.location.href
    });
  }

  /**
   * Start security monitoring
   */
  private startSecurityMonitoring(): void {
    // Monitor for rate limit violations
    setInterval(() => {
      this.cleanupRateLimits();
    }, USER_SECURITY_CONFIG.RATE_LIMIT_WINDOW);

    // Monitor for locked accounts
    setInterval(() => {
      this.cleanupLockedAccounts();
    }, 60000); // Every minute
  }

  /**
   * Clean up expired rate limits
   */
  private cleanupRateLimits(): void {
    const now = Date.now();
    for (const [key, entry] of this.rateLimitMap.entries()) {
      if (now - entry.windowStart > USER_SECURITY_CONFIG.RATE_LIMIT_WINDOW) {
        this.rateLimitMap.delete(key);
      }
    }
  }

  /**
   * Clean up expired account locks
   */
  private cleanupLockedAccounts(): void {
    const now = Date.now();
    for (const [email, attempt] of this.loginAttempts.entries()) {
      if (attempt.lockedUntil && now > attempt.lockedUntil) {
        this.loginAttempts.delete(email);
        this.logAuditEvent('ACCOUNT_UNLOCKED', undefined, { email });
      }
    }
  }

  /**
   * Check rate limiting
   */
  private checkRateLimit(identifier: string): boolean {
    const now = Date.now();
    const entry = this.rateLimitMap.get(identifier);

    if (!entry || now - entry.windowStart > USER_SECURITY_CONFIG.RATE_LIMIT_WINDOW) {
      this.rateLimitMap.set(identifier, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= USER_SECURITY_CONFIG.MAX_REQUESTS_PER_WINDOW) {
      return false;
    }

    entry.count++;
    return true;
  }

  /**
   * Validate email format and security
   */
  private validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return false;
    }

    // Check for disposable email domains (basic check)
    const disposableDomains = ['tempmail.org', '10minutemail.com', 'guerrillamail.com'];
    const domain = email.split('@')[1];
    if (disposableDomains.includes(domain)) {
      return false;
    }

    return true;
  }

  /**
   * Validate password strength
   */
  private validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < USER_SECURITY_CONFIG.PASSWORD_MIN_LENGTH) {
      errors.push(`Password must be at least ${USER_SECURITY_CONFIG.PASSWORD_MIN_LENGTH} characters long`);
    }

    if (!USER_SECURITY_CONFIG.PASSWORD_REQUIREMENTS.test(password)) {
      errors.push('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character');
    }

    // Check for common passwords
    const commonPasswords = ['password', '123456', 'qwerty', 'admin', 'letmein'];
    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common. Please choose a more secure password');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if account is locked
   */
  private isAccountLocked(email: string): boolean {
    const attempt = this.loginAttempts.get(email);
    if (!attempt) return false;

    if (attempt.lockedUntil && Date.now() < attempt.lockedUntil) {
      return true;
    }

    return false;
  }

  /**
   * Record login attempt
   */
  private recordLoginAttempt(email: string, success: boolean): void {
    const attempt = this.loginAttempts.get(email) || { count: 0, lastAttempt: 0 };

    if (success) {
      this.loginAttempts.delete(email);
    } else {
      attempt.count++;
      attempt.lastAttempt = Date.now();

      if (attempt.count >= USER_SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS) {
        attempt.lockedUntil = Date.now() + USER_SECURITY_CONFIG.LOCKOUT_DURATION;
        this.logAuditEvent('ACCOUNT_LOCKED', undefined, { email, reason: 'max_attempts' });
      }

      this.loginAttempts.set(email, attempt);
    }
  }

  /**
   * Create a new user account with enhanced security
   */
  async signUp(
    email: string,
    password: string,
    name: string
  ): Promise<UserCredential> {
    try {
      // Rate limiting
      if (!this.checkRateLimit(`signup:${email}`)) {
        throw new Error('Too many signup attempts. Please try again later.');
      }

      // Input validation
      if (!this.validateEmail(email)) {
        throw new Error('Invalid email address');
      }

      const passwordValidation = this.validatePassword(password);
      if (!passwordValidation.isValid) {
        throw new Error(passwordValidation.errors.join(', '));
      }

      // Check if user already exists
      const existingUser = await this.checkUserExists(email);
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Create user account
      const userCredential = await createUserWithEmailAndPassword(
        this.auth,
        email,
        password
      );

      if (userCredential.user) {
        await updateProfile(userCredential.user, { displayName: name });

        const regionalConfig = CurrencyDetectionUtil.detectRegionalConfig();
        const newUser: User = {
          uid: userCredential.user.uid,
          firstName: name,
          lastName: '',
          displayName: name,
          photoURL: userCredential.user.photoURL || '',
          email,
          role: 'free',
          createdAt: new Date(),
          updatedAt: new Date(),
          preferences: {
            defaultCurrency: regionalConfig.currency,
            timezone: regionalConfig.timezone,
            language: regionalConfig.language,
            country: regionalConfig.country,
            notifications: true,
            emailUpdates: true,
            budgetAlerts: true,
            theme: 'light-theme'
          }
        };

        await this.createUserInFirestore(userCredential.user.uid, newUser);

        // Send email verification
        if (userCredential.user.email) {
          await sendEmailVerification(userCredential.user);
          this.notificationService.info('Please check your email to verify your account');
        }

        this.logAuditEvent('USER_REGISTRATION', userCredential.user.uid, {
          email,
          name,
          timestamp: new Date().toISOString()
        });
      }

      return userCredential;
    } catch (error) {
      console.error('Error signing up:', error);
      this.logAuditEvent('REGISTRATION_FAILED', undefined, {
        email,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Check if user exists in Firestore
   */
  private async checkUserExists(email: string): Promise<boolean> {
    try {
      const usersRef = collection(this.firestore, 'users');
      const q = query(usersRef, where('email', '==', email), limit(1));
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking user existence:', error);
      return false;
    }
  }

  /**
   * Sign in user with enhanced security
   */
  async signIn(email: string, password: string): Promise<UserCredential> {
    try {
      // Rate limiting
      if (!this.checkRateLimit(`signin:${email}`)) {
        throw new Error('Too many login attempts. Please try again later.');
      }

      // Check if account is locked
      if (this.isAccountLocked(email)) {
        const attempt = this.loginAttempts.get(email);
        const remainingTime = attempt?.lockedUntil ? Math.ceil((attempt.lockedUntil - Date.now()) / 1000 / 60) : 0;
        throw new Error(`Account is temporarily locked. Please try again in ${remainingTime} minutes.`);
      }

      // Input validation
      if (!this.validateEmail(email)) {
        throw new Error('Invalid email address');
      }

      if (!password || password.length < 1) {
        throw new Error('Password is required');
      }

      // Attempt sign in
      const userCredential = await signInWithEmailAndPassword(
        this.auth,
        email,
        password
      );

      if (userCredential.user) {
        // Record successful login
        this.recordLoginAttempt(email, true);

        await this.ensureUserDataCached(userCredential.user.uid);


        this.logAuditEvent('LOGIN_SUCCESS', userCredential.user.uid, {
          email,
          timestamp: new Date().toISOString()
        });
      }

      return userCredential;
    } catch (error) {
      // Record failed login attempt
      this.recordLoginAttempt(email, false);

      console.error('Error signing in:', error);
      this.logAuditEvent('LOGIN_FAILED', undefined, {
        email,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Sign out current user with enhanced security
   */
  async signOut(): Promise<void> {
    try {
      const currentUser = this.auth.currentUser;
      if (currentUser) {
        // Log the sign out event
        this.logAuditEvent('USER_LOGOUT', currentUser.uid, {
          timestamp: new Date().toISOString()
        });

        // Clear cached data
        this.storageService.removeItem(`user-data-${currentUser.uid}`);
        this.storageService.removeItem(`last-login-${currentUser.uid}`);

        // Clear rate limits for this user
        this.rateLimitMap.delete(`signin:${currentUser.email}`);
      }

      // Clear guest mode flag
      this.storageService.removeItem(LocalStorageKey.GUEST_MODE);

      await signOut(this.auth);
      console.log('User signed out');
      this.router.navigate(['/sign-in']);
    } catch (error) {
      console.error('Error signing out:', error);
      this.logAuditEvent('LOGOUT_ERROR', undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string): Promise<void> {
    try {
      // Rate limiting
      if (!this.checkRateLimit(`reset:${email}`)) {
        throw new Error('Too many password reset requests. Please try again later.');
      }

      // Validate email
      if (!this.validateEmail(email)) {
        throw new Error('Invalid email address');
      }

      await sendPasswordResetEmail(this.auth, email);
      this.notificationService.success('Password reset email sent. Please check your inbox.');

      this.logAuditEvent('PASSWORD_RESET_REQUESTED', undefined, {
        email,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error sending password reset email:', error);
      this.logAuditEvent('PASSWORD_RESET_FAILED', undefined, {
        email,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Update user password with security validation
   */
  async updateUserPassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      const currentUser = this.auth.currentUser;
      if (!currentUser || !currentUser.email) {
        throw new Error('No authenticated user found');
      }

      // Validate new password
      const passwordValidation = this.validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        throw new Error(passwordValidation.errors.join(', '));
      }

      // Re-authenticate user
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);

      // Update password
      await updatePassword(currentUser, newPassword);

      this.notificationService.success('Password updated successfully');

      this.logAuditEvent('PASSWORD_UPDATED', currentUser.uid, {
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating password:', error);
      this.logAuditEvent('PASSWORD_UPDATE_FAILED', undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Sign in user with Google authentication
   */
  public async signInWithGoogle(): Promise<void> {
    try {
      console.log('🔐 Starting Google sign-in process...');

      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      // provider.addScope('https://www.googleapis.com/auth/spreadsheets');

      // Rate limiting
      if (!this.checkRateLimit('google-signin')) {
        throw new Error('Too many Google sign-in attempts. Please try again later.');
      }

      const result = await signInWithPopup(this.auth, provider);

      // Extract Google Access Token
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        this.googleAccessToken$.next(credential.accessToken);
        console.log('✅ Google Access Token captured');
      }

      await this.handleGoogleSignInResult(result);

      this.logAuditEvent('GOOGLE_LOGIN_SUCCESS', result.user.uid, {
        email: result.user.email,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Google sign-in error:', error);
      this.handleGoogleSignInError(error);
      this.logAuditEvent('GOOGLE_LOGIN_FAILED', undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Handle Google sign-in result
   */
  private async handleGoogleSignInResult(
    result: UserCredential
  ): Promise<void> {
    console.log('✅ Google sign-in successful');

    const firebaseUser = result.user;
    const userRef = doc(this.firestore, `users/${firebaseUser.uid}`);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      await this.handleExistingGoogleUser(firebaseUser, userSnap);
    } else {
      await this.createNewGoogleUser(firebaseUser);
    }
  }

  /**
   * Create new Google user
   */
  private async createNewGoogleUser(firebaseUser: any): Promise<void> {
    console.log('🆕 Creating new Google user in Firestore');

    const regionalConfig = CurrencyDetectionUtil.detectRegionalConfig();
    const newUser: User = {
      uid: firebaseUser.uid,
      firstName: firebaseUser.displayName?.split(' ')[0] || '',
      lastName: firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName || '',
      photoURL: firebaseUser.photoURL || '',
      role: 'free',
      createdAt: new Date(),
      updatedAt: new Date(),
      preferences: {
        defaultCurrency: regionalConfig.currency,
        timezone: regionalConfig.timezone,
        language: regionalConfig.language,
        country: regionalConfig.country,
        notifications: true,
        emailUpdates: true,
        budgetAlerts: true,
        theme: 'light-theme'
      }
    };

    await this.createUserInFirestore(firebaseUser.uid, newUser);
    await this.setupDefaultData(firebaseUser.uid);

    console.log('✅ User created in Firestore');
    this.notificationService.success(
      `Registration successful! Welcome to ${APP_CONFIG.APP_NAME}.`
    );
  }

  /**
   * Handle existing Google user
   */
  private async handleExistingGoogleUser(
    firebaseUser: any,
    userSnap: any
  ): Promise<void> {
    console.log('✅ User already exists in Firestore');

    let userData = userSnap.data();

    // Check if we need to update the user's photo or display name from Google
    let needsUpdate = false;
    const updates: any = {};

    if (firebaseUser.photoURL && userData['photoURL'] !== firebaseUser.photoURL) {
      if (!userData['photoURL'] || userData['photoURL'].includes('googleusercontent.com')) {
        // Only update if missing or if it looks like a google profile image (to avoid overwriting custom uploads if we ever support them)
        // For now, assume google auth source is truth for google profile images
        updates.photoURL = firebaseUser.photoURL;
        needsUpdate = true;
      }
    }

    if (firebaseUser.displayName && !userData['displayName']) {
      updates.displayName = firebaseUser.displayName;
      needsUpdate = true;
    }

    if (needsUpdate) {
      console.log('Updating user profile from Google data', updates);
      await this.createOrUpdateUser({
        ...userData,
        ...updates
      });
      // Update local object to reflect what we just saved
      userData = { ...userData, ...updates };
    }


    this.storageService.setItem(
      `user-data-${firebaseUser.uid}`,
      userData
    );
  }

  /**
   * Handle Google sign-in errors
   */
  private handleGoogleSignInError(error: unknown): void {
    console.error('❌ Google sign-in error:', error);

    const authError = error as FirebaseAuthError;

    switch (authError.code) {
      case 'auth/popup-closed-by-user':
        console.log('ℹ️ User closed the popup');
        this.notificationService.info('Sign-in cancelled');
        break;
      case 'auth/popup-blocked':
        console.log('ℹ️ Popup was blocked by browser');
        this.notificationService.error('Popup was blocked. Please allow popups for this site.');
        break;
      case 'auth/cancelled-popup-request':
        console.log('ℹ️ Popup request was cancelled');
        this.notificationService.info('Sign-in was cancelled');
        break;
      default:
        console.error(
          '❌ Unexpected error during Google sign-in:',
          authError.message
        );
        this.notificationService.error('Sign-in failed. Please try again.');
    }
  }

  /**
   * Create user document in Firestore with enhanced security
   */
  private async createUserInFirestore(
    uid: string,
    userData: User
  ): Promise<void> {
    try {
      const userRef = doc(this.firestore, `users/${uid}`);
      await setDoc(userRef, {
        ...userData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        loginCount: 0,
        isActive: true,
        securitySettings: {
          twoFactorEnabled: false,
          emailNotifications: true,
          loginAlerts: true
        }
      });

      this.storageService.setItem(`user-data-${uid}`, userData);

      this.logAuditEvent('USER_CREATED_IN_FIRESTORE', uid, {
        email: userData.email,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error creating user in Firestore:', error);
      this.logAuditEvent('FIRESTORE_USER_CREATION_FAILED', uid, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Setup default accounts and categories for new user
   */
  private async setupDefaultData(uid: string): Promise<void> {
    try {
      console.log(`🛠️ Setting up default data for user: ${uid}`);

      // Create default categories first
      for (const defaultCategory of defaultCategoriesForNewUser) {
        this.store.dispatch(CategoriesActions.createCategory({
          userId: uid,
          name: defaultCategory.name,
          categoryType: defaultCategory.type,
          icon: defaultCategory.icon,
          color: defaultCategory.color
        }));
      }

      // Create default bank accounts
      for (const defaultAccount of defaultBankAccounts) {
        const accountType = this.mapBankAccountType(defaultAccount.type);

        this.store.dispatch(AccountsActions.createAccount({
          userId: uid,
          accountData: {
            name: defaultAccount.name,
            type: accountType,
            balance: defaultAccount.balance,
            description: `${defaultAccount.type} account`,
            institution: defaultAccount.institution,
            currency: defaultAccount.currency,
          }
        }));
      }

      // For guest mode, we don't strictly await Firestore success as it might be handled offline
      if (uid === 'offline-guest') {
        // Wait a small amount of time for the actions to be dispatched and processed by effects
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        // For real users, we could wait for completion if needed, 
        // but dispatching is usually sufficient as the store handles the state.
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      this.logAuditEvent('DEFAULT_DATA_SETUP', uid, {
        timestamp: new Date().toISOString()
      });
      console.log('✅ Default data setup complete');
    } catch (error) {
      console.error('Error setting up default data:', error);
      this.logAuditEvent('DEFAULT_DATA_SETUP_FAILED', uid, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Map BankAccount type to Account type
   */
  private mapBankAccountType(
    bankAccountType: 'checking' | 'savings' | 'credit' | 'investment'
  ): AccountType {
    switch (bankAccountType) {
      case 'checking':
      case 'savings':
        return AccountType.BANK;
      case 'credit':
        return AccountType.CREDIT;
      case 'investment':
        return AccountType.INVESTMENT;
      default:
        return AccountType.BANK;
    }
  }

  /**
   * Create or update user in Firestore
   */
  async createOrUpdateUser(user: User): Promise<void> {
    try {
      if (this.isGuestUser()) {
        this.storageService.setItem(`user-data-${user.uid}`, user);
        this.userAuth$.next(user);
        return;
      }
      const userRef = doc(this.firestore, `users/${user.uid}`);
      await setDoc(userRef, {
        ...user,
        updatedAt: serverTimestamp()
      }, { merge: true });

      this.storageService.setItem(`user-data-${user.uid}`, user);
      this.userAuth$.next(user);

      this.logAuditEvent('USER_UPDATED', user.uid, {
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating user:', error);
      this.logAuditEvent('USER_UPDATE_FAILED', user.uid, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get current user data from cache or Firestore
   */
  async getCurrentUser(): Promise<User | null> {
    if (this.isGuestUser()) {
      return this.userAuth$.value;
    }
    const currentUser = this.auth.currentUser;
    if (!currentUser) return null;

    try {
      // 1. Try cache first
      const cachedUserData = this.storageService.getItem<User>(
        `user-data-${currentUser.uid}`
      );
      if (cachedUserData) {
        // If we have cached data, return it immediately for fast UI
        const clonedData = { ...cachedUserData };
        if (!clonedData.photoURL && currentUser.photoURL) clonedData.photoURL = currentUser.photoURL;
        if (!clonedData.displayName && currentUser.displayName) clonedData.displayName = currentUser.displayName;
        return clonedData;
      }

      // 2. Check if we're offline
      if (!navigator.onLine) {
        console.log('[UserService] Offline mode - no cache found, returning null');
        return null;
      }

      // 3. Fallback to Firestore
      const userRef = doc(this.firestore, `users/${currentUser.uid}`);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data() as User;
        if (!userData.photoURL && currentUser.photoURL) userData.photoURL = currentUser.photoURL;
        if (!userData.displayName && currentUser.displayName) userData.displayName = currentUser.displayName;
        this.storageService.setItem(
          `user-data-${currentUser.uid}`,
          userData
        );
        return userData;
      }

      return null;
    } catch (error) {
      console.error('Error getting current user:', error);
      // ... error logging ...

      // Try one last time to return whatever is in cache
      return this.storageService.getItem<User>(`user-data-${currentUser.uid}`);
    }
  }

  /**
   * Check if user is authenticated (for offline scenarios)
   */
  public isAuthenticated(): boolean {
    return this.userAuth$.value !== null;
  }

  /**
   * Get cached user data (for offline scenarios)
   */
  public getCachedUserData(uid: string): User | null {
    try {
      return this.storageService.getItem<User>(`user-data-${uid}`);
    } catch (error) {
      console.error('Error getting cached user data:', error);
      return null;
    }
  }

  /**
   * Clear all cached user data from localStorage
   */
  public clearCachedUserData(): void {
    try {
      const keys = this.storageService.getAllKeys();
      keys.forEach((key) => {
        if (key.startsWith('user-data-')) {
          this.storageService.removeItem(key);
        }
      });

      this.logAuditEvent('CACHE_CLEARED', undefined, {
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error clearing cached user data:', error);
    }
  }

  /**
   * Cache user data for offline access
   */
  private async ensureUserDataCached(uid: string): Promise<void> {
    try {
      // Check if we already have it in cache to avoid redundant network call on every startup
      const cachedData = this.storageService.getItem<User>(`user-data-${uid}`);
      if (cachedData) {
        console.log('[UserService] User data already cached, skipping redundant fetch');
        return;
      }

      if (!navigator.onLine) return;

      const userRef = doc(this.firestore, `users/${uid}`);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data() as User;

        // Ensure auth profile data is merged if missing
        const currentUser = this.auth.currentUser;
        if (currentUser) {
          if (!userData.photoURL && currentUser.photoURL) userData.photoURL = currentUser.photoURL;
          if (!userData.displayName && currentUser.displayName) userData.displayName = currentUser.displayName;
        }

        this.storageService.setItem(`user-data-${uid}`, userData);
        console.log('[UserService] User data successfully cached from network');
      }
    } catch (error) {
      console.error('Error ensuring user data is cached:', error);
    }
  }

  /**
   * Log audit events for security monitoring
   */
  private logAuditEvent(event: string, userId?: string, details: any = {}): void {
    const auditEntry = {
      timestamp: new Date(),
      event,
      userId,
      details,
      userAgent: navigator.userAgent,
      ip: 'client-side', // In production, this would be server-side
      sessionId: this.generateSessionId()
    };

    this.auditLog.push(auditEntry);

    // Keep only last 1000 audit entries
    if (this.auditLog.length > 1000) {
      this.auditLog.shift();
    }

    console.log('Audit Event:', auditEntry);

    // In production, send to audit service
    // this.auditService.logEvent(auditEntry);
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  /**
   * Get security status for current user
   */
  public getSecurityStatus(): any {
    const currentUser = this.userAuth$.value;
    if (!currentUser) return null;

    const email = currentUser.email;
    const loginAttempt = this.loginAttempts.get(email);

    return {
      isLocked: this.isAccountLocked(email),
      loginAttempts: loginAttempt?.count || 0,
      remainingAttempts: USER_SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS - (loginAttempt?.count || 0),
      lockoutTime: loginAttempt?.lockedUntil,
      isEmailVerified: currentUser.emailVerified,
      lastLogin: this.storageService.getItem(`last-login-${currentUser.uid}`)
    };
  }

  /**
   * Get audit log (for admin purposes)
   */
  public getAuditLog(): Array<any> {
    return [...this.auditLog];
  }

  /**
   * Force logout user (for security incidents)
   */
  public forceLogout(reason: string): void {
    console.warn('Force logout triggered:', reason);
    this.logAuditEvent('FORCE_LOGOUT', this.userAuth$.value?.uid, { reason });
    this.signOut();
  }

  /**
   * Find user by email for Splitwise invitations
   */
  async findUserByEmail(email: string): Promise<User | null> {
    try {
      const usersRef = collection(this.firestore, 'users');
      const q = query(usersRef, where('email', '==', email.toLowerCase()), limit(1));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        return {
          uid: userDoc.id,
          ...userDoc.data()
        } as User;
      }

      return null;
    } catch (error) {
      console.error('Error finding user by email:', error);
      return null;
    }
  }


  /**
   * Get all users for admin purposes
   */
  async getAllUsers(): Promise<any[]> {
    try {
      const usersRef = collection(this.firestore, 'users');
      const querySnapshot = await getDocs(usersRef);

      const users: any[] = [];
      for (const doc of querySnapshot.docs) {
        const userData = doc.data();
        users.push({
          uid: doc.id,
          email: userData['email'],
          displayName: userData['firstName'] + ' ' + userData['lastName'],
          photoURL: userData['photoURL'],
          emailVerified: userData['emailVerified'] || false,
          createdAt: userData['createdAt']?.toDate?.() || new Date(),
          lastSignInAt: userData['lastLoginAt']?.toDate?.() || null,
          isAdmin: userData['role'] === 'admin',
          status: userData['status'] || 'active',
          totalTransactions: userData['totalTransactions'] || 0,
          totalCategories: userData['totalCategories'] || 0,
          role: userData['role'] || 'free'
        });
      }

      return users;
    } catch (error) {
      console.error('Error fetching all users:', error);
      throw error;
    }
  }

  /**
   * Update user status
   */
  async updateUserStatus(uid: string, status: 'active' | 'suspended' | 'pending'): Promise<void> {
    try {
      const userRef = doc(this.firestore, `users/${uid}`);
      await updateDoc(userRef, {
        status: status,
        updatedAt: serverTimestamp()
      });

      this.logAuditEvent('USER_STATUS_UPDATED', uid, {
        status: status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating user status:', error);
      throw error;
    }
  }

  /**
   * Toggle admin role for user
   */
  async toggleAdminRole(uid: string): Promise<void> {
    try {
      const userRef = doc(this.firestore, `users/${uid}`);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const newRole = userData['role'] === 'admin' ? 'free' : 'admin';

        await updateDoc(userRef, {
          role: newRole,
          updatedAt: serverTimestamp()
        });

        this.logAuditEvent('ADMIN_ROLE_TOGGLED', uid, {
          newRole: newRole,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error toggling admin role:', error);
      throw error;
    }
  }

  /**
   * Get user statistics for admin dashboard
   */
  async getUserStatistics(): Promise<any> {
    try {
      const usersRef = collection(this.firestore, 'users');
      const querySnapshot = await getDocs(usersRef);

      const stats = {
        totalUsers: querySnapshot.size,
        activeUsers: 0,
        adminUsers: 0,
        verifiedUsers: 0,
        totalTransactions: 0,
        totalCategories: 0
      };

      querySnapshot.forEach(doc => {
        const userData = doc.data();
        if (userData['isActive'] === 'active') stats.activeUsers++;
        if (userData['role'] === 'admin') stats.adminUsers++;
        // if (userData['emailVerified']) stats.verifiedUsers++;
        // stats.totalTransactions += userData['totalTransactions'] || 0;
        // stats.totalCategories += userData['totalCategories'] || 0;
      });

      return stats;
    } catch (error) {
      console.error('Error fetching user statistics:', error);
      throw error;
    }
  }

  /**
   * Delete user account
   */
  async deleteUser(uid: string): Promise<void> {
    try {
      const userRef = doc(this.firestore, `users/${uid}`);
      await deleteDoc(userRef);

      this.logAuditEvent('USER_DELETED', uid, {
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }
}
