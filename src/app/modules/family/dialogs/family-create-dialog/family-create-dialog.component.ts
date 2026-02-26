import { Component, inject, ChangeDetectionStrategy, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatBottomSheetRef, MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CommonModule } from '@angular/common';
import { CreateFamilyRequest } from 'src/app/util/models/family.model';

export const GROUP_ICON_OPTIONS: { icon: string; label: string }[] = [
  { icon: 'family_restroom', label: 'Family' },
  { icon: 'home',            label: 'Home' },
  { icon: 'work',            label: 'Work' },
  { icon: 'handshake',      label: 'Partners' },
  { icon: 'favorite',       label: 'Loved Ones' },
  { icon: 'school',         label: 'Education' },
  { icon: 'travel_explore', label: 'Travel' },
  { icon: 'savings',        label: 'Savings' },
  { icon: 'sports_soccer',  label: 'Sports' },
  { icon: 'celebration',    label: 'Events' },
];

@Component({
  selector: 'app-family-create-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatBottomSheetModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatTooltipModule,
  ],
  templateUrl: './family-create-dialog.component.html',
  styleUrls: ['./family-create-dialog.component.scss']
})
export class FamilyCreateDialogComponent {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<FamilyCreateDialogComponent>, { optional: true });
  private bottomSheetRef = inject(MatBottomSheetRef<FamilyCreateDialogComponent>, { optional: true });

  readonly iconOptions = GROUP_ICON_OPTIONS;

  /** Currently selected icon – either an emoji from the preset list or a Data URL from file upload */
  selectedIcon = signal<string>('family_restroom');

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    mode: ['common', Validators.required],
  });

  selectIcon(icon: string): void {
    this.selectedIcon.set(icon);
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      this.selectedIcon.set(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  get isImageIcon(): boolean {
    return this.selectedIcon().startsWith('data:');
  }

  submit() {
    if (this.form.valid) {
      const data: CreateFamilyRequest = {
        ...(this.form.value as { name: string; mode: 'common' | 'split' }),
        icon: this.selectedIcon(),
      };
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
