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
  template: `
    <div class="flag-dialog">
      <div class="dialog-header">
        <mat-icon color="warn">flag</mat-icon>
        <h2 mat-dialog-title>{{ data.title }}</h2>
      </div>
      
      <mat-dialog-content>
        <p class="dialog-description">{{ data.message }}</p>
        
        <mat-form-field appearance="fill" class="w-full mt-4">
          <mat-label>Reason / Comment</mat-label>
          <textarea 
            matInput 
            [(ngModel)]="comment" 
            placeholder="e.g., Wrong amount, wrong category..." 
            rows="4"
            maxlength="200"
          ></textarea>
          <mat-hint align="end">{{ comment.length }}/200</mat-hint>
        </mat-form-field>
      </mat-dialog-content>
      
      <mat-dialog-actions>
        <button mat-button (click)="onCancel()">Cancel</button>
        <div class="flex-spacer"></div>
        <div class="actions-group">
          <button 
            *ngIf="data.isUpdate"
            mat-button 
            color="accent"
            (click)="onRemove()"
          >
            Solve/Remove
          </button>
          <button 
            mat-flat-button 
            color="warn" 
            [disabled]="!comment.trim()" 
            (click)="onConfirm()"
          >
            {{ data.isUpdate ? 'Update flag' : 'Flag Transaction' }}
          </button>
        </div>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .flag-dialog {
      padding: 16px;
      
      .dialog-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 8px;
        
        mat-icon {
          font-size: 28px;
          height: 28px;
          width: 28px;
        }
        
        h2 {
          margin: 0;
          font-weight: 700;
        }
      }
      
      .dialog-description {
        color: var(--neutral-500);
        font-size: 0.9rem;
        margin-bottom: 16px;
      }
      
      .w-full {
        width: 100%;
      }

      mat-dialog-actions {
        display: flex;
        align-items: center;
        padding: 8px 0;
        margin: 0;
        min-height: 52px;

        .flex-spacer {
          flex: 1 1 auto;
        }

        .actions-group {
          display: flex;
          gap: 8px;
          align-items: center;
        }
      }
    }
  `]
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
