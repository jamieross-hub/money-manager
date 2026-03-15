import { Component, inject, ChangeDetectionStrategy, signal, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatBottomSheetRef, MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';



@Component({
  selector: 'app-family-join-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatDialogModule, MatBottomSheetModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule],
  templateUrl: './family-join-dialog.component.html',
  styleUrls: ['./family-join-dialog.component.scss']
})
export class FamilyJoinDialogComponent implements OnDestroy {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<FamilyJoinDialogComponent>, { optional: true });
  private bottomSheetRef = inject(MatBottomSheetRef<FamilyJoinDialogComponent>, { optional: true });


  form = this.fb.group({
    inviteCode: ['', [Validators.required, Validators.pattern(/^[A-Z0-9]{4}$/)]],
  });



  ngOnDestroy() {
  }

  onCodeInput(event: any) {
    const input = event.target as HTMLInputElement;
    let val = input.value.toUpperCase();
    
    // Automatically handle full codes if pasted (strip 'FAM-' or 'FAM' prefix)
    if (val.startsWith('FAM-')) {
      val = val.substring(4);
    } else if (val.startsWith('FAM') && val.length > 4) {
      val = val.substring(3);
    }

    const transformedVal = val.replace(/[^A-Z0-9]/g, '').slice(0, 4);
    
    // Only update DOM if the transformed value is different from raw input
    if (input.value !== transformedVal) {
      const selectionStart = input.selectionStart;
      const selectionEnd = input.selectionEnd;
      input.value = transformedVal;
      // Restore cursor position if possible
      if (selectionStart !== null && selectionEnd !== null) {
        input.setSelectionRange(selectionStart, selectionEnd);
      }
    }
    
    // Sync with form control
    this.form.get('inviteCode')?.setValue(transformedVal, { emitEvent: false });
  }

  submit() {
    if (this.form.valid) {
      const code = 'FAM-' + this.form.value.inviteCode;
      if (this.bottomSheetRef) {
        this.bottomSheetRef.dismiss(code);
      } else {
        this.dialogRef?.close(code);
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
