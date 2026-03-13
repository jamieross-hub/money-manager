/**
 * Pure utility functions for date conversions and formatting.
 * These are safe to use in Web Workers as they do not depend on Angular DI.
 */
export class DateUtil {
  /**
   * Safely convert a Firebase timestamp or any date-like value to a Date object
   */
  static toDate(timestamp: any): Date | null {
    try {
      if (!timestamp) return null;

      // 1. Handle Date object
      if (timestamp instanceof Date) {
        return isNaN(timestamp.getTime()) ? null : timestamp;
      }

      // 2. Handle Firestore Timestamp (Structural Clone or Object Literal)
      // Check for seconds property which is characteristic of Firestore Timestamps
      if (typeof timestamp === 'object') {
        if ('seconds' in timestamp) {
          const seconds = Number(timestamp.seconds);
          const nanoseconds = Number(timestamp.nanoseconds || 0);
          return new Date(seconds * 1000 + Math.floor(nanoseconds / 1000000));
        }
        
        // Handle other toDate() providing objects
        if (typeof timestamp.toDate === 'function') {
          return timestamp.toDate();
        }
      }

      // 3. Handle numbers (milliseconds)
      if (typeof timestamp === 'number') return new Date(timestamp);

      // 4. Handle strings
      if (typeof timestamp === 'string') {
        // Handle common YYYY-MM-DD format as local date to avoid UTC shift
        if (/^\d{4}-\d{2}-\d{2}$/.test(timestamp)) {
          const parts = timestamp.split('-').map(Number);
          return new Date(parts[0], parts[1] - 1, parts[2]);
        }
        
        // Ensure strings without timezone info are treated as local
        let dateStr = timestamp;
        if (dateStr.length > 10 && !dateStr.includes('Z') && !/[+-]\d{2}(:?\d{2})?$/.test(dateStr)) {
           // It's a datetime string without offset, Date constructor treats it as local
        }

        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) return parsed;
      }

      return null;
    } catch (error) {
      console.error('DateUtil.toDate error:', error);
      return null;
    }
  }

  /**
   * Safely convert a date value to a Firestore-compatible Timestamp object
   * Returns a plain object with {seconds, nanoseconds} for Web Worker compatibility
   */
  static toTimestamp(dateValue: any): { seconds: number; nanoseconds: number } | null {
    try {
      if (!dateValue) return null;

      // If it's already a Timestamp-like object
      if (typeof dateValue === 'object') {
        if ('seconds' in dateValue) {
          return {
            seconds: Number(dateValue.seconds),
            nanoseconds: Number(dateValue.nanoseconds || 0)
          };
        }
      }

      const date = this.toDate(dateValue);
      if (date && !isNaN(date.getTime())) {
        const ms = date.getTime();
        return {
          seconds: Math.floor(ms / 1000),
          nanoseconds: (ms % 1000) * 1000000
        };
      }

      return null;
    } catch (error) {
      console.error('DateUtil.toTimestamp error:', error);
      return null;
    }
  }

  /**
   * Format date for display (MM/DD/YYYY)
   */
  static formatDate(dateValue: any, format: string = 'MM/DD/YYYY'): string {
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
}
