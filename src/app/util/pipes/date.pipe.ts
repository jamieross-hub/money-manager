import { Pipe, PipeTransform, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { DateService } from '../service/date.service';
import { selectUserPreferences } from 'src/app/store/profile/profile.selectors';
import { AppState } from 'src/app/store/app.state';

export interface DateFormatOptions {
  format?: 'short' | 'short-time' | 'medium' | 'medium-time' | 'long' | 'full' | 'time-only' | 'custom' | 'user-preference';
  customFormatString?: string;
}

@Pipe({
  name: 'appDate',
  standalone: true,
  pure: false // impure to react to profile signal changes immediately without explicitly passing preference
})
export class AppDatePipe implements PipeTransform {
  private dateService = inject(DateService);
  private store = inject(Store<AppState>);
  private preferences = this.store.selectSignal(selectUserPreferences);

  transform(value: any, options?: DateFormatOptions | string): string {
    if (!value) return '';

    const date = this.dateService.toDate(value);
    if (!date) return '';

    const prefs = this.preferences();
    
    // Construct locale from user preferences (language and country)
    const userLang = prefs?.language || 'en';
    const userCountry = prefs?.country || 'US';
    // Only use hyphen if country is provided and not already part of the language string
    const localeString = userLang.includes('-') ? userLang : `${userLang}-${userCountry}`;

    // Ensure we have a valid format string to construct Intl locale
    let locale: string;
    try {
      // Validate locale by formatting a dummy date. If invalid, fallback to en-US.
      Intl.DateTimeFormat(localeString);
      locale = localeString;
    } catch (e) {
      locale = 'en-US';
    }
    
    const formatType = typeof options === 'string' ? options : options?.format;
    const customFormatString = typeof options === 'object' ? options.customFormatString : undefined;

    switch (formatType) {
      case 'short':
        return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
      case 'short-time':
        return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      case 'medium':
        return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
      case 'medium-time':
        return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      case 'long':
        return date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
      case 'full':
        return date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      case 'time-only':
        return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
      case 'custom':
        if (customFormatString) {
          return this.dateService.formatDate(date, customFormatString);
        }
        return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
      case 'user-preference':
      default:
        // Use user's locale to format in a standard medium representation if no specific format provided
        return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    }
  }
}
