import { Component, OnInit, OnDestroy , ChangeDetectionStrategy, ChangeDetectorRef} from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Auth } from '@angular/fire/auth';
import { NotificationService } from 'src/app/util/service/notification.service';
import { UserService } from 'src/app/util/service/db/user.service';
import { ConfirmDialogComponent } from 'src/app/util/components/confirm-dialog/confirm-dialog.component';

export interface UserData {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  emailVerified: boolean;
  createdAt: Date;
  lastSignInAt?: Date;
  isAdmin?: boolean;
  status: 'active' | 'suspended' | 'pending';
  totalTransactions?: number;
  totalCategories?: number;
}

@Component({
  selector: 'app-admin-users',
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminUsersComponent implements OnInit, OnDestroy {
  usersList: UserData[] = [];
  filteredUsers: UserData[] = [];
  isLoading: boolean = false;
  isMobile: boolean = false;
  currentUser: any = null;
  private destroy$ = new Subject<void>();

  // Search and filters
  searchControl = new FormControl('');
  statusFilter = new FormControl('all');
  roleFilter = new FormControl('all');

  // Filter options
  statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'suspended', label: 'Suspended' },
    { value: 'pending', label: 'Pending' }
  ];

  roleOptions = [
    { value: 'all', label: 'All Roles' },
    { value: 'user', label: 'User' },
    { value: 'admin', label: 'Admin' }
  ];

  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;

  constructor(
    private breakpointObserver: BreakpointObserver,
    private auth: Auth,
    private userService: UserService,
    private dialog: MatDialog,
    private notificationService: NotificationService,
    private changeDetectorRef: ChangeDetectorRef
  ) {
    // Observe breakpoints for mobile detection
    this.breakpointObserver.observe([Breakpoints.Handset])
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        this.isMobile = result.matches;
        this.changeDetectorRef.markForCheck();
      });
  }

  ngOnInit(): void {
    this.initializeComponent();
    this.setupSearchAndFilters();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async initializeComponent(): Promise<void> {
    this.currentUser = await this.auth.currentUser;
    await this.loadUsers();
  }

  private setupSearchAndFilters(): void {
    // Search functionality
    this.searchControl.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(() => {
        this.applyFilters();
      });

    // Filter changes
    this.statusFilter.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.applyFilters());

    this.roleFilter.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.applyFilters());
  }

  private async loadUsers(): Promise<void> {
    this.isLoading = true;
    this.changeDetectorRef.markForCheck();
    try {
      // Load users from UserService
      this.usersList = await this.userService.getAllUsers();
      this.applyFilters();
    } catch (error) {
      console.error('Error loading users:', error);
      this.notificationService.error('Failed to load users');
    } finally {
      this.isLoading = false;
      this.changeDetectorRef.markForCheck();
    }
  }

  private applyFilters(): void {
    let filtered = [...this.usersList];

    // Search filter
    const searchTerm = this.searchControl.value?.toLowerCase();
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.displayName?.toLowerCase().includes(searchTerm) ||
        user.email.toLowerCase().includes(searchTerm)
      );
    }

    // Status filter
    const status = this.statusFilter.value;
    if (status && status !== 'all') {
      filtered = filtered.filter(user => user.status === status);
    }

    // Role filter
    const role = this.roleFilter.value;
    if (role && role !== 'all') {
      if (role === 'admin') {
        filtered = filtered.filter(user => user.isAdmin);
      } else {
        filtered = filtered.filter(user => !user.isAdmin);
      }
    }

    // Sort by creation date (newest first)
    filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    this.filteredUsers = filtered;
    this.totalItems = filtered.length;
    this.currentPage = 1;
    this.changeDetectorRef.markForCheck();
  }

  public getStatusColor(status: string): string {
    switch (status) {
      case 'active': return '#10b981';
      case 'suspended': return '#ef4444';
      case 'pending': return '#f59e0b';
      default: return '#6b7280';
    }
  }

  public getStatusIcon(status: string): string {
    switch (status) {
      case 'active': return 'check_circle';
      case 'suspended': return 'block';
      case 'pending': return 'pending';
      default: return 'help';
    }
  }

  public formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  public formatDateTime(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  public async updateUserStatus(user: UserData, newStatus: 'active' | 'suspended' | 'pending'): Promise<void> {
    try {
      await this.userService.updateUserStatus(user.uid, newStatus);
      user.status = newStatus;
      this.notificationService.success(`User status updated to ${newStatus}`);
      this.changeDetectorRef.markForCheck();
    } catch (error) {
      console.error('Error updating user status:', error);
      this.notificationService.error('Failed to update user status');
    }
  }

  public async deleteUser(user: UserData): Promise<void> {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete User',
        message: `Are you sure you want to delete ${user.displayName || user.email}? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        confirmColor: 'warn'
      }
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        try {
          await this.userService.deleteUser(user.uid);
          this.usersList = this.usersList.filter(u => u.uid !== user.uid);
          this.applyFilters();
          this.notificationService.success('User deleted successfully');
        } catch (error) {
          console.error('Error deleting user:', error);
          this.notificationService.error('Failed to delete user');
        }
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  public sendEmailToUser(user: UserData): void {
    // Implement email functionality
    this.notificationService.info(`Email functionality will be implemented for ${user.email}`);
  }

  public async toggleAdminRole(user: UserData): Promise<void> {
    try {
      await this.userService.toggleAdminRole(user.uid);
      user.isAdmin = !user.isAdmin;
      this.notificationService.success(`Admin role ${user.isAdmin ? 'granted' : 'revoked'} for ${user.displayName || user.email}`);
      this.changeDetectorRef.markForCheck();
    } catch (error) {
      console.error('Error toggling admin role:', error);
      this.notificationService.error('Failed to update admin role');
    }
  }

  public getPaginatedUsers(): UserData[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.filteredUsers.slice(startIndex, endIndex);
  }

  public onPageChange(page: number): void {
    this.currentPage = page;
  }

  public getTotalPages(): number {
    return Math.ceil(this.totalItems / this.itemsPerPage);
  }

  public clearFilters(): void {
    this.searchControl.setValue('');
    this.statusFilter.setValue('all');
    this.roleFilter.setValue('all');
  }

  public exportUsers(): void {
    try {
      const csvContent = this.generateCSV();
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `users_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      this.notificationService.success('Users exported successfully');
    } catch (error) {
      console.error('Error exporting users:', error);
      this.notificationService.error('Failed to export users');
    }
  }

  private generateCSV(): string {
    const headers = ['Name', 'Email', 'Status', 'Role', 'Email Verified', 'Created Date', 'Last Sign In', 'Transactions', 'Categories'];
    const rows = this.filteredUsers.map(user => [
      user.displayName || 'N/A',
      user.email,
      user.status,
      user.isAdmin ? 'Admin' : 'User',
      user.emailVerified ? 'Yes' : 'No',
      this.formatDate(user.createdAt),
      user.lastSignInAt ? this.formatDateTime(user.lastSignInAt) : 'Never',
      user.totalTransactions || 0,
      user.totalCategories || 0
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    return csvContent;
  }
} 