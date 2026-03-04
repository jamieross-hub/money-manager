import { Component, OnInit, OnDestroy , ChangeDetectionStrategy} from '@angular/core';

import { Subscription } from 'rxjs';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { CommonSyncService, NetworkStatus } from '../../service/common-sync.service';
import { NotificationService } from '../../service/notification.service';
import { UserService } from '../../service/db/user.service';
import { APP_CONFIG } from '../../config/config';

@Component({
  selector: 'app-offline-indicator',
  templateUrl: './offline-indicator.component.html',
  styleUrls: ['./offline-indicator.component.scss'],
  standalone: true,
  imports: [],
  animations: [
    trigger('slideDown', [
      state('void', style({
        transform: 'translateY(-100%)',
        opacity: 0
      })),
      state('*', style({
        transform: 'translateY(0)',
        opacity: 1
      })),
      transition('void => *', [
        animate('0.3s ease-out')
      ]),
      transition('* => void', [
        animate('0.2s ease-in')
      ])
    ])
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OfflineIndicatorComponent implements OnInit, OnDestroy {
  isOnline = true;
  showOnlineBanner = false;
  isGuest = false;
  private subscriptions: Subscription[] = [];

  constructor(
    private commonSyncService: CommonSyncService,
    private notificationService: NotificationService,
    private userService: UserService
  ) { }

  ngOnInit(): void {
    // Check initial guest state from local storage to avoid flash
    const isGuestStored = this.userService.isGuestModeEnabled();
    if (isGuestStored) {
      this.isGuest = true;
    }

    // Subscribe to user changes to check for guest mode
    this.subscriptions.push(
      this.userService.userAuth$.subscribe(user => {
        this.isGuest = user?.uid === 'offline-guest';
      })
    );

    // Subscribe to network status changes
    this.subscriptions.push(
      this.commonSyncService.networkStatus$.subscribe(status => {
        const wasOnline = this.isOnline;
        this.isOnline = status.online;

        if (!this.isOnline && !this.isGuest) {
          console.log('App is running in offline mode.');
        }

        // Show online banner when connection is restored
        if (!wasOnline && this.isOnline && !this.isGuest) {
          this.showOnlineBanner = true;
          console.log('Online mode restored. Syncing data...');
          setTimeout(() => {
            this.showOnlineBanner = false;
          }, APP_CONFIG.NOTIFICATIONS.AUTO_HIDE_DELAY); // Use config duration
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  dismissOfflineBanner(): void {
    // This will be handled by the service
  }

  dismissOnlineBanner(): void {
    this.showOnlineBanner = false;
  }


} 