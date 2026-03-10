import { TestBed } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { Store } from '@ngrx/store';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { NotificationService } from '../service/notification.service';
import { LoaderService } from '../service/loader.service';
import { FilterService } from '../service/filter.service';
import { DateService } from '../service/date.service';
import { BreakpointService } from '../service/breakpoint.service';
import { TransactionsService } from '../service/db/transactions.service';
import { AccountsService } from '../service/db/accounts.service';
import { CategoryService } from '../service/db/category.service';
import { UserService } from '../service/db/user.service';
import { SubscriptionService } from '../service/subscription.service';
import { CurrencyService } from '../service/currency.service';
import { SecurityService } from '../service/security.service';
import { LanguageService } from '../service/language.service';
import { LocalIndexDBStorageService } from '../service/indexdb-storage.service';
import { SwUpdate } from '@angular/service-worker';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { OverlayContainer } from '@angular/cdk/overlay';
import { MobileBackButtonService } from '../service/mobile-back-button.service';
import { FamilyNotificationService } from '../../modules/family/services/family-notification.service';
import { TransactionProcessorService } from '../service/transaction-processor.service';
import { SsrService } from '../service/ssr.service';
import { PwaNavigationService } from '../service/pwa-navigation.service';
import { ThemeSwitchingService } from '../service/theme-switching.service';
import { environment } from '../../../environments/environment';
import { TranslateModule } from '@ngx-translate/core';
import { signal } from '@angular/core';
import { of, BehaviorSubject } from 'rxjs';
// No top-level TEST_IMPORTS here to avoid conflicts with test-config.ts

export class TestSetup {
  static getMockAuth() {
    return jasmine.createSpyObj('Auth', [], {
      currentUser: {
        uid: 'test-user-id',
        email: 'test@example.com',
        displayName: 'Test User'
      }
    });
  }

  static getMockFirestore() {
    return jasmine.createSpyObj('Firestore', ['collection', 'doc'], {
      collection: jasmine.createSpy('collection').and.returnValue({
        doc: jasmine.createSpy('doc').and.returnValue({
          get: jasmine.createSpy('get').and.returnValue(Promise.resolve({ data: () => ({}) })),
          set: jasmine.createSpy('set').and.returnValue(Promise.resolve()),
          update: jasmine.createSpy('update').and.returnValue(Promise.resolve()),
          delete: jasmine.createSpy('delete').and.returnValue(Promise.resolve())
        })
      })
    });
  }

  static getMockStore() {
    const mock = jasmine.createSpyObj('Store', ['dispatch', 'select', 'selectSignal']);
    mock.select.and.returnValue(of([]));
    mock.selectSignal.and.returnValue(() => []);
    return mock;
  }

  static getMockMatDialog() {
    return jasmine.createSpyObj('MatDialog', ['open'], {
      open: jasmine.createSpy('open').and.returnValue({
        afterClosed: () => of(null)
      })
    });
  }

  static getMockRouter() {
    return jasmine.createSpyObj('Router', ['navigate', 'navigateByUrl'], {
      url: '/test',
      navigate: jasmine.createSpy('navigate'),
      navigateByUrl: jasmine.createSpy('navigateByUrl')
    });
  }

  static getMockActivatedRoute() {
    return {
      params: of({}),
      queryParams: of({}),
      snapshot: {
        params: {},
        queryParams: {}
      }
    };
  }

  static getMockBreakpointObserver() {
    const mock = jasmine.createSpyObj('BreakpointObserver', ['observe']);
    mock.observe.and.returnValue(of({ matches: false, breakpoints: {} }));
    return mock;
  }

  static getMockNotificationService() {
    return jasmine.createSpyObj('NotificationService', ['success', 'error', 'warning', 'info']);
  }

  static getMockLoaderService() {
    return jasmine.createSpyObj('LoaderService', ['show', 'hide']);
  }

  static getMockFilterService() {
    return jasmine.createSpyObj('FilterService', [
      'clearAllFilters',
      'hasActiveFilters',
      'getActiveFiltersCount',
      'getCurrentFilterState',
      'filterTransactions',
      'filterCurrentYearTransactions',
      'getSelectedCategory',
      'getSelectedType',
      'getSelectedDate',
      'getSelectedDateRange',
      'getCategoryFilter',
      'getAccountFilter',
      'getAmountRange',
      'getStatusFilter',
      'getTags'
    ], {
      filterState$: of({}),
      hasActiveFilters: false,
      getActiveFiltersCount: 0,
      getCurrentFilterState: {},
      filterTransactions: [],
      filterCurrentYearTransactions: []
    });
  }

