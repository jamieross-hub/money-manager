import { CurrencyCode, LanguageCode } from '../config/enums';
import { APP_CONFIG } from '../config/config';

interface CountryConfig {
    currency: CurrencyCode;
    language: LanguageCode;
    timezones?: readonly string[];
    symbol: string;
    decimalPlaces: number;
}

/**
 * Utility class for detecting user's currency based on their location/locale
 */
export class CurrencyDetectionUtil {
    /**
     * Map of country codes to their configuration (currency, language, timezones)
     * Retrieves from centralized config
     */
    private static get COUNTRY_CONFIG(): Record<string, CountryConfig> {
        return APP_CONFIG.CURRENCY.COUNTRY_MAPPING;
    }

    /**
     * Detect user's currency based on browser locale and timezone
     * @returns Detected currency code or fallback to INR
     */
    static detectCurrency(): CurrencyCode {
        try {
            // Method 1: Try to get country from Intl.DateTimeFormat (most reliable)
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (timeZone) {
                const country = this.getCountryFromTimezone(timeZone);
                if (country && this.COUNTRY_CONFIG[country]) {
                    console.log(`Detected currency from timezone: ${this.COUNTRY_CONFIG[country].currency}`);
                    return this.COUNTRY_CONFIG[country].currency;
                }
            }

            // Method 2: Try to get from browser language/locale
            const locale = navigator.language || (navigator as any).userLanguage;
            if (locale) {
                const countryCode = this.getCountryFromLocale(locale);
                if (countryCode && this.COUNTRY_CONFIG[countryCode]) {
                    console.log(`Detected currency from locale: ${this.COUNTRY_CONFIG[countryCode].currency}`);
                    return this.COUNTRY_CONFIG[countryCode].currency;
                }
            }

            // Method 3: Fallback to INR (India)
            console.log('Using fallback currency: INR');
            return CurrencyCode.INR;
        } catch (error) {
            console.error('Error detecting currency:', error);
            return CurrencyCode.INR;
        }
    }

    /**
     * Extract country code from timezone by searching the config
     */
    private static getCountryFromTimezone(timeZone: string): string | null {
        const mapping = this.COUNTRY_CONFIG;
        for (const [countryCode, config] of Object.entries(mapping)) {
            if (config.timezones?.includes(timeZone)) {
                return countryCode;
            }
        }
        return null;
    }

    /**
     * Extract country code from locale string (e.g., "en-US" -> "US")
     */
    private static getCountryFromLocale(locale: string): string | null {
        const parts = locale.split('-');
        if (parts.length >= 2) {
            return parts[1].toUpperCase();
        }
        return null;
    }
}
