import { Component, Inject, OnInit } from '@angular/core';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { CATEGORY_COLORS } from 'src/app/util/config/config';

export interface ColorSelectorDialogData {
  currentColor: string;
  availableColors: string[];
}

@Component({
  selector: 'app-color-selector-dialog',
  templateUrl: './color-selector-dialog.component.html',
  styleUrls: ['./color-selector-dialog.component.scss']
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