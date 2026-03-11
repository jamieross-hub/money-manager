import { Component, Inject, ChangeDetectionStrategy, signal, computed } from '@angular/core';
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
import { CATEGORY_ICONS, CategoryIcon } from 'src/app/util/config/config';
import { IconModule } from 'src/app/util/icon.module';


export interface IconSelectorDialogData {
  currentIcon: string;
  availableIcons: CategoryIcon[];
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
    MatSortModule
],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IconSelectorDialogComponent {
  public availableIcons = signal<CategoryIcon[]>(CATEGORY_ICONS);
  public selectedIcon = signal<string>('category');
  public searchTerm = signal<string>('');
  
  public groupedIcons = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const icons = this.availableIcons();
    const filtered = !term ? icons : icons.filter(item =>
      item.name.toLowerCase().includes(term) ||
      item.icon.toLowerCase().includes(term) ||
      item.group?.toLowerCase().includes(term)
    );

    const groups: { name: string, icons: CategoryIcon[] }[] = [];
    const groupMap = new Map<string, CategoryIcon[]>();

    filtered.forEach(icon => {
      const groupName = icon.group || 'Other';
      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, []);
        groups.push({ name: groupName, icons: groupMap.get(groupName)! });
      }
      groupMap.get(groupName)!.push(icon);
    });

    return groups;
  });

  public hasNoIcons = computed(() => this.groupedIcons().length === 0);

  constructor(
    public bottomSheetRef: MatBottomSheetRef<IconSelectorDialogComponent>,
    @Inject(MAT_BOTTOM_SHEET_DATA) public data: IconSelectorDialogData
  ) {
    if (data.availableIcons) {
      this.availableIcons.set(data.availableIcons);
    }
    if (data.currentIcon) {
      this.selectedIcon.set(data.currentIcon);
    }
  }

  public selectIcon(icon: string): void {
    this.selectedIcon.set(icon);
    this.bottomSheetRef.dismiss(icon);
  }

  public clearSearch(): void {
    this.searchTerm.set('');
  }

  public onCancel(): void {
    this.bottomSheetRef.dismiss();
  }

  public trackByIcon(index: number, item: CategoryIcon): string {
    return item.icon;
  }
}

