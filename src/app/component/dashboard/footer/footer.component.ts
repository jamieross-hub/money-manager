import { Component, ChangeDetectionStrategy, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { CommonSyncService, NetworkStatus } from '../../../util/service/common-sync.service';
import { MatDialog } from '@angular/material/dialog';
import { NotificationService } from '../../../util/service/notification.service';
import { filter, map } from 'rxjs/operators';
import { MobileAddTransactionComponent } from '../transaction-list/add-transaction/mobile-add-transaction/mobile-add-transaction.component';
import { AddAccountDialogComponent } from '../accounts/add-account-dialog/add-account-dialog.component';
import { MobileCategoryAddEditPopupComponent } from '../category/mobile-category-add-edit-popup/mobile-category-add-edit-popup.component';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';
import { Store } from '@ngrx/store';
import { toSignal } from '@angular/core/rxjs-interop';
import { AppState } from 'src/app/store/app.state';
import * as fromProfile from 'src/app/store/profile/profile.selectors';
import * as fromFamily from 'src/app/modules/family/store/family.selectors';
import { FamilyService } from '../../../modules/family/services/family.service';


@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslateModule, MatIconModule, MatButtonModule, RouterModule]
})
export class FooterComponent {
  private commonSyncService = inject(CommonSyncService);
  private router = inject(Router);
  private _dialog = inject(MatDialog);
  private notificationService = inject(NotificationService);
  public breakpointService = inject(BreakpointService);
  private store = inject(Store<AppState>);
  public familyService = inject(FamilyService);

  // Breakpoint signals for template
  readonly isMobile = this.breakpointService.isMobile;
  readonly isTablePortrait = this.breakpointService.isTablePortrait;
  readonly isDesktop = this.breakpointService.isDesktop;

  private hideFooterForRoutes: string[] = [];

  /** Reactively mirrors user preferences → isFamilyMode from the NgRx store. */
  readonly isFamilyMode = toSignal(
    this.store.select(fromProfile.selectUserPreferences).pipe(
      map(prefs => prefs?.isFamilyMode ?? false)
    ),
    { initialValue: false }
  );

  readonly userFamilies = toSignal(
    this.store.select(fromFamily.selectUserFamilies),
    { initialValue: [] }
  );

  private readonly activeFamily = computed(() => {
    const activeId = this.isFamilyMode() ? this.familyService.activeFamilyId() : null;
    return activeId ? this.userFamilies().find(f => f.id === activeId) : null;
  });

  readonly activeFamilyIcon = computed(() => this.activeFamily()?.icon || 'family_restroom');
  readonly activeFamilyName = computed(() => {
    const name = this.activeFamily()?.name || 'Family';
    if (name.length > 6) {
      const words = name.trim().split(/\s+/).filter(w => w.length > 0);
      if (words.length > 1) {
        return words.map(w => w[0].toUpperCase()).join('').substring(0, 3);
      }
      return name.substring(0, 5) + '..';
    }
    return name;
  });

  isImageIcon(icon: string | null | undefined): boolean {
    return !!icon && icon.startsWith('data:');
  }

  readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(event => event.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  readonly hideFooter = computed(() => this.hideFooterForRoutes.includes(this.currentUrl()));

  readonly isHomeActive = computed(() => this.currentUrl() === '/dashboard' || this.currentUrl() === '/dashboard/home');
  readonly isExpenseActive = computed(() => this.currentUrl().includes('/dashboard/transactions'));
  readonly isReportsActive = computed(() => this.currentUrl() === '/dashboard/reports' || this.currentUrl() === '/dashboard/family/reports');
  readonly isSettleActive = computed(() => this.currentUrl() === '/dashboard/family/settle');
  readonly isCategoryActive = computed(() => this.currentUrl() === '/dashboard/category');
  readonly isAccountsActive = computed(() => this.currentUrl() === '/dashboard/accounts');
  readonly isProfileActive = computed(() => this.currentUrl() === '/dashboard/profile');
  readonly isFamilyActive = computed(() => {
    const url = this.currentUrl();
    return url.includes('/dashboard/family/dashboard') || 
           url.includes('/dashboard/family/groups') || 
           url === '/dashboard/family';
  });
  readonly isMoreActive = computed(() => [
    '/dashboard/accounts', '/dashboard/budgets', '/dashboard/goals', 
    '/dashboard/notes', '/dashboard/tax', '/dashboard/subscription'
  ].includes(this.currentUrl()));

  readonly addConfig = computed(() => {
    const url = this.currentUrl();
    if (url.includes('/dashboard/accounts')) {
      return { icon: 'account_balance', label: 'Account', bgClass: 'add-btn-green', action: 'account' };
    }
    if (url.includes('/dashboard/category')) {
      return { icon: 'category', label: 'Category', bgClass: 'add-btn-purple', action: 'category' };
    }
    if (url.includes('/dashboard/family/groups')) {
      return { icon: 'groups', label: 'Actions', bgClass: 'add-btn-purple', action: 'family-groups' };
    }

    return { icon: 'add_circle', label: 'Add', bgClass: '', action: 'transaction' };
  });

  readonly networkStatus = toSignal(this.commonSyncService.networkStatus$, { 
    initialValue: this.commonSyncService.getCurrentNetworkStatus() 
  });

  onAddFabClick() {
    this.notificationService.buttonClick();
    const action = this.addConfig().action;
    if (action === 'account') {
      this.addAccount();
    } else if (action === 'category') {
      this.addCategory();
    } else if (action === 'family-groups') {
      this.openFamilyActions();
    } else {
      this.addTransaction();
    }
  }

  private openFamilyActions() {
    this.familyService.openCreateDialog();
  }

  private addAccount() {
    this._dialog.open(AddAccountDialogComponent, {
      data: null,
      disableClose: true,
      closeOnNavigation: false,
      panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : 'desktop-dialog',
    });
  }

  private addCategory() {
    this._dialog.open(MobileCategoryAddEditPopupComponent, {
      data: null,
      disableClose: true,
      closeOnNavigation: false,
      panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : 'desktop-dialog',
    });
  }

  addTransaction() {
    this.notificationService.buttonClick();
    this._dialog.open(MobileAddTransactionComponent, {
      closeOnNavigation: false,
      panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : 'desktop-dialog',
    });
  }

  home() {
    if (this.isFamilyMode()) {
      const activeFamilyId = this.familyService.activeFamilyId();
      if (activeFamilyId) {
        this.navigateTo(`/dashboard/family/dashboard/${activeFamilyId}`);
      } else {
        this.navigateTo('/dashboard/family');
      }
    } else {
      this.navigateTo('/dashboard/home');
    }
  }

  quickExpense() {
    this.navigateTo('/dashboard/transactions');
  }

  private pressTimer: any;
  private isLongPress = false;
  readonly showSummaryInFamily = signal(false);

  startPress() {
    this.isLongPress = false;
    this.pressTimer = setTimeout(() => {
      this.isLongPress = true;
      this.showSummaryInFamily.update((v: boolean) => !v);
    }, 600);
  }

  endPress() {
    if (this.pressTimer) {
      clearTimeout(this.pressTimer);
    }
  }

  handleSettleClick() {
    if (this.isLongPress) return;
    const route = this.showSummaryInFamily() ? '/dashboard/family/reports' : '/dashboard/family/settle';
    this.navigateTo(route);
  }

  navigateTo(route: string) {
    this.notificationService.buttonClick();
    this.router.navigate([route]);
  }
}
