import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
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
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatIconModule],
  templateUrl: './family-create-dialog.component.html',
  styleUrls: ['./family-create-dialog.component.scss']
})
export class FamilyCreateDialogComponent {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<FamilyCreateDialogComponent>);

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    currency: ['INR', Validators.required],
  });

  submit() {
    if (this.form.valid) {
      this.dialogRef.close(this.form.value as CreateFamilyRequest);
    }
  }

  close() {
    this.dialogRef.close();
  }
}
