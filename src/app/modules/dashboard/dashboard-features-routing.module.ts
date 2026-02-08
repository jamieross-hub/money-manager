import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ReportsComponent } from '../../component/dashboard/reports/reports.component';
import { TaxComponent } from '../../component/dashboard/tax/tax.component';
import { SubscriptionComponent } from '../../component/dashboard/subscription/subscription.component';
import { GoalsComponent } from '../../component/dashboard/goals/goals.component';
import { GoogleSheetsComponent } from '../../component/dashboard/google-sheets/google-sheets.component';
import { OpenaiInteractionComponent } from '../../component/dashboard/openai-interaction/openai-interaction.component';
import { BudgetsComponent } from '../../component/dashboard/budgets/budgets.component';
import { NotesComponent } from '../../component/dashboard/notes/notes.component';
import { ImportTransactionsComponent } from '../../component/dashboard/transaction-list/add-transaction';
import { ProfileComponent } from '../../component/dashboard/profile/profile.component';
import { NotificationSettingsComponent } from '../../util/components/notification-settings/notification-settings.component';
import { FeedbackComponent } from '../../component/feedback/feedback.component';
import { LoanCalculatorComponent } from '../../component/dashboard/tools/loan-calculator/loan-calculator.component';
import { BackupRestoreComponent } from '../../component/dashboard/settings/backup-restore/backup-restore.component';

const routes: Routes = [
    { path: 'reports', component: ReportsComponent, data: { roles: ['premium', 'admin'], requireEmailVerification: true } },
    { path: 'tax', component: TaxComponent, data: { roles: ['premium', 'admin'], requireEmailVerification: true } },
    { path: 'subscription', component: SubscriptionComponent, data: { roles: ['free', 'premium', 'admin'], requireEmailVerification: true } },
    { path: 'goals', component: GoalsComponent, data: { roles: ['premium', 'admin'], requireEmailVerification: true } },
    { path: 'google-sheets', component: GoogleSheetsComponent, data: { roles: ['free', 'premium', 'admin'], requireEmailVerification: true } },
    { path: 'openai-interaction', component: OpenaiInteractionComponent, data: { roles: ['premium', 'admin'], requireEmailVerification: true } },
    { path: 'budgets', component: BudgetsComponent, data: { roles: ['free', 'premium', 'admin'], requireEmailVerification: true } },
    { path: 'notes', component: NotesComponent, data: { roles: ['free', 'premium', 'admin'], requireEmailVerification: true } },
    { path: 'import', component: ImportTransactionsComponent, data: { roles: ['premium', 'admin'], requireEmailVerification: true } },
    { path: 'profile', component: ProfileComponent, data: { roles: ['free', 'premium', 'admin'], requireEmailVerification: true } },
    { path: 'notifications', component: NotificationSettingsComponent, data: { roles: ['free', 'premium', 'admin'], requireEmailVerification: true } },
    { path: 'feedback', component: FeedbackComponent, data: { roles: ['free', 'premium', 'admin'], requireEmailVerification: true } },
    { path: 'loan-calculator', component: LoanCalculatorComponent, data: { roles: ['free', 'premium', 'admin'], requireEmailVerification: true } },
    { path: 'backup-restore', component: BackupRestoreComponent, data: { roles: ['free', 'premium', 'admin'], requireEmailVerification: true } }
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class DashboardFeaturesRoutingModule { }
