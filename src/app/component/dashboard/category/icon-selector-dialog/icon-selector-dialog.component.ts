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
import { CATEGORY_ICONS } from 'src/app/util/config/config';
import { IconModule } from 'src/app/util/icon.module';

export interface IconSelectorDialogData {
  currentIcon: string;
  availableIcons: string[];
}

@Component({
  selector: 'app-icon-selector-dialog',
  templateUrl: './icon-selector-dialog.component.html',
  styleUrls: ['./icon-selector-dialog.component.scss'],
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
export class IconSelectorDialogComponent implements OnInit {
  public availableIcons: string[] = CATEGORY_ICONS;
  public selectedIcon: string;
  public searchTerm: string = '';
  public filteredIcons: string[] = [];

  constructor(
    public bottomSheetRef: MatBottomSheetRef<IconSelectorDialogComponent>,
    @Inject(MAT_BOTTOM_SHEET_DATA) public data: IconSelectorDialogData
  ) {
    this.selectedIcon = data.currentIcon || 'category';
    this.filteredIcons = [...this.availableIcons];
  }

  ngOnInit(): void {
    if (this.data.availableIcons) {
      this.availableIcons = this.data.availableIcons;
      this.filteredIcons = [...this.availableIcons];
    }
  }

  public selectIcon(icon: string): void {
    this.selectedIcon = icon;
    this.bottomSheetRef.dismiss(icon);
  }

  public onSearchChange(): void {
    if (!this.searchTerm.trim()) {
      this.filteredIcons = [...this.availableIcons];
    } else {
      this.filteredIcons = this.availableIcons.filter(icon =>
        icon.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }
  }

  public clearSearch(): void {
    this.searchTerm = '';
    this.filteredIcons = [...this.availableIcons];
  }

  public onCancel(): void {
    this.bottomSheetRef.dismiss();
  }

  public trackByIcon(index: number, icon: string): string {
    return icon;
  }
}
