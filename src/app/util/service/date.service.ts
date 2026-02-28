import { Injectable } from '@angular/core';
import { Timestamp } from '@angular/fire/firestore';

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
    try {
      if (!timestamp) {
        return null;
      }

      // If it's already a Date object
      if (timestamp instanceof Date) {
        return timestamp;
      }

      // If it's a Firebase Timestamp
      if (timestamp instanceof Timestamp) {
        return timestamp.toDate();
      }

      // If it's a Firestore timestamp object with seconds/nanoseconds
      if (timestamp && typeof timestamp === 'object' && 'seconds' in timestamp) {
        return new Timestamp(timestamp.seconds, timestamp.nanoseconds).toDate();
      }

      // If it's a number (milliseconds)
      if (typeof timestamp === 'number') {
        return new Date(timestamp);
      }

      // If it's a string, try to parse it
      if (typeof timestamp === 'string') {
        const parsed = new Date(timestamp);
        return isNaN(parsed.getTime()) ? null : parsed;
      }

      // If it's an object with toDate method
      if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate();
      }

      return null;
    } catch (error) {
      console.error('Error converting timestamp to date:', error, timestamp);
      return null;
    }
  }

  /**
   * Safely convert a date value to a Firebase Timestamp
   * @param dateValue - Date object, string, or number
   * @returns Firebase Timestamp or null if conversion fails
   */
  toTimestamp(dateValue: any): Timestamp | null {
    try {
      if (!dateValue) {
        return null;
      }

      // If it's already a Timestamp
      if (dateValue instanceof Timestamp) {
        return dateValue;
      }

      // If it's a Date object
      if (dateValue instanceof Date) {
        return Timestamp.fromDate(dateValue);
      }

      // If it's a number (milliseconds)
      if (typeof dateValue === 'number') {
        return Timestamp.fromDate(new Date(dateValue));
      }

      // If it's a string, try to parse it
      if (typeof dateValue === 'string') {
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
          return Timestamp.fromDate(date);
        }
      }

      // If it's an object with toDate method
      if (dateValue && typeof dateValue.toDate === 'function') {
        return Timestamp.fromDate(dateValue.toDate());
      }

      return null;
    } catch (error) {
      console.error('Error converting date to timestamp:', error, dateValue);
      return null;
    }
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
   * If preserveTime is true, it keeps the current hour, minute, and second.
   * @param formDate - string in YYYY-MM-DD format
   * @param preserveTime - boolean to preserve current time
   * @returns Date object in local time
   */
  getLocalDateTimeFromForm(formDate: string, preserveTime: boolean = false): Date {
    if (!formDate) return new Date();
    
    const [year, month, day] = formDate.split('-').map(Number);
    const date = new Date();
    date.setFullYear(year);
    date.setMonth(month - 1);
    date.setDate(day);
    
    if (!preserveTime) {
      date.setHours(0, 0, 0, 0);
    }
    
    return date;
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
      return ascending ? comparison : -comparison;
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