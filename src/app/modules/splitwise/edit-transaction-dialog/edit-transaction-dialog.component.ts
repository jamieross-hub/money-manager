import { Component, Inject, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { SplitTransaction, TransactionSplit } from '../../../util/models/splitwise.model';
import { CurrencyService } from 'src/app/util/service/currency.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';


export interface EditTransactionDialogData {
  transaction: SplitTransaction;
  groupMembers: any[];
}

@Component({
  selector: 'app-edit-transaction-dialog',
  templateUrl: './edit-transaction-dialog.component.html',
  styleUrls: ['./edit-transaction-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditTransactionDialogComponent implements OnInit, OnDestroy {
  editForm!: FormGroup;
  transaction: SplitTransaction;
  groupMembers: any[];
  totalAmount: number = 0;
  splitMode: 'percentage' | 'amount' = 'percentage';
  isSubmitting: boolean = false;
  Math = Math; // Make Math available in template
  private destroy$ = new Subject<void>();


  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<EditTransactionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: EditTransactionDialogData,
    private currencyService: CurrencyService
  ) {
    this.transaction = data.transaction;
    this.groupMembers = data.groupMembers;
    this.totalAmount = this.transaction.totalAmount;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }


  ngOnInit(): void {
    this.initForm();
  }

  initForm(): void {
    this.editForm = this.fb.group({
      totalAmount: [this.transaction.totalAmount, [Validators.required, Validators.min(0.01)]],
      splits: this.fb.array([])
    });

    // Initialize splits form array
    this.transaction.splits.forEach(split => {
      this.addSplit(split);
    });

    // Watch for total amount changes
    this.editForm.get('totalAmount')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(newTotal => {
        this.totalAmount = newTotal;
        this.updateSplitPercentages();
      });
  }

  get splitsArray(): FormArray {
    return this.editForm.get('splits') as FormArray;
  }

  addSplit(existingSplit?: TransactionSplit): void {
    const splitGroup = this.fb.group({
      userId: [existingSplit?.userId || '', Validators.required],
      displayName: [existingSplit?.displayName || '', Validators.required],
      email: [existingSplit?.email || '', Validators.required],
      amount: [existingSplit?.amount || 0, [Validators.required, Validators.min(0)]],
      percentage: [existingSplit?.percentage || 0, [Validators.required, Validators.min(0), Validators.max(100)]],
      isPaid: [existingSplit?.isPaid || false]
    });

    this.splitsArray.push(splitGroup);

    // Watch for amount changes to update percentage
    splitGroup.get('amount')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(amount => {
        if (this.totalAmount > 0 && amount !== null && amount !== undefined) {
          const percentage = (amount / this.totalAmount) * 100;
          splitGroup.patchValue({ percentage: Math.round(percentage * 100) / 100 }, { emitEvent: false });
        }
      });


    // Watch for percentage changes to update amount
    splitGroup.get('percentage')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(percentage => {
        if (percentage !== null && percentage !== undefined) {
          const amount = (percentage / 100) * this.totalAmount;
          splitGroup.patchValue({ amount: Math.round(amount * 100) / 100 }, { emitEvent: false });
        }
      });
  }

  removeSplit(index: number): void {
    this.splitsArray.removeAt(index);
    this.updateSplitPercentages();
  }

  updateSplitPercentages(): void {
    const splits = this.splitsArray.controls;
    splits.forEach(split => {
      const amount = split.get('amount')?.value || 0;
      if (this.totalAmount > 0 && amount !== null && amount !== undefined) {
        const percentage = (amount / this.totalAmount) * 100;
        split.patchValue({ percentage: Math.round(percentage * 100) / 100 }, { emitEvent: false });
      }
    });
  }

  updateSplitAmounts(): void {
    const splits = this.splitsArray.controls;
    splits.forEach(split => {
      const percentage = split.get('percentage')?.value || 0;
      if (percentage !== null && percentage !== undefined) {
        const amount = (percentage / 100) * this.totalAmount;
        split.patchValue({ amount: Math.round(amount * 100) / 100 }, { emitEvent: false });
      }
    });
  }

  addMemberSplit(member: any): void {
    // Check if member is already added
    const existingMember = this.splitsArray.controls.find(control =>
      control.get('userId')?.value === member.userId
    );

    if (!existingMember) {
      const splitGroup = this.fb.group({
        userId: [member.userId, Validators.required],
        displayName: [member.displayName],
        email: [member.email, Validators.required],
        amount: [0, [Validators.required, Validators.min(0)]],
        percentage: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
        isPaid: [false]
      });

      this.splitsArray.push(splitGroup);
      this.updateSplitPercentages();
    }
  }

  getAvailableMembers(): any[] {
    const selectedUserIds = this.splitsArray.controls.map(control => control.get('userId')?.value);
    return this.groupMembers.filter(member => !selectedUserIds.includes(member.userId));
  }

  getTotalPercentage(): number {
    return this.splitsArray.controls.reduce((total, control) => {
      return total + (control.get('percentage')?.value || 0);
    }, 0);
  }

  getTotalSplitAmount(): number {
    return this.splitsArray.controls.reduce((total, control) => {
      return total + (control.get('amount')?.value || 0);
    }, 0);
  }

  isFormValid(): boolean {
    const totalPercentage = this.getTotalPercentage();
    const formValid = this.editForm.valid;

    // Only require percentage to equal 100%, allow unequal amounts
    return formValid && Math.abs(totalPercentage - 100) < 0.01;
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSave(): void {
    if (this.isFormValid()) {
      const formValue = this.editForm.value;
      const updatedTransaction: Partial<SplitTransaction> = {
        totalAmount: formValue.totalAmount,
        splits: formValue.splits.map((split: any) => ({
          userId: split.userId,
          displayName: split.displayName,
          email: split.email,
          amount: split.amount,
          percentage: split.percentage,
          isPaid: split.isPaid
        }))
      };

      this.dialogRef.close(updatedTransaction);
    }
  }

  formatCurrency(amount: number): string {
    return this.currencyService.formatAmount(amount);
  }

  setSplitMode(mode: 'percentage' | 'amount'): void {
    this.splitMode = mode;
    if (mode === 'percentage') {
      this.updateSplitPercentages();
    } else {
      this.updateSplitAmounts();
    }
  }



  getMemberPhotoURL(userId: string): string | null {
    const member = this.groupMembers.find(m => m.userId === userId);
    return member?.photoURL || null;
  }

  getMemberInitials(displayName: string): string {
    if (!displayName) return '?';
    return displayName
      .split(' ')
      .map(name => name.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
} 