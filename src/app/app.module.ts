import { NgModule, isDevMode, APP_INITIALIZER } from '@angular/core';
import { BrowserModule, provideClientHydration } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

// Function for ngx-translate loader
// Function for ngx-translate loader
export function HttpLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

// LocalStorageService Factory
export function initializeLocalStorage(localStorageService: LocalStorageService) {
  return () => localStorageService.initialize();
}

// ngx-papaparse
import { Papa } from 'ngx-papaparse';

// ngx-echarts
import { NgxEchartsModule } from 'ngx-echarts';

// Firebase Imports
import { environment } from '@env/environment';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth, indexedDBLocalPersistence } from '@angular/fire/auth';
import { provideFirestore, getFirestore, enableIndexedDbPersistence } from '@angular/fire/firestore';
import { provideMessaging, getMessaging } from '@angular/fire/messaging';

// Service Worker
import { ServiceWorkerModule } from '@angular/service-worker';

// Utility Modules
import { IconModule } from './util/icon.module';

// Directives
import { ClickOutsideDirective } from './util/directives/click-outside.directive';

// Components
import { TotalBalanceComponent } from './util/components/cards/total-balance/total-balance.component';
import { CalendarViewComponent } from './component/dashboard/calendar-view/calendar-view.component';
import { TransactionListComponent } from './component/dashboard/transaction-list/transaction-list.component';
import { HeaderComponent } from './component/dashboard/header/header.component';
import { SideBarComponent } from './component/dashboard/side-bar/side-bar.component';
import { MobileAddTransactionComponent } from './component/dashboard/transaction-list/add-transaction/mobile-add-transaction/mobile-add-transaction.component';
import { MobileCategoryAddEditPopupComponent } from './component/dashboard/category/mobile-category-add-edit-popup/mobile-category-add-edit-popup.component';
import { IconSelectorDialogComponent } from './component/dashboard/category/icon-selector-dialog/icon-selector-dialog.component';
import { ColorSelectorDialogComponent } from './component/dashboard/category/color-selector-dialog/color-selector-dialog.component';
import { CategoryBudgetDialogComponent } from './component/dashboard/category/category-budget-dialog/category-budget-dialog.component';
import { SignInComponent } from './component/auth/sign-in/sign-in.component';
import { DashboardComponent } from './component/dashboard/dashboard.component';
import { UserComponent } from './component/dashboard/header/user/user.component';
import { AccountsComponent } from './component/dashboard/accounts/accounts.component';
import { BudgetsComponent } from './component/dashboard/budgets/budgets.component';
import { GoalsComponent } from './component/dashboard/goals/goals.component';
import { SubscriptionComponent } from './component/dashboard/subscription/subscription.component';
import { CategoryComponent } from './component/dashboard/category/category.component';
import { CategoryCardComponent } from './component/dashboard/category/category-card/category-card.component';
import { LoaderComponent } from './util/components/loader/loader.component';
import { HomeComponent } from './component/dashboard/home/home.component';
import { ImportTransactionsComponent } from './component/dashboard/transaction-list/add-transaction/import-transactions.component';
import { ReportsComponent } from './component/dashboard/reports/reports.component';
import { TaxComponent } from './component/dashboard/tax/tax.component';
import { NotesComponent } from './component/dashboard/notes/notes.component';
import { LanguageSwitcherComponent } from './util/components/language-switcher/language-switcher.component';
import { ThemeToggleComponent } from './util/components/theme-toggle/theme-toggle.component';
import { MobileTransactionListComponent } from './component/dashboard/transaction-list/mobile-transaction-list/mobile-transaction-list.component';
import { SearchFilterComponent } from './component/dashboard/transaction-list/search-filter/search-filter.component';
import { TransactionTableComponent } from './component/dashboard/transaction-list/transaction-table/transaction-table.component';
import { RegistrationComponent } from './component/auth/registration/registration.component';
import { OfflineIndicatorComponent } from './util/components/offline-indicator/offline-indicator.component';
import { OfflinePageComponent } from './util/components/offline-page/offline-page.component';
import { FooterComponent } from './component/dashboard/footer/footer.component';
import { TermsConditionsComponent } from './component/terms-conditions/terms-conditions.component';
import { AddAccountDialogComponent } from './component/dashboard/accounts/add-account-dialog/add-account-dialog.component';
import { AccountStatementDialogComponent } from './component/dashboard/accounts/account-statement-dialog/account-statement-dialog.component';
import { MobileAccountsListComponent } from './component/dashboard/accounts/mobile-accounts-list/mobile-accounts-list.component';
import { LandingComponent } from './component/landing/landing.component';
import { PreLoginHeaderComponent } from './component/landing/pre-login-header/pre-login-header.component';
import { PreFooterComponent } from './component/landing/pre-footer/pre-footer.component';
import { CustomDateRangeDialogComponent } from './util/components/custom-date-range-dialog';
import { ProfileComponent } from './component/dashboard/profile/profile.component';
import { FeedbackComponent } from './component/feedback/feedback.component';
import { PrivacyPolicyComponent } from './component/privacy-policy/privacy-policy.component';
import { GoogleSheetsComponent } from './component/dashboard/google-sheets/google-sheets.component';
import { OpenaiInteractionComponent } from './component/dashboard/openai-interaction/openai-interaction.component';
import { ChatCategoryDropdownComponent } from './util/components/chat-category-dropdown/chat-category-dropdown.component';
import { ContactFormComponent } from './component/landing/contact-form/contact-form.component';
import { ChatComponent } from './component/dashboard/chat/chat.component';
import { DataDeletionComponent } from './component/data-deletion/data-deletion.component';
import { SyncToCloudComponent } from './component/sync-to-cloud/sync-to-cloud.component';
import { CategorySelectionSheetComponent } from './component/dashboard/transaction-list/add-transaction/mobile-add-transaction/category-selection-sheet/category-selection-sheet.component';

