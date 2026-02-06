import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { APP_CONFIG } from '../config/config';
import { TranslateService } from '@ngx-translate/core';
import { LocalStorageService } from './local-storage.service';

export type Language = string;

interface Translations {
  [key: string]: {
    [lang: string]: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private currentLanguage = new BehaviorSubject<Language>('en');



  constructor(
    private translateService: TranslateService,
    private localStorageService: LocalStorageService
  ) {
    // Set default language
    this.translateService.setDefaultLang('en');

    // Initialize language from user preferences
    const initialLanguage = this.getInitialLanguage();
    if (initialLanguage) {
      this.setLanguage(initialLanguage);
    }
  }

  /**
   * Get initial language from user preferences with fallback chain:
   * 1. Guest user preferences (if in guest mode)
   * 2. Logged-in user preferences (if user data exists)
   * 3. Saved app_language in localStorage
   * 4. Browser locale detection
   */
  private getInitialLanguage(): string | null {
    try {
      // Check for guest mode
      const isGuest = this.localStorageService.getItem<string>('guest-mode', false) === 'true';

      if (isGuest) {
        // Try to get language from guest user preferences
        const guestData = this.localStorageService.getItem<any>('user-data-offline-guest');
        if (guestData?.preferences?.language) {
          return this.normalizeLanguageCode(guestData.preferences.language);
        }
      }

      // Try to get language from any cached user data
      const keys = this.localStorageService.getAllKeys();
      const userDataKey = keys.find(key => key.startsWith('user-data-') && key !== 'user-data-offline-guest');

      if (userDataKey) {
        const userData = this.localStorageService.getItem<any>(userDataKey);
        if (userData?.preferences?.language) {
          return this.normalizeLanguageCode(userData.preferences.language);
        }
      }

      // Fall back to saved app_language
      const savedLanguage = this.localStorageService.getItem<string>('app_language', false);
      if (savedLanguage) {
        return this.normalizeLanguageCode(savedLanguage);
      }

      // Fall back to browser locale detection
      const browserLocale = navigator.language || (navigator as any).userLanguage;
      if (browserLocale) {
        return this.normalizeLanguageCode(browserLocale);
      }

      return null;
    } catch (error) {
      console.error('Error getting initial language:', error);
      return null;
    }
  }



  /**
   * Normalize language code to short format (e.g., 'en-IN' -> 'en')
   */
  private normalizeLanguageCode(code: string): string {
    if (!code) return 'en';
    return code.split('-')[0].toLowerCase();
  }

  // Get current language as observable
  getCurrentLanguage(): Observable<Language> {
    return this.currentLanguage.asObservable();
  }

  // Get current language value
  getCurrentLanguageValue(): Language {
    return this.currentLanguage.value;
  }

  // Change language
  setLanguage(language: string): void {
    const normalizedLang = this.normalizeLanguageCode(language);
    this.currentLanguage.next(normalizedLang);
    this.translateService.use(normalizedLang);
    this.localStorageService.setItem('app_language', normalizedLang);
  }




} 