import { Component, OnInit , ChangeDetectionStrategy} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { NotificationService } from 'src/app/util/service/notification.service';
import { UserService } from 'src/app/util/service/db/user.service';

import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PreLoginHeaderComponent } from './pre-login-header/pre-login-header.component';
import { PreFooterComponent } from './pre-footer/pre-footer.component';
import { ContactFormComponent } from './contact-form/contact-form.component';
import { PwaInstallPromptComponent } from 'src/app/util/components/pwa-install-prompt/pwa-install-prompt.component';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { HeaderComponent } from '../dashboard/header/header.component';

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    PreLoginHeaderComponent,
    PreFooterComponent,
    ContactFormComponent,
    PwaInstallPromptComponent,
    MatButtonModule,
    MatIconModule,
    HeaderComponent,
    TranslateModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LandingComponent implements OnInit {
  features = [
    {
      icon: 'account_balance',
      title: 'LANDING.FEATURES_LIST.CONNECT_BANK_TITLE',
      description: 'LANDING.FEATURES_LIST.CONNECT_BANK_DESC'
    },
    {
      icon: 'pie_chart',
      title: 'LANDING.FEATURES_LIST.SMART_BUDGETING_TITLE',
      description: 'LANDING.FEATURES_LIST.SMART_BUDGETING_DESC'
    },
    {
      icon: 'category',
      title: 'LANDING.FEATURES_LIST.SUB_CATEGORY_TITLE',
      description: 'LANDING.FEATURES_LIST.SUB_CATEGORY_DESC'
    },
    //sub category
    {
      icon: 'trending_up',
      title: 'LANDING.FEATURES_LIST.REAL_TIME_INSIGHTS_TITLE',
      description: 'LANDING.FEATURES_LIST.REAL_TIME_INSIGHTS_DESC'
    },
    {
      icon: 'flag',
      title: 'LANDING.FEATURES_LIST.GOAL_TRACKING_TITLE',
      description: 'LANDING.FEATURES_LIST.GOAL_TRACKING_DESC'
    },
    {
      icon: 'wifi_off',
      title: 'LANDING.FEATURES_LIST.OFFLINE_ACCESS_TITLE',
      description: 'LANDING.FEATURES_LIST.OFFLINE_ACCESS_DESC'
    },
    {
      icon: 'currency_exchange',
      title: 'LANDING.FEATURES_LIST.MULTIPLE_CURRENCY_TITLE',
      description: 'LANDING.FEATURES_LIST.MULTIPLE_CURRENCY_DESC'
    },
    {
      icon: 'devices',
      title: 'LANDING.FEATURES_LIST.PWA_TITLE',
      description: 'LANDING.FEATURES_LIST.PWA_DESC'
    },
    {
      icon: 'security',
      title: 'LANDING.FEATURES_LIST.SECURE_PRIVATE_TITLE',
      description: 'LANDING.FEATURES_LIST.SECURE_PRIVATE_DESC'
    },
    {
      icon: 'cloud',
      title: 'LANDING.FEATURES_LIST.CLOUD_SYNC_TITLE',
      description: 'LANDING.FEATURES_LIST.CLOUD_SYNC_DESC'
    }
  ];

  howItWorks = [
    {
      step: 1,
      title: 'LANDING.HOW_IT_WORKS_STEPS.STEP_1_TITLE',
      description: 'LANDING.HOW_IT_WORKS_STEPS.STEP_1_DESC',
      icon: 'smartphone'
    },
    {
      step: 2,
      title: 'LANDING.HOW_IT_WORKS_STEPS.STEP_2_TITLE',
      description: 'LANDING.HOW_IT_WORKS_STEPS.STEP_2_DESC',
      icon: 'flag'
    },
    {
      step: 3,
      title: 'LANDING.HOW_IT_WORKS_STEPS.STEP_3_TITLE',
      description: 'LANDING.HOW_IT_WORKS_STEPS.STEP_3_DESC',
      icon: 'trending_up'
    }
  ];

  testimonials = [
    {
      name: 'Sarah Johnson',
      role: 'Freelance Designer',
      content: 'Money Manager helped me save $5,000 in just 6 months! The goal tracking feature is incredible.',
      avatar: '👩‍🎨',
      rating: 5,
      location: 'San Francisco, CA'
    },
    {
      name: 'Mike Chen',
      role: 'Software Engineer',
      content: 'Finally, a finance app that actually works offline and syncs perfectly across all my devices.',
      avatar: '👨‍💻',
      rating: 5,
      location: 'Seattle, WA'
    },
    {
      name: 'Emma Davis',
      role: 'Small Business Owner',
      content: 'The real-time insights helped me identify spending patterns I never noticed before. Game changer!',
      avatar: '👩‍💼',
      rating: 5,
      location: 'Austin, TX'
    }
  ];

  screenshots = [
    {
      title: 'LANDING.SCREENSHOTS.DASHBOARD_TITLE',
      description: 'LANDING.SCREENSHOTS.DASHBOARD_DESC',
      image: 'assets/images/screenshot/dashboard.png'
    },
    {
      title: 'LANDING.SCREENSHOTS.ANALYTICS_TITLE',
      description: 'LANDING.SCREENSHOTS.ANALYTICS_DESC',
      image: 'assets/images/screenshot/analytics.png'
    },
    {
      title: 'LANDING.SCREENSHOTS.GOALS_TITLE',
      description: 'LANDING.SCREENSHOTS.GOALS_DESC',
      image: 'assets/images/screenshot/goals.png'
    }
  ];

  currentScreenshotIndex = 0;

  constructor(
    private router: Router,
    private notificationService: NotificationService,
    public userService: UserService
  ) { }

  ngOnInit(): void { }

  async loginDemoUser(): Promise<void> {
    try {
      this.notificationService.info('Logging in as demo user...');
      const userCredential = await this.userService.signIn('wadkarprashil@gmail.com', 'Prashil@n79');
      if (userCredential.user) {
        if (!userCredential.user.emailVerified) {
          await this.userService.signOut();
          this.notificationService.error('Demo user email is not verified. Please contact support.');
          return;
        }

        this.notificationService.success('Welcome back, Demo User!');
        this.router.navigate(['/dashboard']);
      }
    } catch (error: any) {
      console.error('Demo login failed', error);
      this.notificationService.error('Demo login failed. Please try again.');
    }
  }

  navigateToSignUp(): void {
    this.router.navigate(['/sign-in']);
  }

  navigateToSignIn(): void {
    this.router.navigate(['/sign-in']);
  }

  async startGuestMode(): Promise<void> {
    try {
      this.notificationService.info('Starting guest session...');
      await this.userService.enableGuestMode();
      this.router.navigate(['/dashboard']);
      this.notificationService.success('Welcome! You are now in offline guest mode.');
    } catch (error) {
      console.error('Error starting guest mode:', error);
      this.notificationService.error('Failed to start guest mode');
    }
  }

  scrollToFeatures(): void {
    const element = document.getElementById('features');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }

  nextScreenshot(): void {
    this.currentScreenshotIndex = (this.currentScreenshotIndex + 1) % this.screenshots.length;
  }

  prevScreenshot(): void {
    this.currentScreenshotIndex = this.currentScreenshotIndex === 0
      ? this.screenshots.length - 1
      : this.currentScreenshotIndex - 1;
  }

  setScreenshotIndex(index: number): void {
    this.currentScreenshotIndex = index;
  }

  downloadAppStore(): void {
    // Add App Store link when available
    this.notificationService.info('App Store link coming soon!');
  }

  downloadPlayStore(): void {
    // Add Play Store link when available
    this.notificationService.info('Play Store link coming soon!');
  }

  async installPwa(): Promise<void> {
    // This method is called from the install buttons
    // The actual PWA install logic is handled by the PWA install prompt component
    this.notificationService.info('PWA installation will be triggered automatically when available.');
  }

  onPwaInstallClicked(): void {
    console.log('PWA install clicked from prompt component');
    this.notificationService.success('Installing Money Manager...');
  }

  onPwaInstallDismissed(): void {
    console.log('PWA install dismissed from prompt component');
    this.notificationService.info('Installation cancelled');
  }
} 