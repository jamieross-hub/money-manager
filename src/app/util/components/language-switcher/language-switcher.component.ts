import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslationService, Language } from '../../service/translation.service';
import { LanguageService } from '../../service/language.service';

@Component({
  selector: 'app-language-switcher',
  templateUrl: './language-switcher.component.html',
  styleUrls: ['./language-switcher.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class LanguageSwitcherComponent implements OnInit {
  currentLanguage: Language = 'en';
  availableLanguages: { code: Language; name: string; nativeName: string }[] = [];
  isDropdownOpen = false;

  constructor(
    private translationService: TranslationService,
    private languageService: LanguageService
  ) { }

  ngOnInit(): void {
    this.translationService.getCurrentLanguage().subscribe(lang => {
      this.currentLanguage = lang;
    });

    // Populate available languages from LanguageService
    this.availableLanguages = this.languageService.getAvailableLanguages().map((lang: any) => ({
      code: lang.code,
      name: lang.name,
      nativeName: lang.code === 'hi' ? 'हिंदी' : lang.name
    }));
  }

  switchLanguage(language: Language): void {
    this.translationService.setLanguage(language);
  }

  getCurrentLanguageName(): string {
    const lang = this.availableLanguages.find(l => l.code === this.currentLanguage);
    return lang ? lang.nativeName : 'English';
  }

  toggleDropdown(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  onLanguageSelect(language: Language): void {
    this.switchLanguage(language);
    this.isDropdownOpen = false;
  }
} 