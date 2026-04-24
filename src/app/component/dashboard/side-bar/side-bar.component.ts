import { Component, HostListener, ElementRef, AfterViewInit, OnDestroy, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { ViewChild } from '@angular/core';
import { MatDrawer, MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';

import { TranslateModule } from '@ngx-translate/core';
import { SidebarNavParent, getAllNavigationItems } from '../../../util/config/sidebar.config';
import { UserService } from 'src/app/util/service/db/user.service';
import { User } from 'src/app/util/models';
import { Observable, Subscription, map } from 'rxjs';

import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { toSignal } from '@angular/core/rxjs-interop';
import { selectIsFamilyMode } from 'src/app/store/profile/profile.selectors';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';

@Component({
  selector: 'side-bar',
  templateUrl: './side-bar.component.html',
  styleUrl: './side-bar.component.scss',
  standalone: true,
  imports: [
    MatSidenavModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    RouterModule,
    TranslateModule
],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SideBarComponent implements AfterViewInit, OnDestroy, OnInit {
  @ViewChild('drawer') drawer!: MatDrawer;
  isAdmin: boolean = false;
  navigationSections: SidebarNavParent[] = [];
  
  public userService = inject(UserService);
  private store = inject(Store<AppState>);
  public breakpointService = inject(BreakpointService);
  
  user$: Observable<User | null> = this.userService.userAuth$ ;

  /** True when the user has family mode enabled — drives familyOnly nav items */
  readonly isFamilyMode = toSignal(this.store.select(selectIsFamilyMode), { initialValue: false });

  /** True when the user is a guest — drives hideForGuest nav items */
  readonly isGuestUser = toSignal(this.user$.pipe(map(u => u?.uid === 'offline-guest')), { initialValue: false });


  private boundDocumentClick: (event: Event) => void;

  constructor(
    private auth: Auth,
    public router: Router,
    private elementRef: ElementRef
  ) {
    this.navigationSections = getAllNavigationItems();
    this.boundDocumentClick = this.handleDocumentClick.bind(this);
  }

  ngOnInit() {
    this.isAdmin = this.userService.isAdmin;
  }

  toggleSection(section: SidebarNavParent) {
    if (section.isCollapsible) {
      section.isExpanded = !section.isExpanded;
    }
  }

  closeDrawer() {
    // Defer drawer closure to the next event loop cycle.
    // This allows router navigation to fire reliably on older Android devices
    // without the noticeable UI lag of a hardcoded 100ms delay.
    setTimeout(() => {
      if (this.drawer) {
        this.drawer.close();
      }
    }, 0);
  }

  ngAfterViewInit() {
    // Add click listener to document after view is initialized
    document.addEventListener('click', this.boundDocumentClick);


  }

  ngOnDestroy() {
    document.removeEventListener('click', this.boundDocumentClick);
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && this.drawer && this.drawer.opened) {
      this.drawer.close();
    }
  }

  private handleDocumentClick(event: Event) {
    // Check if sidebar is open and click is outside
    if (this.drawer && this.drawer.opened) {
      const clickedElement = event.target as HTMLElement;
      const sidebarElement = this.elementRef.nativeElement;

      // Check if click is outside the sidebar
      if (!sidebarElement.contains(clickedElement)) {
        // Check if it's not a click on the menu button (which should open the sidebar)
        const menuButton = clickedElement.closest('button[data-testid="sidebar-toggle"]');
        if (!menuButton) {
          this.drawer.close();
        }
      }
    }
  }

  public async logout() {
    await this.userService.logout();
    this.router.navigate(['/sign-in'], { queryParams: { loggedOut: 'true' } });
  }

  /**
   * Check if a route is a premium feature
   */
  isPremiumRoute(route: string): boolean {
    const premiumRoutes = [
      '/dashboard/google-sheets',
      '/dashboard/reports',
      '/dashboard/tax',
      '/dashboard/goals',
      '/dashboard/budgets'
    ];
    return premiumRoutes.includes(route);
  }
}
