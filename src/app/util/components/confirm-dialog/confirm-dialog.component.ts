import { Component, Inject , ChangeDetectionStrategy} from '@angular/core';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  type: 'delete' | 'warning' | 'info';
  confirmColor?: 'primary' | 'warn' | 'accent';
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
  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    // Set defaults if not provided
    this.data = {
      title: data.title || 'Confirm',
      message: data.message || 'Are you sure?',
      confirmText: data.confirmText || 'Confirm',
      cancelText: data.cancelText || 'Cancel',
      type: data.type || 'warning',
      confirmColor: data.confirmColor || (data.type === 'delete' ? 'warn' : 'primary')
    };
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
} 