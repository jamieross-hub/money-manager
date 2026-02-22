import { Component, inject, ChangeDetectionStrategy, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-family-join-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule],
  templateUrl: './family-join-dialog.component.html',
  styleUrls: ['./family-join-dialog.component.scss']
})
export class FamilyJoinDialogComponent {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<FamilyJoinDialogComponent>);

  form = this.fb.group({
    inviteCode: ['', [Validators.required, Validators.pattern(/^FAM-[A-Z0-9]{4}$/)]],
  });

  onCodeInput(event: any) {
    const val: string = event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    this.form.get('inviteCode')?.setValue(val, { emitEvent: false });
  }

  submit() {
    if (this.form.valid) {
      this.dialogRef.close(this.form.value.inviteCode);
    }
  }

  close() {
    this.dialogRef.close();
  }
}
