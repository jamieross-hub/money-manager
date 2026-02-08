import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardComponent } from '../../component/dashboard/dashboard.component';
import { HomeComponent } from '../../component/dashboard/home/home.component';
import { AccountsComponent } from '../../component/dashboard/accounts/accounts.component';
import { CategoryComponent } from '../../component/dashboard/category/category.component';
import { TransactionListComponent } from '../../component/dashboard/transaction-list/transaction-list.component';
import { SyncToCloudComponent } from '../../component/sync-to-cloud/sync-to-cloud.component';

const routes: Routes = [
    {
        path: '',
        component: DashboardComponent,
        children: [
            { path: '', component: HomeComponent },
            { path: 'home', component: HomeComponent },
            { path: 'sync-to-cloud', component: SyncToCloudComponent },
            {
                path: 'accounts',
                component: AccountsComponent,
                data: { roles: ['free', 'premium', 'admin'], requireEmailVerification: true }
            },
            {
                path: 'category',
                component: CategoryComponent,
                data: { roles: ['free', 'premium', 'admin'], requireEmailVerification: true }
            },
            {
                path: 'transactions',
                component: TransactionListComponent,
                data: { roles: ['free', 'premium', 'admin'], requireEmailVerification: true }
            },
            {
                path: 'splitwise',
                loadChildren: () => import('../splitwise/splitwise.module').then(m => m.SplitwiseModule),
                data: { roles: ['free', 'premium', 'admin'], requireEmailVerification: true }
            },
            // Lazy load non-essential features
            {
                path: 'reports',
                loadChildren: () => import('./dashboard-features.module').then(m => m.DashboardFeaturesModule)
            },
            {
                path: 'tax',
                loadChildren: () => import('./dashboard-features.module').then(m => m.DashboardFeaturesModule)
            },
            {
                path: 'subscription',
                loadChildren: () => import('./dashboard-features.module').then(m => m.DashboardFeaturesModule)
            },
            {
                path: 'goals',
                loadChildren: () => import('./dashboard-features.module').then(m => m.DashboardFeaturesModule)
            },
            {
                path: 'google-sheets',
                loadChildren: () => import('./dashboard-features.module').then(m => m.DashboardFeaturesModule)
            },
            {
                path: 'openai-interaction',
                loadChildren: () => import('./dashboard-features.module').then(m => m.DashboardFeaturesModule)
            },
            {
                path: 'budgets',
                loadChildren: () => import('./dashboard-features.module').then(m => m.DashboardFeaturesModule)
            },
            {
                path: 'notes',
                loadChildren: () => import('./dashboard-features.module').then(m => m.DashboardFeaturesModule)
            },
            {
                path: 'import',
                loadChildren: () => import('./dashboard-features.module').then(m => m.DashboardFeaturesModule)
            },
            {
                path: 'profile',
                loadChildren: () => import('./dashboard-features.module').then(m => m.DashboardFeaturesModule)
            },
            {
                path: 'notifications',
                loadChildren: () => import('./dashboard-features.module').then(m => m.DashboardFeaturesModule)
            },
            {
                path: 'feedback',
                loadChildren: () => import('./dashboard-features.module').then(m => m.DashboardFeaturesModule)
            },
            {
                path: 'loan-calculator',
                loadChildren: () => import('./dashboard-features.module').then(m => m.DashboardFeaturesModule)
            },
            {
                path: 'backup-restore',
                loadChildren: () => import('./dashboard-features.module').then(m => m.DashboardFeaturesModule)
            }
        ]
    }
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class DashboardRoutingModule { }
