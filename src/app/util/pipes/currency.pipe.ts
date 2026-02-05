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
    if (value === null || value === undefined || value === '') {
      return this.formatCurrency(0, options);
    }

    const numericValue = typeof value === 'string' ? parseFloat(value) : value;

    if (isNaN(numericValue)) {
      return 'Invalid amount';
    }

    // Apply rounding if specified
    const roundedValue = options?.round ? Math.round(numericValue) : numericValue;

    return this.formatCurrency(roundedValue, options);
  }

  /**
   * Format currency value with the specified options
   */
  private formatCurrency(value: number, options?: CurrencyPipeOptions): string {
    const userCurrency = this.userService.userAuth$.value?.preferences?.defaultCurrency;

    const {
      currency = userCurrency || APP_CONFIG.CURRENCY.DEFAULT,
      locale = APP_CONFIG.LANGUAGE.DEFAULT,
      showSymbol = true,
      showCode = false,
      decimalPlaces,
      compact = false,
      signDisplay = 'auto',
      notation = 'standard',
      round = false
    } = options || {};

    const currencyConfig = this.getCurrencyConfig(currency);

    // Determine if value has a decimal part
    const hasDecimal = value % 1 !== 0;

    // If rounding is enabled, force decimal places to 0
    const effectiveDecimalPlaces = round ? 0 : decimalPlaces;

    const minFractionDigits = effectiveDecimalPlaces !== undefined
      ? (hasDecimal && !round ? effectiveDecimalPlaces : 0)
      : (hasDecimal && !round ? currencyConfig.decimalPlaces : 0);

    const maxFractionDigits = effectiveDecimalPlaces !== undefined
      ? effectiveDecimalPlaces
      : (round ? 0 : currencyConfig.decimalPlaces);

    const formatOptions: Intl.NumberFormatOptions = {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: minFractionDigits,
      maximumFractionDigits: maxFractionDigits,
      signDisplay: signDisplay,
      notation: compact ? 'compact' : notation
    };

    if (!showSymbol) {
      formatOptions.currencyDisplay = 'code';
    } else if (showCode) {
      formatOptions.currencyDisplay = 'narrowSymbol';
    }

    try {
      const formatter = new Intl.NumberFormat(locale, formatOptions);
      return formatter.format(value);
    } catch (error) {
      console.error('Currency formatting error:', error);
      return this.fallbackFormat(value, currency, currencyConfig);
    }
  }

  /**
   * Get currency configuration from APP_CONFIG
   */
  private getCurrencyConfig(currency: string) {
    const currencyCode = currency as CurrencyCode;
    return {
      symbol: APP_CONFIG.CURRENCY.SYMBOLS[currencyCode] || currency,
      decimalPlaces: APP_CONFIG.CURRENCY.DECIMAL_PLACES[currencyCode] || 2
    };
  }

  /**
   * Fallback formatting when Intl.NumberFormat fails
   */
  private fallbackFormat(value: number, currency: string, config: any): string {
    const symbol = config.symbol;
    const formattedValue = value % 1 === 0
      ? value.toFixed(0)
      : value.toFixed(config.decimalPlaces);
    return `${symbol}${formattedValue}`;
  }

  /**
   * Get currency symbol for a given currency code
   */
  static getCurrencySymbol(currencyCode: string): string {
    const code = currencyCode as CurrencyCode;
    return APP_CONFIG.CURRENCY.SYMBOLS[code] || currencyCode;
  }

  /**
   * Get decimal places for a given currency code
   */
  static getDecimalPlaces(currencyCode: string): number {
    const code = currencyCode as CurrencyCode;
    return APP_CONFIG.CURRENCY.DECIMAL_PLACES[code] || 2;
  }

  /**
   * Check if a currency code is supported
   */
  static isSupportedCurrency(currencyCode: string): boolean {
    return APP_CONFIG.CURRENCY.SUPPORTED.includes(currencyCode as CurrencyCode);
  }

  /**
   * Get all supported currencies
   */
  static getSupportedCurrencies(): readonly CurrencyCode[] {
    return APP_CONFIG.CURRENCY.SUPPORTED;
  }
}
