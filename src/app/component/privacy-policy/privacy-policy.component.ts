import { Component , ChangeDetectionStrategy} from '@angular/core';


import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-privacy-policy',
  templateUrl: './privacy-policy.component.html',
  styleUrls: ['./privacy-policy.component.scss'],
  standalone: true,
  imports: [MatIconModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PrivacyPolicyComponent {

  lastUpdated = 'December 2024';

  navigateBack() {
    window.history.back();
  }
} 