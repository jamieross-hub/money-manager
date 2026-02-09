import { Component } from '@angular/core';

import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-privacy-policy',
  templateUrl: './privacy-policy.component.html',
  styleUrls: ['./privacy-policy.component.scss'],
  standalone: true,
  imports: [CommonModule, MatIconModule]
})
export class PrivacyPolicyComponent {

  lastUpdated = 'December 2024';

  navigateBack() {
    window.history.back();
  }
} 