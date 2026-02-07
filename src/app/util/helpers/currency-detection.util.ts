import { CurrencyCode, LanguageCode } from '../config/enums';
import { APP_CONFIG } from '../config/config';

interface CountryConfig {
    currency: CurrencyCode;
    languages: readonly { code: LanguageCode; name: string }[];
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
        return APP_CONFIG.REGIONAL.COUNTRY_MAPPING;
    }

    /**
     * Detect user's currency based on detected country
     * @returns Detected currency code or fallback to INR
     */
    static detectCurrency(): CurrencyCode {
        const countryCode = this.detectCountryCode();
        return this.COUNTRY_CONFIG[countryCode]?.currency || CurrencyCode.INR;
    }

    /**
     * Detect user's country code based on browser locale and timezone
     * @returns Detected country code (e.g., 'US', 'IN')
     */
    static detectCountryCode(): string {
        try {
            // Method 1: Try to get country from Intl.DateTimeFormat (most reliable)
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (timeZone) {
                const country = this.getCountryFromTimezone(timeZone);
                if (country && this.COUNTRY_CONFIG[country]) {
                    return country;
                }
            }

            // Method 2: Try to get from browser language/locale(s)
            const locales = [
                navigator.language,
                ...(navigator.languages || []),
                (navigator as any).userLanguage
            ].filter(Boolean);

            for (const locale of locales) {
                const countryCode = this.getCountryFromLocale(locale);
                if (countryCode && this.COUNTRY_CONFIG[countryCode]) {
                    return countryCode;
                }
            }

            return 'IN'; // Fallback to India
        } catch (error) {
            console.error('Error detecting country:', error);
            return 'IN';
        }
    }

    /**
     * Detect full regional configuration for a user
     */
    static detectRegionalConfig(): { country: string, currency: CurrencyCode, language: LanguageCode, timezone: string } {
        const countryCode = this.detectCountryCode();
        const config = this.COUNTRY_CONFIG[countryCode];
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

        // Detect preferred language from config if multiple are available
        const browserLang = (navigator.language || (navigator as any).userLanguage || '').split(/[_-]/)[0].toLowerCase();
        const matchedLanguage = config?.languages?.find(lang => lang.code === browserLang);

        return {
            country: countryCode,
            currency: config?.currency || CurrencyCode.INR,
            language: config?.languages?.[0]?.code || LanguageCode.EN,
            timezone: timezone
        };
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
        // Handle both "en-US" and "en_US" formats
        const parts = locale.split(/[_-]/);
        if (parts.length >= 2) {
            return parts[1].toUpperCase();
        }
        return null;
    }
}
