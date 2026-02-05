import { Pipe, PipeTransform, inject } from '@angular/core';
import { APP_CONFIG } from '../config/config';
import { CurrencyCode } from '../config/enums';
import { UserService } from '../service/db/user.service';

export interface CurrencyPipeOptions {
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

@Pipe({
  name: 'currency',
  standalone: true,
  pure: true
})
export class CurrencyPipe implements PipeTransform {
  private userService = inject(UserService);

  /**
   * Transform a number value to a formatted currency string
   * @param value - The numeric value to format
   * @param options - Optional formatting options
   * @returns Formatted currency string
   */
  transform(value: number | string | null | undefined, options?: CurrencyPipeOptions): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (value === '') {
      return '';
    }

    const numericValue = typeof value === 'string' ? parseFloat(value) : value;

    if (isNaN(numericValue)) {
      return 'Invalid amount';
    }

    const userPreferences = this.userService.userAuth$.value?.preferences;
    const userCurrency = userPreferences?.defaultCurrency;
    const userLanguage = userPreferences?.language;

    const {
      currency = userCurrency || APP_CONFIG.CURRENCY.DEFAULT,
      locale = userLanguage || APP_CONFIG.LANGUAGE.DEFAULT,
      showSymbol = true,
      showCode = false,
      decimalPlaces,
      compact = false,
      signDisplay = 'auto',
      notation = 'standard',
      round = false
    } = options || {};

    const currencyCode = currency as CurrencyCode;
    const config = this.getCurrencyConfig(currencyCode);
    const configDecimalPlaces = config?.decimalPlaces ?? 2;

    // Apply rounding if specified
    const roundedValue = round ? Math.round(numericValue) : numericValue;

    // Determine decimal places
    const effectiveDecimalPlaces = round
      ? 0
      : (decimalPlaces !== undefined ? decimalPlaces : configDecimalPlaces);

    const formatOptions: Intl.NumberFormatOptions = {
      style: 'currency',
      currency: currencyCode,
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
      // Use the provided locale or default to browser locale
      const formatLocale = locale || navigator.language;
      return new Intl.NumberFormat(formatLocale, formatOptions).format(roundedValue);
    } catch (error) {
      console.error('Error formatting currency:', error);
      // Fallback formatting
      const symbol = config?.symbol || currencyCode;
      return `${symbol}${roundedValue.toFixed(effectiveDecimalPlaces)}`;
    }
  }

  /**
   * Helper to get currency configuration from COUNTRY_MAPPING
   */
  private getCurrencyConfig(currencyCode: CurrencyCode): { symbol: string, decimalPlaces: number } | undefined {
    // Search through COUNTRY_MAPPING values to find the currency
    const mapping = APP_CONFIG.CURRENCY.COUNTRY_MAPPING;
    for (const data of Object.values(mapping)) {
      if (data.currency === currencyCode) {
        return { symbol: data.symbol, decimalPlaces: data.decimalPlaces };
      }
    }
    return undefined;
  }

  getSymbol(currencyCode: CurrencyCode): string {
    const config = this.getCurrencyConfig(currencyCode);
    return config?.symbol || currencyCode;
  }

  getDecimalPlaces(currencyCode: CurrencyCode): number {
    const config = this.getCurrencyConfig(currencyCode);
    return config?.decimalPlaces ?? 2;
  }

  /**
   * Check if a currency code is supported
   */
  static isSupportedCurrency(currencyCode: string): boolean {
    const mapping = APP_CONFIG.CURRENCY.COUNTRY_MAPPING;
    return Object.values(mapping).some(data => data.currency === currencyCode);
  }

  /**
   * Get all supported currencies
   */
  static getSupportedCurrencies(): readonly CurrencyCode[] {
    const mapping = APP_CONFIG.CURRENCY.COUNTRY_MAPPING;
    const currencies = new Set<CurrencyCode>();
    Object.values(mapping).forEach(data => currencies.add(data.currency));
    return Array.from(currencies);
  }
}
