import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit , ChangeDetectionStrategy} from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetModule, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatRippleModule } from '@angular/material/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSortModule } from '@angular/material/sort';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CATEGORY_COLORS } from 'src/app/util/config/config';
import { IconModule } from 'src/app/util/icon.module';

export interface ColorSelectorDialogData {
  currentColor: string;
  availableColors: string[];
}

@Component({
  selector: 'app-color-selector-dialog',
  templateUrl: './color-selector-dialog.component.html',
  styleUrls: ['./color-selector-dialog.component.scss'],
  standalone: true,
  imports: [
    MatBottomSheetModule,
    MatIconModule,
    MatInputModule,
    MatButtonModule,
    MatFormFieldModule,
    FormsModule,
    ReactiveFormsModule,
    CommonModule,
    IconModule,
    MatTooltipModule,
    MatDividerModule,
    MatListModule,
    MatRippleModule,
    MatTabsModule,
    MatCardModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    MatAutocompleteModule,
    MatExpansionModule,
    MatChipsModule,
    MatSnackBarModule,
    MatSliderModule,
    MatStepperModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ColorSelectorDialogComponent implements OnInit {
  public availableColors: { label: string; value: string }[] = CATEGORY_COLORS;
  public selectedColor: string;
  public searchTerm: string = '';
  public filteredColors: { label: string; value: string }[] = [];

  constructor(
    public bottomSheetRef: MatBottomSheetRef<ColorSelectorDialogComponent>,
    @Inject(MAT_BOTTOM_SHEET_DATA) public data: ColorSelectorDialogData
  ) {
    this.selectedColor = (data.currentColor || '#10B981').toUpperCase();
    this.filteredColors = [...this.availableColors];
  }

  ngOnInit(): void {

  }

  public selectColor(color: string): void {
    this.selectedColor = color;
    this.bottomSheetRef.dismiss(color);
  }

  public onSearchChange(): void {
    if (!this.searchTerm.trim()) {
      this.filteredColors = [...this.availableColors];
    } else {
      this.filteredColors = this.availableColors.filter(color =>
        color.label.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }
  }

  public clearSearch(): void {
    this.searchTerm = '';
    this.filteredColors = [...this.availableColors];
  }

  public onCancel(): void {
    this.bottomSheetRef.dismiss();
  }

  public trackByColor(index: number, color: { label: string; value: string }): string {
    return color.value;
  }
} 