import { Component, inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRippleModule } from '@angular/material/core';

import { BalanceEntry, AddSettlementRequest, SettlementMethod } from 'src/app/util/models/family.model';

export interface SettleDialogData {
  familyId: string;
  balance: BalanceEntry;
  suggestedAmount: number;
}

@Component({
  selector: 'app-settle-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatRippleModule,
  ],
  templateUrl: './settle-dialog.component.html',
  styleUrls: ['./settle-dialog.component.scss'],
})
export class SettleDialogComponent implements OnInit {
  readonly dialogRef = inject(MatDialogRef<SettleDialogComponent>);
  readonly data: SettleDialogData = inject(MAT_DIALOG_DATA);
  private fb = inject(FormBuilder);

  readonly methods: { value: SettlementMethod; label: string; icon: string }[] = [
    { value: 'cash',          label: 'Cash',          icon: 'payments'         },
    { value: 'upi',           label: 'UPI',            icon: 'phone_iphone'     },
    { value: 'bank_transfer', label: 'Bank Transfer',  icon: 'account_balance'  },
  ];

  form = this.fb.group({
    amount: [this.data.suggestedAmount, [Validators.required, Validators.min(0.01)]],
    method: ['cash' as SettlementMethod, Validators.required],
    note: [''],
  });

  get balance() { return this.data.balance; }

  ngOnInit() {}

  selectMethod(m: SettlementMethod) {
    this.form.patchValue({ method: m });
  }

  avatar(name: string) {
    return (name || '?').charAt(0).toUpperCase();
  }

  private memberColors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];
  avatarColor(userId: string): string {
    let hash = 0;
    for (const c of userId) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
    return this.memberColors[hash % this.memberColors.length];
  }

  save() {
    if (this.form.invalid) return;
    const { amount, method, note } = this.form.value;
    const b = this.data.balance;

    const request: AddSettlementRequest = {
      familyId: this.data.familyId,
      fromUserId: b.fromUserId,
      fromDisplayName: b.fromDisplayName,
      fromPhotoURL: b.fromPhotoURL,
      toUserId: b.toUserId,
      toDisplayName: b.toDisplayName,
      toPhotoURL: b.toPhotoURL,
      amount: amount!,
      method: method as SettlementMethod,
      note: note || undefined,
    };

    this.dialogRef.close(request);
  }

  cancel() {
    this.dialogRef.close();
  }
}
