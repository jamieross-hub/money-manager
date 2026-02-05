import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CURRENCIES, Currency, DEFAULT_CURRENCY, getCurrencyByCode, getCurrencySymbol } from '../models/currency.model';
import { UserService } from './db/user.service';
import { APP_CONFIG } from '../config/config';

@Injectable({
  providedIn: 'root'
})
export class CurrencyService {
  private currentCurrencySubject = new BehaviorSubject<string>(DEFAULT_CURRENCY);
  public currentCurrency$ = this.currentCurrencySubject.asObservable();

  private currentLanguageSubject = new BehaviorSubject<string>(APP_CONFIG.LANGUAGE.DEFAULT);
  public currentLanguage$ = this.currentLanguageSubject.asObservable();

  constructor(private userService: UserService) {
    this.initializeCurrency();
  }

  private initializeCurrency(): void {
    this.userService.userAuth$.subscribe(user => {
      if (user?.preferences) {
        if (user.preferences.defaultCurrency) {
          this.setCurrentCurrency(user.preferences.defaultCurrency);
        }
        if (user.preferences.language) {
          this.setCurrentLanguage(user.preferences.language);
        }
      }
    });
  }

  getCurrencies(): Currency[] {
    return CURRENCIES;
  }

  getCurrentCurrency(): string {
    return this.currentCurrencySubject.value;
  }

  setCurrentCurrency(currencyCode: string): void {
    if (this.isValidCurrency(currencyCode) && this.currentCurrencySubject.value !== currencyCode) {
      this.currentCurrencySubject.next(currencyCode);
    }
  }

  getCurrentLanguage(): string {
    return this.currentLanguageSubject.value;
  }

  setCurrentLanguage(languageCode: string): void {
    if (this.currentLanguageSubject.value !== languageCode) {
      this.currentLanguageSubject.next(languageCode);
    }
  }

  getCurrencySymbol(currencyCode?: string): string {
    const code = currencyCode || this.getCurrentCurrency();
    return getCurrencySymbol(code);
  }

  getCurrencyByCode(currencyCode: string): Currency | undefined {
    return getCurrencyByCode(currencyCode);
  }

  isValidCurrency(currencyCode: string): boolean {
    return CURRENCIES.some(currency => currency.code === currencyCode);
  }

  getDefaultCurrency(): string {
    return DEFAULT_CURRENCY;
  }

  formatAmount(amount: number): string {
    const code = this.getCurrentCurrency();
    const locale = this.getCurrentLanguage();
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
    }).format(amount);
  }
} 