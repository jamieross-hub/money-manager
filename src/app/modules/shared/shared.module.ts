import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

// Angular Material Modules
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatInputModule } from '@angular/material/input';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSliderModule } from '@angular/material/slider';
import { MatStepperModule } from '@angular/material/stepper';
import { MatBottomSheetModule } from '@angular/material/bottom-sheet';

// Utility Components
import { ConfirmDialogComponent } from '../../util/components/confirm-dialog/confirm-dialog.component';
import { RecurringTransactionConfirmationDialogComponent } from '../../util/components/recurring-transaction-confirmation-dialog/recurring-transaction-confirmation-dialog.component';
import { CommonHeaderComponent } from '../../util/components/dialog/common-header/common-header.component';
import { CommonBodyContentComponent } from 'src/app/util/components/dialog/common-body-content/common-body-content.component';
import { CategorySplitDialogComponent } from '../../util/components/category-split-dialog/category-split-dialog.component';
import { BudgetCardComponent } from '../../util/components/cards/budget-card/budget-card.component';
import { AccountSummaryCardComponent } from '../../util/components/cards/account-summary-card/account-summary-card.component';
import { KeyMetricsSummaryCardComponent } from '../../util/components/cards/key-metrics-summary-card/key-metrics-summary-card.component';
import { AnalyticsSummaryCardComponent } from '../../util/components/cards/analytics-summary-card/analytics-summary-card.component';
import { CurrencyPipe } from 'src/app/util/pipes';
import { SafeHtmlPipe } from 'src/app/util/pipes/safe-html.pipe';
// import { TranslatePipe } from 'src/app/util/pipes/translate.pipe';
import { FinancialMetricsCardComponent } from 'src/app/util/components/cards/financial-metrics-card/financial-metrics-card.component';
import { LoanSummaryCardComponent } from '../../util/components/cards/loan-summary-card/loan-summary-card.component';
import { HeaderComponent } from '../../component/dashboard/header/header.component';
import { SideBarComponent } from '../../component/dashboard/side-bar/side-bar.component';
import { UserComponent } from '../../component/dashboard/header/user/user.component';
import { FooterComponent } from '../../component/dashboard/footer/footer.component';
import { LanguageSwitcherComponent } from '../../util/components/language-switcher/language-switcher.component';
import { ThemeToggleComponent } from '../../util/components/theme-toggle/theme-toggle.component';
import { PreLoginHeaderComponent } from '../../component/landing/pre-login-header/pre-login-header.component';
import { PreFooterComponent } from '../../component/landing/pre-footer/pre-footer.component';

// Standalone Cards
import { MonthlyExpenditureCardComponent } from '../../util/components/cards/monthly-expenditure-card/monthly-expenditure-card.component';
import { RecentActivityCardComponent } from '../../util/components/cards/recent-activity-card/recent-activity-card.component';
import { MonthlyTrendsCardComponent } from '../../util/components/cards/monthly-trends-card/monthly-trends-card.component';
import { TopCategoriesCardComponent } from '../../util/components/cards/top-categories-card/top-categories-card.component';
import { CategoryBreakdownCardComponent } from '../../util/components/cards/category-breakdown-card/category-breakdown-card.component';
import { UpcomingTransactionsCardComponent } from '../../util/components/cards/upcoming-transactions-card/upcoming-transactions-card.component';
import { QuickActionsFabComponent } from '../../util/components/floating-action-buttons/quick-actions-fab/quick-actions-fab.component';
import { TotalBalanceComponent } from '../../util/components/cards/total-balance/total-balance.component';

@NgModule({
  declarations: [
    ConfirmDialogComponent,
    RecurringTransactionConfirmationDialogComponent,
    CommonHeaderComponent,
    CommonBodyContentComponent,
    CategorySplitDialogComponent,
    BudgetCardComponent,
    AccountSummaryCardComponent,
    HeaderComponent,
    SideBarComponent,
    UserComponent,
    FooterComponent,
    LanguageSwitcherComponent,
    ThemeToggleComponent,
    PreLoginHeaderComponent,
    PreFooterComponent,
    TotalBalanceComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    KeyMetricsSummaryCardComponent,
    AnalyticsSummaryCardComponent,
    FinancialMetricsCardComponent,
    LoanSummaryCardComponent,
    CurrencyPipe,
    SafeHtmlPipe,
    TranslateModule,
    // TranslatePipe,

    // Material Modules
    MatCardModule,
    MatListModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSidenavModule,
    MatFormFieldModule,
    MatSelectModule,
    MatMenuModule,
    MatToolbarModule,
    MatButtonToggleModule,
    MatInputModule,
    MatDialogModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatTabsModule,
    MatCheckboxModule,
    MatTooltipModule,
    MatSlideToggleModule,
    MatAutocompleteModule,
    MatExpansionModule,
    MatDividerModule,
    MatChipsModule,
    MatSnackBarModule,
    MatSliderModule,
    MatStepperModule,
    MatBottomSheetModule,

    // Standalone Components
    MonthlyExpenditureCardComponent,
    RecentActivityCardComponent,
    MonthlyTrendsCardComponent,
    TopCategoriesCardComponent,
    CategoryBreakdownCardComponent,
    UpcomingTransactionsCardComponent,
    QuickActionsFabComponent,
    RouterModule
  ],
  exports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,

    // Material Modules
    MatCardModule,
    MatListModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSidenavModule,
    MatFormFieldModule,
    MatSelectModule,
    MatMenuModule,
    MatToolbarModule,
    MatButtonToggleModule,
    MatInputModule,
    MatDialogModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatTabsModule,
    MatCheckboxModule,
    MatTooltipModule,
    MatSlideToggleModule,
    MatAutocompleteModule,
    MatExpansionModule,
    MatDividerModule,
    MatChipsModule,
    MatSnackBarModule,
    MatSliderModule,
    MatStepperModule,
    MatBottomSheetModule,

    // Components
    ConfirmDialogComponent,
    RecurringTransactionConfirmationDialogComponent,
    CommonHeaderComponent,
    CommonBodyContentComponent,
    CategorySplitDialogComponent,
    BudgetCardComponent,
    AccountSummaryCardComponent,
    KeyMetricsSummaryCardComponent,
    AnalyticsSummaryCardComponent,
    FinancialMetricsCardComponent,
    LoanSummaryCardComponent,
    MonthlyExpenditureCardComponent,
    RecentActivityCardComponent,
    MonthlyTrendsCardComponent,
    TopCategoriesCardComponent,
    CategoryBreakdownCardComponent,
    UpcomingTransactionsCardComponent,
    QuickActionsFabComponent,
    HeaderComponent,
    SideBarComponent,
    UserComponent,
    FooterComponent,
    LanguageSwitcherComponent,
    ThemeToggleComponent,
    PreLoginHeaderComponent,
    PreFooterComponent,
    TotalBalanceComponent,

    // Pipes
    CurrencyPipe,
    SafeHtmlPipe,
    TranslateModule
    // TranslatePipe
  ]
})
export class SharedModule { } 