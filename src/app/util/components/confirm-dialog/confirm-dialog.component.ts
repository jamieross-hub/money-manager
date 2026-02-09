import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  type: 'delete' | 'warning' | 'info';
}

@Component({
  selector: 'confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatDialogModule],
  template: `
    <div class="confirm-dialog">
      <div class="dialog-header">
        <mat-icon class="dialog-icon" [class.delete]="data.type === 'delete'">
          {{ data.type === 'delete' ? 'delete_forever' : 'warning' }}
        </mat-icon>
        <h2 class="dialog-title">{{ data.title }}</h2>
      </div>
      
      <div class="dialog-content">
        <p class="dialog-message">{{ data.message }}</p>
      </div>
      
      <div class="dialog-actions">
        <button mat-button 
                (click)="onCancel()" 
                class="cancel-button">
          {{ data.cancelText }}
        </button>
        <button mat-raised-button 
                [color]="data.type === 'delete' ? 'warn' : 'primary'"
                (click)="onConfirm()" 
                class="confirm-button">
          {{ data.confirmText }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .confirm-dialog {
      padding: 1rem;
    }
    
    .dialog-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
      
      .dialog-icon {
        font-size: 2rem;
        width: 2rem;
        height: 2rem;
        color: #6b7280;
        
        &.delete {
          color: #dc2626;
        }
      }
      
      .dialog-title {
        font-size: 1.25rem;
        font-weight: 600;
        color: #1f2937;
        margin: 0;
      }
    }
    
    .dialog-content {
      margin-bottom: 1.5rem;
      
      .dialog-message {
        color: #6b7280;
        font-size: 1rem;
        line-height: 1.5;
        margin: 0;
      }
    }
    
    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      
      .cancel-button {
        color: #6b7280;
      }
      
      .confirm-button {
        font-weight: 500;
      }
    }
  `]
})
export class ConfirmDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData
  ) { }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
} 