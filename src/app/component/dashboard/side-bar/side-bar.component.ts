import { Component, HostListener, ElementRef, AfterViewInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { ViewChild } from '@angular/core';
import { MatDrawer, MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { SidebarNavParent, getAllNavigationItems } from '../../../util/config/sidebar.config';
import { UserService } from 'src/app/util/service/db/user.service';
import { User } from 'src/app/util/models';
import { Observable, Subscription } from 'rxjs';
import { MobileBackButtonService } from 'src/app/util/service/mobile-back-button.service';

@Component({
  selector: 'side-bar',
  templateUrl: './side-bar.component.html',
  styleUrl: './side-bar.component.scss',
  standalone: true,
  imports: [
    CommonModule,
    MatSidenavModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    RouterModule,
    TranslateModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SideBarComponent implements AfterViewInit, OnDestroy {
  @ViewChild('drawer') drawer!: MatDrawer;
  isAdmin: boolean = false;
  navigationSections: SidebarNavParent[] = [];
  user$: Observable<User | null>;

  private drawerSub?: Subscription;
  private boundDocumentClick: (event: Event) => void;

  constructor(
    private auth: Auth,
    public router: Router,
    private elementRef: ElementRef,
    public userService: UserService,
    private mobileBackButtonService: MobileBackButtonService
  ) {
    this.navigationSections = getAllNavigationItems();
    this.user$ = this.userService.userAuth$;
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

  ngAfterViewInit() {
    // Add click listener to document after view is initialized
    document.addEventListener('click', this.boundDocumentClick);

    // Subscribe to drawer open state changes to handle history on mobile
    this.drawerSub = this.drawer.openedChange.subscribe((isOpen: boolean) => {
      if (isOpen) {
        this.mobileBackButtonService.openModal('sidebar', () => {
          this.drawer.close();
        });
      } else {
        this.mobileBackButtonService.closeModal('sidebar');
      }
    });
  }

  ngOnDestroy() {
    document.removeEventListener('click', this.boundDocumentClick);
    if (this.drawerSub) {
      this.drawerSub.unsubscribe();
    }
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
