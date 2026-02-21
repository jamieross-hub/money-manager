import { NgModule, isDevMode, APP_INITIALIZER } from '@angular/core';
import { BrowserModule, provideClientHydration } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
export function HttpLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

// LocalStorageService Factory
export function initializeLocalStorage(localStorageService: LocalIndexDBStorageService) {
  return () => localStorageService.initialize();
}


// Firebase Imports
import { environment } from '@env/environment';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth, indexedDBLocalPersistence } from '@angular/fire/auth';
import { provideFirestore, getFirestore, enableIndexedDbPersistence } from '@angular/fire/firestore';
import { provideMessaging, getMessaging } from '@angular/fire/messaging';
import { provideAnalytics, getAnalytics, UserTrackingService, ScreenTrackingService } from '@angular/fire/analytics';


// Service Worker
import { ServiceWorkerModule } from '@angular/service-worker';

// Utility Modules
import { IconModule } from './util/icon.module';

// Directives
// Directives

// Components


// Card Components

// Common Sync Service (replaces BackgroundSyncService)
import { CommonSyncService } from './util/service/common-sync.service';
import { LocalIndexDBStorageService } from './util/service/indexdb-storage.service';


// NgRx Store
import { AppStoreModule } from './store';

// Security
import { securityInterceptor } from './util/interceptors/security.interceptor';
import { RouterModule } from '@angular/router';
import { CurrencyPipe } from './util/pipes';
import { OfflineIndicatorComponent } from './util/components/offline-indicator/offline-indicator.component';
import { PwaInstallPromptComponent } from './util/components/pwa-install-prompt/pwa-install-prompt.component';
import { LoaderComponent } from './util/components/loader/loader.component';


@NgModule({
  declarations: [
    AppComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,

    // Utility
    IconModule,
    MatIconModule,
    MatButtonModule,
    CommonModule,
    // TranslatePipe,
    CurrencyPipe,



    // NgRx Store
    AppStoreModule,
    OfflineIndicatorComponent,
    PwaInstallPromptComponent,
    LoaderComponent,


    // Enhanced Service Worker with offline support
    ServiceWorkerModule.register('custom-sw.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:3000',
      scope: './'
    }),
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: HttpLoaderFactory,
        deps: [HttpClient]
      }
    }),
    RouterModule,
  ],
  providers: [
    provideAnimationsAsync(),
    provideHttpClient(withInterceptors([securityInterceptor])),
    provideClientHydration(),
    CommonSyncService,
    LocalIndexDBStorageService,
    {
      provide: APP_INITIALIZER,
      useFactory: initializeLocalStorage,
      deps: [LocalIndexDBStorageService],
      multi: true
    },

    // Firebase Initialization
    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
    provideAnalytics(() => getAnalytics()),
    UserTrackingService,
    ScreenTrackingService,

    // Auth with IndexedDB Persistence
    provideAuth(() => {
      const auth = getAuth();
      auth.setPersistence(indexedDBLocalPersistence)
        .then(() => console.log("✅ Auth persistence enabled"))
        .catch((error) => console.warn("⚠️ Auth persistence error:", error.message));
      return auth;
    }),

    // Firestore with IndexedDB Persistence (Improved)
    provideFirestore(() => {
      const firestore = getFirestore();

      enableIndexedDbPersistence(firestore).then(() => {
        console.log("✅ Firestore offline persistence enabled");
      }).catch((err) => {
        if (err.code === 'failed-precondition') {
          console.warn("⚠️ Multiple tabs detected. Persistence disabled to avoid conflicts.");
        } else if (err.code === 'unimplemented') {
          console.warn("⚠️ IndexedDB persistence not supported. Falling back to cache.");
        }
      });

      return firestore;
    }),

    // Firebase Cloud Messaging (Browser-only)
    provideMessaging(() => {
      // Only initialize messaging in browser context
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
      return null as any; // Return null on server
    }),
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
