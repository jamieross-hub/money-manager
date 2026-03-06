import { ApplicationConfig, isDevMode, APP_INITIALIZER, provideZonelessChangeDetection, importProvidersFrom } from '@angular/core';
import { provideRouter, withViewTransitions, withHashLocation, withPreloading, PreloadAllModules } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideClientHydration } from '@angular/platform-browser';
import { provideNativeDateAdapter } from '@angular/material/core';
import { ServiceWorkerModule } from '@angular/service-worker';

import { routes } from './app-routing.module';
import { environment } from '@env/environment';
import { securityInterceptor } from './util/interceptors/security.interceptor';

// Firebase
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth, indexedDBLocalPersistence } from '@angular/fire/auth';
import { provideFirestore, getFirestore, enableMultiTabIndexedDbPersistence } from '@angular/fire/firestore';
import { provideMessaging, getMessaging } from '@angular/fire/messaging';
import { provideAnalytics, getAnalytics, UserTrackingService, ScreenTrackingService, setAnalyticsCollectionEnabled } from '@angular/fire/analytics';

// Services
import { LocalIndexDBStorageService } from './util/service/indexdb-storage.service';
import { CommonSyncService } from './util/service/common-sync.service';
import { FamilyTransactionsService } from './util/service/db/family-transactions.service';
import { TransactionsFacadeService, PERSONAL_TRANSACTIONS_SERVICE } from './util/service/db/transactions-facade.service';
import { TransactionsService } from './util/service/db/transactions.service';
import { FamilyAccountsService } from './util/service/db/family-accounts.service';
import { AccountsFacadeService, PERSONAL_ACCOUNTS_SERVICE } from './util/service/db/accounts-facade.service';
import { AccountsService } from './util/service/db/accounts.service';
import { FamilyCategoryService } from './util/service/db/family-category.service';
import { CategoryFacadeService, PERSONAL_CATEGORY_SERVICE } from './util/service/db/category-facade.service';
import { CategoryService } from './util/service/db/category.service';

import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';

// Store
import { AppStoreModule } from './store';

export function initializeLocalStorage(localStorageService: LocalIndexDBStorageService) {
  return () => localStorageService.initialize();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideAnimationsAsync(),
    provideRouter(routes,
      withViewTransitions({
        skipInitialTransition: true
      }),
      withHashLocation(),
      withPreloading(PreloadAllModules)
    ),
    provideNativeDateAdapter(),
    provideHttpClient(withInterceptors([securityInterceptor])),
    provideClientHydration(),
    importProvidersFrom(ServiceWorkerModule.register('firebase-messaging-sw.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:3000'
    })),
    
    // Store
    importProvidersFrom(AppStoreModule),

    // Translation
    importProvidersFrom(TranslateModule.forRoot()),
    provideTranslateHttpLoader({
      prefix: './assets/i18n/',
      suffix: '.json'
    }),

    // Services
    CommonSyncService,
    LocalIndexDBStorageService,
    {
      provide: APP_INITIALIZER,
      useFactory: initializeLocalStorage,
      deps: [LocalIndexDBStorageService],
      multi: true
    },

    // Firebase
    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
    provideAnalytics(() => {
      const analytics = getAnalytics();
      if (isDevMode()) {
        setAnalyticsCollectionEnabled(analytics, false);
      }
      return analytics;
    }),
    UserTrackingService,
    ScreenTrackingService,

    provideAuth(() => {
      const auth = getAuth();
      auth.setPersistence(indexedDBLocalPersistence)
        .then(() => console.log("✅ Auth persistence enabled"))
        .catch((error) => console.warn("⚠️ Auth persistence error:", error.message));
      return auth;
    }),

    provideFirestore(() => {
      const firestore = getFirestore();
      enableMultiTabIndexedDbPersistence(firestore).then(() => {
        console.log("✅ Firestore multi-tab persistence enabled");
      }).catch((err) => {
        if (err.code === 'failed-precondition') {
          console.warn("⚠️ Multiple tabs detected. Persistence handled by multi-tab mode.");
        } else if (err.code === 'unimplemented') {
          console.warn("⚠️ IndexedDB persistence not supported. Falling back to cache.");
        }
      });
      return firestore;
    }),

    provideMessaging(() => {
      if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
        try {
          const messaging = getMessaging();
          console.log("✅ Firebase Cloud Messaging initialized");
          return messaging;
        } catch (error) {
          console.warn("⚠️ Firebase Messaging not supported:", error);
          return null as any;
        }
      }
      return null as any;
    }),

    // Transaction/Account/Category Services
    FamilyTransactionsService,
    TransactionsFacadeService,
    {
      provide: PERSONAL_TRANSACTIONS_SERVICE,
      useClass: TransactionsService
    },
    {
      provide: TransactionsService,
      useExisting: TransactionsFacadeService
    },

    FamilyAccountsService,
    AccountsFacadeService,
    {
      provide: PERSONAL_ACCOUNTS_SERVICE,
      useClass: AccountsService
    },
    {
      provide: AccountsService,
      useExisting: AccountsFacadeService
    },

    FamilyCategoryService,
    CategoryFacadeService,
    {
      provide: PERSONAL_CATEGORY_SERVICE,
      useClass: CategoryService
    },
    {
      provide: CategoryService,
      useExisting: CategoryFacadeService
    }
  ]
};
