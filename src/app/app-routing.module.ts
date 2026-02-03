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

export const routes: Routes = [
  { path: 'shell', component: AppShellComponent },
  { path: 'feedback', component: ContactFormComponent },
  { path: 'landing', component: LandingComponent },
  { path: 'privacy-policy', component: PrivacyPolicyComponent },
  { path: 'terms-conditions', component: TermsConditionsComponent },
  { path: 'offline', component: OfflinePageComponent },
  { path: 'data-deletion', component: DataDeletionComponent },
  { path: 'sign-in', component: SignInComponent },
  { path: 'sign-up', component: SignInComponent },
  { path: 'register', component: RegistrationComponent },

  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [AuthGuard],
    data: {
      requireEmailVerification: true,
      requireActiveSession: true
    },

    children: [
      { path: '', component: HomeComponent },
      { path: 'sync-to-cloud', component: SyncToCloudComponent },
      { path: 'home', component: HomeComponent },
      {
        path: 'accounts',
        component: AccountsComponent,
        data: {
          roles: ['free', 'premium', 'admin'],
          requireEmailVerification: true
        }
      },
      {
        path: 'category',
        component: CategoryComponent,
        data: {
          roles: ['free', 'premium', 'admin'],
          requireEmailVerification: true
        }
      },
      {
        path: 'reports',
        component: ReportsComponent,
        data: {
          roles: ['premium', 'admin'],
          requireEmailVerification: true
        }
      },
      {
        path: 'transactions',
        component: TransactionListComponent,
        data: {
          roles: ['free', 'premium', 'admin'],
          requireEmailVerification: true
        }
      },
      {
        path: 'tax',
        component: TaxComponent,
        data: {
          roles: ['premium', 'admin'],
          requireEmailVerification: true
        }
      },
      {
        path: 'subscription',
        component: SubscriptionComponent,
        data: {
          roles: ['free', 'premium', 'admin'],
          requireEmailVerification: true
        }
      },
      {
        path: 'goals',
        component: GoalsComponent,
        data: {
          roles: ['premium', 'admin'],
          requireEmailVerification: true
        }
      },
      {
        path: 'splitwise',
        loadChildren: () => import('./modules/splitwise/splitwise.module').then(m => m.SplitwiseModule),
        data: {
          roles: ['free', 'premium', 'admin'],
          requireEmailVerification: true
        }
      },
      {
        path: 'google-sheets',
        component: GoogleSheetsComponent,
        data: {
          roles: ['free', 'premium', 'admin'],
          requireEmailVerification: true
        }
      },
      {
        path: 'openai-interaction',
        component: OpenaiInteractionComponent,
        data: {
          roles: ['premium', 'admin'],
          requireEmailVerification: true
        }
      },
      {
        path: 'budgets',
        component: BudgetsComponent,
        data: {
          roles: ['free', 'premium', 'admin'],
          requireEmailVerification: true
        }
      },
      {
        path: 'notes',
        component: NotesComponent,
        data: {
          roles: ['free', 'premium', 'admin'],
          requireEmailVerification: true
        }
      },
      {
        path: 'import',
        component: ImportTransactionsComponent,
        data: {
          roles: ['premium', 'admin'],
          requireEmailVerification: true
        }
      },
      {
        path: 'profile',
        component: ProfileComponent,
        data: {
          roles: ['free', 'premium', 'admin'],
          requireEmailVerification: true
        }
      },
      {
        path: 'notifications',
        component: NotificationSettingsComponent,
        data: {
          roles: ['free', 'premium', 'admin'],
          requireEmailVerification: true
        }
      },
      {
        path: 'feedback',
        component: FeedbackComponent,
        data: {
          roles: ['free', 'premium', 'admin'],
          requireEmailVerification: true
        }
      }
    ]
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
