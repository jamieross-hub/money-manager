import { Component, inject, ChangeDetectionStrategy, signal, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatBottomSheetRef, MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { MobileBackButtonService } from 'src/app/util/service/mobile-back-button.service';

@Component({
  selector: 'app-family-join-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatBottomSheetModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule],
  templateUrl: './family-join-dialog.component.html',
  styleUrls: ['./family-join-dialog.component.scss']
})
export class FamilyJoinDialogComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<FamilyJoinDialogComponent>, { optional: true });
  private bottomSheetRef = inject(MatBottomSheetRef<FamilyJoinDialogComponent>, { optional: true });
  private mobileBackButtonService = inject(MobileBackButtonService);

  form = this.fb.group({
    inviteCode: ['', [Validators.required, Validators.pattern(/^[A-Z0-9]{4}$/)]],
  });

  ngOnInit() {
    this.mobileBackButtonService.openModal('family-join', () => this.close());
  }

  ngOnDestroy() {
    this.mobileBackButtonService.closeModal('family-join');
  }

  onCodeInput(event: any) {
    const val: string = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    this.form.patchValue({ inviteCode: val });
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
