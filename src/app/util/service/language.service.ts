import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { APP_CONFIG } from '../config/config';
import { LanguageCode } from '../config/enums';
import { UserService } from './db/user.service';
import { TranslationService } from './translation.service';

@Injectable({
    providedIn: 'root'
})
export class LanguageService {
    private currentLanguageSubject = new BehaviorSubject<string>(APP_CONFIG.REGIONAL.LANGUAGE_DEFAULT);
    public currentLanguage$ = this.currentLanguageSubject.asObservable();

    constructor(
        private translationService: TranslationService,
        private userService: UserService,
    ) {
        // Initialization is handled by TranslationService via getInitialLanguage()
        this.syncWithUserPreferences();
    }

    private syncWithUserPreferences(): void {
        this.userService.userAuth$.subscribe(user => {
            if (user?.preferences?.language) {
                this.translationService.setLanguage(user.preferences.language);
            }
        });

        // Sync local currentLanguageSubject with TranslationService
        this.translationService.getCurrentLanguage().subscribe((lang: string) => {
            if (this.currentLanguageSubject.value !== lang) {
                this.currentLanguageSubject.next(lang);
                // Update HTML lang attribute
                document.documentElement.lang = lang;
            }
        });
    }




    setLanguage(lang: string) {
        this.translationService.setLanguage(lang);
    }

    getCurrentLanguage(): string {
        return this.currentLanguageSubject.value;
    }

    getAvailableLanguages() {
        return Object.values(APP_CONFIG.REGIONAL.COUNTRY_MAPPING)
            .flatMap(config => (config as any).languages || [])
            .filter((v, i, a) => a.findIndex(t => t.code === v.code) === i);
    }
}
