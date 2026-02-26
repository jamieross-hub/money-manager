import { Component, inject, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { CommonModule } from '@angular/common';
import { AddFamilyTransactionRequest, FamilyTransactionType } from 'src/app/util/models/family.model';

const EXPENSE_CATEGORIES = [
  'Food & Dining', 'Groceries', 'Transport', 'Utilities', 'Rent/EMI',
  'Healthcare', 'Education', 'Shopping', 'Entertainment', 'Travel', 'Others'
];
const INCOME_CATEGORIES = [
  'Salary', 'Freelance', 'Business', 'Investment', 'Rental Income', 'Gift', 'Others'
];

@Component({
  selector: 'app-family-add-transaction-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatDatepickerModule, MatNativeDateModule, MatIconModule, MatButtonToggleModule],
  templateUrl: './family-add-transaction-dialog.component.html',
  styleUrls: ['./family-add-transaction-dialog.component.scss']
})
export class FamilyAddTransactionDialogComponent {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<FamilyAddTransactionDialogComponent>);
  private data = inject(MAT_DIALOG_DATA, { optional: true }) as { familyId: string; transaction?: any } | null;

  isEditing = !!this.data?.transaction;

  typeControl = this.fb.control<FamilyTransactionType>(
    this.data?.transaction?.type || 'expense',
    Validators.required
  );

  form = this.fb.group({
    amount: [this.data?.transaction?.amount || null, [Validators.required, Validators.min(0.01)]],
    category: [this.data?.transaction?.category || '', Validators.required],
    date: [this.data?.transaction?.date ? new Date(this.data.transaction.date.seconds ? this.data.transaction.date.seconds * 1000 : this.data.transaction.date) : new Date(), Validators.required],
    note: [this.data?.transaction?.note || ''],
  });

  categories = computed(() => this.typeControl.value === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES);

  submit() {
    if (this.form.invalid) return;
    const val = this.form.value;
    const result: AddFamilyTransactionRequest = {
      familyId: this.data?.familyId || '',
      amount: val.amount!,
      type: this.typeControl.value as FamilyTransactionType,
      category: val.category!,
      date: val.date!,
      note: val.note || '',
    };
    this.dialogRef.close({ request: result, isEditing: this.isEditing, txId: this.data?.transaction?.id });
  }

  close() {
    this.dialogRef.close();
  }
}
