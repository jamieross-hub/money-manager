import { Component, ChangeDetectionStrategy } from '@angular/core';

import { RouterModule } from '@angular/router';
import { ChatComponent } from '../chat/chat.component';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';

import { BreakpointService } from 'src/app/util/service/breakpoint.service';
import { UserService } from 'src/app/util/service/db/user.service';

import { MobileAddTransactionComponent } from '../transaction-list/add-transaction/mobile-add-transaction/mobile-add-transaction.component';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import * as fromProfile from 'src/app/store/profile/profile.selectors';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { inject } from '@angular/core';
import { FamilyService } from 'src/app/modules/family/services/family.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  standalone: true,
  imports: [RouterModule, ChatComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent {
  private store = inject(Store<AppState>);
  isFamilyMode = toSignal(this.store.select(fromProfile.selectUserPreferences).pipe(map(prefs => prefs?.isFamilyMode || false)));
  private familyService = inject(FamilyService);
  // topCategoriesConfig: TopCategoriesConfig = {
  //   title: 'Top Categories',
  //   subtitle: 'Top categories by spending',
  //   currency: 'INR',
  //   showHeaderIcon: true,
  //   headerIcon: 'category',
  //   headerIconColor: 'blue',
  //   showFooter: true,
  //   footerText: 'Last updated',
  //   cardHeight: 'small',
  //   theme: 'auto',
  //   animations: true,
  //   clickable: true,
  // };
  // recentActivityConfig: RecentActivityConfig = {
  //   title: 'Recent Activity',
  //   subtitle: 'Recent activity',
  //   currency: 'INR',
  //   showHeaderIcon: true,
  // };
  // monthlyTrendsConfig: MonthlyTrendsConfig = {
  //   title: 'Monthly Trends',
  //   subtitle: 'Monthly trends',
  //   currency: 'INR',
  //   showHeaderIcon: true,
  // };
  // categoryBreakdownConfig: CategoryBreakdownConfig = {
  //   title: 'Category Breakdown',
  //   subtitle: 'Spending by category',
  //   currency: 'INR',
  //   showHeaderIcon: true,
  //   headerIcon: 'category',
  //   headerIconColor: 'blue',
  //   maxItems: 5,
  //   chartType: 'bar',
  // };
  // categoryPieBreakdownConfig: CategoryBreakdownConfig = {
  //   title: 'Category Breakdown',
  //   subtitle: 'Spending by category',
  //   currency: 'INR',
  //   showHeaderIcon: true,
  //   headerIcon: 'category',
  //   headerIconColor: 'blue',
  //   maxItems: 5,
  //   chartType: 'radial',
  // };
  // quickActionsFabConfig: QuickActionsFabConfig = {
  //   title: 'Quick Actions',
  //   mainButtonIcon: 'add',
  //   mainButtonColor: 'primary',
  //   mainButtonTooltip: 'Quick Actions',
  //   showLabels: false,
  //   animations: true,
  //   autoHide: false,
  //   autoHideDelay: 3000,
  //   theme: 'auto',
  //   actions: [
  //     {
  //       id: 'add-transaction',
  //       label: 'Add Transaction',
  //       icon: 'add',
  //       color: 'accent',
  //       tooltip: 'Add Transaction'
  //     },
  //     {
  //       id: 'category',
  //       label: 'Category',
  //       icon: 'category',
  //       color: 'warn',
  //       tooltip: 'Category'
  //     },
  //     {
  //       id: 'accounts',
  //       label: 'Accounts',
  //       icon: 'account_balance',
  //       color: 'primary',
  //       tooltip: 'Accounts',
  //       loading: false
  //     }
  //   ],
  //   onActionClick: (action: QuickAction) => {
  //     console.log('Quick action clicked:', action);
  //     switch (action.id) {
  //       case 'add-transaction':
  //         this._dialog.open(MobileAddTransactionComponent, {
  //           closeOnNavigation: false,
  //           panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : 'desktop-dialog',
  //         });
  //         break;
  //       case 'category':
  //         this.router.navigate(["/dashboard/category"]);
  //         break;
  //       case 'accounts':
  //         this.router.navigate(["/dashboard/accounts"]);
  //         break;
  //     }
  //   },
  //   onMainButtonClick: () => {
  //     console.log('Main FAB clicked');
  //   }
  // };

  // keyMetricsConfig: KeyMetricsConfig = {
  //   title: '',
  //   subtitle: '',
  //   currency: 'INR',
  //   showHeaderIcon: false ,
  //   columns: 3,
  //   cardsPerRow: {
  //     xs: 1,
  //     sm: 2,
  //     md: 4,
  //     lg: 5,
  //     xl: 6,
  //   },
  //   showPeriod: false,
  // };

  // upcomingTransactionsConfig: UpcomingTransactionsConfig = {
  //   title: 'Upcoming Transactions',
  //   subtitle: 'Upcoming transactions',
  //   currency: 'INR',
  //   showHeaderIcon: true,
  // };

  // financialMetricsConfig:FinancialMetricsConfig = {
  //   title: 'Monthly Financial Summary',
  //   subtitle: '',
  //   currency: 'INR',
  //   showHeaderIcon: true,
  //   headerIcon: 'pie_chart',
  //   showFooter: true,
  //   footerText: 'Last updated',
  //   cardHeight: 'medium',
  //   theme: 'auto',
  //   animations: true,
  //   loading: false,
  //   error: '',
  //   onRefresh: () => {
  //     console.log('Refreshing financial data...');
  //   }
  // };

  constructor(private router: Router, private _dialog: MatDialog, public breakpointService: BreakpointService, private userService: UserService) {
    //check route param action=add-transaction
    if (this.router.url.includes('action=add-transaction')) {
      this._dialog.open(MobileAddTransactionComponent, {
        closeOnNavigation: false,
        panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : 'desktop-dialog',
      });
    }
  }



  // Chat UI moved to `app-chat` component.




}
