import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';

import { ClipboardModule } from '@angular/cdk/clipboard';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Clipboard } from '@angular/cdk/clipboard';

@Component({
  selector: 'app-auto-sync',
  templateUrl: './auto-sync.component.html',
  styleUrls: ['./auto-sync.component.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    MatIconModule, 
    MatButtonModule, 
    TranslateModule,
    ClipboardModule,
    MatSnackBarModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AutoSyncComponent {
  readonly forwardingEmail = 'familyexpensetracker.noreply@gmail.com';

  constructor(
    private clipboard: Clipboard,
    private snackBar: MatSnackBar
  ) {}

  copyEmail() {
    this.clipboard.copy(this.forwardingEmail);
    this.snackBar.open('Email copied to clipboard!', 'Close', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
  }
}
