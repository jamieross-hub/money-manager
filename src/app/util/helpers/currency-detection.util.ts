import { CurrencyCode } from '../config/enums';

/**
 * Utility class for detecting user's currency based on their location/locale
 */
export class CurrencyDetectionUtil {
    /**
     * Map of country codes to their primary currencies
     * Only includes currencies defined in CurrencyCode enum
     */
    private static readonly COUNTRY_TO_CURRENCY: Record<string, CurrencyCode> = {
        // Americas
        'US': CurrencyCode.USD,
        'CA': CurrencyCode.CAD,

        // Europe
        'GB': CurrencyCode.GBP,

        // Eurozone countries (all use EUR)
        'DE': CurrencyCode.EUR,
        'FR': CurrencyCode.EUR,
        'IT': CurrencyCode.EUR,
        'ES': CurrencyCode.EUR,
        'PT': CurrencyCode.EUR,
        'NL': CurrencyCode.EUR,
        'BE': CurrencyCode.EUR,
        'AT': CurrencyCode.EUR,
        'IE': CurrencyCode.EUR,
        'FI': CurrencyCode.EUR,
        'GR': CurrencyCode.EUR,

        // Asia Pacific
        'IN': CurrencyCode.INR,
        'CN': CurrencyCode.CNY,
        'JP': CurrencyCode.JPY,
        'AU': CurrencyCode.AUD,
    };

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
                if (country && this.COUNTRY_TO_CURRENCY[country]) {
                    console.log(`Detected currency from timezone: ${this.COUNTRY_TO_CURRENCY[country]}`);
                    return this.COUNTRY_TO_CURRENCY[country];
                }
            }

            // Method 2: Try to get from browser language/locale
            const locale = navigator.language || (navigator as any).userLanguage;
            if (locale) {
                const countryCode = this.getCountryFromLocale(locale);
                if (countryCode && this.COUNTRY_TO_CURRENCY[countryCode]) {
                    console.log(`Detected currency from locale: ${this.COUNTRY_TO_CURRENCY[countryCode]}`);
                    return this.COUNTRY_TO_CURRENCY[countryCode];
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
     * Extract country code from timezone (e.g., "Asia/Kolkata" -> "IN")
     */
    private static getCountryFromTimezone(timeZone: string): string | null {
        const timezoneToCountry: Record<string, string> = {
            // India
            'Asia/Kolkata': 'IN',
            'Asia/Calcutta': 'IN',

            // USA
            'America/New_York': 'US',
            'America/Chicago': 'US',
            'America/Los_Angeles': 'US',
            'America/Denver': 'US',
            'America/Phoenix': 'US',

            // Europe
            'Europe/London': 'GB',
            'Europe/Paris': 'FR',
            'Europe/Berlin': 'DE',
            'Europe/Rome': 'IT',
            'Europe/Madrid': 'ES',
            'Europe/Amsterdam': 'NL',
            'Europe/Brussels': 'BE',
            'Europe/Vienna': 'AT',
            'Europe/Dublin': 'IE',

            // Asia Pacific
            'Asia/Shanghai': 'CN',
            'Asia/Tokyo': 'JP',
            'Australia/Sydney': 'AU',
            'Pacific/Auckland': 'NZ',
        };

        return timezoneToCountry[timeZone] || null;
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
