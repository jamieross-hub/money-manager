import { Component , ChangeDetectionStrategy} from '@angular/core';

import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-pre-footer',
  templateUrl: './pre-footer.component.html',
  styleUrls: ['./pre-footer.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PreFooterComponent {
  currentYear = new Date().getFullYear();
}
