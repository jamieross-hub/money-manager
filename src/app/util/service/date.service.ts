import { Injectable } from '@angular/core';
import { Timestamp } from '@angular/fire/firestore';
import { DateUtil } from '../helpers/date.util';

@Injectable({
  providedIn: 'root'
})
export class DateService {

  constructor() { }

  /**
   * Safely convert a Firebase timestamp to a Date object
   * @param timestamp - Firebase timestamp or any date-like value
   * @returns Date object or null if conversion fails
   */
  toDate(timestamp: any): Date | null {
    return DateUtil.toDate(timestamp);
  }

  /**
   * Safely convert a date value to a Firebase Timestamp
   * @param dateValue - Date object, string, or number
   * @returns Firebase Timestamp or null if conversion fails
   */
  toTimestamp(dateValue: any): Timestamp | null {
    const raw = DateUtil.toTimestamp(dateValue);
    if (!raw) return null;
    return new Timestamp(raw.seconds, raw.nanoseconds);
  }

  /**
   * Safely convert a form date value to a Firebase Timestamp
   * @param formDateValue - Date from form input
   * @returns Firebase Timestamp or null if conversion fails
   */
  fromFormDate(formDateValue: any): Timestamp | null {
    try {
      if (!formDateValue) {
        return null;
      }

      // Ensure it's a Date object first
      const date = new Date(formDateValue);
      if (isNaN(date.getTime())) {
        return null;
      }

      return Timestamp.fromDate(date);
    } catch (error) {
      console.error('Error converting form date to timestamp:', error, formDateValue);
      return null;
    }
  }

  /**
   * Get current date as Firebase Timestamp
   * @returns Current date as Firebase Timestamp
   */
  now(): Timestamp {
    return Timestamp.fromDate(new Date());
  }

