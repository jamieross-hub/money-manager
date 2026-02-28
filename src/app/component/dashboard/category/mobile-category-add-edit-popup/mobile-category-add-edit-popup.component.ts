import { Component, Inject, OnDestroy, OnInit, ChangeDetectionStrategy, signal, computed, Signal } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { UserService } from 'src/app/util/service/db/user.service';
import { FormBuilder, FormControl, FormGroup, Validators, ReactiveFormsModule, FormsModule, AbstractControl } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogRef,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatBottomSheet, MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { Router } from '@angular/router';
import { HapticFeedbackService } from 'src/app/util/service/haptic-feedback.service';
import { NotificationService } from 'src/app/util/service/notification.service';
import { ValidationService } from 'src/app/util/service/validation.service';

import { IconSelectorDialogComponent } from '../icon-selector-dialog/icon-selector-dialog.component';
import { ColorSelectorDialogComponent } from '../color-selector-dialog/color-selector-dialog.component';
import { AppState } from 'src/app/store/app.state';
import { Store } from '@ngrx/store';
import { createCategory, updateCategory } from 'src/app/store/categories/categories.actions';

import { SsrService } from 'src/app/util/service/ssr.service';
import { Category } from 'src/app/util/models';
import { selectAllCategories } from 'src/app/store/categories/categories.selectors';
import { takeUntil, Observable, of } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';
import { CATEGORY_ICONS, CATEGORY_COLORS, CategoryIcon } from 'src/app/util/config/config';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatNativeDateModule, MatOptionModule } from '@angular/material/core';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { CommonHeaderComponent } from 'src/app/util/components/dialog/common-header/common-header.component';
import { CommonBodyContentComponent } from 'src/app/util/components/dialog/common-body-content/common-body-content.component';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSortModule } from '@angular/material/sort';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { toSignal } from '@angular/core/rxjs-interop';
import { APP_CONFIG } from 'src/app/util/config/config';

