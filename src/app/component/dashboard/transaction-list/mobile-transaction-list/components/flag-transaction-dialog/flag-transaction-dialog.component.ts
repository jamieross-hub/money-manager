import { Component, Inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

export interface FlagDialogData {
  title: string;
  message: string;
  comment: string;
  isUpdate: boolean;
}

@Component({
  selector: 'app-flag-transaction-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    TranslateModule
  ],
  templateUrl: './flag-transaction-dialog.component.html',
  styleUrls: ['./flag-transaction-dialog.component.scss']
})
export class FlagTransactionDialogComponent {
  public comment = '';

  constructor(
    public dialogRef: MatDialogRef<FlagTransactionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FlagDialogData
  ) {
    this.comment = data.comment || '';
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onRemove(): void {
    this.dialogRef.close(null);
  }

  onConfirm(): void {
    if (this.comment.trim()) {
      this.dialogRef.close(this.comment.trim());
    }
  }
}
