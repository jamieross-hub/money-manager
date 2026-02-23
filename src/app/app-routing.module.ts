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
  { path: 'shell', component: AppShellComponent, title: 'App Shell' },
  { path: 'feedback', component: ContactFormComponent, title: 'Feedback' },
  { path: 'landing', component: LandingComponent, title: 'Welcome' },
  { path: 'privacy-policy', component: PrivacyPolicyComponent, title: 'Privacy Policy' },
  { path: 'terms-conditions', component: TermsConditionsComponent, title: 'Terms & Conditions' },
  { path: 'offline', component: OfflinePageComponent, title: 'Offline' },
  { path: 'data-deletion', component: DataDeletionComponent, title: 'Data Deletion' },
  { path: 'sign-in', component: SignInComponent, title: 'Sign In' },
  { path: 'sign-up', component: SignInComponent, title: 'Sign Up' },
  { path: 'register', component: RegistrationComponent, title: 'Register' },

  {
    path: 'dashboard',
    component: DashboardComponent,
    title: 'Dashboard',
    canActivate: [AuthGuard],
    data: {
      requireEmailVerification: true,
      requireActiveSession: true,
      title: 'Dashboard'
    },

    children: [
      { path: '', component: HomeComponent, title: 'Home' },
      { path: 'sync-to-cloud', component: SyncToCloudComponent, title: 'Sync to Cloud' },
      { path: 'home', component: HomeComponent, title: 'Home' },
      {
        path: 'accounts',
        loadComponent: () => import('./component/dashboard/accounts/accounts.component').then(m => m.AccountsComponent),
        title: 'Accounts',
        data: {
          roles: ['free', 'premium', 'admin'],
          requireEmailVerification: true,
          title: 'Accounts'
        }
      },
      {
        path: 'summary',
        loadComponent: () => import('./component/dashboard/summary/summary.component').then(m => m.SummaryComponent),
        title: 'Summary',
        data: {
          roles: ['free', 'premium', 'admin'],
          requireEmailVerification: true,
          title: 'Summary'
        }
      },
      {
        path: 'category',
        loadComponent: () => import('./component/dashboard/category/category.component').then(m => m.CategoryComponent),
        title: 'Categories',
        data: {
          roles: ['free', 'premium', 'admin'],
          requireEmailVerification: true,
          title: 'Categories'
        }
      },
      {
        path: 'transactions',
        loadComponent: () => import('./component/dashboard/transaction-list/transaction-list.component').then(m => m.TransactionListComponent),
        title: 'Transactions',
        data: {
          roles: ['free', 'premium', 'admin'],
          requireEmailVerification: true,
          title: 'Transactions'
        }
      },
      {
        path: 'subscription',
        loadComponent: () => import('./component/dashboard/subscription/subscription.component').then(m => m.SubscriptionComponent),
        title: 'Subscriptions',
        data: {
          roles: ['free', 'premium', 'admin'],
          requireEmailVerification: true,
          title: 'Subscriptions'
        }
      },
      {
        path: 'goals',
        loadComponent: () => import('./component/dashboard/goals/goals.component').then(m => m.GoalsComponent),
        title: 'Goals',
        data: {
          roles: ['premium', 'admin'],
          requireEmailVerification: true,
          title: 'Goals'
        }
      },
      {
        path: 'splitwise',
        loadChildren: () => import('./modules/splitwise/splitwise.module').then(m => m.SplitwiseModule),
        title: 'Splitwise',
        data: {
          roles: ['free', 'premium', 'admin'],
          requireEmailVerification: true,
          title: 'Splitwise'
        }
      },
      {
        path: 'family',
        loadChildren: () => import('./modules/family/family.module').then(m => m.FamilyModule),
        title: 'Family',
        data: {
          roles: ['free', 'premium', 'admin'],
          requireEmailVerification: true,
          title: 'Family'
        }
      },
      {
        path: 'notes',
        loadComponent: () => import('./component/dashboard/notes/notes.component').then(m => m.NotesComponent),
        title: 'Notes',
        data: {
          roles: ['free', 'premium', 'admin'],
          requireEmailVerification: true,
          title: 'Notes'
        }
      },
      {
        path: 'import',
        loadComponent: () => import('./component/dashboard/transaction-list/add-transaction/import-transactions.component')
          .then(m => m.ImportTransactionsComponent),
        title: 'Import Transactions',
        data: {
          roles: ['premium', 'admin'],
          requireEmailVerification: true,
          title: 'Import Transactions'
        }
      },
      {
        path: 'profile',
        loadComponent: () => import('./component/dashboard/profile/profile.component').then(m => m.ProfileComponent),
        title: 'Profile',
        data: {
          roles: ['free', 'premium', 'admin'],
          requireEmailVerification: true,
          title: 'Profile'
        }
      },
      {
        path: 'notifications',
        component: NotificationSettingsComponent,
        title: 'Notifications',
        data: {
          roles: ['free', 'premium', 'admin'],
          requireEmailVerification: true,
          title: 'Notifications'
        }
      },
      {
        path: 'feedback',
        component: FeedbackComponent,
        title: 'Feedback',
        data: {
          roles: ['free', 'premium', 'admin'],
          requireEmailVerification: true,
          title: 'Feedback'
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
    title: 'Administration',
    canActivate: [AuthGuard, AdminGuard],
    data: {
      requireEmailVerification: true,
      requireActiveSession: true,
      roles: ['admin'],
      title: 'Administration'
    }
  },

  { path: '', redirectTo: '/dashboard', pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true, preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
