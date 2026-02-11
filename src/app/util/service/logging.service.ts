import { Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { LocalIndexDBStorageService } from './indexdb-storage.service';
import { LocalStorageKey } from '../models/local-storage.model';

export interface LogEntry {
  timestamp: Date;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  message: string;
  data?: any;
  userId?: string;
  sessionId?: string;
  url?: string;
  userAgent?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LoggingService {
  private logs: LogEntry[] = [];
  private readonly MAX_LOGS = 1000;
  private sessionId: string;
  private userId?: string;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.loadLogsFromStorage();
  }

  setUserId(userId: string): void {
    this.userId = userId;
  }

  debug(message: string, data?: any): void {
    this.log('DEBUG', message, data);
  }

  info(message: string, data?: any): void {
    this.log('INFO', message, data);
  }

  warn(message: string, data?: any): void {
    this.log('WARN', message, data);
  }

  error(message: string, data?: any): void {
    this.log('ERROR', message, data);
  }

  critical(message: string, data?: any): void {
    this.log('CRITICAL', message, data);
    this.sendToRemoteLogger(message, data);
  }

  private log(level: LogEntry['level'], message: string, data?: any): void {
    const logEntry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      data,
      userId: this.userId,
      sessionId: this.sessionId,
      url: window.location.href,
      userAgent: navigator.userAgent
    };

    this.logs.unshift(logEntry);

    // Keep only the latest logs
    if (this.logs.length > this.MAX_LOGS) {
      this.logs = this.logs.slice(0, this.MAX_LOGS);
    }

    // Save to localStorage
    this.saveLogsToStorage();

    // Console logging based on environment
    if (environment.production) {
      if (level === 'ERROR' || level === 'CRITICAL') {
        console.error(`[${level}] ${message}`, data);
      } else if (level === 'WARN') {
        console.warn(`[${level}] ${message}`, data);
      }
    } else {
      // Development: log everything
      console.log(`[${level}] ${message}`, data);
    }
  }

  private sendToRemoteLogger(message: string, data?: any): void {
    // In production, you would send critical logs to a remote logging service
    // like Sentry, LogRocket, or your own logging server
    if (environment.production) {
      try {
        // Example: Send to remote logging service
        // this.http.post('https://your-logging-service.com/logs', {
        //   message,
        //   data,
        //   timestamp: new Date().toISOString(),
        //   userId: this.userId,
        //   sessionId: this.sessionId,
        //   url: window.location.href,
        //   userAgent: navigator.userAgent
        // }).subscribe();

        console.error('Critical log should be sent to remote service:', { message, data });
      } catch (error) {
        console.error('Failed to send log to remote service:', error);
      }
    }
  }

  private generateSessionId(): string {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private saveLogsToStorage(): void {
    try {
      LocalIndexDBStorageService.getInstance().setItem(LocalStorageKey.APP_LOGS, this.logs);
    } catch (error) {
      console.warn('Failed to save logs to storage:', error);
    }
  }

  private loadLogsFromStorage(): void {
    try {
      const storedLogs = LocalIndexDBStorageService.getInstance().getItem<any[]>(LocalStorageKey.APP_LOGS);
      if (storedLogs) {
        this.logs = storedLogs.map((log: any) => ({
          ...log,
          timestamp: new Date(log.timestamp)
        }));
      }
    } catch (error) {
      console.warn('Failed to load logs from storage:', error);
    }
  }

  // Public methods for debugging and monitoring
  getLogs(level?: LogEntry['level']): LogEntry[] {
    if (level) {
      return this.logs.filter(log => log.level === level);
    }
    return [...this.logs];
  }

  getLogsByTimeRange(startTime: Date, endTime: Date): LogEntry[] {
    return this.logs.filter(log =>
      log.timestamp >= startTime && log.timestamp <= endTime
    );
  }

  getLogsByUser(userId: string): LogEntry[] {
    return this.logs.filter(log => log.userId === userId);
  }

  clearLogs(): void {
    this.logs = [];
    LocalIndexDBStorageService.getInstance().removeItem(LocalStorageKey.APP_LOGS);
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  getLogStats(): { total: number; byLevel: Record<string, number> } {
    const stats = {
      total: this.logs.length,
      byLevel: {
        DEBUG: 0,
        INFO: 0,
        WARN: 0,
        ERROR: 0,
        CRITICAL: 0
      }
    };

    this.logs.forEach(log => {
      stats.byLevel[log.level]++;
    });

    return stats;
  }

  // Performance monitoring
  timeOperation<T>(operationName: string, operation: () => T | Promise<T>): T | Promise<T> {
    const startTime = performance.now();

    try {
      const result = operation();

      if (result instanceof Promise) {
        return result.finally(() => {
          const endTime = performance.now();
          const duration = endTime - startTime;
          this.info(`Operation completed: ${operationName}`, { duration: `${duration.toFixed(2)}ms` });
        });
      } else {
        const endTime = performance.now();
        const duration = endTime - startTime;
        this.info(`Operation completed: ${operationName}`, { duration: `${duration.toFixed(2)}ms` });
        return result;
      }
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      this.error(`Operation failed: ${operationName}`, {
        duration: `${duration.toFixed(2)}ms`,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
} 