import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardFeaturesRoutingModule } from './dashboard-features-routing.module';
import { SharedModule } from '../shared/shared.module';
import { NgxEchartsModule } from 'ngx-echarts';

import { ReportsComponent } from '../../component/dashboard/reports/reports.component';
import { TaxComponent } from '../../component/dashboard/tax/tax.component';
import { SubscriptionComponent } from '../../component/dashboard/subscription/subscription.component';
import { GoalsComponent } from '../../component/dashboard/goals/goals.component';
import { GoogleSheetsComponent } from '../../component/dashboard/google-sheets/google-sheets.component';
import { OpenaiInteractionComponent } from '../../component/dashboard/openai-interaction/openai-interaction.component';
import { BudgetsComponent } from '../../component/dashboard/budgets/budgets.component';
import { NotesComponent } from '../../component/dashboard/notes/notes.component';
import { ImportTransactionsComponent } from '../../component/dashboard/transaction-list/add-transaction/import-transactions.component';
import { ProfileComponent } from '../../component/dashboard/profile/profile.component';
import { NotificationSettingsComponent } from '../../util/components/notification-settings/notification-settings.component';
import { FeedbackComponent } from '../../component/feedback/feedback.component';
import { LoanCalculatorComponent } from '../../component/dashboard/tools/loan-calculator/loan-calculator.component';
import { BackupRestoreComponent } from '../../component/dashboard/settings/backup-restore/backup-restore.component';

@NgModule({
    declarations: [
        ReportsComponent,
        TaxComponent,
        SubscriptionComponent,
        GoalsComponent,
        GoogleSheetsComponent,
        OpenaiInteractionComponent,
        BudgetsComponent,
        NotesComponent,
        ImportTransactionsComponent,
        ProfileComponent,
        NotificationSettingsComponent,
        FeedbackComponent,
        BackupRestoreComponent
    ],
    imports: [
        CommonModule,
        DashboardFeaturesRoutingModule,
        SharedModule,
        LoanCalculatorComponent,
        NgxEchartsModule
    ]
})
export class DashboardFeaturesModule { }
