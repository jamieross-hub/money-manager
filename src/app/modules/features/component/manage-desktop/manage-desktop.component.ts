import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { NotificationService } from '../../../../util/service/notification.service';
import { APP_CONFIG } from '../../../../util/config/config';

@Component({
  selector: 'app-manage-desktop',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatTooltipModule,
    RouterModule
  ],
  templateUrl: './manage-desktop.component.html',
  styleUrls: ['./manage-desktop.component.scss']
})
export class ManageDesktopComponent {
  private notificationService = inject(NotificationService);
  
  readonly currentUrl = APP_CONFIG.WEB_APP_URL;

  copyLink() {
    navigator.clipboard.writeText(this.currentUrl).then(() => {
      this.notificationService.success('Link copied to clipboard!');
    });
  }

  shareLink() {
    if (navigator.share) {
      navigator.share({
        title: APP_CONFIG.APP_NAME,
        text: APP_CONFIG.SHARE_TEXT,
        url: this.currentUrl
      });
    } else {
      this.copyLink();
    }
  }
}
