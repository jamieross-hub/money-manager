import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-auto-sync',
  templateUrl: './auto-sync.component.html',
  styleUrls: ['./auto-sync.component.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    MatIconModule, 
    MatButtonModule, 
    TranslateModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AutoSyncComponent {
  constructor() {}
}
