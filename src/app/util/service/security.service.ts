import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { UserService } from './db/user.service';
import { NotificationService } from './notification.service';

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
 * Security configuration interface
 */
export interface SecurityConfig {
  readonly SESSION_TIMEOUT: number;
  readonly MAX_LOGIN_ATTEMPTS: number;
  readonly LOCKOUT_DURATION: number;
  readonly PASSWORD_MIN_LENGTH: number;
  readonly REQUIRE_EMAIL_VERIFICATION: boolean;
  readonly ENABLE_TWO_FACTOR: boolean;
  readonly ENABLE_RATE_LIMITING: boolean;
  readonly ENABLE_AUDIT_LOGGING: boolean;
  readonly ENABLE_SECURITY_HEADERS: boolean;
  readonly ALLOWED_ORIGINS: string[];
  readonly BLOCKED_IPS: string[];
}

/**
 * Security status interface
 */
export interface SecurityStatus {
  isAuthenticated: boolean;
  sessionActive: boolean;
  sessionAge: number;
  loginAttempts: number;
  isAccountLocked: boolean;
  isEmailVerified: boolean;
  twoFactorEnabled: boolean;
  lastLoginTime?: Date;
  securityLevel: SecurityLevel;
  recentSecurityEvents: SecurityEvent[];
}

/**
 * Centralized security service for the application
 * Handles security monitoring, event logging, and security operations
 */
@Injectable({
  providedIn: 'root'
})
export class SecurityService {
  private readonly securityEvents = new BehaviorSubject<SecurityEvent[]>([]);
  private readonly securityStatus = new BehaviorSubject<SecurityStatus | null>(null);


  private readonly securityConfig: SecurityConfig = {
    SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
    PASSWORD_MIN_LENGTH: 8,
    REQUIRE_EMAIL_VERIFICATION: true,
    ENABLE_TWO_FACTOR: false,
    ENABLE_RATE_LIMITING: true,
    ENABLE_AUDIT_LOGGING: true,
    ENABLE_SECURITY_HEADERS: true,
    ALLOWED_ORIGINS: ['localhost', '127.0.0.1', 'yourdomain.com'],
    BLOCKED_IPS: []
  };

  public readonly securityEvents$ = this.securityEvents.asObservable();
  public readonly securityStatus$ = this.securityStatus.asObservable();




  constructor(
    private router: Router,
    private userService: UserService,
    private notificationService: NotificationService
  ) {
    this.initializeSecurityMonitoring();
  }

