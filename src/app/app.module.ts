import { NgModule, isDevMode, APP_INITIALIZER } from '@angular/core';
import { BrowserModule, provideClientHydration } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ServiceWorkerModule } from '@angular/service-worker';
import { NgxEchartsModule } from 'ngx-echarts';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { environment } from '@env/environment';

// Firebase
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth, indexedDBLocalPersistence } from '@angular/fire/auth';
import { provideFirestore, getFirestore, enableIndexedDbPersistence } from '@angular/fire/firestore';
import { provideMessaging, getMessaging } from '@angular/fire/messaging';

// Modules
import { SharedModule } from './modules/shared/shared.module';
import { AppStoreModule } from './store';
import { IconModule } from './util/icon.module';

// Services
import { LocalIndexDBStorageService } from './util/service/indexdb-storage.service';
import { CommonSyncService } from './util/service/common-sync.service';

// Interceptors
import { securityInterceptor } from './util/interceptors/security.interceptor';

// Components (Global/Essential)
import { LoaderComponent } from './util/components/loader/loader.component';
import { TotalBalanceComponent } from './util/components/cards/total-balance/total-balance.component';
import { AppShellComponent } from './app-shell/app-shell.component';
import { PwaBackButtonComponent } from './util/components/pwa-back-button/pwa-back-button.component';
import { PwaNavigationBarComponent } from './util/components/pwa-navigation-bar/pwa-navigation-bar.component';
import { PwaInstallPromptComponent } from './util/components/pwa-install-prompt/pwa-install-prompt.component';
import { CustomDateRangeDialogComponent } from './util/components/custom-date-range-dialog';
import { OfflineIndicatorComponent } from './util/components/offline-indicator/offline-indicator.component';

// Directives
import { ClickOutsideDirective } from './util/directives/click-outside.directive';

// Other
import { Papa } from 'ngx-papaparse';

export function HttpLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

export function initializeLocalStorage(localStorageService: LocalIndexDBStorageService) {
  return () => localStorageService.initialize();
}

@NgModule({
  declarations: [
    AppComponent,
    ClickOutsideDirective,
    PwaBackButtonComponent,
    PwaNavigationBarComponent,
    PwaInstallPromptComponent,
    CustomDateRangeDialogComponent,
    AppShellComponent,
    OfflineIndicatorComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    LoaderComponent,
    SharedModule,
    IconModule,
    AppStoreModule,
    NgxEchartsModule.forRoot({
      echarts: () => import('echarts')
    }),
    ServiceWorkerModule.register('ngsw-worker.js', {
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
    })
  ],
  providers: [
    provideAnimationsAsync(),
    provideHttpClient(withInterceptors([securityInterceptor])),
    Papa,
    provideClientHydration(),
    CommonSyncService,
    LocalIndexDBStorageService,
    {
      provide: APP_INITIALIZER,
      useFactory: initializeLocalStorage,
      deps: [LocalIndexDBStorageService],
      multi: true
    },
    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
    provideAuth(() => {
      const auth = getAuth();
      auth.setPersistence(indexedDBLocalPersistence)
        .then(() => console.log("✅ Auth persistence enabled"))
        .catch((error) => console.warn("⚠️ Auth persistence error:", error.message));
      return auth;
    }),
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
    provideMessaging(() => {
      const messaging = getMessaging();
      console.log("✅ Firebase Cloud Messaging initialized");
      return messaging;
    })
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
