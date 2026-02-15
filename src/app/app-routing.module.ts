import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { SignInComponent } from './component/auth/sign-in/sign-in.component';
import { RegistrationComponent } from './component/auth/registration/registration.component';
import { DashboardComponent } from './component/dashboard/dashboard.component';
import { AuthGuard } from './util/guard/auth.guard';
import { AdminGuard } from './util/guard/admin.guard';
import { HomeComponent } from './component/dashboard/home/home.component';
import { LandingComponent } from './component/landing/landing.component';
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
        loadComponent: () => import('./component/dashboard/accounts/accounts.component').then(m => m.AccountsComponent),
        data: {
          roles: ['free', 'premium', 'admin'],
          requireEmailVerification: true
        }
      },
      {
        path: 'summary',
        loadComponent: () => import('./component/dashboard/summary/summary.component').then(m => m.SummaryComponent),
        data: {
          roles: ['free', 'premium', 'admin'],
          requireEmailVerification: true
        }
      },
      {
        path: 'category',
        loadComponent: () => import('./component/dashboard/category/category.component').then(m => m.CategoryComponent),
        data: {
          roles: ['free', 'premium', 'admin'],
          requireEmailVerification: true
        }
      },
      {
        path: 'transactions',
        loadComponent: () => import('./component/dashboard/transaction-list/transaction-list.component').then(m => m.TransactionListComponent),
        data: {
          roles: ['free', 'premium', 'admin'],
          requireEmailVerification: true
        }
      },
      {
        path: 'subscription',
        loadComponent: () => import('./component/dashboard/subscription/subscription.component').then(m => m.SubscriptionComponent),
        data: {
          roles: ['free', 'premium', 'admin'],
          requireEmailVerification: true
        }
      },
      {
        path: 'goals',
        loadComponent: () => import('./component/dashboard/goals/goals.component').then(m => m.GoalsComponent),
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
        path: 'notes',
        loadComponent: () => import('./component/dashboard/notes/notes.component').then(m => m.NotesComponent),
        data: {
          roles: ['free', 'premium', 'admin'],
          requireEmailVerification: true
        }
      },
      {
        path: 'import',
        loadComponent: () => import('./component/dashboard/transaction-list/add-transaction/import-transactions.component')
          .then(m => m.ImportTransactionsComponent),
        data: {
          roles: ['premium', 'admin'],
          requireEmailVerification: true
        }
      },
      {
        path: 'profile',
        loadComponent: () => import('./component/dashboard/profile/profile.component').then(m => m.ProfileComponent),
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
      },
      {
        path: '',
        loadChildren: () => import('./modules/features/features.module').then(m => m.FeaturesModule)
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
  imports: [RouterModule.forRoot(routes, { useHash: true, preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
