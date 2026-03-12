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
import { provideFirebaseApp, initializeApp, getApp } from '@angular/fire/app';
import { provideAuth, getAuth, indexedDBLocalPersistence } from '@angular/fire/auth';
import { provideFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from '@angular/fire/firestore';
import { provideMessaging, getMessaging } from '@angular/fire/messaging';
import { provideAnalytics, getAnalytics, UserTrackingService, ScreenTrackingService, setAnalyticsCollectionEnabled } from '@angular/fire/analytics';

// Services
import { LocalIndexDBStorageService } from './util/service/indexdb-storage.service';
import { CommonSyncService } from './util/service/common-sync.service';
import { FamilyTransactionsService } from './util/service/db/family-transactions.service';
import { TransactionsFacadeService, PERSONAL_TRANSACTIONS_SERVICE } from './util/service/db/transactions-facade.service';
import { TransactionsService } from './util/service/db/transactions.service';
import { AccountsFacadeService, PERSONAL_ACCOUNTS_SERVICE } from './util/service/db/accounts-facade.service';
import { AccountsService } from './util/service/db/accounts.service';
import { CategoryFacadeService, PERSONAL_CATEGORY_SERVICE } from './util/service/db/category-facade.service';
import { CategoryService } from './util/service/db/category.service';
import { UserService } from './util/service/db/user.service';

import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';

// Store
import { AppStoreModule } from './store';

export function initializeApplicationData(localStorageService: LocalIndexDBStorageService, userService: UserService) {
  return async () => {
    // 1. First initialize the base storage/cache (Async loading from IndexedDB)
    await localStorageService.initialize();
    
    // 2. Once cache is hot, synchronously load the cached user profile into store
    userService.optimisticLoadProfile();
  };
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
      enabled: true,
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
      useFactory: initializeApplicationData,
      deps: [LocalIndexDBStorageService, UserService],
      multi: true
    },

    // Firebase
    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),

    provideAuth(() => {
      const auth = getAuth();
      auth.setPersistence(indexedDBLocalPersistence)
        .then(() => console.log("✅ Auth persistence enabled"))
        .catch((error: any) => console.warn("⚠️ Auth persistence error:", error.message));
      return auth;
    }),

    provideFirestore(() => {
      return initializeFirestore(getApp(), {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
      });
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

    AccountsFacadeService,
    {
      provide: PERSONAL_ACCOUNTS_SERVICE,
      useClass: AccountsService
    },
    {
      provide: AccountsService,
      useExisting: AccountsFacadeService
    },

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
