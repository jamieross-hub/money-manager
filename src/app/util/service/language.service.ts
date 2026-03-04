import { Injectable, signal, effect, inject } from '@angular/core';
import { APP_CONFIG } from '../config/config';
import { UserService } from './db/user.service';
import { TranslationService } from './translation.service';
import { toSignal } from '@angular/core/rxjs-interop';

@Injectable({
    providedIn: 'root'
})
export class LanguageService {
    private readonly translationService = inject(TranslationService);
    private readonly userService = inject(UserService);

    private languageSignal = signal<string>(APP_CONFIG.REGIONAL.LANGUAGE_DEFAULT);
    public readonly currentLanguage = this.languageSignal.asReadonly();

    constructor() {
        this.syncWithUserPreferences();
    }

    private syncWithUserPreferences(): void {
        this.userService.userAuth$.subscribe(user => {
            if (user?.preferences?.language) {
                this.translationService.setLanguage(user.preferences.language);
            }
        });

        // Sync local languageSignal with TranslationService
        effect(() => {
            const lang = this.translationService.currentLanguage();
            if (this.languageSignal() !== lang) {
                this.languageSignal.set(lang);
                // Update HTML lang attribute
                document.documentElement.lang = lang;
            }
        });
    }

    setLanguage(lang: string) {
        this.translationService.setLanguage(lang);
    }

    getCurrentLanguage(): string {
        return this.languageSignal();
    }

    getAvailableLanguages() {
        return Object.values(APP_CONFIG.REGIONAL.COUNTRY_MAPPING)
            .flatMap(config => (config as any).languages || [])
            .filter((v, i, a) => a.findIndex(t => t.code === v.code) === i);
    }
}

