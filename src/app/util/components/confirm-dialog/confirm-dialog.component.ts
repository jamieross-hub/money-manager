import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  type: 'delete' | 'warning' | 'info';
  confirmColor?: 'primary' | 'warn' | 'accent';
  /** Optional Material Icon name (e.g. 'system_update') rendered as the dialog icon */
  icon?: string;
  imageUrl?: string;
  design?: 'standard' | 'premium' | 'welcome';
}

@Component({
  selector: 'confirm-dialog',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, MatDialogModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConfirmDialogComponent {
  safeMessage: SafeHtml;

  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private sanitizer: DomSanitizer
  ) {
    // Set defaults if not provided
    this.data = {
      title: data.title || 'Confirm',
      message: data.message || 'Are you sure?',
      confirmText: data.confirmText || 'Confirm',
      cancelText: data.cancelText,
      type: data.type || 'warning',
      confirmColor: data.confirmColor || (data.type === 'delete' ? 'warn' : 'primary'),
      icon: data.icon,
      imageUrl: data.imageUrl,
      design: data.design || 'standard'
    };

    // Sanitize message for safe HTML rendering
    this.safeMessage = this.sanitizer.bypassSecurityTrustHtml(this.data.message);
  }
}