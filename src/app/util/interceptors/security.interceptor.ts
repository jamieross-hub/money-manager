import { HttpRequest, HttpHandlerFn, HttpErrorResponse, HttpEvent } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { UserService } from '../service/db/user.service';
import { NotificationService } from '../service/notification.service';

/**
 * Security interceptor function for HTTP requests
 * Adds security headers and handles security-related errors
 */
export function securityInterceptor(
  request: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> {
  // Check if this is an OpenAI API request that should be ignored
  if (shouldIgnoreRequest(request)) {
    return next(request);
  }

  const router = inject(Router);
  const userService = inject(UserService);
  const notificationService = inject(NotificationService);

  // Add security headers to all requests
  const secureRequest = addSecurityHeaders(request);

  // Add authentication token if available
  const authenticatedRequest = addAuthToken(secureRequest, userService);

  return next(authenticatedRequest).pipe(
    retry(1), // Retry failed requests once
    catchError((error: HttpErrorResponse) => {
      return handleSecurityError(error, request, router, userService, notificationService);
    })
  );
}

/**
 * Check if the request should be ignored by the security interceptor
 */
function shouldIgnoreRequest(request: HttpRequest<unknown>): boolean {
  const url = request.url.toLowerCase();

  // Ignore OpenAI API requests
  if (url.includes('api.openai.com')) {
    return true;
  }

  // Ignore local i18n asset requests to avoid circular dependencies during initialization
  if (url.includes('assets/i18n/')) {
    return true;
  }

  // Add other external APIs here if needed
  // if (url.includes('other-external-api.com')) {
  //   return true;
  // }

  return false;
}

/**
 * Add security headers to HTTP requests
 */
function addSecurityHeaders(request: HttpRequest<unknown>): HttpRequest<unknown> {
  const securityHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  };

  return request.clone({
    setHeaders: securityHeaders
  });
}

/**
 * Add authentication token to requests
 */
function addAuthToken(request: HttpRequest<unknown>, userService: UserService): HttpRequest<unknown> {
  const currentUser = userService.userAuth$.value;

  if (currentUser && currentUser.uid) {
    // For Firebase Auth, we would typically get the ID token
    // This is a placeholder for the actual implementation
    return request.clone({
      setHeaders: {
        'Authorization': `Bearer ${currentUser.uid}` // Placeholder
      }
    });
  }

  return request;
}

/**
 * Handle security-related HTTP errors
 */
function handleSecurityError(
  error: HttpErrorResponse,
  request: HttpRequest<unknown>,
  router: Router,
  userService: UserService,
  notificationService: NotificationService
): Observable<never> {
  console.error('Security interceptor error:', error);

  // Log the request URL for debugging
  console.log('Request URL that caused error:', request.url);

  switch (error.status) {
    case 401: // Unauthorized
      handleUnauthorizedError(router, userService, notificationService);
      break;
    case 403: // Forbidden
      handleForbiddenError(notificationService);
      break;
    case 429: // Too Many Requests
      handleRateLimitError(notificationService);
      break;
    case 500: // Internal Server Error
      handleServerError(notificationService);
      break;
    default:
      handleGenericError(error, notificationService);
  }

  return throwError(() => error);
}

/**
 * Handle unauthorized errors (401)
 */
function handleUnauthorizedError(
  router: Router,
  userService: UserService,
  notificationService: NotificationService
): void {
  console.warn('Unauthorized request detected');

  // Log the security event
  logSecurityEvent('UNAUTHORIZED_REQUEST', {
    url: window?.location?.href || '',
    timestamp: new Date().toISOString()
  });

  // Force logout user
  userService.forceLogout('Unauthorized request detected');

  notificationService.error('Session expired. Please log in again.');
  router.navigate(['/landing'], {
    queryParams: { error: 'unauthorized', redirect: router.url }
  });
}

/**
 * Handle forbidden errors (403)
 */
function handleForbiddenError(notificationService: NotificationService): void {
  console.warn('Forbidden request detected');

  logSecurityEvent('FORBIDDEN_REQUEST', {
    url: window?.location?.href || '',
    timestamp: new Date().toISOString()
  });

  notificationService.error('Access denied. You do not have permission to perform this action.');
}

/**
 * Handle rate limit errors (429)
 */
function handleRateLimitError(notificationService: NotificationService): void {
  console.warn('Rate limit exceeded');

  logSecurityEvent('RATE_LIMIT_EXCEEDED', {
    url: window?.location?.href || '',
    timestamp: new Date().toISOString()
  });

  notificationService.warning('Too many requests. Please wait a moment before trying again.');
}

/**
 * Handle server errors (500)
 */
function handleServerError(notificationService: NotificationService): void {
  console.error('Server error detected');

  logSecurityEvent('SERVER_ERROR', {
    url: window?.location?.href || '',
    timestamp: new Date().toISOString()
  });

  notificationService.error('Server error. Please try again later.');
}

/**
 * Handle generic errors
 */
function handleGenericError(error: HttpErrorResponse, notificationService: NotificationService): void {
  console.error('Generic HTTP error:', error);

  logSecurityEvent('HTTP_ERROR', {
    status: error.status,
    statusText: error.statusText,
    url: error.url || window?.location?.href || '',
    timestamp: new Date().toISOString()
  });

  if (error.status >= 500) {
    notificationService.error('Server error. Please try again later.');
  } else if (error.status >= 400) {
    notificationService.error('Request failed. Please check your input and try again.');
  }
}

/**
 * Log security events
 */
function logSecurityEvent(eventType: string, data: any): void {
  const securityEvent = {
    type: eventType,
    data,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
    url: window?.location?.href || ''
  };

  console.log('Security Event:', securityEvent);

  // In production, send to security monitoring service
  // this.securityMonitoringService.logEvent(securityEvent);
} 