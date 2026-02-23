import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';
import { Router, NavigationEnd } from '@angular/router';
import { CommonSyncService, NetworkStatus } from '../../../util/service/common-sync.service';
import { Subject } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { HapticFeedbackService } from '../../../util/service/haptic-feedback.service';
import { filter, takeUntil } from 'rxjs/operators';
import { MobileAddTransactionComponent } from '../transaction-list/add-transaction/mobile-add-transaction/mobile-add-transaction.component';
import { AddAccountDialogComponent } from '../accounts/add-account-dialog/add-account-dialog.component';
import { MobileCategoryAddEditPopupComponent } from '../category/mobile-category-add-edit-popup/mobile-category-add-edit-popup.component';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslateModule, MatIconModule, MatButtonModule, RouterModule]
})
export class FooterComponent implements OnInit, OnDestroy {
  public hideFooter: boolean = false;
  private hideFooterForRoutes: string[] = [];

  // Local state for network status to support OnPush
  private networkStatus: NetworkStatus = { online: false };
  private destroy$ = new Subject<void>();

  constructor(
    private commonSyncService: CommonSyncService,
    private router: Router,
    private _dialog: MatDialog,
    private hapticFeedback: HapticFeedbackService,
    public breakpointService: BreakpointService,
    private cdr: ChangeDetectorRef
  ) {
    // Initialize with current status
    this.networkStatus = this.commonSyncService.getCurrentNetworkStatus();
  }

  ngOnInit() {
    // Subscribe to Router Events
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.hideFooter = this.hideFooterForRoutes.includes(this.router.url);
        this.cdr.markForCheck(); // Trigger CD on route change
      });

    // Subscribe to Network Status
    this.commonSyncService.networkStatus$
      .pipe(takeUntil(this.destroy$))
      .subscribe(status => {
        this.networkStatus = status;
        this.cdr.markForCheck(); // Trigger CD on network status change
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Route checking methods
  // Note: These will be re-evaluated when CD runs (which happens on route change via subscription)
  isHomeActive(): boolean {
    return this.router.url === '/dashboard' || this.router.url === '/dashboard/home';
  }

  isExpenseActive(): boolean {
    return this.router.url === '/dashboard/transactions'
  }

  isReportsActive(): boolean {
    return this.router.url === '/dashboard/reports';
  }

  isSummaryActive(): boolean {
    return this.router.url === '/dashboard/summary';
  }

  isCategoryActive(): boolean {
    return this.router.url === '/dashboard/category';
  }

  isAccountsActive(): boolean {
    return this.router.url === '/dashboard/accounts';
  }

  isProfileActive(): boolean {
    return this.router.url === '/dashboard/profile';
  }

  isMoreActive(): boolean {
    const moreRoutes = [
      '/dashboard/accounts',
      '/dashboard/budgets',
      '/dashboard/goals',
      '/dashboard/notes',
      '/dashboard/tax',
      '/dashboard/subscription'
    ];
    return moreRoutes.includes(this.router.url);
  }

  // ─── Dynamic Add Button ────────────────────────────────────────────────────

  /** Returns an object describing what the centre Add FAB should do on the current page. */
  getAddConfig(): { icon: string; label: string; bgClass: string; action: () => void } {
    const url = this.router.url;

    if (url.includes('/dashboard/accounts')) {
      return {
        icon: 'account_balance',
        label: 'Account',
        bgClass: 'add-btn-green',
        action: () => this.addAccount()
      };
    }

    if (url.includes('/dashboard/category')) {
      return {
        icon: 'category',
        label: 'Category',
        bgClass: 'add-btn-purple',
        action: () => this.addCategory()
      };
    }

    // Default: add transaction
    return {
      icon: 'add_circle',
      label: 'Add',
      bgClass: '',
      action: () => this.addTransaction()
    };
  }

  onAddFabClick() {
    this.hapticFeedback.buttonClick();
    this.getAddConfig().action();
  }

  private addAccount() {
    this._dialog.open(AddAccountDialogComponent, {
      data: null,
      disableClose: true,
      panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : 'desktop-dialog',
    });
  }

  private addCategory() {
    this._dialog.open(MobileCategoryAddEditPopupComponent, {
      data: null,
      disableClose: true,
      panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : 'desktop-dialog',
    });
  }

  addTransaction() {
    this.hapticFeedback.buttonClick();
    this._dialog.open(MobileAddTransactionComponent, {
      panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : 'desktop-dialog',
    });
  }

  home() {
    this.router.navigate(['/dashboard/home']);
    this.hapticFeedback.buttonClick();
  }

  quickExpense() {
    this.hapticFeedback.buttonClick();
    this.router.navigate(['/dashboard/transactions']);
  }

  reports() {
    console.log('Quick transfer clicked');
    this.router.navigate(['/dashboard/reports']);
  }

  scanReceipt() {
    console.log('Scan receipt clicked');
    alert('Receipt scanning feature coming soon!');
  }

  openAddTransactionModal() {
    this.router.navigate(['/dashboard/add-transaction']);
  }

  openSettings() {
    this.router.navigate(['/dashboard/settings']);
  }

  openReports() {
    this.router.navigate(['/dashboard/reports']);
  }

  openSearch() {
    alert('Search feature coming soon!');
  }

  onMoreMenuClick() {
    this.hapticFeedback.buttonClick();
    console.log('More menu clicked');
  }

  navigateTo(route: string) {
    this.hapticFeedback.buttonClick();
    this.router.navigate([route]);
  }

  getAppVersion(): string {
    return new Date().toISOString().split('T')[0];
  }

  // Network Status Helpers (using local state)
  getNetworkStatusClass(): string {
    const status = this.networkStatus;
    if (!status.online) return 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300';
    if (status.effectiveType === '4g') return 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300';
    if (status.effectiveType === '3g') return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300';
    return 'bg-gray-100 dark:bg-gray-900/20 text-gray-700 dark:text-gray-300';
  }

  getNetworkIndicatorClass(): string {
    const status = this.networkStatus;
    if (!status.online) return 'bg-red-500';
    if (status.effectiveType === '4g') return 'bg-green-500';
    if (status.effectiveType === '3g') return 'bg-yellow-500';
    return 'bg-gray-500';
  }

  getNetworkStatusText(): string {
    const status = this.networkStatus;
    if (!status.online) return 'Offline';
    if (status.effectiveType === '4g') return '4G';
    if (status.effectiveType === '3g') return '3G';
    if (status.effectiveType === '2g') return '2G';
    return 'Online';
  }
}