import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CURRENCIES, Currency, DEFAULT_CURRENCY, getCurrencyByCode, getCurrencySymbol } from '../models/currency.model';
import { UserService } from './db/user.service';
import { APP_CONFIG } from '../config/config';

import { CurrencyDetectionUtil } from '../helpers/currency-detection.util';

export interface CurrencyFormatOptions {
  currency?: string;
  locale?: string;
  showSymbol?: boolean;
  showCode?: boolean;
  decimalPlaces?: number;
  compact?: boolean;
  signDisplay?: 'auto' | 'never' | 'always' | 'exceptZero';
  notation?: 'standard' | 'scientific' | 'engineering' | 'compact';
  round?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CurrencyService {
  private currentCurrencySubject = new BehaviorSubject<string>(CurrencyDetectionUtil.detectCurrency());
  public currentCurrency$ = this.currentCurrencySubject.asObservable();

  private currentLanguageSubject = new BehaviorSubject<string>(APP_CONFIG.REGIONAL.LANGUAGE_DEFAULT);
  public currentLanguage$ = this.currentLanguageSubject.asObservable();

  constructor(private userService: UserService) {
    this.initializeCurrency();
  }

  private initializeCurrency(): void {
    this.userService.userAuth$.subscribe(user => {
      // Prioritize country-based settings if country is set in preferences
      if (user?.preferences?.country) {
        const country = APP_CONFIG.REGIONAL.COUNTRY_MAPPING[user.preferences.country as keyof typeof APP_CONFIG.REGIONAL.COUNTRY_MAPPING];
        if (country) {
          this.setCurrentCurrency((country as any).currency);
          this.setCurrentLanguage((country as any).language);
        }
      }

      // Individual preferences can override or act as fallback
      if (user?.preferences?.defaultCurrency) {
        this.setCurrentCurrency(user.preferences.defaultCurrency);
      }
      if (user?.preferences?.language) {
        this.setCurrentLanguage(user.preferences.language);
      }
    });
  }

  getCurrencies(): Currency[] {
    return CURRENCIES;
  }

  getCurrentCurrency(): string {
    return this.currentCurrencySubject.value;
  }

  setCurrentCurrency(currencyCode: string): void {
    if (this.isValidCurrency(currencyCode) && this.currentCurrencySubject.value !== currencyCode) {
      this.currentCurrencySubject.next(currencyCode);
    }
  }

  getCurrentLanguage(): string {
    return this.currentLanguageSubject.value;
  }

  setCurrentLanguage(languageCode: string): void {
    if (this.currentLanguageSubject.value !== languageCode) {
      this.currentLanguageSubject.next(languageCode);
    }
  }

  getCurrencySymbol(currencyCode?: string): string {
    const code = currencyCode || this.getCurrentCurrency();
    return getCurrencySymbol(code);
  }

  getCurrencyByCode(currencyCode: string): Currency | undefined {
    return getCurrencyByCode(currencyCode);
  }

  isValidCurrency(currencyCode: string): boolean {
    return CURRENCIES.some(currency => currency.code === currencyCode);
  }

  getDefaultCurrency(): string {
    return DEFAULT_CURRENCY;
  }

  /**
   * Helper to get currency configuration from COUNTRY_MAPPING
   */
  getCurrencyConfig(currencyCode: string): { symbol: string, decimalPlaces: number } | undefined {
    const mapping = APP_CONFIG.REGIONAL.COUNTRY_MAPPING;
    for (const data of Object.values(mapping)) {
      if ((data as any).currency === currencyCode) {
        return { symbol: (data as any).symbol, decimalPlaces: (data as any).decimalPlaces };
      }
    }
    return undefined;
  }

  formatAmount(amount: number | string | null | undefined, options?: CurrencyFormatOptions): string {
    if (amount === null || amount === undefined || amount === '') {
      return '';
    }

    const numericValue = typeof amount === 'string' ? parseFloat(amount) : amount;

    if (isNaN(numericValue)) {
      return 'Invalid amount';
    }

    const {
      currency = this.getCurrentCurrency(),
      locale = this.getCurrentLanguage(),
      showSymbol = true,
      showCode = false,
      decimalPlaces,
      compact = false,
      signDisplay = 'auto',
      notation = 'standard',
      round = false
    } = options || {};

    const config = this.getCurrencyConfig(currency);
    const configDecimalPlaces = config?.decimalPlaces ?? 2;

    // Apply rounding if specified
    const roundedValue = round ? Math.round(numericValue) : numericValue;

    // Determine decimal places
    const effectiveDecimalPlaces = round
      ? 0
      : (decimalPlaces !== undefined ? decimalPlaces : configDecimalPlaces);

    const formatOptions: Intl.NumberFormatOptions = {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: effectiveDecimalPlaces,
      maximumFractionDigits: effectiveDecimalPlaces,
      signDisplay: signDisplay,
      notation: compact ? 'compact' : notation
    };

    if (!showSymbol) {
      formatOptions.currencyDisplay = 'code';
    } else if (showCode) {
      formatOptions.currencyDisplay = 'narrowSymbol';
    } else {
      formatOptions.currencyDisplay = 'symbol';
    }

    try {
      return new Intl.NumberFormat(locale, formatOptions).format(roundedValue);
    } catch (error) {
      console.error('Error formatting currency:', error);
      // Fallback formatting
      const symbol = config?.symbol || currency;
      return `${symbol}${roundedValue.toFixed(effectiveDecimalPlaces)}`;
    }
  }
}
