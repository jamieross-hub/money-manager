import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { APP_CONFIG } from '../config/config';
import { LanguageCode } from '../config/enums';
import { UserService } from './db/user.service';

@Injectable({
    providedIn: 'root'
})
export class LanguageService {
    private currentLanguageSubject = new BehaviorSubject<string>(APP_CONFIG.REGIONAL.LANGUAGE_DEFAULT);
    public currentLanguage$ = this.currentLanguageSubject.asObservable();

    constructor(private translate: TranslateService, private userService: UserService) {
        // Set default language
        this.translate.setDefaultLang('en');

        // Initialize language from localStorage or profile
        // const savedLang = localStorage.getItem('app_language');
        // if (savedLang) {
        //     this.setLanguage(savedLang);
        // } else {
        //     const browserLang = this.translate.getBrowserLang();
        //     this.setLanguage(browserLang?.match(/en|hi|fr|de|es|zh/) ? browserLang : 'en');
        // }
        this.initializeCurrency();
    }

    private initializeCurrency(): void {
        this.userService.userAuth$.subscribe(user => {
            // Prioritize country-based settings if country is set in preferences
            if (user?.preferences?.language) {
                this.setLanguage(user?.preferences?.language || APP_CONFIG.REGIONAL.LANGUAGE_DEFAULT);
            }else{
                this.setLanguage(APP_CONFIG.REGIONAL.LANGUAGE_DEFAULT);
            }
        }


        )
    }




    setLanguage(lang: string) {
        this.translate.use(lang);
        this.currentLanguageSubject.next(lang);
        localStorage.setItem('app_language', lang);

        // Update HTML lang attribute
        document.documentElement.lang = lang;
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
