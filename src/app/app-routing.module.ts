import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SignInComponent } from './component/auth/sign-in/sign-in.component';
import { RegistrationComponent } from './component/auth/registration/registration.component';
import { DashboardComponent } from './component/dashboard/dashboard.component';
import { AuthGuard } from './util/guard/auth.guard';
import { AdminGuard } from './util/guard/admin.guard';
import { AccountsComponent } from './component/dashboard/accounts/accounts.component';
import { CategoryComponent } from './component/dashboard/category/category.component';
import { HomeComponent } from './component/dashboard/home/home.component';
import { ReportsComponent } from './component/dashboard/reports/reports.component';
import { TransactionListComponent } from './component/dashboard/transaction-list/transaction-list.component';
import { LandingComponent } from './component/landing/landing.component';
import { TaxComponent } from './component/dashboard/tax/tax.component';
import { SubscriptionComponent } from './component/dashboard/subscription/subscription.component';
import { GoalsComponent } from './component/dashboard/goals/goals.component';
import { GoogleSheetsComponent } from './component/dashboard/google-sheets/google-sheets.component';
import { OpenaiInteractionComponent } from './component/dashboard/openai-interaction/openai-interaction.component';

import { BudgetsComponent } from './component/dashboard/budgets/budgets.component';
import { NotesComponent } from './component/dashboard/notes/notes.component';
import { ImportTransactionsComponent } from './component/dashboard/transaction-list/add-transaction';
import { ProfileComponent } from './component/dashboard/profile/profile.component';
import { NotificationSettingsComponent } from './util/components/notification-settings/notification-settings.component';
import { FeedbackComponent } from './component/feedback/feedback.component';
import { AppShellComponent } from './app-shell/app-shell.component';
import { PrivacyPolicyComponent } from './component/privacy-policy/privacy-policy.component';
import { TermsConditionsComponent } from './component/terms-conditions/terms-conditions.component';
import { OfflinePageComponent } from './util/components/offline-page/offline-page.component';
import { DataDeletionComponent } from './component/data-deletion/data-deletion.component';
import { ContactFormComponent } from './component/landing/contact-form/contact-form.component';
import { SyncToCloudComponent } from './component/sync-to-cloud/sync-to-cloud.component';
import { LoanCalculatorComponent } from './component/dashboard/tools/loan-calculator/loan-calculator.component';
import { BackupRestoreComponent } from './component/dashboard/settings/backup-restore/backup-restore.component';

export const routes: Routes = [
  { path: 'shell', component: AppShellComponent },

  {
    path: '',
    loadChildren: () => import('./modules/landing/landing.module').then(m => m.LandingModule)
  },
  {
    path: '',
    loadChildren: () => import('./modules/auth/auth.module').then(m => m.AuthModule)
  },
  {
    path: 'dashboard',
    canActivate: [AuthGuard],
    loadChildren: () => import('./modules/dashboard/dashboard.module').then(m => m.DashboardModule),
    data: {
      requireEmailVerification: true,
      requireActiveSession: true
    }
  },

  // Admin routes - Lazy loaded
  {
    path: 'admin',
    loadChildren: () => import('./modules/admin/admin.module').then(m => m.AdminModule),
    canActivate: [AuthGuard, AdminGuard],
    data: {
      requireEmailVerification: true,
      requireActiveSession: true,
      roles: ['admin']
    }
  },

  { path: '', redirectTo: '/dashboard', pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
