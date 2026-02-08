import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { APP_CONFIG } from '../config/config';
import { TranslateService } from '@ngx-translate/core';
import { LocalIndexDBStorageService } from './indexdb-storage.service';

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
    private localStorageService: LocalIndexDBStorageService
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
   * 
   * Android-safe: Each step has individual error handling to prevent cache issues
   */
  private getInitialLanguage(): string | null {
    console.log('🌐 Initializing language...');

    // Step 1: Try guest mode language
    try {
      const isGuest = this.localStorageService.getItem<string>('guest-mode') === 'true';
      console.log('Guest mode:', isGuest);

      if (isGuest) {
        try {
          const guestData = this.localStorageService.getItem<any>('user-data-offline-guest');
          console.log('Guest data retrieved:', !!guestData);

          if (guestData?.preferences?.language) {
            const lang = this.normalizeLanguageCode(guestData.preferences.language);
            console.log('✅ Using guest user language:', lang);
            return lang;
          }
        } catch (guestError) {
          console.warn('Failed to load guest user language:', guestError);
        }
      }
    } catch (error) {
      console.warn('Error checking guest mode:', error);
    }

    // Step 2: Try logged-in user language
    try {
      const keys = this.localStorageService.getAllKeys();
      const userDataKey = keys.find(key => key.startsWith('user-data-') && key !== 'user-data-offline-guest');
      console.log('User data key found:', userDataKey);

      if (userDataKey) {
        try {
          const userData = this.localStorageService.getItem<any>(userDataKey);

          if (userData?.preferences?.language) {
            const lang = this.normalizeLanguageCode(userData.preferences.language);
            console.log('✅ Using logged-in user language:', lang);
            return lang;
          }
        } catch (userError) {
          console.warn('Failed to load user language from', userDataKey, userError);
        }
      }
    } catch (error) {
      console.warn('Error checking user data:', error);
    }

    // Step 3: Try app_language
    try {
      let savedLanguage = this.localStorageService.getItem<string>('app_language');

      if (savedLanguage) {
        const lang = this.normalizeLanguageCode(savedLanguage);
        console.log('✅ Using saved app_language:', lang);
        return lang;
      }
    } catch (error) {
      console.warn('Error loading app_language:', error);
    }

    // Step 4: Fall back to browser locale detection
    try {
      const browserLocale = navigator.language || (navigator as any).userLanguage;
      if (browserLocale) {
        const lang = this.normalizeLanguageCode(browserLocale);
        console.log('✅ Using browser locale:', lang);
        return lang;
      }
    } catch (error) {
      console.warn('Error detecting browser locale:', error);
    }

    // Final fallback: return null (will use default 'en')
    console.log('⚠️ No language preference found, will use default');
    return null;
  }



  /**
   * Normalize language code to short format (e.g., 'en' -> 'en')
   */
  public normalizeLanguageCode(code: string): string {
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

    // Try LocalStorageService first
    this.localStorageService.setItem('app_language', normalizedLang);
  }




} 