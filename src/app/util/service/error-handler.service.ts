import { Injectable, ErrorHandler, Injector } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { APP_CONFIG } from '../config/config';

export interface ErrorLog {
  timestamp: Date;
  message: string;
  stack?: string;
  user?: string;
  url?: string;
  userAgent?: string;
  errorType: 'CRITICAL' | 'ERROR' | 'WARNING' | 'INFO';
}

@Injectable({
  providedIn: 'root'
})
export class ErrorHandlerService implements ErrorHandler {
  private errorLogs: ErrorLog[] = [];
  private readonly MAX_LOGS = APP_CONFIG.PERFORMANCE.CACHE_SIZE; // Use config value

  constructor(
    private injector: Injector,
    private snackBar: MatSnackBar
  ) {}

  handleError(error: any): void {
    // Handle dynamically loading chunk errors (e.g. after a new deploy)
    const message = error?.message || error?.toString() || '';
    if (message.includes('ChunkLoadError') || message.includes('Loading chunk')) {
      console.warn('ChunkLoadError detected in ErrorHandler. Reloading application...');
      window.location.reload();
      return;
    }

    console.error('An error occurred:', error);

    // Create error log
    const errorLog: ErrorLog = {
      timestamp: new Date(),
      message: error.message,
      stack: error.stack,
      user: this.getCurrentUser(),
      url: this.getCurrentUrl(),
      userAgent: navigator.userAgent,
      errorType: this.categorizeError(error)
    };

    // Add to logs
    this.addToLogs(errorLog);

    // Handle different types of errors
    this.handleErrorByType(error, errorLog);

    // Show user-friendly message
    this.showUserMessage(error);
  }

  private categorizeError(error: Error): 'CRITICAL' | 'ERROR' | 'WARNING' | 'INFO' {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('connection') || message.includes('timeout')) {
      return 'CRITICAL';
    }
    
    if (message.includes('auth') || message.includes('permission') || message.includes('unauthorized')) {
      return 'ERROR';
    }
    
    if (message.includes('validation') || message.includes('invalid')) {
      return 'WARNING';
    }
    
    return 'ERROR';
  }

  private handleErrorByType(error: Error, errorLog: ErrorLog): void {
    const router = this.injector.get(Router);
    const auth = this.injector.get(Auth);

    switch (errorLog.errorType) {
      case 'CRITICAL':
        // Network or critical system errors
        this.handleCriticalError(error, router);
        break;
      
      case 'ERROR':
        // Authentication or permission errors
        if (error.message.includes('auth') || error.message.includes('permission')) {
          this.handleAuthError(error, router, auth);
        } else {
          this.handleGeneralError(error);
        }
        break;
      
      case 'WARNING':
        // Validation or user input errors
        this.handleWarningError(error);
        break;
      
      default:
        this.handleGeneralError(error);
    }
  }

  private handleCriticalError(error: Error, router: Router): void {
    // Redirect to error page for critical errors
    router.navigate(['/error'], { 
      queryParams: { 
        type: 'critical',
        message: 'Network connection issue. Please check your internet connection.'
      }
    });
  }

  private handleAuthError(error: Error, router: Router, auth: Auth): void {
    // Sign out user and redirect to login
    auth.signOut().then(() => {
      router.navigate(['/sign-in'], { 
        queryParams: { 
          reason: 'session_expired'
        }
      });
    });
  }

  private handleGeneralError(error: Error): void {
    // Log error for debugging
    console.error('General error:', error);
  }

  private handleWarningError(error: Error): void {
    // Show warning message
    this.showUserMessage(error);
  }

  private showUserMessage(error: Error, type: 'error' | 'warning' | 'info' = 'error'): void {
    const userMessage = this.getUserFriendlyMessage(error);
    
    this.snackBar.open(userMessage, 'Close', {
      duration: APP_CONFIG.NOTIFICATIONS.AUTO_HIDE_DELAY, // Use config duration
      panelClass: [`snackbar-${type}`],
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
  }

  private getUserFriendlyMessage(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('connection')) {
      return 'Network connection issue. Please check your internet connection and try again.';
    }
    
    if (message.includes('auth') || message.includes('permission')) {
      return 'Session expired. Please sign in again.';
    }
    
    if (message.includes('validation')) {
      return 'Please check your input and try again.';
    }
    
    if (message.includes('firebase')) {
      return 'Service temporarily unavailable. Please try again later.';
    }
    
    return 'Something went wrong. Please try again.';
  }

  private getCurrentUser(): string {
    try {
      const auth = this.injector.get(Auth);
      return auth.currentUser?.uid || 'anonymous';
    } catch {
      return 'unknown';
    }
  }

  private getCurrentUrl(): string {
    try {
      const router = this.injector.get(Router);
      return router.url;
    } catch {
      return 'unknown';
    }
  }

  private addToLogs(errorLog: ErrorLog): void {
    this.errorLogs.unshift(errorLog);
    
    // Keep only the latest logs
    if (this.errorLogs.length > this.MAX_LOGS) {
      this.errorLogs = this.errorLogs.slice(0, this.MAX_LOGS);
    }
  }

  // Public methods for external use
  public logError(message: string, errorType: ErrorLog['errorType'] = 'ERROR'): void {
    const errorLog: ErrorLog = {
      timestamp: new Date(),
      message,
      user: this.getCurrentUser(),
      url: this.getCurrentUrl(),
      userAgent: navigator.userAgent,
      errorType
    };
    
    this.addToLogs(errorLog);
  }

  public getErrorLogs(): ErrorLog[] {
    return [...this.errorLogs];
  }

  public clearLogs(): void {
    this.errorLogs = [];
  }

  public exportLogs(): string {
    return JSON.stringify(this.errorLogs, null, 2);
  }
} 