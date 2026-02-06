import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { APP_CONFIG } from '../config/config';
import { TranslateService } from '@ngx-translate/core';

export type Language = 'en' | 'hi';

interface Translations {
  [key: string]: {
    en: string;
    hi: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private currentLanguage = new BehaviorSubject<Language>('en');

  private translations: Translations = {
    // Common
    'loading': { en: 'Loading...', hi: 'लोड हो रहा है...' },
    'error': { en: 'Error', hi: 'त्रुटि' },
    'success': { en: 'Success', hi: 'सफलता' },
    'cancel': { en: 'Cancel', hi: 'रद्द करें' },
    'save': { en: 'Save', hi: 'सहेजें' },
    'delete': { en: 'Delete', hi: 'हटाएं' },
    'edit': { en: 'Edit', hi: 'संपादित करें' },
    'add': { en: 'Add', hi: 'जोड़ें' },
    'close': { en: 'Close', hi: 'बंद करें' },
    'logout': { en: 'Logout', hi: 'लॉगआउट' },
    'login': { en: 'Login', hi: 'लॉगिन' },
    'manage': { en: 'Manage', hi: 'प्रबंधन' },
    'signup': { en: 'Sign Up', hi: 'साइन अप' },
    'email': { en: 'Email', hi: 'ईमेल' },
    'password': { en: 'Password', hi: 'पासवर्ड' },
    'name': { en: 'Name', hi: 'नाम' },
    'amount': { en: 'Amount', hi: 'राशि' },
    'date': { en: 'Date', hi: 'तारीख' },
    'category': { en: 'Category', hi: 'श्रेणी' },
    'type': { en: 'Type', hi: 'प्रकार' },
    'income': { en: 'Income', hi: 'आय' },
    'expense': { en: 'Expense', hi: 'खर्च' },
    'total': { en: 'Total', hi: 'कुल' },
    'balance': { en: 'Balance', hi: 'शेष राशि' },
    'actions': { en: 'Actions', hi: 'कार्रवाई' },
    'search': { en: 'Search', hi: 'खोजें' },
    'filter': { en: 'Filter', hi: 'फ़िल्टर' },
    'clear': { en: 'Clear', hi: 'साफ़ करें' },
    'settings': { en: 'Settings', hi: 'सेटिंग्स' },

    // Navigation
    'dashboard': { en: 'Dashboard', hi: 'डैशबोर्ड' },
    'home': { en: 'Home', hi: 'होम' },
    'accounts': { en: 'Accounts', hi: 'खाते' },
    'transactions': { en: 'Transactions', hi: 'लेन-देन' },
    'categories': { en: 'Categories', hi: 'श्रेणियां' },
    'budgets': { en: 'Budgets', hi: 'बजट' },
    'goals': { en: 'Goals', hi: 'लक्ष्य' },
    'reports': { en: 'Reports', hi: 'रिपोर्ट्स' },
    'calendar': { en: 'Calendar', hi: 'कैलेंडर' },
    'notes': { en: 'Notes', hi: 'नोट्स' },
    'tax': { en: 'Tax', hi: 'कर' },
    'recurring': { en: 'Recurring', hi: 'आवर्ती' },
    'recurring_transactions': { en: 'Recurring Transactions', hi: 'आवर्ती लेन-देन' },
    'tools': { en: 'Tools', hi: 'उपकरण' },

    // Dashboard
    'moneyManager': { en: `${APP_CONFIG.APP_NAME}`, hi: 'मनी मैनेजर' },
    'manageFinances': { en: 'Manage your finances', hi: 'अपने वित्त का प्रबंधन करें' },
    'welcomeBack': { en: 'Welcome Back!', hi: 'वापसी पर स्वागत है!' },
    'youSpend': { en: 'You Spend', hi: 'आपका खर्च' },
    'youEarn': { en: 'You Earn', hi: 'आपकी कमाई' },
    'netBalance': { en: 'Net Balance', hi: 'शुद्ध शेष' },
    'thisMonth': { en: 'This Month', hi: 'इस महीने' },
    'lastMonth': { en: 'Last Month', hi: 'पिछले महीने' },
    'quickActions': { en: 'Quick Actions', hi: 'त्वरित कार्रवाई' },
    'recentTransactions': { en: 'Recent Transactions', hi: 'हाल के लेन-देन' },
    'upcomingBills': { en: 'Upcoming Bills', hi: 'आगामी बिल' },
    'savingsGoal': { en: 'Savings Goal', hi: 'बचत लक्ष्य' },

    // Auth
    'signIn': { en: 'Sign In', hi: 'साइन इन' },
    'signUp': { en: 'Sign Up', hi: 'साइन अप' },
    'signOut': { en: 'Sign Out', hi: 'साइन आउट' },
    'forgotPassword': { en: 'Forgot Password?', hi: 'पासवर्ड भूल गए?' },
    'resetPassword': { en: 'Reset Password', hi: 'पासवर्ड रीसेट करें' },
    'emailPlaceholder': { en: 'Enter your email', hi: 'अपना ईमेल दर्ज करें' },
    'passwordPlaceholder': { en: 'Enter your password', hi: 'अपना पासवर्ड दर्ज करें' },
    'confirmPassword': { en: 'Confirm Password', hi: 'पासवर्ड की पुष्टि करें' },
    'namePlaceholder': { en: 'Enter your name', hi: 'अपना नाम दर्ज करें' },
    'loginSuccess': { en: 'Successfully signed in', hi: 'सफलतापूर्वक साइन इन किया गया' },
    'loginError': { en: 'Failed to sign in', hi: 'साइन इन करने में विफल' },
    'signupSuccess': { en: 'Successfully signed up', hi: 'सफलतापूर्वक साइन अप किया गया' },
    'signupError': { en: 'Failed to sign up', hi: 'साइन अप करने में विफल' },
    'sessionExpired': { en: 'Session expired. Please sign in again.', hi: 'सत्र समाप्त हो गया। कृपया फिर से साइन इन करें।' },
    'invalidCredentials': { en: 'Invalid email or password', hi: 'अमान्य ईमेल या पासवर्ड' },
    'passwordMismatch': { en: 'Passwords do not match', hi: 'पासवर्ड मेल नहीं खाते' },
    'emailRequired': { en: 'Email is required', hi: 'ईमेल आवश्यक है' },
    'passwordRequired': { en: 'Password is required', hi: 'पासवर्ड आवश्यक है' },
    'nameRequired': { en: 'Name is required', hi: 'नाम आवश्यक है' },

    // Transactions
    'addTransaction': { en: 'Add Transaction', hi: 'लेन-देन जोड़ें' },
    'editTransaction': { en: 'Edit Transaction', hi: 'लेन-देन संपादित करें' },
    'deleteTransaction': { en: 'Delete Transaction', hi: 'लेन-देन हटाएं' },
    'transactionHistory': { en: 'Transaction History', hi: 'लेन-देन इतिहास' },
    'manageTransactions': { en: 'Manage and track your financial transactions', hi: 'अपने वित्तीय लेन-देन का प्रबंधन और ट्रैकिंग करें' },
    'payee': { en: 'Payee', hi: 'प्राप्तकर्ता' },
    'payeePlaceholder': { en: 'Enter payee name', hi: 'प्राप्तकर्ता का नाम दर्ज करें' },
    'amountPlaceholder': { en: 'Enter amount', hi: 'राशि दर्ज करें' },
    'categoryPlaceholder': { en: 'Select category', hi: 'श्रेणी चुनें' },
    'datePlaceholder': { en: 'Select date', hi: 'तारीख चुनें' },
    'notesPlaceholder': { en: 'Add notes (optional)', hi: 'नोट्स जोड़ें (वैकल्पिक)' },
    'noTransactions': { en: 'No transactions yet', hi: 'अभी तक कोई लेन-देन नहीं' },
    'noTransactionsMessage': { en: 'Start by adding your first transaction to track your finances.', hi: 'अपने वित्त का ट्रैक रखने के लिए अपना पहला लेन-देन जोड़कर शुरू करें।' },
    'transactionAdded': { en: 'Transaction added successfully', hi: 'लेन-देन सफलतापूर्वक जोड़ा गया' },
    'transactionUpdated': { en: 'Transaction updated successfully', hi: 'लेन-देन सफलतापूर्वक अपडेट किया गया' },
    'transactionDeleted': { en: 'Transaction deleted successfully', hi: 'लेन-देन सफलतापूर्वक हटाया गया' },
    'confirmDelete': { en: 'Delete Transaction', hi: 'लेन-देन हटाएं' },
    'confirmDeleteMessage': { en: 'Are you sure you want to delete this transaction?', hi: 'क्या आप वाकई इस लेन-देन को हटाना चाहते हैं?' },

    // Messages
    'networkError': { en: 'Network error. Please check your connection.', hi: 'नेटवर्क त्रुटि। कृपया अपना कनेक्शन जांचें।' },
    'serverError': { en: 'Server error. Please try again later.', hi: 'सर्वर त्रुटि। कृपया बाद में पुनः प्रयास करें।' },
    'validationError': { en: 'Please check your input and try again.', hi: 'कृपया अपना इनपुट जांचें और पुनः प्रयास करें।' },
    'dataSaved': { en: 'Data saved successfully', hi: 'डेटा सफलतापूर्वक सहेजा गया' },
    'dataDeleted': { en: 'Data deleted successfully', hi: 'डेटा सफलतापूर्वक हटाया गया' },
    'changesDiscarded': { en: 'Changes discarded', hi: 'परिवर्तन त्याग दिए गए' },
    'unsavedChanges': { en: 'You have unsaved changes', hi: 'आपके पास असहेजे परिवर्तन हैं' },
    'confirmDiscard': { en: 'Discard Changes', hi: 'परिवर्तन त्यागें' },
    'confirmDiscardMessage': { en: 'Are you sure you want to discard your changes?', hi: 'क्या आप वाकई अपने परिवर्तन त्यागना चाहते हैं?' }
  };

  constructor(private translateService: TranslateService) {
    // Set default language
    this.translateService.setDefaultLang('en');

    // Load saved language preference
    let savedLanguage = localStorage.getItem('app_language');

    // Normalize if needed (e.g. en-IN -> en)
    if (savedLanguage) {
      savedLanguage = this.normalizeLanguageCode(savedLanguage);
    }

    if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'hi')) {
      const lang = savedLanguage as Language;
      this.currentLanguage.next(lang);
      this.translateService.use(lang);
    } else {
      // Detect browser language
      const browserLang = this.normalizeLanguageCode(navigator.language);
      if (browserLang === 'hi') {
        this.currentLanguage.next('hi');
        this.translateService.use('hi');
      } else {
        this.translateService.use('en');
      }
    }
  }

  /**
   * Normalize language code to short format (e.g., 'en-IN' -> 'en')
   */
  private normalizeLanguageCode(code: string): string {
    if (!code) return 'en';
    return code.split('-')[0].toLowerCase();
  }

  // Get current language as observable
  getCurrentLanguage(): Observable<Language> {
    return this.currentLanguage.asObservable();
  }

  // Get current language value
  getCurrentLanguageValue(): Language {
    return this.currentLanguage.value;
  }

  // Change language
  setLanguage(language: string): void {
    const normalizedLang = this.normalizeLanguageCode(language) as Language;

    // Only update if it's a supported language
    if (normalizedLang === 'en' || normalizedLang === 'hi') {
      this.currentLanguage.next(normalizedLang);
      this.translateService.use(normalizedLang);
      localStorage.setItem('app_language', normalizedLang);
    }
  }

  // Get translation
  translate(key: string): string {
    // First try ngx-translate (instant)
    const ngxTranslation = this.translateService.instant(key);
    if (ngxTranslation !== key) {
      return ngxTranslation;
    }

    // Fallback to hardcoded translations
    const translation = this.translations[key];
    if (translation) {
      return translation[this.currentLanguage.value] || translation['en'] || key;
    }
    return key;
  }

  // Get translation with parameters
  translateWithParams(key: string, params: Record<string, string>): string {
    let translation = this.translate(key);

    // Replace parameters in translation
    Object.keys(params).forEach(param => {
      translation = translation.replace(`{{${param}}}`, params[param]);
    });

    return translation;
  }

} 