@Component({
  selector: 'app-mobile-category-add-edit-popup',
  templateUrl: './mobile-category-add-edit-popup.component.html',
  styleUrls: ['./mobile-category-add-edit-popup.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    TranslateModule,
    CommonHeaderComponent,
    CommonBodyContentComponent,

    // Material Modules
    MatCardModule,
    MatListModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSidenavModule,
    MatFormFieldModule,
    MatSelectModule,
    MatMenuModule,
    MatToolbarModule,
    MatButtonToggleModule,
    MatInputModule,
    MatDialogModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatTabsModule,
    MatCheckboxModule,
    MatTooltipModule,
    MatSlideToggleModule,
    MatAutocompleteModule,
    MatExpansionModule,
    MatDividerModule,
    MatChipsModule,
    MatSnackBarModule,
    MatSliderModule,
    MatStepperModule,
    MatBottomSheetModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MobileCategoryAddEditPopupComponent implements OnInit {
  categoryForm: FormGroup;
  public isSubmitting = signal<boolean>(false);
  public userId = signal<string>('');
  
  public allCategories = toSignal(this.store.select(selectAllCategories), { initialValue: [] as Category[] });
  public existingGroups = computed(() => [...new Set(this.allCategories().map(c => c.group).filter(g => !!g))] as string[]);
  
  public availableIcons = signal(CATEGORY_ICONS);
  public iconFilterCtrl = new FormControl('');
  public filteredIcons!: Signal<CategoryIcon[]>;

  public availableColors = signal(CATEGORY_COLORS);
  public colorFilterCtrl = new FormControl('');
  public filteredColors!: Signal<{ label: string; value: string }[]>;

  public filteredGroups!: Signal<string[]>;

  public colorValue!: Signal<string>;
  public iconValue!: Signal<string>;




  constructor(
    @Inject(MAT_DIALOG_DATA) public dialogData: { category: Category, isEdit: boolean, allCategories: Category[] } | null,
    private store: Store<AppState>,
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<MobileCategoryAddEditPopupComponent>,
    private auth: Auth,
    private notificationService: NotificationService,
    private router: Router,
    private hapticFeedback: HapticFeedbackService,
    private dialog: MatDialog,
    private bottomSheet: MatBottomSheet,
    public breakpointService: BreakpointService,
    private validationService: ValidationService,
    private ssrService: SsrService,
    private userService: UserService
  ) {
    this.categoryForm = this.fb.group({
      name: ['', [
        ...this.validationService.getCategoryNameValidators(),
        (control: AbstractControl) => {
          const val = control.value?.trim().toLowerCase();
          const reservedNames = APP_CONFIG.VALIDATION.RESERVED_CATEGORY_NAMES;
          if (val && val in reservedNames) {
            return { reserved: true };
          }
          return null;
        }
      ]],
      type: ['expense', Validators.required],
      icon: ['category', Validators.required],
      color: ['#10B981', Validators.required],
      group: [''], 
    });

    const iconSearchValue = toSignal(this.iconFilterCtrl.valueChanges.pipe(startWith('')), { initialValue: '' });
    this.filteredIcons = computed(() => this._filterIcons(iconSearchValue() || ''));

    const colorSearchValue = toSignal(this.colorFilterCtrl.valueChanges.pipe(startWith('')), { initialValue: '' });
    this.filteredColors = computed(() => this._filterColors(colorSearchValue() || ''));

    const groupSearchValue = toSignal(this.categoryForm.controls['group'].valueChanges.pipe(startWith('')), { initialValue: '' });
    this.filteredGroups = computed(() => this._filterGroups(groupSearchValue() || ''));

    this.colorValue = toSignal(this.categoryForm.controls['color'].valueChanges.pipe(startWith(this.categoryForm.controls['color'].value)), { initialValue: this.categoryForm.controls['color'].value });
    this.iconValue = toSignal(this.categoryForm.controls['icon'].valueChanges.pipe(startWith(this.categoryForm.controls['icon'].value)), { initialValue: this.categoryForm.controls['icon'].value });
  }



  ngOnInit(): void {
    this.userId.set(this.userService.getCurrentUserId() || '');

    if (this.ssrService.isClientSide()) {
      window.addEventListener('popstate', (event) => {
        this.dialogRef.close();
        event.preventDefault();
      });
    }

    if (this.dialogData) {
      this.categoryForm.patchValue({
        name: this.dialogData.category?.name || '',
        type: this.dialogData.category?.type || 'expense',
        icon: this.dialogData.category?.icon || 'category',
        color: (this.dialogData.category?.color || '#10B981').toUpperCase(),
        group: this.dialogData.category?.group || '',
      });
    }
  }

  async onSubmit(): Promise<void> {
    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      this.notificationService.error('Please fix the errors in the form before saving');
      return;
    }

    if (this.isSubmitting() || this.isCategoryPresent()) return;
    this.isSubmitting.set(true);

    try {
      const formValue = this.categoryForm.value;

      if (this.dialogData?.category?.id) {
        await this.store.dispatch(
          updateCategory({
            userId: this.userId(),
            categoryId: this.dialogData.category.id,
            name: formValue.name.trim(),
            categoryType: formValue.type,
            icon: formValue.icon,
            color: formValue.color,
            group: formValue.group?.trim() || '',
          })
        );
        this.notificationService.success('Category updated successfully');
      } else {
        await this.store.dispatch(
          createCategory({
            userId: this.userId(),
            name: formValue.name.trim(),
            categoryType: formValue.type,
            icon: formValue.icon,
            color: formValue.color,
            group: formValue.group?.trim() || undefined,
          })
        );
        this.notificationService.success('Category added successfully');
        this.hapticFeedback.successVibration();
      }

      this.dialogRef.close(formValue);
    } catch (error) {
      this.notificationService.error('Failed to save category');
      console.error('Error saving category:', error);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  selectType(type: any): void {
    this.categoryForm.patchValue({ type });
  }

  getNameError(): string {
    const control = this.categoryForm.get('name');
    if (control?.hasError('reserved')) {
      const val = control.value?.trim().toLowerCase();
      const reservedNames = APP_CONFIG.VALIDATION.RESERVED_CATEGORY_NAMES;
      const originalName = control.value?.trim();
      
      if (val && val in reservedNames) {
        return `'${originalName}' ${reservedNames[val as keyof typeof reservedNames]}`;
      }
    }
    return control ? this.validationService.getCategoryNameError(control) : '';
  }

  getTypeError(): string {
    const typeControl = this.categoryForm.get('type');
    if (typeControl?.hasError('required')) {
      return 'Category type is required';
    }
    return '';
  }

  openIconSelectorDialog(): void {
    this.bottomSheet
      .open(IconSelectorDialogComponent, {
        data: {
          currentIcon: this.categoryForm.get('icon')?.value,
        },
      })
      .afterDismissed()
      .subscribe((selectedIcon: string) => {
        if (selectedIcon) {
          this.categoryForm.patchValue({ icon: selectedIcon });
          this.hapticFeedback.lightVibration();
        }
      });
  }

  openColorSelectorDialog(): void {
    this.bottomSheet
      .open(ColorSelectorDialogComponent, {
        data: {
          currentColor: this.categoryForm.get('color')?.value,
        },
      })
      .afterDismissed()
      .subscribe((selectedColor: string) => {
        if (selectedColor) {
          this.categoryForm.patchValue({ color: selectedColor.toUpperCase() });
          this.hapticFeedback.lightVibration();
        }
      });
  }

  private _filterGroups(value: string): string[] {
    const filterValue = value.toLowerCase();
    return this.existingGroups().filter((group: string) => group.toLowerCase().includes(filterValue));
  }

  private _filterIcons(value: string): CategoryIcon[] {
    const filterValue = value.toLowerCase();
    return this.availableIcons().filter((item: CategoryIcon) =>
      item.name.toLowerCase().includes(filterValue) ||
      item.icon.toLowerCase().includes(filterValue)
    );
  }

  private _filterColors(value: string): { label: string; value: string }[] {
    const filterValue = value.toLowerCase();
    return this.availableColors().filter((color: { label: string; value: string }) => color.label.toLowerCase().includes(filterValue));
  }

  getColorLabel(value: string): string {
    if (!value) return '';
    const color = this.availableColors().find(c => c.value.toUpperCase() === value.toUpperCase());
    return color ? color.label : value;
  }

  getIconName(value: string): string {
    if (!value) return 'Category';
    const found = this.availableIcons().find((item: CategoryIcon) => item.icon === value);
    return found ? found.name : value.replace(/_/g, ' ');
  }

  isCategoryPresent(): boolean {
    let existingCategory = this.allCategories().find((category: Category) => category.name.trim().toLowerCase() === this.categoryForm.get('name')?.value.trim().toLowerCase());
    if (this.dialogData?.category?.id) {
      existingCategory = this.allCategories().find((category: Category) => category.name.trim().toLowerCase() === this.categoryForm.get('name')?.value.trim().toLowerCase() && category.id !== this.dialogData?.category?.id);
    }
    if (existingCategory) {
      this.notificationService.error('Category already exists');
    }
    return !!existingCategory;
  }
}

