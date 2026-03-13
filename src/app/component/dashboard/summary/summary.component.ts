
import { Component, ChangeDetectionStrategy } from '@angular/core';

import { MatDialog } from '@angular/material/dialog';
import { ReportsComponent } from 'src/app/modules/features/component/reports/reports.component';
import { QuickActionsFabComponent, QuickAction, QuickActionsFabConfig } from 'src/app/util/components/floating-action-buttons/quick-actions-fab/quick-actions-fab.component';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';
import { NotificationService } from 'src/app/util/service/notification.service';
import { MobileCategoryAddEditPopupComponent } from '../category/mobile-category-add-edit-popup/mobile-category-add-edit-popup.component';
import { AddAccountDialogComponent } from '../accounts/add-account-dialog/add-account-dialog.component';
import { Router } from '@angular/router';

@Component({
    selector: 'user-summary',
    templateUrl: './summary.component.html',
    styleUrls: ['./summary.component.scss'],
    standalone: true,
    imports: [
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
            },
            {
                id: 'view-categories',
                label: 'View Categories',
                icon: 'view_list',
                color: 'basic',
                tooltip: 'View all categories'
            },
            {
                id: 'view-accounts',
                label: 'View Accounts',
                icon: 'account_balance_wallet',
                color: 'basic',
                tooltip: 'View all accounts'
            }
        ]
    };

    constructor(
        public breakpointService: BreakpointService,
        private dialog: MatDialog,
        private notificationService: NotificationService,
        private router: Router
    ) { }

    onFabAction(action: QuickAction): void {
        if (this.breakpointService.device.isMobile) {
            this.notificationService.lightVibration();
        }

        switch (action.id) {
            case 'add-category':
                this.dialog.open(MobileCategoryAddEditPopupComponent, {
                    panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : 'desktop-dialog',
                    data: { category: null, isEdit: false, allCategories: [] }
                }).afterClosed().subscribe(() => {
                    this.notificationService.lightVibration();
                    this.router.navigate(['/dashboard/category']);
                });
                break;

            case 'add-account':
                this.dialog.open(AddAccountDialogComponent, {
                    panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : 'desktop-dialog',
                    data: null
                }).afterClosed().subscribe(() => {
                    this.notificationService.lightVibration();
                    this.router.navigate(['/dashboard/accounts']);
                });
                break;
            
            case 'view-categories':
                this.router.navigate(['/dashboard/category']);
                break;
            
            case 'view-accounts':
                this.router.navigate(['/dashboard/accounts']);
                break;
        }
    }
}
