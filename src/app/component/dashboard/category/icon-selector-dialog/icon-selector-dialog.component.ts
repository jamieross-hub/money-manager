import { Component, Inject, OnInit } from '@angular/core';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { CATEGORY_ICONS } from 'src/app/util/config/config';

export interface IconSelectorDialogData {
  currentIcon: string;
  availableIcons: string[];
}

@Component({
  selector: 'app-icon-selector-dialog',
  templateUrl: './icon-selector-dialog.component.html',
  styleUrls: ['./icon-selector-dialog.component.scss']
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