  static getMockDateService() {
    return jasmine.createSpyObj('DateService', ['toDate', 'now', 'formatDate'], {
      toDate: new Date(),
      now: { toDate: () => new Date() },
      formatDate: '2024-01-01'
    });
  }

  static getMockBreakpointService() {
    return jasmine.createSpyObj('BreakpointService', ['isMobile', 'isTablet', 'isDesktop'], {
      device: {
        isMobile: false,
        isTablet: false,
        isDesktop: true
      },
      isMobile: false,
      isTablet: false,
      isDesktop: true
    });
  }

  static getMockTransactionsService() {
    return jasmine.createSpyObj('TransactionsService', [
      'getTransactions',
      'addTransaction',
      'updateTransaction',
      'deleteTransaction',
      'bulkUpdateCategory',
      'bulkDeleteTransactions'
    ], {
      getTransactions: of([]),
      addTransaction: Promise.resolve(),
      updateTransaction: Promise.resolve(),
      deleteTransaction: Promise.resolve(),
      bulkUpdateCategory: Promise.resolve(),
      bulkDeleteTransactions: Promise.resolve()
    });
  }

  static getMockAccountsService() {
    return jasmine.createSpyObj('AccountsService', [
      'getAccounts',
      'addAccount',
      'updateAccount',
      'deleteAccount'
    ], {
      getAccounts: of([]),
      addAccount: Promise.resolve(),
      updateAccount: Promise.resolve(),
      deleteAccount: Promise.resolve()
    });
  }

  static getMockCategoryService() {
    return jasmine.createSpyObj('CategoryService', [
      'getCategories',
      'addCategory',
      'updateCategory',
      'deleteCategory'
    ], {
      getCategories: of([]),
      addCategory: Promise.resolve(),
      updateCategory: Promise.resolve(),
      deleteCategory: Promise.resolve()
    });
  }

  static getMockUserService() {
    return jasmine.createSpyObj('UserService', [
      'getCurrentUser',
      'getCurrentUserId',
      'updateProfile',
      'deleteAccount'
    ], {
      getCurrentUser: of({}),
      getCurrentUserId: 'test-user-id',
      updateProfile: Promise.resolve(),
      deleteAccount: Promise.resolve()
    });
  }

  static getMockSubscriptionService() {
    return jasmine.createSpyObj('SubscriptionService', [
      'getSubscription',
      'createSubscription',
      'cancelSubscription'
    ], {
      getSubscription: of({}),
      createSubscription: Promise.resolve(),
      cancelSubscription: Promise.resolve()
    });
  }

  static getMockLanguageService() {
    return jasmine.createSpyObj('LanguageService', ['setLanguage', 'getCurrentLanguage']);
  }

  static getMockSecurityService() {
    return {
      isLocked: signal(false),
      setPinVerified: jasmine.createSpy('setPinVerified')
    };
  }

  static getMockLocalStorageService() {
    return jasmine.createSpyObj('LocalIndexDBStorageService', ['initialize', 'setItem', 'getItem', 'removeItem', 'clear', 'getEntities', 'saveEntity', 'saveEntities'], {
      isReady$: of(true)
    });
  }

  static getMockSwUpdate() {
    return {
      isEnabled: false,
      versionUpdates: of({ type: 'NO_NEW_VERSION_DETECTED' })
    };
  }

  static getMockMobileBackButtonService() {
    return jasmine.createSpyObj('MobileBackButtonService', ['hasOpenModals', 'popModal']);
  }

  static getMockSsrService() {
    return jasmine.createSpyObj('SsrService', ['isClientSide'], {
      isClientSide: () => true
    });
  }

  static getMockPwaNavigationService() {
    return jasmine.createSpyObj('PwaNavigationService', ['ngOnDestroy', 'goBack', 'goForward', 'navigateTo'], {
      navigationState$: of({
        canGoBack: false,
        currentRoute: '',
        previousRoute: '',
        navigationStack: [],
        isStandalone: false,
        isMobile: false
      })
    });
  }

  static getMockThemeSwitchingService() {
    return jasmine.createSpyObj('ThemeSwitchingService', ['initTheme']);
  }

  static getMockFamilyNotificationService() {
    return jasmine.createSpyObj('FamilyNotificationService', ['success', 'error']);
  }

  static getMockTransactionProcessorService() {
    return jasmine.createSpyObj('TransactionProcessorService', ['processTransactions']);
  }

