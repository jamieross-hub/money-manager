import { Component, inject, ChangeDetectionStrategy, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatBottomSheetRef, MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { CreateFamilyRequest } from 'src/app/util/models/family.model';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MobileBackButtonService } from 'src/app/util/service/mobile-back-button.service';
import { ImageFallbackDirective } from 'src/app/util/directives/image-fallback.directive';

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
    ReactiveFormsModule,
    MatDialogModule,
    MatBottomSheetModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    ImageFallbackDirective
],
  templateUrl: './family-create-dialog.component.html',
  styleUrls: ['./family-create-dialog.component.scss']
})
export class FamilyCreateDialogComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<FamilyCreateDialogComponent>, { optional: true });
  private bottomSheetRef = inject(MatBottomSheetRef<FamilyCreateDialogComponent>, { optional: true });
  public data = inject(MAT_DIALOG_DATA, { optional: true });
  private mobileBackButtonService = inject(MobileBackButtonService);

  readonly iconOptions = GROUP_ICON_OPTIONS;

  isEditMode = computed(() => !!this.data?.family);
  
  /** Currently selected icon – either an emoji from the preset list or a Data URL from file upload */
  selectedIcon = signal<string>('family_restroom');
  selectedOption = computed(() => this.iconOptions.find(opt => opt.icon === this.selectedIcon()));
  
  loading = signal(false);

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    mode: ['common', Validators.required],
  });

  isDuplicateName = computed(() => {
    const newName = this.form.get('name')?.value?.toLowerCase().trim();
    const existing = (this.data as any)?.existingNames as string[];
    const currentName = this.data?.family?.name?.toLowerCase().trim();
    
    if (!newName || !existing) return false;
    // In edit mode, ignore the current name as a duplicate
    if (this.isEditMode() && newName === currentName) return false;
    
    return existing.some(n => n.toLowerCase().trim() === newName);
  });

  ngOnInit() {
    const ref = this.bottomSheetRef || this.dialogRef;
    if (ref) {
      this.mobileBackButtonService.openModal('family-create', ref);
    }
    
    if (this.isEditMode()) {
      const family = this.data.family;
      this.form.patchValue({
        name: family.name,
        mode: family.mode || 'common'
      });
      if (family.icon) {
        this.selectedIcon.set(family.icon);
      }
      
      // Optionally disable changing the mode if transactions already exist
      // Since it's complex to check, we might want to warn or let the backend handle it
      // this.form.get('mode')?.disable(); // Or keep it enabled
    }
  }

  ngOnDestroy() {
  }

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
    if (this.form.valid && !this.loading()) {
      this.loading.set(true);
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
