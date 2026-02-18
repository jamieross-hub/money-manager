import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Auth } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { NotificationService } from 'src/app/util/service/notification.service';
import { UserService } from 'src/app/util/service/db/user.service';
import { FeedbackService } from 'src/app/util/service/feedback.service';
import { AdminSidebarService, AdminSidebarState } from './admin-sidebar.service';
import { AdminSidebarSection, AdminSidebarNavItem } from './admin-sidebar.config';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss'],
  changeDetection: ChangeDetectionStrategy.Default
})
export class AdminComponent implements OnInit, OnDestroy {
  isMobile: boolean = false;
  isSidebarOpen: boolean = false;
  currentUser: any = null;
  isAdmin: boolean = false;
  userPermissions: string[] = ['admin'];
  private destroy$ = new Subject<void>();

  // Admin navigation sections from service
  adminSections: AdminSidebarSection[] = [];
  adminNavigationItems: AdminSidebarNavItem[] = [];
  activeSection: string = 'dashboard';

  // Dashboard statistics
  dashboardStats = {
    totalUsers: 0,
    totalFeedback: 0,
    pendingFeedback: 0,
    activeUsers: 0,
    totalTransactions: 0,
    totalCategories: 0
  };

  constructor(
    private breakpointObserver: BreakpointObserver,
    private auth: Auth,
    private router: Router,
    private userService: UserService,
    private feedbackService: FeedbackService,
    private notificationService: NotificationService,
    private adminSidebarService: AdminSidebarService
  ) {
    // Observe breakpoints for mobile detection
    this.breakpointObserver.observe([Breakpoints.Handset])
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        this.isMobile = result.matches;
        if (!this.isMobile) {
          this.isSidebarOpen = false;
        }
      });
  }

  ngOnInit(): void {
    this.initializeAdmin();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async initializeAdmin(): Promise<void> {
    try {
      this.currentUser = await this.auth.currentUser;

      if (!this.currentUser) {
        this.notificationService.error('Authentication required');
        this.router.navigate(['/sign-in']);
        return;
      }

      // Check if user is admin
      this.isAdmin = await this.checkAdminStatus();

      if (!this.isAdmin) {
        this.notificationService.error('Admin access required');
        this.router.navigate(['/dashboard']);
        return;
      }

      // Initialize sidebar service
      this.initializeSidebar();

      // Load dashboard statistics
      await this.loadDashboardStats();

    } catch (error) {
      console.error('Error initializing admin:', error);
      this.notificationService.error('Failed to initialize admin panel');
    }
  }

  private async checkAdminStatus(): Promise<boolean> {
    return this.userService.isAdmin;
  }

  private initializeSidebar(): void {
    // Set user permissions
    this.adminSidebarService.setUserPermissions(this.userPermissions);

    // Subscribe to sidebar state changes
    this.adminSidebarService.getSidebarState()
      .pipe(takeUntil(this.destroy$))
      .subscribe((state: AdminSidebarState) => {
        this.adminSections = state.sections;
        this.adminNavigationItems = state.navigationItems;
        this.activeSection = state.activeSection;
      });
  }

  private async loadDashboardStats(): Promise<void> {
    try {
      // Load user statistics
      const userStats = await this.userService.getUserStatistics();

      // Load feedback statistics
      const allFeedback = await this.feedbackService.getAllFeedback();
      const pendingFeedback = allFeedback.filter(f => f.status === 'pending').length;

      this.dashboardStats = {
        totalUsers: userStats.totalUsers,
        totalFeedback: allFeedback.length,
        pendingFeedback: pendingFeedback,
        activeUsers: userStats.activeUsers,
        totalTransactions: userStats.totalTransactions,
        totalCategories: userStats.totalCategories
      };

      // Add badge to feedback item if there are pending items
      if (pendingFeedback > 0) {
        this.adminSidebarService.addBadgeToItem('feedback', {
          text: pendingFeedback.toString(),
          color: 'warn'
        });
      }
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
      this.notificationService.error('Failed to load dashboard statistics');
    }
  }

  public setActiveSection(sectionId: string): void {
    this.adminSidebarService.setActiveSection(sectionId);
    // Close sidebar on mobile after navigation
    if (this.isMobile) {
      this.isSidebarOpen = false;
    }
  }

  public getActiveSection(): AdminSidebarNavItem | undefined {
    return this.adminSidebarService.getActiveSection();
  }

  public getActiveSectionLabel(): string {
    return this.adminSidebarService.getActiveSectionLabel();
  }

  public toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  public closeSidebar(): void {
    this.isSidebarOpen = false;
  }

  public toggleSection(sectionId: string): void {
    this.adminSidebarService.toggleSection(sectionId);
  }

  public isSectionExpanded(sectionId: string): boolean {
    return this.adminSidebarService.isSectionExpanded(sectionId);
  }

  public isSectionCollapsible(sectionId: string): boolean {
    return this.adminSidebarService.isSectionCollapsible(sectionId);
  }

  public getSectionItems(sectionId: string): AdminSidebarNavItem[] {
    return this.adminSidebarService.getSectionItems(sectionId);
  }

  public logout(): void {
    this.auth.signOut().then(() => {
      this.notificationService.success('Logged out successfully');
      this.router.navigate(['/sign-in']);
    }).catch(error => {
      console.error('Logout error:', error);
      this.notificationService.error('Failed to logout');
    });
  }

  public goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }
} 