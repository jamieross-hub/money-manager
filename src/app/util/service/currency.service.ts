import { Injectable, signal, OnDestroy } from '@angular/core';
import { CurrencyDetectionUtil } from '../helpers/currency-detection.util';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { APP_CONFIG } from '../config/config';
import { DEFAULT_CURRENCY } from '../models/currency.model';
import { UserService } from './db/user.service';

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
export class CurrencyService implements OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private currencySignal = signal<string>(CurrencyDetectionUtil.detectCurrency());
  public readonly currentCurrency = this.currencySignal.asReadonly();

  private languageSignal = signal<string>(APP_CONFIG.REGIONAL.LANGUAGE_DEFAULT);
  public readonly currentLanguage = this.languageSignal.asReadonly();

  constructor(private userService: UserService) {
    this.initializeCurrency();
  }

  private initializeCurrency(): void {
    this.userService.userAuth$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
      // Prioritize country-based settings if country is set in preferences
      if (user?.preferences?.country) {
        const country = APP_CONFIG.REGIONAL.COUNTRY_MAPPING[user.preferences.country as keyof typeof APP_CONFIG.REGIONAL.COUNTRY_MAPPING];
        if (country) {
          this.setCurrentCurrency(user?.preferences.defaultCurrency || (country as any).currency);
          this.setCurrentLanguage(user?.preferences.language || APP_CONFIG.REGIONAL.LANGUAGE_DEFAULT);
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

  getCurrentCurrency(): string {
    return this.currencySignal();
  }

  setCurrentCurrency(currencyCode: string): void {
    if (this.currencySignal() !== currencyCode) {
      this.currencySignal.set(currencyCode);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getCurrentLanguage(): string {
    return this.languageSignal();
  }

  getCurrentLanguageForCurrency(): string {
    const lang = this.languageSignal();
    if (lang === 'en') return 'en-IN';
    if (lang === 'hi') return 'hi-IN';
    return lang;
  }

  setCurrentLanguage(languageCode: string): void {
    if (this.languageSignal() !== languageCode) {
      this.languageSignal.set(languageCode);
    }
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
      currency = this.currencySignal(),
      locale = this.getCurrentLanguageForCurrency(),
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

    // Auto-compact if >= 1,000,000 (6 digits/millions)
    const isAutoCompact = Math.abs(roundedValue) >= 1000000;
    const finalCompact = compact || isAutoCompact;

    const formatOptions: Intl.NumberFormatOptions = {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: effectiveDecimalPlaces,
      signDisplay: signDisplay,
      notation: finalCompact ? 'compact' : notation
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

