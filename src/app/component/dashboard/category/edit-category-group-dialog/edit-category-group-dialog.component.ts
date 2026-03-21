import { Component, Inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatBottomSheet, MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { IconSelectorDialogComponent } from '../icon-selector-dialog/icon-selector-dialog.component';
import { NotificationService } from 'src/app/util/service/notification.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-edit-category-group-dialog',
  templateUrl: './edit-category-group-dialog.component.html',
  styleUrls: ['./edit-category-group-dialog.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatBottomSheetModule
  ]
})
export class EditCategoryGroupDialogComponent implements OnInit {
  groupForm: FormGroup;
  public groupIcon = signal<string>('category');

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { groupName: string, groupIcon?: string },
    private dialogRef: MatDialogRef<EditCategoryGroupDialogComponent>,
    private fb: FormBuilder,
    private bottomSheet: MatBottomSheet,
    private notificationService: NotificationService
  ) {
    this.groupForm = this.fb.group({
      groupName: [data.groupName || '', [Validators.required, Validators.maxLength(30)]]
    });
    if (data.groupIcon) {
      this.groupIcon.set(data.groupIcon);
    }
  }

  ngOnInit(): void {}

  openIconSelector(): void {
    this.bottomSheet
      .open(IconSelectorDialogComponent, {
        data: {
          currentIcon: this.groupIcon(),
        },
      })
      .afterDismissed()
      .subscribe((selectedIcon: string) => {
        if (selectedIcon) {
          this.groupIcon.set(selectedIcon);
          this.notificationService.lightVibration();
        }
      });
  }

  onSubmit(): void {
    if (this.groupForm.invalid) return;
    const value = this.groupForm.value;
    this.dialogRef.close({
      action: 'save',
      groupName: value.groupName.trim(),
      groupIcon: this.groupIcon()
    });
  }

  onDelete(): void {
    this.dialogRef.close({
      action: 'delete'
    });
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }
}