  static getMockCurrencyService() {
    return jasmine.createSpyObj('CurrencyService', [
      'formatAmount',
      'getCurrencySymbol',
      'getCurrencyCode',
      'setCurrency'
    ], {
      currency$: of('INR'),
      formatAmount: (amount: number) => `₹${amount}`,
      getCurrencySymbol: () => '₹',
      getCurrencyCode: () => 'INR'
    });
  }

  static getCommonProviders() {
    return [
      { provide: Auth, useValue: TestSetup.getMockAuth() },
      { provide: Firestore, useValue: TestSetup.getMockFirestore() },
      { provide: Store, useValue: TestSetup.getMockStore() },
      { provide: MatDialog, useValue: TestSetup.getMockMatDialog() },
      { provide: Router, useValue: TestSetup.getMockRouter() },
      { provide: ActivatedRoute, useValue: TestSetup.getMockActivatedRoute() },
      { provide: BreakpointObserver, useValue: TestSetup.getMockBreakpointObserver() },
      { provide: NotificationService, useValue: TestSetup.getMockNotificationService() },
      { provide: LoaderService, useValue: TestSetup.getMockLoaderService() },
      { provide: FilterService, useValue: TestSetup.getMockFilterService() },
      { provide: DateService, useValue: TestSetup.getMockDateService() },
      { provide: BreakpointService, useValue: TestSetup.getMockBreakpointService() },
      { provide: TransactionsService, useValue: TestSetup.getMockTransactionsService() },
      { provide: AccountsService, useValue: TestSetup.getMockAccountsService() },
      { provide: CategoryService, useValue: TestSetup.getMockCategoryService() },
      { provide: UserService, useValue: TestSetup.getMockUserService() },
      { provide: SubscriptionService, useValue: TestSetup.getMockSubscriptionService() },
      { provide: CurrencyService, useValue: TestSetup.getMockCurrencyService() },
      { provide: LanguageService, useValue: TestSetup.getMockLanguageService() },
      { provide: SecurityService, useValue: TestSetup.getMockSecurityService() },
      { provide: LocalIndexDBStorageService, useValue: TestSetup.getMockLocalStorageService() },
      { provide: SwUpdate, useValue: TestSetup.getMockSwUpdate() },
      { provide: MobileBackButtonService, useValue: TestSetup.getMockMobileBackButtonService() },
      { provide: SsrService, useValue: TestSetup.getMockSsrService() },
      { provide: PwaNavigationService, useValue: TestSetup.getMockPwaNavigationService() },
      { provide: ThemeSwitchingService, useValue: TestSetup.getMockThemeSwitchingService() },
      { provide: FamilyNotificationService, useValue: TestSetup.getMockFamilyNotificationService() },
      { provide: TransactionProcessorService, useValue: TestSetup.getMockTransactionProcessorService() },
      { provide: MatBottomSheet, useValue: {} },
      { provide: OverlayContainer, useValue: { getContainerElement: () => document.createElement('div') } }
    ];
  }

  static getFirebaseProviders() {
    return [];
    /*
    return [
      provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
      provideAuth(() => getAuth()),
      provideFirestore(() => getFirestore())
    ];
    */
  }

  static configureTestingModule(declarations: any[] = [], imports: any[] = [], providers: any[] = [], useActualFirebase: boolean = false) {
    const isStandalone = (d: any) => {
      if (!d) return false;
      // Robust check for standalone flag in various Angular internal properties
      const standalone = d.ɵcmp?.standalone || d.ɵdir?.standalone || d.ɵpipe?.standalone || d.standalone === true;
      return !!standalone;
    };

    const standaloneComponents = declarations.filter(isStandalone);
    const regularDeclarations = declarations.filter(d => d && !isStandalone(d));

    const commonProviders = TestSetup.getCommonProviders();
    // Filter out undefined imports to prevent "Unexpected value 'undefined' imported by the module 'DynamicTestModule'"
    const allImports = [...imports, ...standaloneComponents].filter(i => !!i);

    if (useActualFirebase) {
      const filteredProviders = commonProviders.filter(p => p.provide !== Auth && p.provide !== Firestore);
      return TestBed.configureTestingModule({
        declarations: regularDeclarations,
        imports: allImports,
        providers: [
          ...filteredProviders, 
          ...providers,
          ...TestSetup.getFirebaseProviders()
        ]
      });
    }

    return TestBed.configureTestingModule({
      declarations: regularDeclarations,
      imports: allImports,
      providers: [...commonProviders, ...providers]
    });
  }
}