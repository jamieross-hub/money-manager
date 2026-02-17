import { Component, Inject, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Category } from 'src/app/util/models/category.model';
import { CategoryBudgetService } from 'src/app/util/service/category-budget.service';
import { Subscription } from 'rxjs';

import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { CommonHeaderComponent } from 'src/app/util/components/dialog/common-header/common-header.component';
import { CommonBodyContentComponent } from 'src/app/util/components/dialog/common-body-content/common-body-content.component';

export interface CategoryBudgetDialogData {
  category: Category;
  isEdit: boolean;
}

@Component({
  selector: 'app-category-budget-dialog',
  templateUrl: './category-budget-dialog.component.html',
  styleUrls: ['./category-budget-dialog.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    CommonHeaderComponent,
    CommonBodyContentComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CategoryBudgetDialogComponent implements OnInit, OnDestroy {
  budgetForm: FormGroup;
  budgetPeriods: Array<{ value: string; label: string }>;
  minDate: Date = new Date();
  maxDate: Date = new Date(new Date().getFullYear() + 1, 11, 31);
  private subscription = new Subscription();


  constructor(
    private dialogRef: MatDialogRef<CategoryBudgetDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CategoryBudgetDialogData,
    private budgetService: CategoryBudgetService
  ) {
    this.budgetForm = this.budgetService.createBudgetForm();
    this.budgetPeriods = this.budgetService.getBudgetPeriods();
  }

  ngOnInit(): void {
    this.subscription = this.budgetService.initializeBudgetForm(this.budgetForm, this.data.category);
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }


  onCancel(): void {
    this.dialogRef.close();
  }

  onSave(): void {
    if (this.budgetService.isBudgetFormValid(this.budgetForm)) {
      const budgetData = this.budgetService.getBudgetDataFromForm(this.budgetForm);
      this.dialogRef.close(budgetData);
    }
  }

  get isFormValid(): boolean {
    return this.budgetService.isBudgetFormValid(this.budgetForm);
  }

  get budgetAmountControl() {
    return this.budgetForm.get('budgetAmount');
  }

  get budgetPeriodControl() {
    return this.budgetForm.get('budgetPeriod');
  }
} 