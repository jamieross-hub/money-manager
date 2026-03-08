import { Injectable, signal, computed, inject, OnDestroy } from '@angular/core';

import { Subject, takeUntil } from 'rxjs';
import { UserService } from './db/user.service';
import { NotificationService } from './notification.service';
import { environment } from 'src/environments/environment';
import { toSignal } from '@angular/core/rxjs-interop';

/**
 * Security event types
 */
export enum SecurityEventType {
  LOGIN_ATTEMPT = 'LOGIN_ATTEMPT',
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  PASSWORD_RESET = 'PASSWORD_RESET',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_UNLOCKED = 'ACCOUNT_UNLOCKED',
  FORCE_LOGOUT = 'FORCE_LOGOUT',
  SECURITY_ALERT = 'SECURITY_ALERT'
}

/**
 * Security level enum
 */
export enum SecurityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Security event interface
 */
export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  level: SecurityLevel;
  userId?: string;
  timestamp: Date;
  details: any;
  userAgent: string;
  ipAddress?: string;
  location?: string;
  resolved: boolean;
}





/**
 * Centralized security service for the application
 * Handles security monitoring, event logging, and security operations
 */
@Injectable({
  providedIn: 'root'
})
export class SecurityService implements OnDestroy {
  private readonly userService = inject(UserService);
  private readonly notificationService = inject(NotificationService);

  private readonly destroy$ = new Subject<void>();

  private readonly pinVerifiedSignal = signal<boolean>(false);
  


  private readonly userAuth = toSignal(this.userService.userAuth$);



  /**
   * Signal representing if the app should be locked (PIN enabled + Not verified)
   */
  public readonly isLocked = computed(() => {
    const user = this.userAuth();
    const verified = this.pinVerifiedSignal();
    
    // Bypass PIN lock in development mode
    if (!environment.production) {
      return false;
    }
    // App is locked if PIN is enabled, has a hash, and is not already verified
    return !!(user?.preferences?.pinEnabled && user?.preferences?.pinHash && !verified);
  });


  /**
   * Set PIN verified state manually
   */
  public setPinVerified(verified: boolean): void {
    this.pinVerifiedSignal.set(verified);
  }



  /**
   * Simple hash function for PIN (for local use)
   * In a real app, use a more robust crypto library if possible.
   */
  public async hashPin(pin: string): Promise<string> {
    const msgUint8 = new TextEncoder().encode(pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Verify PIN against a hash
   */
  public async verifyPin(pin: string, hash: string): Promise<boolean> {
    const hashedPin = await this.hashPin(pin);
    const match = hashedPin === hash;
    if (match) {
      this.setPinVerified(true);
    }
    return match;
  }

  constructor() {
    // Security service initialized
  }

  ngOnDestroy(): void {

    this.destroy$.next();
    this.destroy$.complete();
  }



  /**
   * Log a security event
   */
  public logSecurityEvent(
    type: SecurityEventType,
    level: SecurityLevel,
    details: any = {},
    userId?: string
  ): void {
    const event: SecurityEvent = {
      id: this.generateEventId(),
      type,
      level,
      userId,
      timestamp: new Date(),
      details,
      userAgent: navigator.userAgent,
      ipAddress: this.getClientIP(),
      location: window.location.href,
      resolved: false
    };

    // Log to console for debugging
    console.log('Security Event:', event);
    
    // Handle critical security events
    if (level === SecurityLevel.CRITICAL) {
      this.handleCriticalSecurityEvent(event);
    }
    
    // Log to console for debugging
    console.log('Security Event:', event);
    
    // In production, send to security monitoring service
    // this.sendToSecurityMonitoringService(event);
  }

  /**
   * Handle critical security events
   */
  private handleCriticalSecurityEvent(event: SecurityEvent): void {
    switch (event.type) {
      case SecurityEventType.SUSPICIOUS_ACTIVITY:
        this.notificationService.error('Suspicious activity detected. Please review your account.');
        break;
      case SecurityEventType.UNAUTHORIZED_ACCESS:
        this.forceLogout('Unauthorized access detected');
        break;
      case SecurityEventType.ACCOUNT_LOCKED:
        this.notificationService.warning('Account locked due to multiple failed login attempts.');
        break;
      case SecurityEventType.SECURITY_ALERT:
        this.notificationService.error('Security alert: Please review your account immediately.');
        break;
    }
  }







  /**
   * Force logout user
   */
  public forceLogout(reason: string): void {
    this.logSecurityEvent(
      SecurityEventType.FORCE_LOGOUT,
      SecurityLevel.CRITICAL,
      { reason }
    );
    
    this.userService.forceLogout(reason);
  }







  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  /**
   * Get client IP address (placeholder)
   */
  private getClientIP(): string {
    // In production, this would be determined server-side
    return 'client-side';
  }


}
 