// Card Components
import { TopCategoriesCardComponent } from './util/components/cards/top-categories-card/top-categories-card.component';
import { KeyMetricsSummaryCardComponent } from './util/components/cards/key-metrics-summary-card/key-metrics-summary-card.component';
import { AnalyticsSummaryCardComponent } from './util/components/cards/analytics-summary-card/analytics-summary-card.component';
import { RecentActivityCardComponent } from './util/components/cards/recent-activity-card/recent-activity-card.component';
import { MonthlyTrendsCardComponent } from './util/components/cards/monthly-trends-card/monthly-trends-card.component';
import { CategoryBreakdownCardComponent } from './util/components/cards/category-breakdown-card/category-breakdown-card.component';
import { MonthlyExpenditureCardComponent } from './util/components/cards/monthly-expenditure-card/monthly-expenditure-card.component';
import { QuickActionsFabComponent } from './util/components/floating-action-buttons/quick-actions-fab/quick-actions-fab.component';

// Notification Components
import { NotificationSettingsComponent } from './util/components/notification-settings/notification-settings.component';

// Splitwise Module
import { SplitwiseModule } from './modules/splitwise/splitwise.module';

// PWA Components
import { PwaBackButtonComponent } from './util/components/pwa-back-button/pwa-back-button.component';
import { PwaNavigationBarComponent } from './util/components/pwa-navigation-bar/pwa-navigation-bar.component';
import { PwaInstallPromptComponent } from './util/components/pwa-install-prompt/pwa-install-prompt.component';

// Common Sync Service (replaces BackgroundSyncService)
import { CommonSyncService } from './util/service/common-sync.service';
import { LocalStorageService } from './util/service/local-storage.service';


// NgRx Store
import { AppStoreModule } from './store';

