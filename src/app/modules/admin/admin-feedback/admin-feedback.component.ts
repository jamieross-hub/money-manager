import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Subject, Observable, firstValueFrom } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Auth } from '@angular/fire/auth';
import { NotificationService } from 'src/app/util/service/notification.service';
import { FeedbackService, FeedbackData } from 'src/app/util/service/feedback.service';
import { ConfirmDialogComponent } from 'src/app/util/components/confirm-dialog/confirm-dialog.component';
import { SsrService } from 'src/app/util/service/ssr.service';

export interface FeedbackFilter {
  status: string;
  category: string;
  priority: string;
  dateRange: string;
}

@Component({
  selector: 'app-admin-feedback',
  templateUrl: './admin-feedback.component.html',
  styleUrls: ['./admin-feedback.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminFeedbackComponent implements OnInit, OnDestroy {
  feedbackList: FeedbackData[] = [];
  filteredFeedback: FeedbackData[] = [];
  isLoading: boolean = false;
  isMobile: boolean = false;
  currentUser: any = null;
  private destroy$ = new Subject<void>();

  // Search and filters
  searchControl = new FormControl('');
  statusFilter = new FormControl('all');
  categoryFilter = new FormControl('all');
  priorityFilter = new FormControl('all');
  dateRangeFilter = new FormControl('all');

  // Filter options
  statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'pending', label: 'Pending' },
    { value: 'reviewed', label: 'Reviewed' },
    { value: 'resolved', label: 'Resolved' }
  ];

  categoryOptions = [
    { value: 'all', label: 'All Categories' },
    { value: 'bug', label: 'Bug Report' },
    { value: 'feature', label: 'Feature Request' },
    { value: 'improvement', label: 'Improvement' },
    { value: 'general', label: 'General' },
    { value: 'support', label: 'Support' }
  ];

  priorityOptions = [
    { value: 'all', label: 'All Priorities' },
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' }
  ];

  dateRangeOptions = [
    { value: 'all', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'quarter', label: 'This Quarter' }
  ];

  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;

  constructor(
    private breakpointObserver: BreakpointObserver,
    private auth: Auth,
    private feedbackService: FeedbackService,
    private dialog: MatDialog,
    private notificationService: NotificationService,
    private ssrService: SsrService,
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
    await this.loadFeedback();
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

    this.categoryFilter.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.applyFilters());

    this.priorityFilter.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.applyFilters());

    this.dateRangeFilter.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.applyFilters());
  }

  private async loadFeedback(): Promise<void> {
    this.isLoading = true;
    this.changeDetectorRef.markForCheck();
    try {
      // Load feedback from the service
      this.feedbackList = await firstValueFrom(this.feedbackService.getAllFeedback());
      this.applyFilters();
    } catch (error) {
      console.error('Error loading feedback:', error);
      this.notificationService.error('Failed to load feedback');
    } finally {
      this.isLoading = false;
      this.changeDetectorRef.markForCheck();
    }
  }

  private applyFilters(): void {
    let filtered = [...this.feedbackList];


    // Search filter
    const searchTerm = this.searchControl.value?.toLowerCase();
    if (searchTerm) {
      filtered = filtered.filter(feedback =>
        feedback.name.toLowerCase().includes(searchTerm) ||
        feedback.email.toLowerCase().includes(searchTerm) ||
        feedback.subject.toLowerCase().includes(searchTerm) ||
        feedback.message.toLowerCase().includes(searchTerm)
      );
    }

    // Status filter
    const status = this.statusFilter.value;
    if (status && status !== 'all') {
      filtered = filtered.filter(feedback => feedback.status === status);
    }

    // Category filter
    const category = this.categoryFilter.value;
    if (category && category !== 'all') {
      filtered = filtered.filter(feedback => feedback.category === category);
    }

    // Priority filter
    const priority = this.priorityFilter.value;
    if (priority && priority !== 'all') {
      filtered = filtered.filter(feedback => feedback.priority === priority);
    }

    // Date range filter
    const dateRange = this.dateRangeFilter.value;
    if (dateRange && dateRange !== 'all') {
      filtered = this.filterByDateRange(filtered, dateRange);
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => {
      const dateA = a.timestamp?.toDate?.() || new Date(a.timestamp);
      const dateB = b.timestamp?.toDate?.() || new Date(b.timestamp);
      return dateB.getTime() - dateA.getTime();
    });

    this.filteredFeedback = filtered;
    this.totalItems = filtered.length;
    this.currentPage = 1;
    this.changeDetectorRef.markForCheck();
  }

  private filterByDateRange(feedback: FeedbackData[], range: string): FeedbackData[] {
    const now = new Date();
    const startDate = new Date();

    switch (range) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        break;
      default:
        return feedback;
    }

    return feedback.filter(feedback => {
      const feedbackDate = feedback.timestamp?.toDate?.() || new Date(feedback.timestamp);
      return feedbackDate >= startDate;
    });
  }

  public getStatusColor(status: string): string {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'reviewed': return '#3b82f6';
      case 'resolved': return '#10b981';
      default: return '#6b7280';
    }
  }

  public getPriorityColor(priority: string): string {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  }

  public getCategoryIcon(category: string): string {
    switch (category) {
      case 'bug': return 'bug_report';
      case 'feature': return 'lightbulb';
      case 'improvement': return 'trending_up';
      case 'general': return 'chat';
      case 'support': return 'help';
      default: return 'feedback';
    }
  }

  public formatDate(timestamp: any): string {
    if (!timestamp) return 'N/A';

    const date = timestamp.toDate?.() || new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  public async updateFeedbackStatus(feedback: FeedbackData, newStatus: string): Promise<void> {
    try {
      await this.feedbackService.updateFeedbackStatus(feedback.id!, newStatus as 'pending' | 'reviewed' | 'resolved');
      feedback.status = newStatus as 'pending' | 'reviewed' | 'resolved';
      this.notificationService.success(`Feedback status updated to ${newStatus}`);
      this.changeDetectorRef.markForCheck();
    } catch (error) {
      console.error('Error updating feedback status:', error);
      this.notificationService.error('Failed to update feedback status');
    }
  }

  public async deleteFeedback(feedback: FeedbackData): Promise<void> {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: this.isMobile ? '90vw' : '400px',
      data: {
        title: 'Delete Feedback',
        message: `Are you sure you want to delete feedback from ${feedback.name}? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        type: 'delete'
      }
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result && feedback.id) {
        try {
          await this.feedbackService.deleteFeedback(feedback.id);
          this.feedbackList = this.feedbackList.filter(f => f.id !== feedback.id);
          this.applyFilters();
          this.notificationService.success('Feedback deleted successfully');
        } catch (error) {
          console.error('Error deleting feedback:', error);
          this.notificationService.error('Failed to delete feedback');
        }
        this.changeDetectorRef.markForCheck();
      }
    });
  }



  public getPaginatedFeedback(): FeedbackData[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.filteredFeedback.slice(startIndex, endIndex);
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
    this.categoryFilter.setValue('all');
    this.priorityFilter.setValue('all');
    this.dateRangeFilter.setValue('all');
  }

  public exportFeedback(): void {
    if (this.ssrService.isClientSide()) {
      // Implement CSV export functionality
      const csvContent = this.generateCSV();
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `feedback-export-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      this.notificationService.success('Feedback exported successfully');
    }
  }

  private generateCSV(): string {
    const headers = ['Name', 'Email', 'Subject', 'Category', 'Priority', 'Status', 'Rating', 'Message', 'Date'];
    const rows = this.filteredFeedback.map(feedback => [
      feedback.name,
      feedback.email,
      feedback.subject,
      feedback.category,
      feedback.priority,
      feedback.status,
      feedback.rating || 'N/A',
      feedback.message.replace(/"/g, '""'), // Escape quotes
      this.formatDate(feedback.timestamp)
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    return csvContent;
  }
} 