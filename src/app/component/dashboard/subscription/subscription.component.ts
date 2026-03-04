import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Timestamp } from '@angular/fire/firestore';
import { Subscription, SubscriptionService } from 'src/app/util/service/subscription.service';
import { NotificationService } from 'src/app/util/service/notification.service';
import { DateService } from 'src/app/util/service/date.service';
import { firstValueFrom } from 'rxjs';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AppState } from 'src/app/store/app.state';
import * as ProfileSelectors from 'src/app/store/profile/profile.selectors';

@Component({
  selector: 'app-subscription',
  templateUrl: './subscription.component.html',
  styleUrls: ['./subscription.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SubscriptionComponent implements OnInit {
  private subscriptionService = inject(SubscriptionService);
  private store = inject(Store<AppState>);
  private router = inject(Router);
  private notificationService = inject(NotificationService);
  public dateService = inject(DateService);

  userId: string = '';
  subscription: Subscription | undefined;
  newSubscription: Subscription = {
    userId: '',
    plan: 'free',
    startDate: Timestamp.fromDate(new Date()),
    endDate: Timestamp.fromDate(new Date()),
  };

  ngOnInit(): void {
    // Get userId from NgRx profile store
    const profile = this.store.selectSignal(ProfileSelectors.selectProfile)();
    this.userId = profile?.uid ?? '';
    this.loadSubscription();
  }

  // Load subscription for the logged-in user
  async loadSubscription() {
    if (this.userId) {
      try {
        this.subscription = await firstValueFrom(this.subscriptionService.getSubscription(this.userId));
      } catch (error) {
        console.error('Error loading subscription:', error);
        this.notificationService.error('Failed to load subscription data');
      }
    } else {
      this.notificationService.error('User not authenticated');
    }
  }

  // Create a new subscription
  async createSubscription() {
    if (!this.newSubscription.plan) {
      this.notificationService.warning('Please select a subscription plan');
      return;
    }

    if (this.userId) {
      try {
        this.newSubscription.userId = this.userId;
        await this.subscriptionService.createSubscription(this.userId, this.newSubscription);
        this.notificationService.success('Subscription created successfully');
        this.loadSubscription();
        this.newSubscription = {
          userId: '',
          plan: 'free',
          startDate: Timestamp.fromDate(new Date()),
          endDate: Timestamp.fromDate(new Date()),
        };
      } catch (error) {
        console.error('Error creating subscription:', error);
        this.notificationService.error('Failed to create subscription');
      }
    } else {
      this.notificationService.error('User not authenticated');
    }
  }

  // Update subscription plan
  async updatePlan(newPlan: string) {
    if (!newPlan) {
      this.notificationService.warning('Please select a valid plan');
      return;
    }

    if (this.userId) {
      try {
        await this.subscriptionService.updateSubscriptionPlan(this.userId, newPlan);
        this.notificationService.success(`Subscription plan updated to ${newPlan}`);
        this.loadSubscription();
      } catch (error) {
        console.error('Error updating subscription plan:', error);
        this.notificationService.error('Failed to update subscription plan');
      }
    } else {
      this.notificationService.error('User not authenticated');
    }
  }

  // Update subscription dates
  async updateDates(startDate: Date, endDate: Date) {
    if (!startDate || !endDate) {
      this.notificationService.warning('Please select valid start and end dates');
      return;
    }

    if (startDate >= endDate) {
      this.notificationService.warning('End date must be after start date');
      return;
    }

    if (this.userId) {
      try {
        await this.subscriptionService.updateSubscriptionDates(this.userId, startDate, endDate);
        this.notificationService.success('Subscription dates updated successfully');
        this.loadSubscription();
      } catch (error) {
        console.error('Error updating subscription dates:', error);
        this.notificationService.error('Failed to update subscription dates');
      }
    } else {
      this.notificationService.error('User not authenticated');
    }
  }

  // Delete the subscription
  async deleteSubscription() {
    if (this.userId) {
      try {
        await this.subscriptionService.deleteSubscription(this.userId);
        this.subscription = undefined;
        this.notificationService.success('Subscription deleted successfully');
      } catch (error) {
        console.error('Error deleting subscription:', error);
        this.notificationService.error('Failed to delete subscription');
      }
    } else {
      this.notificationService.error('User not authenticated');
    }
  }
}
