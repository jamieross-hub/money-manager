import { Component, OnInit , ChangeDetectionStrategy} from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { Timestamp } from '@angular/fire/firestore';
import { Subscription, SubscriptionService } from 'src/app/util/service/subscription.service';
import { NotificationService } from 'src/app/util/service/notification.service';
import { DateService } from 'src/app/util/service/date.service';
import { firstValueFrom } from 'rxjs';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { CurrencyPipe } from 'src/app/util/pipes/currency.pipe';

@Component({
  selector: 'app-subscription',
  templateUrl: './subscription.component.html',
  styleUrls: ['./subscription.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SubscriptionComponent implements OnInit {
  userId: string = '';
  subscription: Subscription | undefined;
  newSubscription: Subscription = {
    userId: '',
    plan: 'free',
    startDate: Timestamp.fromDate(new Date()),
    endDate: Timestamp.fromDate(new Date()),
  };

  constructor(
    private subscriptionService: SubscriptionService,
    private auth: Auth,
    private router: Router,
    private notificationService: NotificationService,
    public dateService: DateService
  ) { }

  ngOnInit(): void {
    this.loadSubscription();
  }

  // Load subscription for the logged-in user
  async loadSubscription() {
    const user = this.auth.currentUser;
    if (user) {
      try {
        this.userId = user.uid;
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

    const user = this.auth.currentUser;
    if (user) {
      try {
        this.newSubscription.userId = user.uid;
        await this.subscriptionService.createSubscription(user.uid, this.newSubscription);
        this.notificationService.success('Subscription created successfully');
        this.loadSubscription();  // Reload subscription after adding
        // Reset form
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

    const user = this.auth.currentUser;
    if (user) {
      try {
        await this.subscriptionService.updateSubscriptionPlan(user.uid, newPlan);
        this.notificationService.success(`Subscription plan updated to ${newPlan}`);
        this.loadSubscription();  // Reload subscription after updating
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

    const user = this.auth.currentUser;
    if (user) {
      try {
        await this.subscriptionService.updateSubscriptionDates(user.uid, startDate, endDate);
        this.notificationService.success('Subscription dates updated successfully');
        this.loadSubscription();  // Reload subscription after updating dates
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
    const user = this.auth.currentUser;
    if (user) {
      try {
        await this.subscriptionService.deleteSubscription(user.uid);
        this.subscription = undefined;  // Clear the local subscription data
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
