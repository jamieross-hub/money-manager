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
import { LocalIndexDBStorageService } from 'src/app/util/service/indexdb-storage.service';
import { LocalStorageKey } from 'src/app/util/models/local-storage.model';
import { FooterService, FooterAction, FooterConfig } from './footer.service';



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
  private storageService = inject(LocalIndexDBStorageService);
  private footerService = inject(FooterService);

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

  readonly activeFamily = computed(() => {
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


  /** Dynamic Footer Items from Service or Defaults */
  readonly dynamicConfig = computed<FooterConfig>(() => {
    const custom = this.footerService.currentConfig();
    const isMobile = this.isMobile();
    const isFamilyMode = this.isFamilyMode();
    const currentUrl = this.currentUrl();

    // Calculate Defaults
    const defaultItems: FooterAction[] = [];

    // 1. Home
    defaultItems.push({
      id: 'home',
      icon: isFamilyMode ? this.activeFamilyIcon() : 'home',
      label: isFamilyMode ? 'Home' : 'NAVIGATION.HOME',
      priority: 1
    });

    // 2. Quick Expense
    defaultItems.push({
      id: 'expense',
      icon: 'trending_up',
      label: 'NAVIGATION.EXPENSE',
      priority: 2
    });

    // 3. Central FAB (will be rendered in the middle)
    const defaultFab: FooterAction = {
      id: 'fab',
      icon: 'add_circle',
      label: 'Add',
      bgClass: '',
      isFab: true,
      priority: 3
    };

    // 4. Reports / Settlement (Mobile only)
    if (isMobile) {
      if (isFamilyMode) {
        const isCommonMode = this.activeFamily()?.mode !== 'split';
        const showSummary = this.showSummaryInFamily() || isCommonMode;
        defaultItems.push({
          id: 'reports',
          icon: showSummary ? 'assessment' : 'handshake',
          label: showSummary ? 'NAVIGATION.SUMMARY' : 'Settle',
          priority: 4
        });
      } else {
        defaultItems.push({
          id: 'reports',
          icon: 'assessment',
          label: 'NAVIGATION.SUMMARY',
          priority: 4
        });
      }
    }

    // 5. Large screen items (Category/Accounts)
    if (!isMobile) {
      defaultItems.push({
        id: 'category',
        icon: 'layers',
        label: 'NAVIGATION.CATEGORIES',
        priority: 5
      });
      defaultItems.push({
        id: 'accounts',
        icon: 'account_balance',
        label: 'NAVIGATION.ACCOUNTS',
        priority: 6
      });
    }

    // 6. Profile (Mobile only)
    if (isMobile) {
      defaultItems.push({
        id: 'profile',
        icon: isFamilyMode ? 'group' : 'person',
        label: 'NAVIGATION.PROFILE',
        priority: 7
      });
    }

    // Merge strategy: Use custom items if provided, otherwise use defaults
    const finalItems = (custom && custom.items && custom.items.length > 0) ? custom.items : defaultItems;
    const finalFab = custom?.fab ?? defaultFab;

    // Ensure they are sorted by priority
    return { 
      items: finalItems.sort((a: FooterAction, b: FooterAction) => (a.priority || 0) - (b.priority || 0)), 
      fab: finalFab,
      hideFooter: custom?.hideFooter ?? this.hideFooterForRoutes.includes(currentUrl),
      hideFab: custom?.hideFab ?? false
    } as FooterConfig;
  });
  
  readonly footerLayoutClass = computed(() => {
    const items = this.dynamicConfig().items || [];
    const showFab = !this.dynamicConfig().hideFab;
    const total = items.length + (showFab ? 1 : 0);
    
    if (total <= 3) {
      return 'flex justify-center gap-10 lg:max-w-md lg:mx-auto';
    }
    
    return 'grid grid-cols-5 gap-2 lg:max-w-md lg:mx-auto lg:gap-1';
  });

  readonly fabConfig = computed(() => this.dynamicConfig().fab || ({ id: 'fab', icon: 'add_circle', label: 'Add', bgClass: '' } as FooterAction));

  readonly footerSelectionItems = computed(() => {
    const families = this.userFamilies();
    const activeId = this.isFamilyMode() ? this.familyService.activeFamilyId() : null;
    
    // Base items
    const allItems = [
      { id: null, name: 'Personal', icon: 'person', isIndividual: true },
      ...families.map(f => ({ id: f.id, name: f.name, icon: f.icon, isIndividual: false }))
    ];

    // Load recents from indexing storage (synchronous via in-memory cache)
    const recents = this.storageService.getItem< (string | null)[] >(LocalStorageKey.RECENT_FOOTER_MODES) || [];

    // Sort: Active first, then by recents, then by default
    const sorted = [...allItems].sort((a, b) => {
      // 1. Current active always first
      if (a.id === activeId) return -1;
      if (b.id === activeId) return 1;

      // 2. Then by most recently used
      const idxA = recents.indexOf(a.id as any);
      const idxB = recents.indexOf(b.id as any);
      
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;

      return 0;
    });
    
    // Limit to 5 items
    return sorted.slice(0, 5);
  });

  onAddFabClick() {
    this.notificationService.buttonClick();
    const fab = this.fabConfig();
    
    if (fab.action) {
      fab.action();
      return;
    }
    
    this.addTransaction();
  }

  addTransaction() {
    this.notificationService.buttonClick();
    this._dialog.open(MobileAddTransactionComponent, {
      closeOnNavigation: false,
      panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : 'desktop-dialog',
    });
  }

  onActionClick(item: FooterAction) {
    if (item.action) {
      item.action();
      return;
    }
    
    if (item.route) {
      this.navigateTo(item.route);
      return;
    }
    
    // Legacy fallback for known IDs
    if (item.id === 'category') this.navigateTo('/dashboard/category');
    else if (item.id === 'accounts') this.navigateTo('/dashboard/accounts');
    else if (item.id === 'profile') this.navigateTo('/dashboard/profile');
    else if (item.id === 'home') this.home();
    else if (item.id === 'expense') this.quickExpense();
    else if (item.id === 'reports') this.handleSettleClick();
  }

  home() {
    if (this.isLongPressHome) return; // Prevent navigation on long press
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

  // Home Long Press Logic
  private homePressTimer: any;
  private isLongPressHome = false;
  readonly showHomeMenu = signal(false);

  startHomePress() {
    this.isLongPressHome = false;
    this.homePressTimer = setTimeout(() => {
      this.isLongPressHome = true;
      this.showHomeMenu.set(true);
      this.notificationService.buttonClick();
    }, 500);
  }

  endHomePress() {
    if (this.homePressTimer) {
      clearTimeout(this.homePressTimer);
    }
  }

  cancelHomePress() {
    this.endHomePress();
    this.isLongPressHome = false;
  }

  selectFamily(familyId: string | undefined | null) {
    this.showHomeMenu.set(false);
    this.familyService.setActiveFamily(familyId || null);
    
    // Update recently used cache in indexing storage
    const id = familyId || null;
    let recents = this.storageService.getItem< (string | null)[] >(LocalStorageKey.RECENT_FOOTER_MODES) || [];
    
    // Move to front, remove duplicates
    recents = [id, ...recents.filter(r => r !== id)].slice(0, 10);
    this.storageService.setItem(LocalStorageKey.RECENT_FOOTER_MODES, recents);

    if (familyId) {
      this.navigateTo(`/dashboard/family/dashboard/${familyId}`);
    } else {
      this.navigateTo('/dashboard/home');
    }
  }

  handleSettleClick() {
    if (this.isLongPress) return;
    
    // 1. Individual mode: Always go to standard reports
    if (!this.isFamilyMode()) {
      this.navigateTo('/dashboard/reports');
      return;
    }

    // 2. Family mode: Decide between summary vs. settle based on family settings
    const isCommonMode = this.activeFamily()?.mode !== 'split';
    const route = (this.showSummaryInFamily() || isCommonMode) ? '/dashboard/family/reports' : '/dashboard/family/settle';
    this.navigateTo(route);
  }

  navigateTo(route: string) {
    this.notificationService.buttonClick();
    this.router.navigate([route]);
  }
}
