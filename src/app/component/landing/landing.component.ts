import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationService } from 'src/app/util/service/notification.service';
import { UserService } from 'src/app/util/service/db/user.service';

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss']
})
export class LandingComponent implements OnInit {
  features = [
    {
      icon: 'account_balance',
      title: 'Connect Bank',
      description: 'Securely connect your bank accounts for automatic transaction tracking and real-time balance updates.'
    },
    {
      icon: 'pie_chart',
      title: 'Smart Budgeting',
      description: 'Create and manage budgets with intelligent spending alerts to keep you on track.'
    },
    {
      icon: 'category',
      title: 'Sub Category',
      description: 'Create and manage sub categories to track your spending.'
    },
    //sub category
    {
      icon: 'trending_up',
      title: 'Real-Time Insights',
      description: 'Get instant financial insights and trends with beautiful charts and analytics.'
    },
    {
      icon: 'flag',
      title: 'Goal Tracking',
      description: 'Set savings goals and track your progress with visual milestones.'
    },
    {
      icon: 'wifi_off',
      title: 'Offline Access',
      description: 'Access your data anytime, even without an internet connection.'
    },
    {
      icon: 'currency_exchange',
      title: 'Multiple Currency Support',
      description: 'Manage your finances in multiple currencies with ease.'
    },
    {
      icon: 'devices',
      title: 'PWA - Multi-Platform Support',
      description: 'Access your data on multiple devices web, android and ios'
    },
    {
      icon: 'security',
      title: 'Secure & Private',
      description: 'Your financial data is protected with industry-standard security measures.'
    },
    {
      icon: 'cloud',
      title: 'Cloud Sync',
      description: 'Sync your data across all your devices with ease.'
    }
  ];

  howItWorks = [
    {
      step: 1,
      title: 'Download & Sign Up',
      description: 'Get the app from App Store or Play Store and create your account in seconds.',
      icon: 'smartphone'
    },
    {
      step: 2,
      title: 'Set Your Goals',
      description: 'Define your financial goals and create personalized budgets.',
      icon: 'flag'
    },
    {
      step: 3,
      title: 'Track & Grow',
      description: 'Monitor your progress and watch your savings grow with smart insights.',
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
      title: 'Dashboard Overview',
      description: 'Get a complete view of your finances at a glance',
      image: 'assets/images/screenshot/dashboard.png'
    },
    {
      title: 'Smart Analytics',
      description: 'Beautiful charts and insights to understand your spending',
      image: 'assets/images/screenshot/analytics.png'
    },
    {
      title: 'Goal Tracking',
      description: 'Set and track your financial goals with visual progress',
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