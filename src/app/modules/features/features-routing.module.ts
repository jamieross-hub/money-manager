import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BudgetsComponent } from './component/budgets/budgets.component';
import { ReportsComponent } from './component/reports/reports.component';
import { BackupRestoreComponent } from './component/backup-restore/backup-restore.component';
import { TaxComponent } from './component/tax/tax.component';
import { GoogleSheetsComponent } from './component/google-sheets/google-sheets.component';
import { OpenaiInteractionComponent } from './component/openai-interaction/openai-interaction.component';
import { LoanCalculatorComponent } from './component/loan-calculator/loan-calculator.component';

const routes: Routes = [
    {
        path: 'reports',
        component: ReportsComponent,
        data: {
            roles: ['premium', 'admin'],
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
        path: 'loan-calculator',
        component: LoanCalculatorComponent,
        data: {
            roles: ['free', 'premium', 'admin'],
            requireEmailVerification: true
        }
    },
    {
        path: 'backup-restore',
        component: BackupRestoreComponent,
        data: {
            roles: ['free', 'premium', 'admin'],
            requireEmailVerification: true
        }
    }
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class FeaturesRoutingModule { }