// Security
import { securityInterceptor } from './util/interceptors/security.interceptor';
import { RouterModule } from '@angular/router';
import { SharedModule } from './modules/shared/shared.module';
import { ParentCategorySelectorDialogComponent } from './component/dashboard/category/parent-category-selector-dialog/parent-category-selector-dialog.component';
import { CategoryDetailsDialogComponent } from './component/dashboard/category/category-details-dialog/category-details-dialog.component';
import { NgxMatSelectSearchModule } from 'ngx-mat-select-search';
import { UpcomingTransactionsCardComponent } from './util/components/cards/upcoming-transactions-card/upcoming-transactions-card.component';
import { CurrencyPipe } from './util/pipes';


@NgModule({
  declarations: [
    AppComponent,
    TotalBalanceComponent,
    CalendarViewComponent,
    TransactionListComponent,
    HeaderComponent,
    SideBarComponent,
    MobileAddTransactionComponent,
    MobileCategoryAddEditPopupComponent,
    ParentCategorySelectorDialogComponent,
    CategoryDetailsDialogComponent,
    IconSelectorDialogComponent,
    ColorSelectorDialogComponent,
    CategoryBudgetDialogComponent,
    SignInComponent,
    RegistrationComponent,
    DashboardComponent,
    UserComponent,
    AccountsComponent,
    BudgetsComponent,
    GoalsComponent,
    SubscriptionComponent,
    CategoryComponent,
    CategoryCardComponent,
    HomeComponent,
    ImportTransactionsComponent,
    ReportsComponent,
    TaxComponent,
    NotesComponent,
    LanguageSwitcherComponent,
    ThemeToggleComponent,
    MobileTransactionListComponent,
    TransactionTableComponent,
    SearchFilterComponent,
    OfflineIndicatorComponent,
    OfflinePageComponent,
    FooterComponent,
    ClickOutsideDirective,
    PwaBackButtonComponent,
    PwaNavigationBarComponent,
    PwaInstallPromptComponent,
    AddAccountDialogComponent,
    AccountStatementDialogComponent,
    MobileAccountsListComponent,
    LandingComponent,
    PreLoginHeaderComponent,
    PreFooterComponent,
    CustomDateRangeDialogComponent,
    ProfileComponent,
    NotificationSettingsComponent,
    FeedbackComponent,
    PrivacyPolicyComponent,
    TermsConditionsComponent,
    GoogleSheetsComponent,
    OpenaiInteractionComponent,
    ChatCategoryDropdownComponent,
    ChatComponent,
    ContactFormComponent,
    ContactFormComponent,
    DataDeletionComponent,
    SyncToCloudComponent,
    CategorySelectionSheetComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    LoaderComponent,
    SharedModule,

    // Utility
    IconModule,
    // TranslatePipe,
    CurrencyPipe,

    // Charts
    NgxEchartsModule.forRoot({
      echarts: () => import('echarts')
    }),

    // NgRx Store
    AppStoreModule,

    // Splitwise Module
    SplitwiseModule,

    // Card Components
    TopCategoriesCardComponent,
    KeyMetricsSummaryCardComponent,
    AnalyticsSummaryCardComponent,
    RecentActivityCardComponent,
    MonthlyTrendsCardComponent,
    CategoryBreakdownCardComponent,
    UpcomingTransactionsCardComponent,
    MonthlyExpenditureCardComponent,

    // Floating Action Button Components
    QuickActionsFabComponent,

    // ngx-mat-select-search
    NgxMatSelectSearchModule,

    // Enhanced Service Worker with offline support
    ServiceWorkerModule.register('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerImmediately',
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
    Papa,
    provideClientHydration(),
    provideClientHydration(),
    CommonSyncService,
    LocalStorageService,
    {
      provide: APP_INITIALIZER,
      useFactory: initializeLocalStorage,
      deps: [LocalStorageService],
      multi: true
    },

    // Firebase Initialization
    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),

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

    // Firebase Cloud Messaging
    provideMessaging(() => {
      const messaging = getMessaging();
      console.log("✅ Firebase Cloud Messaging initialized");
      return messaging;
    }),
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
