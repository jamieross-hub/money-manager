import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardRoutingModule } from './dashboard-routing.module';
import { SharedModule } from '../shared/shared.module';

import { DashboardComponent } from '../../component/dashboard/dashboard.component';
import { HomeComponent } from '../../component/dashboard/home/home.component';
import { AccountsComponent } from '../../component/dashboard/accounts/accounts.component';
import { CategoryComponent } from '../../component/dashboard/category/category.component';
import { TransactionListComponent } from '../../component/dashboard/transaction-list/transaction-list.component';
import { MobileAddTransactionComponent } from '../../component/dashboard/transaction-list/add-transaction/mobile-add-transaction/mobile-add-transaction.component';
import { MobileCategoryAddEditPopupComponent } from '../../component/dashboard/category/mobile-category-add-edit-popup/mobile-category-add-edit-popup.component';
import { ParentCategorySelectorDialogComponent } from '../../component/dashboard/category/parent-category-selector-dialog/parent-category-selector-dialog.component';
import { CategoryDetailsDialogComponent } from '../../component/dashboard/category/category-details-dialog/category-details-dialog.component';
import { IconSelectorDialogComponent } from '../../component/dashboard/category/icon-selector-dialog/icon-selector-dialog.component';
import { ColorSelectorDialogComponent } from '../../component/dashboard/category/color-selector-dialog/color-selector-dialog.component';
import { CategoryBudgetDialogComponent } from '../../component/dashboard/category/category-budget-dialog/category-budget-dialog.component';
import { CategoryCardComponent } from '../../component/dashboard/category/category-card/category-card.component';
import { MobileTransactionListComponent } from '../../component/dashboard/transaction-list/mobile-transaction-list/mobile-transaction-list.component';
import { TransactionTableComponent } from '../../component/dashboard/transaction-list/transaction-table/transaction-table.component';
import { SearchFilterComponent } from '../../component/dashboard/transaction-list/search-filter/search-filter.component';
import { AddAccountDialogComponent } from '../../component/dashboard/accounts/add-account-dialog/add-account-dialog.component';
import { AccountStatementDialogComponent } from '../../component/dashboard/accounts/account-statement-dialog/account-statement-dialog.component';
import { MobileAccountsListComponent } from '../../component/dashboard/accounts/mobile-accounts-list/mobile-accounts-list.component';
import { SyncToCloudComponent } from '../../component/sync-to-cloud/sync-to-cloud.component';
import { CategorySelectionSheetComponent } from '../../component/dashboard/transaction-list/add-transaction/mobile-add-transaction/category-selection-sheet/category-selection-sheet.component';
import { ChatComponent } from '../../component/dashboard/chat/chat.component';
import { ChatCategoryDropdownComponent } from '../../util/components/chat-category-dropdown/chat-category-dropdown.component';
import { CalendarViewComponent } from '../../component/dashboard/calendar-view/calendar-view.component';

@NgModule({
    declarations: [
        DashboardComponent,
        HomeComponent,
        AccountsComponent,
        CategoryComponent,
        TransactionListComponent,
        MobileAddTransactionComponent,
        MobileCategoryAddEditPopupComponent,
        ParentCategorySelectorDialogComponent,
        CategoryDetailsDialogComponent,
        IconSelectorDialogComponent,
        ColorSelectorDialogComponent,
        CategoryBudgetDialogComponent,
        CategoryCardComponent,
        MobileTransactionListComponent,
        TransactionTableComponent,
        SearchFilterComponent,
        AddAccountDialogComponent,
        AccountStatementDialogComponent,
        MobileAccountsListComponent,
        SyncToCloudComponent,
        CategorySelectionSheetComponent,
        ChatComponent,
        ChatCategoryDropdownComponent,
        CalendarViewComponent
    ],
    imports: [
        CommonModule,
        DashboardRoutingModule,
        SharedModule
    ]
})
export class DashboardModule { }
