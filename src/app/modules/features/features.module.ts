import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeaturesRoutingModule } from './features-routing.module';
import { BudgetsComponent } from './component/budgets/budgets.component';
import { BackupRestoreComponent } from './component/backup-restore/backup-restore.component';
import { TaxComponent } from './component/tax/tax.component';
import { GoogleSheetsComponent } from './component/google-sheets/google-sheets.component';
import { OpenaiInteractionComponent } from './component/openai-interaction/openai-interaction.component';
import { ReportsComponent } from './component/reports/reports.component';
import { AutoSyncComponent } from './component/auto-sync/auto-sync.component';
import { SharedModule } from '../shared/shared.module';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

@NgModule({
    declarations: [],
    imports: [
        CommonModule,
        FeaturesRoutingModule,
        SharedModule,
        ReactiveFormsModule,
        FormsModule,
        ReportsComponent,
        BudgetsComponent,
        BackupRestoreComponent,
        TaxComponent,
        GoogleSheetsComponent,
        OpenaiInteractionComponent,
        AutoSyncComponent
    ]
})
export class FeaturesModule { }
