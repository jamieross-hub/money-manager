import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { Category } from '../../../../util/models';
import { CommonHeaderComponent } from 'src/app/util/components/dialog/common-header/common-header.component';
import { CommonBodyContentComponent } from 'src/app/util/components/dialog/common-body-content/common-body-content.component';

export interface ParentCategorySelectorData {
  title: string;
  message: string;
  categories: Category[];
}

@Component({
  selector: 'app-parent-category-selector-dialog',
  templateUrl: './parent-category-selector-dialog.component.html',
  styleUrls: ['./parent-category-selector-dialog.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    CommonHeaderComponent,
    CommonBodyContentComponent
  ]
})
export class ParentCategorySelectorDialogComponent implements OnInit {
  selectedCategory: Category | null = null;

  constructor(
    public dialogRef: MatDialogRef<ParentCategorySelectorDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ParentCategorySelectorData
  ) { }

  ngOnInit(): void { }

  selectCategory(category: Category): void {
    this.selectedCategory = category;
    this.dialogRef.close(category);
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }

  trackByCategory(index: number, category: Category): string {
    return category.id || index.toString();
  }
} 