  /**
   * Initialize security monitoring
   */
  private initializeSecurityMonitoring(): void {
    // Monitor for security events
    this.userService.userAuth$.subscribe((user: any) => {
      this.updateSecurityStatus();
    });

    // Start periodic security checks
    setInterval(() => { 
      //this.performSecurityChecks(); check this later
    }, 60000); // Every minute

    // Monitor for suspicious activity
    this.monitorSuspiciousActivity();
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

    const currentEvents = this.securityEvents.value;
    currentEvents.push(event);
    
    // Keep only last 1000 events
    if (currentEvents.length > 1000) {
      currentEvents.shift();
    }
    
    this.securityEvents.next(currentEvents);
    
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
   * Update security status
   */
  private updateSecurityStatus(): void {
    const currentUser = this.userService.userAuth$.value;
    const userSecurityStatus = this.userService.getSecurityStatus();
    
    const status: SecurityStatus = {
      isAuthenticated: !!currentUser,
      sessionActive: userSecurityStatus?.sessionActive || false,
      sessionAge: userSecurityStatus?.sessionAge || 0,
      loginAttempts: userSecurityStatus?.loginAttempts || 0,
      isAccountLocked: userSecurityStatus?.isLocked || false,
      isEmailVerified: userSecurityStatus?.isEmailVerified || false,
      twoFactorEnabled: false, // Placeholder
      lastLoginTime: userSecurityStatus?.lastLogin ? new Date(userSecurityStatus.lastLogin) : undefined,
      securityLevel: this.calculateSecurityLevel(userSecurityStatus),
      recentSecurityEvents: this.getRecentSecurityEvents()
    };
    
    this.securityStatus.next(status);
  }

  /**
   * Calculate security level based on various factors
   */
  private calculateSecurityLevel(userSecurityStatus: any): SecurityLevel {
    if (!userSecurityStatus) return SecurityLevel.LOW;
    
    let score = 0;
    
    // Email verification
    if (userSecurityStatus.isEmailVerified) score += 2;
    
    // Account not locked
    if (!userSecurityStatus.isLocked) score += 1;
    
    // Low login attempts
    if (userSecurityStatus.loginAttempts < 2) score += 1;
    
    // Active session
    if (userSecurityStatus.sessionActive) score += 1;
    
    if (score >= 4) return SecurityLevel.HIGH;
    if (score >= 2) return SecurityLevel.MEDIUM;
    return SecurityLevel.LOW;
  }

  /**
   * Get recent security events
   */
  private getRecentSecurityEvents(): SecurityEvent[] {
    const events = this.securityEvents.value;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return events.filter(event => event.timestamp > oneHourAgo);
  }

  /**
   * Perform periodic security checks
   */
  private performSecurityChecks(): void {
    const currentUser = this.userService.userAuth$.value;
    if (!currentUser) return;
    
    // Check for session timeout
    const userSecurityStatus = this.userService.getSecurityStatus();
    if (userSecurityStatus && !userSecurityStatus.sessionActive) {
      this.logSecurityEvent(
        SecurityEventType.SESSION_EXPIRED,
        SecurityLevel.HIGH,
        { userId: currentUser.uid },
        currentUser.uid
      );
      this.forceLogout('Session expired');
    }
    
    // Check for suspicious activity patterns
    this.detectSuspiciousActivityPatterns();
  }

  /**
   * Detect suspicious activity patterns
   */
  private detectSuspiciousActivityPatterns(): void {
    const recentEvents = this.getRecentSecurityEvents();
    const currentUser = this.userService.userAuth$.value;
    
    if (!currentUser) return;
    
    // Check for multiple failed login attempts
    const failedLogins = recentEvents.filter(event => 
      event.type === SecurityEventType.LOGIN_FAILED && 
      event.userId === currentUser.uid
    );
    
    if (failedLogins.length >= 3) {
      this.logSecurityEvent(
        SecurityEventType.SUSPICIOUS_ACTIVITY,
        SecurityLevel.HIGH,
        { 
          reason: 'multiple_failed_logins',
          count: failedLogins.length 
        },
        currentUser.uid
      );
    }
    
    // Check for rapid successive events
    const rapidEvents = recentEvents.filter(event => 
      event.timestamp > new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
    );
    
    if (rapidEvents.length > 10) {
      this.logSecurityEvent(
        SecurityEventType.SUSPICIOUS_ACTIVITY,
        SecurityLevel.MEDIUM,
        { 
          reason: 'rapid_activity',
          count: rapidEvents.length 
        }
      );
    }
  }

  /**
   * Monitor for suspicious activity
   */
  private monitorSuspiciousActivity(): void {
    // Monitor for rapid navigation changes
    let navigationCount = 0;
    let lastNavigationTime = Date.now();
    
    this.router.events.subscribe(() => {
      const now = Date.now();
      if (now - lastNavigationTime < 1000) { // Less than 1 second
        navigationCount++;
        if (navigationCount > 10) {
          this.logSecurityEvent(
            SecurityEventType.SUSPICIOUS_ACTIVITY,
            SecurityLevel.MEDIUM,
            { reason: 'rapid_navigation', count: navigationCount }
          );
        }
      } else {
        navigationCount = 0;
      }
      lastNavigationTime = now;
    });
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
   * Validate security configuration
   */
  public validateSecurityConfig(): boolean {
    const issues: string[] = [];
    
    if (this.securityConfig.PASSWORD_MIN_LENGTH < 8) {
      issues.push('Password minimum length should be at least 8 characters');
    }
    
    if (this.securityConfig.SESSION_TIMEOUT < 5 * 60 * 1000) {
      issues.push('Session timeout should be at least 5 minutes');
    }
    
    if (this.securityConfig.MAX_LOGIN_ATTEMPTS < 3) {
      issues.push('Maximum login attempts should be at least 3');
    }
    
    if (issues.length > 0) {
      console.warn('Security configuration issues:', issues);
      return false;
    }
    
    return true;
  }

  /**
   * Get security configuration
   */
  public getSecurityConfig(): SecurityConfig {
    return { ...this.securityConfig };
  }

  /**
   * Update security configuration
   */
  public updateSecurityConfig(updates: Partial<SecurityConfig>): void {
    Object.assign(this.securityConfig, updates);
    
    this.logSecurityEvent(
      SecurityEventType.SECURITY_ALERT,
      SecurityLevel.MEDIUM,
      { reason: 'config_updated', updates }
    );
  }

  /**
   * Get security events by type
   */
  public getSecurityEventsByType(type: SecurityEventType): SecurityEvent[] {
    return this.securityEvents.value.filter(event => event.type === type);
  }

  /**
   * Get security events by level
   */
  public getSecurityEventsByLevel(level: SecurityLevel): SecurityEvent[] {
    return this.securityEvents.value.filter(event => event.level === level);
  }

  /**
   * Resolve security event
   */
  public resolveSecurityEvent(eventId: string): void {
    const events = this.securityEvents.value;
    const eventIndex = events.findIndex(event => event.id === eventId);
    
    if (eventIndex !== -1) {
      events[eventIndex].resolved = true;
      this.securityEvents.next(events);
    }
  }

  /**
   * Clear resolved security events
   */
  public clearResolvedEvents(): void {
    const events = this.securityEvents.value.filter(event => !event.resolved);
    this.securityEvents.next(events);
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Get client IP address (placeholder)
   */
  private getClientIP(): string {
    // In production, this would be determined server-side
    return 'client-side';
  }

  /**
   * Check if origin is allowed
   */
  public isOriginAllowed(origin: string): boolean {
    return this.securityConfig.ALLOWED_ORIGINS.some(allowed => 
      origin.includes(allowed)
    );
  }

  /**
   * Check if IP is blocked
   */
  public isIPBlocked(ip: string): boolean {
    return this.securityConfig.BLOCKED_IPS.includes(ip);
  }

  /**
   * Add IP to blocked list
   */
  public blockIP(ip: string, reason: string): void {
    if (!this.securityConfig.BLOCKED_IPS.includes(ip)) {
      this.securityConfig.BLOCKED_IPS.push(ip);
      
      this.logSecurityEvent(
        SecurityEventType.SECURITY_ALERT,
        SecurityLevel.HIGH,
        { reason: reason, ip }
      );
    }
  }

  /**
   * Remove IP from blocked list
   */
  public unblockIP(ip: string): void {
    const index = this.securityConfig.BLOCKED_IPS.indexOf(ip);
    if (index !== -1) {
      this.securityConfig.BLOCKED_IPS.splice(index, 1);
      
      this.logSecurityEvent(
        SecurityEventType.SECURITY_ALERT,
        SecurityLevel.MEDIUM,
        { reason: 'ip_unblocked', ip }
      );
    }
  }
} 