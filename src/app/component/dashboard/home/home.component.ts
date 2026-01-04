import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { CategoryBreakdownConfig } from 'src/app/util/components/cards/category-breakdown-card/category-breakdown-card.component';
import { FinancialMetricsConfig } from 'src/app/util/components/cards/financial-metrics-card/financial-metrics-card.component';
import { KeyMetricsConfig } from 'src/app/util/components/cards/key-metrics-summary-card/key-metrics-summary-card.component';
import { MonthlyTrendsConfig } from 'src/app/util/components/cards/monthly-trends-card/monthly-trends-card.component';
import { RecentActivityConfig } from 'src/app/util/components/cards/recent-activity-card/recent-activity-card.component';
import { TopCategoriesConfig } from 'src/app/util/components/cards/top-categories-card/top-categories-card.component';
import { UpcomingTransactionsConfig } from 'src/app/util/components/cards/upcoming-transactions-card/upcoming-transactions-card.component';

import { QuickAction, QuickActionsFabConfig } from 'src/app/util/components/floating-action-buttons/quick-actions-fab/quick-actions-fab.component';
import { MobileAddTransactionComponent } from '../transaction-list/add-transaction/mobile-add-transaction/mobile-add-transaction.component';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';
import { OpenaiService } from 'src/app/util/service/ai-chat/openai.service';
import { UserService } from 'src/app/util/service/db/user.service';
import { ChatFacadeService } from 'src/app/util/service/ai-chat/chat-facade-service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
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

  constructor(private router: Router, private _dialog: MatDialog, public breakpointService: BreakpointService, public chatFacadeService: ChatFacadeService, private userService: UserService) {

  }



  // Chat UI moved to `app-chat` component.




}
