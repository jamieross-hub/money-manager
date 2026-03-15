import { Component, Inject, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Store } from '@ngrx/store';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { Category } from '../../models/category.model';
import { CategorySplit } from '../../models/transaction.model';
import { AppState } from '../../../store/app.state';
import { NotificationService } from '../../service/notification.service';
import * as CategoriesSelectors from '../../../store/categories/categories.selectors';


@Component({
  selector: 'app-category-split-dialog',
  templateUrl: './category-split-dialog.component.html',
  styleUrls: ['./category-split-dialog.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatOptionModule,
    MatIconModule,
    MatButtonModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CategorySplitDialogComponent implements OnInit, OnDestroy {
  categorySplitForm: FormGroup;
  categories$: Observable<Category[]>;
  totalAmount: number;
  remainingAmount: number = 0;
  isSubmitting = false;
  private destroy$ = new Subject<void>();


  constructor(
    @Inject(MAT_DIALOG_DATA) public data: {
      totalAmount: number;
      existingSplits?: CategorySplit[];
      transactionType: string;
    },
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<CategorySplitDialogComponent>,
    private store: Store<AppState>,
    private notificationService: NotificationService,

  ) {
    this.totalAmount = data.totalAmount;
    this.categories$ = this.store.select(CategoriesSelectors.selectAllCategories);
    this.categorySplitForm = this.fb.group({
      splits: this.fb.array([])
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }


  ngOnInit(): void {

    if (this.data.existingSplits && this.data.existingSplits.length > 0) {
      this.data.existingSplits.forEach(split => {
        this.addSplit(split);
      });
    } else {
      this.addSplit();
    }
    this.updateRemainingAmount();
  }

  get splitsArray(): FormArray {
    return this.categorySplitForm.get('splits') as FormArray;
  }

  addSplit(existingSplit?: CategorySplit): void {
    const splitGroup = this.fb.group({
      categoryId: [existingSplit?.categoryId || '', Validators.required],
      categoryName: [existingSplit?.categoryName || '', Validators.required],
      amount: [existingSplit?.amount || 0, [Validators.required, Validators.min(0)]],
      percentage: [existingSplit?.percentage || 0, [Validators.required, Validators.min(0), Validators.max(100)]],
      notes: [existingSplit?.notes || '']
    });

    this.splitsArray.push(splitGroup);

    // Watch for amount changes to update percentage
    splitGroup.get('amount')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(amount => {
        if (this.totalAmount > 0 && amount !== null && amount !== undefined) {
          const percentage = (amount / this.totalAmount) * 100;
          splitGroup.patchValue({ percentage: Math.round(percentage * 100) / 100 }, { emitEvent: false });
          this.updateRemainingAmount();
        }
      });

    // Watch for percentage changes to update amount
    splitGroup.get('percentage')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(percentage => {
        if (percentage !== null && percentage !== undefined) {
          const amount = (percentage / 100) * this.totalAmount;
          splitGroup.patchValue({ amount: Math.round(amount * 100) / 100 }, { emitEvent: false });
          this.updateRemainingAmount();
        }
      });

    // Watch for category changes to update category name
    splitGroup.get('categoryId')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(categoryId => {
        if (categoryId) {
          this.categories$.pipe(takeUntil(this.destroy$)).subscribe(categories => {
            const category = categories.find(c => c.id === categoryId);
            if (category) {
              splitGroup.patchValue({ categoryName: category.name }, { emitEvent: false });
            }
          });
        }
      });
  }

  removeSplit(index: number): void {
    this.splitsArray.removeAt(index);
    this.updateRemainingAmount();
  }

  updateRemainingAmount(): void {
    const totalSplitAmount = this.splitsArray.controls.reduce((sum, control) => {
      return sum + (control.get('amount')?.value || 0);
    }, 0);
    this.remainingAmount = this.totalAmount - totalSplitAmount;
  }

  distributeRemaining(): void {
    if (this.remainingAmount > 0 && this.splitsArray.length > 0) {
      const amountPerSplit = this.remainingAmount / this.splitsArray.length;
      this.splitsArray.controls.forEach(control => {
        const currentAmount = control.get('amount')?.value || 0;
        const newAmount = currentAmount + amountPerSplit;
        const percentage = (newAmount / this.totalAmount) * 100;
        control.patchValue({
          amount: Math.round(newAmount * 100) / 100,
          percentage: Math.round(percentage * 100) / 100
        }, { emitEvent: false });
      });
      this.updateRemainingAmount();
    }
  }

  onCategoryChange(categoryId: string, index: number): void {
    this.categories$.pipe(takeUntil(this.destroy$)).subscribe(categories => {
      const category = categories.find(c => c.id === categoryId);
      if (category) {
        this.splitsArray.at(index).patchValue({ categoryName: category.name }, { emitEvent: false });
      }
    });
  }

  onSubmit(): void {
    if (this.categorySplitForm.valid && Math.abs(this.remainingAmount) < 0.01) {
      this.isSubmitting = true;
      const splits: CategorySplit[] = this.splitsArray.value.map((split: any) => ({
        categoryId: split.categoryId,
        categoryName: split.categoryName,
        amount: split.amount,
        percentage: split.percentage,
        notes: split.notes
      }));

      this.dialogRef.close(splits);
    } else {
      if (Math.abs(this.remainingAmount) >= 0.01) {
        this.notificationService.error(`Total split amount must equal ${this.totalAmount}. Remaining: ${this.remainingAmount.toFixed(2)}`);
      } else {
        this.notificationService.error('Please fill in all required fields');
      }
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  getRemainingAmountColor(): string {
    if (Math.abs(this.remainingAmount) < 0.01) {
      return 'text-green-600';
    } else if (this.remainingAmount > 0) {
      return 'text-orange-600';
    } else {
      return 'text-red-600';
    }
  }
} 