  /**
   * Converts a form date string (YYYY-MM-DD) to a local Date object.
   * If existingDate is provided, it preserves the hours, minutes, seconds, and milliseconds from it.
   * If preserveTime is true and no existingDate is provided, it keeps the current hour, minute, and second.
   * @param formDate - string in YYYY-MM-DD format
   * @param preserveTime - boolean to preserve current time
   * @param existingDate - optional existing Date object to preserve time from
   * @returns Date object in local time
   */
  getLocalDateTimeFromForm(formDate: string, preserveTime: boolean = false, existingDate: any = null): Date {
    if (!formDate) return new Date();
    
    // Parse form date components
    const [year, month, day] = formDate.split('-').map(Number);
    const now = new Date();
    let result: Date;
    
    // If we have an existing date, use its time components
    const d = this.toDate(existingDate);
    if (d) {
      result = new Date(year, month - 1, day, d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
    } else if (preserveTime) {
      // Only preserve current time if the date is today
      const isToday = year === now.getFullYear() && (month - 1) === now.getMonth() && day === now.getDate();
      if (isToday) {
        result = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      } else {
        result = new Date(year, month - 1, day, 0, 0, 0, 0);
      }
    } else {
      result = new Date(year, month - 1, day, 0, 0, 0, 0);
    }
    
    return isNaN(result.getTime()) ? new Date() : result;
  }

  /**
   * Compare two date values safely
   * @param date1 - First date value
   * @param date2 - Second date value
   * @returns -1 if date1 < date2, 0 if equal, 1 if date1 > date2
   */
  compare(date1: any, date2: any): number {
    const d1 = this.toDate(date1);
    const d2 = this.toDate(date2);

    if (!d1 && !d2) return 0;
    if (!d1) return -1;
    if (!d2) return 1;

    return d1.getTime() - d2.getTime();
  }

  /**
   * Sort array of objects by date field
   * @param array - Array to sort
   * @param dateField - Field name containing the date
   * @param ascending - Sort order (default: false for newest first)
   * @returns Sorted array
   */
  sortByDate<T>(array: T[], dateField: keyof T, ascending: boolean = false): T[] {
    return [...array].sort((a, b) => {
      const dateA = this.toDate(a[dateField]);
      const dateB = this.toDate(b[dateField]);

      if (!dateA && !dateB) return 0;
      if (!dateA) return ascending ? -1 : 1;
      if (!dateB) return ascending ? 1 : -1;

      const comparison = dateA.getTime() - dateB.getTime();
      if (comparison !== 0) {
        return ascending ? comparison : -comparison;
      }

      // Tie-breaker: use 'id' if available for stable sorting
      const idA = (a as any).id || '';
      const idB = (b as any).id || '';
      const idComparison = idA.localeCompare(idB);
      return ascending ? idComparison : -idComparison;
    });
  }

  /**
   * Filter array by date range
   * @param array - Array to filter
   * @param dateField - Field name containing the date
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Filtered array
   */
  filterByDateRange<T>(array: T[], dateField: keyof T, startDate: any, endDate: any): T[] {
    const start = this.toDate(startDate);
    const end = this.toDate(endDate);

    if (!start && !end) return array;

    return array.filter(item => {
      const itemDate = this.toDate(item[dateField]);
      if (!itemDate) return false;

      if (start && end) {
        return itemDate >= start && itemDate <= end;
      } else if (start) {
        return itemDate >= start;
      } else if (end) {
        return itemDate <= end;
      }

      return true;
    });
  }

  /**
   * Check if a value is a valid date
   * @param value - Value to check
   * @returns True if valid date
   */
  isValidDate(value: any): boolean {
    const date = this.toDate(value);
    return date !== null && !isNaN(date.getTime());
  }

  /**
   * Check if a date is within a range
   * @param dateValue - Date to check
   * @param startDate - Range start
   * @param endDate - Range end
   * @returns True if within range
   */
  isInRange(dateValue: any, startDate: any, endDate: any): boolean {
    const date = this.toDate(dateValue);
    const start = this.toDate(startDate);
    const end = this.toDate(endDate);

    if (!date) return false;
    if (!start && !end) return true;

    if (start && end) return date >= start && date <= end;
    if (start) return date >= start;
    if (end) return date <= end;

    return true;
  }

  /**
   * Check if a date is in a specific month and year
   * @param dateValue - Date to check
   * @param month - Month (0-11)
   * @param year - Year (YYYY)
   * @returns True if in month
   */
  isInMonth(dateValue: any, month: number, year: number): boolean {
    const date = this.toDate(dateValue);
    if (!date) return false;
    return date.getMonth() === month && date.getFullYear() === year;
  }

  /**
   * Format date for display
   * @param dateValue - Date value to format
   * @param format - Format string (default: 'MM/DD/YYYY')
   * @returns Formatted date string
   */
  formatDate(dateValue: any, format: string = 'MM/DD/YYYY'): string {
    const date = this.toDate(dateValue);
    if (!date) return 'Invalid Date';

    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();

    return format
      .replace('MM', month)
      .replace('DD', day)
      .replace('YYYY', year.toString());
  }

  /**
   * Get date as local ISO string for form inputs (YYYY-MM-DD)
   * This respects the local timezone unlike toISOString()
   * @param dateValue - Date value
   * @returns ISO date string (YYYY-MM-DD) in local time
   */
  toLocalISOString(dateValue: any): string {
    const date = this.toDate(dateValue);
    if (!date) return '';

    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }

  /**
   * Get date as UTC ISO string (YYYY-MM-DD)
   * @param dateValue - Date value
   * @returns ISO date string (YYYY-MM-DD) in UTC
   */
  toISOString(dateValue: any): string {
    const date = this.toDate(dateValue);
    if (!date) return '';

    return date.toISOString().split('T')[0];
  }

  /**
   * Get relative time string (e.g., "2 hours ago")
   * @param dateValue - Date value
   * @returns Relative time string
   */
  getRelativeTime(dateValue: any): string {
    const date = this.toDate(dateValue);
    if (!date) return 'Unknown';

    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 2592000) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else {
      return this.formatDate(date);
    }
  }
} 