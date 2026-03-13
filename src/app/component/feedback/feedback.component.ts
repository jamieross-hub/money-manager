import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import { NotificationService } from 'src/app/util/service/notification.service';
import { FeedbackService } from 'src/app/util/service/feedback.service';
import { APP_CONFIG } from 'src/app/util/config/config';

export interface FeedbackForm {
  name: string;
  email: string;
  subject: string;
  message: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  rating?: number;
}


import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AppState } from 'src/app/store/app.state';
import * as ProfileSelectors from 'src/app/store/profile/profile.selectors';

@Component({
  selector: 'app-feedback',
  templateUrl: './feedback.component.html',
  styleUrls: ['./feedback.component.scss'],
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule
],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FeedbackComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private dialog = inject(MatDialog);
  private breakpointObserver = inject(BreakpointObserver);
  private store = inject(Store<AppState>);
  private notificationService = inject(NotificationService);
  private feedbackService = inject(FeedbackService);

  feedbackForm: FormGroup;
  isMobile: boolean = false;
  isSubmitting: boolean = false;
  /** Snapshot of profile from the store (for pre-filling the form) */
  currentUser: { displayName?: string | null; email?: string | null; uid?: string } | null = null;
  private destroy$ = new Subject<void>();
  appName = APP_CONFIG.APP_NAME;

  // Feedback categories
  feedbackCategories = [
    { value: 'bug', label: 'Bug Report', icon: 'bug_report' },
    { value: 'feature', label: 'Feature Request', icon: 'lightbulb' },
    { value: 'improvement', label: 'Improvement Suggestion', icon: 'trending_up' },
    { value: 'general', label: 'General Feedback', icon: 'chat' },
    { value: 'support', label: 'Support Request', icon: 'help' }
  ];

  // Priority levels
  priorityLevels = [
    { value: 'low', label: 'Low', color: '#10b981' },
    { value: 'medium', label: 'Medium', color: '#f59e0b' },
    { value: 'high', label: 'High', color: '#ef4444' }
  ];

  // Rating options
  ratingOptions = [1, 2, 3, 4, 5];

  constructor() {
    this.feedbackForm = this.createForm();

    // Observe breakpoints for mobile detection
    this.breakpointObserver.observe([Breakpoints.Handset])
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        this.isMobile = result.matches;
      });
  }

  ngOnInit(): void {
    this.initializeUser();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeUser(): void {
    /** Read profile snapshot synchronously from NgRx store */
    const profile = this.store.selectSignal(ProfileSelectors.selectProfile)();
    if (profile) {
      this.currentUser = { displayName: profile.displayName, email: profile.email, uid: profile.uid };
      this.feedbackForm.patchValue({
        name: profile.displayName || '',
        email: profile.email || ''
      });
    }
  }

  private createForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      email: ['', [Validators.required, Validators.email]],
      subject: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(100)]],
      message: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(1000)]],
      category: ['general', Validators.required],
      priority: ['medium', Validators.required],
      rating: [null]
    });
  }

  public getCategoryIcon(categoryValue: string): string {
    const category = this.feedbackCategories.find(cat => cat.value === categoryValue);
    return category ? category.icon : 'chat';
  }

  public getPriorityColor(priorityValue: string): string {
    const priority = this.priorityLevels.find(pri => pri.value === priorityValue);
    return priority ? priority.color : '#6b7280';
  }

  public setRating(rating: number): void {
    this.feedbackForm.patchValue({ rating });
    if (this.isMobile) {
      this.notificationService.lightVibration();
    }
  }

  public getRatingStars(rating: number): boolean[] {
    return Array.from({ length: 5 }, (_, i) => i < rating);
  }

  public async submitFeedback(): Promise<void> {
    if (this.feedbackForm.invalid) {
      this.markFormGroupTouched();
      this.notificationService.warning('Please fill in all required fields correctly');
      return;
    }

    if (this.isSubmitting) return;

    this.isSubmitting = true;

    if (this.isMobile) {
      this.notificationService.lightVibration();
    }

    try {
      const feedbackData: FeedbackForm = {
        ...this.feedbackForm.value,
        userId: this.currentUser?.uid || 'anonymous'
      };

      await this.feedbackService.submitFeedback(feedbackData);

      this.notificationService.info('Thank you for your feedback! We\'ll get back to you soon.');
      this.resetForm();

    } catch (error) {
      console.error('Error submitting feedback:', error);
      this.notificationService.error('Failed to submit feedback. Please try again.');
    } finally {
      this.isSubmitting = false;
    }
  }

  public resetForm(): void {
    this.feedbackForm.reset({
      category: 'general',
      priority: 'medium',
      rating: null
    });

    // Re-fill user information if available
    if (this.currentUser) {
      this.feedbackForm.patchValue({
        name: this.currentUser.displayName || '',
        email: this.currentUser.email || ''
      });
    }
  }

  private markFormGroupTouched(): void {
    Object.keys(this.feedbackForm.controls).forEach(key => {
      const control = this.feedbackForm.get(key);
      control?.markAsTouched();
    });
  }

  public getFieldError(fieldName: string): string {
    const field = this.feedbackForm.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) {
        return `${this.getFieldLabel(fieldName)} is required`;
      }
      if (field.errors['email']) {
        return 'Please enter a valid email address';
      }
      if (field.errors['minlength']) {
        return `${this.getFieldLabel(fieldName)} must be at least ${field.errors['minlength'].requiredLength} characters`;
      }
      if (field.errors['maxlength']) {
        return `${this.getFieldLabel(fieldName)} must not exceed ${field.errors['maxlength'].requiredLength} characters`;
      }
    }
    return '';
  }

  private getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      name: 'Name',
      email: 'Email',
      subject: 'Subject',
      message: 'Message',
      category: 'Category',
      priority: 'Priority'
    };
    return labels[fieldName] || fieldName;
  }

  public isFieldInvalid(fieldName: string): boolean {
    const field = this.feedbackForm.get(fieldName);
    return !!(field?.invalid && field.touched);
  }
} 