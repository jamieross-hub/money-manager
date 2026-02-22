import { Component, OnInit, OnDestroy , ChangeDetectionStrategy, ChangeDetectorRef} from '@angular/core';
import { Subject, firstValueFrom } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { UserService } from 'src/app/util/service/db/user.service';
import { FeedbackService } from 'src/app/util/service/feedback.service';
import { NotificationService } from 'src/app/util/service/notification.service';

export interface AnalyticsData {
  userGrowth: {
    labels: string[];
    data: number[];
  };
  feedbackTrends: {
    labels: string[];
    data: number[];
  };
  userActivity: {
    activeUsers: number;
    newUsers: number;
    totalUsers: number;
  };
  feedbackMetrics: {
    totalFeedback: number;
    pendingFeedback: number;
    resolvedFeedback: number;
    averageRating: number;
  };
}

@Component({
  selector: 'app-admin-analytics',
  templateUrl: './admin-analytics.component.html',
  styleUrls: ['./admin-analytics.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminAnalyticsComponent implements OnInit, OnDestroy {
  analyticsData: AnalyticsData | null = null;
  isLoading: boolean = false;
  private destroy$ = new Subject<void>();

  constructor(
    private userService: UserService,
    private feedbackService: FeedbackService,
    private notificationService: NotificationService,
    private changeDetectorRef: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadAnalytics();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async loadAnalytics(): Promise<void> {
    this.isLoading = true;
    this.changeDetectorRef.markForCheck();
    try {
      // Load user statistics
      const userStats = await this.userService.getUserStatistics();
      
      // Load feedback data
      const allFeedback = await firstValueFrom(this.feedbackService.getAllFeedback());
      
      // Generate analytics data
      this.analyticsData = this.generateAnalyticsData(userStats, allFeedback);
      
    } catch (error) {
      console.error('Error loading analytics:', error);
      this.notificationService.error('Failed to load analytics data');
    } finally {
      this.isLoading = false;
      this.changeDetectorRef.markForCheck();
    }
  }

  private generateAnalyticsData(userStats: any, feedbackData: any[]): AnalyticsData {
    // Generate user growth data (last 6 months)
    const userGrowth = this.generateUserGrowthData();
    
    // Generate feedback trends
    const feedbackTrends = this.generateFeedbackTrends(feedbackData);
    
    // Calculate user activity
    const userActivity = {
      activeUsers: userStats.activeUsers,
      newUsers: userStats.totalUsers * 0.1, // Placeholder - implement real calculation
      totalUsers: userStats.totalUsers
    };
    
    // Calculate feedback metrics
    const feedbackMetrics = this.calculateFeedbackMetrics(feedbackData);
    
    return {
      userGrowth,
      feedbackTrends,
      userActivity,
      feedbackMetrics
    };
  }

  private generateUserGrowthData(): { labels: string[]; data: number[] } {
    const labels: string[] = [];
    const data: number[] = [];
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      labels.push(date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
      data.push(Math.floor(Math.random() * 50) + 10); // Placeholder data
    }
    
    return { labels, data };
  }

  private generateFeedbackTrends(feedbackData: any[]): { labels: string[]; data: number[] } {
    const labels: string[] = [];
    const data: number[] = [];
    
    // Group feedback by month
    const feedbackByMonth = new Map<string, number>();
    
    feedbackData.forEach(feedback => {
      const date = feedback.timestamp?.toDate?.() || new Date(feedback.timestamp);
      const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      feedbackByMonth.set(monthKey, (feedbackByMonth.get(monthKey) || 0) + 1);
    });
    
    // Generate last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      labels.push(monthKey);
      data.push(feedbackByMonth.get(monthKey) || 0);
    }
    
    return { labels, data };
  }

  private calculateFeedbackMetrics(feedbackData: any[]): any {
    const totalFeedback = feedbackData.length;
    const pendingFeedback = feedbackData.filter(f => f.status === 'pending').length;
    const resolvedFeedback = feedbackData.filter(f => f.status === 'resolved').length;
    
    // Calculate average rating
    const ratings = feedbackData.filter(f => f.rating).map(f => f.rating);
    const averageRating = ratings.length > 0 
      ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length 
      : 0;
    
    return {
      totalFeedback,
      pendingFeedback,
      resolvedFeedback,
      averageRating: Math.round(averageRating * 10) / 10
    };
  }

  public getFeedbackStatusPercentage(status: string): number {
    if (!this.analyticsData) return 0;
    
    const total = this.analyticsData.feedbackMetrics.totalFeedback;
    if (total === 0) return 0;
    
    switch (status) {
      case 'pending':
        return Math.round((this.analyticsData.feedbackMetrics.pendingFeedback / total) * 100);
      case 'resolved':
        return Math.round((this.analyticsData.feedbackMetrics.resolvedFeedback / total) * 100);
      default:
        return 0;
    }
  }

  public getStatusColor(status: string): string {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'resolved': return '#10b981';
      default: return '#6b7280';
    }
  }
} 