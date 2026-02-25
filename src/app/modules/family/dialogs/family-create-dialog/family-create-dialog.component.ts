import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatBottomSheetRef, MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { CreateFamilyRequest } from 'src/app/util/models/family.model';

@Component({
  selector: 'app-family-create-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatBottomSheetModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatIconModule],
  templateUrl: './family-create-dialog.component.html',
  styleUrls: ['./family-create-dialog.component.scss']
})
export class FamilyCreateDialogComponent {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<FamilyCreateDialogComponent>, { optional: true });
  private bottomSheetRef = inject(MatBottomSheetRef<FamilyCreateDialogComponent>, { optional: true });

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    currency: ['INR', Validators.required],
  });

  submit() {
    if (this.form.valid) {
      const data = this.form.value as CreateFamilyRequest;
      if (this.bottomSheetRef) {
        this.bottomSheetRef.dismiss(data);
      } else {
        this.dialogRef?.close(data);
      }
    }
  }

  close() {
    if (this.bottomSheetRef) {
      this.bottomSheetRef.dismiss();
    } else {
      this.dialogRef?.close();
    }
  }
}
