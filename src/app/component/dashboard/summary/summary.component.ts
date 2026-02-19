
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { ReportsComponent } from 'src/app/modules/features/component/reports/reports.component';
import { QuickActionsFabComponent, QuickAction, QuickActionsFabConfig } from 'src/app/util/components/floating-action-buttons/quick-actions-fab/quick-actions-fab.component';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';
import { HapticFeedbackService } from 'src/app/util/service/haptic-feedback.service';
import { MobileCategoryAddEditPopupComponent } from '../category/mobile-category-add-edit-popup/mobile-category-add-edit-popup.component';
import { AddAccountDialogComponent } from '../accounts/add-account-dialog/add-account-dialog.component';

@Component({
    selector: 'user-summary',
    templateUrl: './summary.component.html',
    styleUrls: ['./summary.component.scss'],
    standalone: true,
    imports: [
        CommonModule,
        ReportsComponent,
        QuickActionsFabComponent
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SummaryComponent {

    quickActionsFabConfig: QuickActionsFabConfig = {
        title: 'Quick Actions',
        mainButtonIcon: 'add',
        mainButtonColor: 'primary',
        mainButtonTooltip: 'Quick Actions',
        showLabels: true,
        actions: [
            {
                id: 'add-category',
                label: 'Add Category',
                icon: 'category',
                color: 'accent',
                tooltip: 'Add a new category'
            },
            {
                id: 'add-account',
                label: 'Add Account',
                icon: 'account_balance',
                color: 'primary',
                tooltip: 'Add a new account'
            }
        ]
    };

    constructor(
        public breakpointService: BreakpointService,
        private dialog: MatDialog,
        private hapticFeedback: HapticFeedbackService
    ) { }

    onFabAction(action: QuickAction): void {
        if (this.breakpointService.device.isMobile) {
            this.hapticFeedback.lightVibration();
        }

        switch (action.id) {
            case 'add-category':
                this.dialog.open(MobileCategoryAddEditPopupComponent, {
                    panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : 'desktop-dialog',
                    data: { category: null, isEdit: false, allCategories: [] }
                });
                break;

            case 'add-account':
                this.dialog.open(AddAccountDialogComponent, {
                    panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : 'desktop-dialog',
                    data: null
                });
                break;
        }
    }
}
