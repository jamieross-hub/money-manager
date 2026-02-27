import { Component, Inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { FamilyMember, PaidByMember } from 'src/app/util/models/family.model';

export interface MultiplePaidBySheetData {
  members: FamilyMember[];
  totalAmount: number;
  initialPaidBy: PaidByMember[];
  currencySymbol?: string;
}

@Component({
  selector: 'app-multiple-paid-by-sheet',
  templateUrl: './multiple-paid-by-sheet.component.html',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule
  ]
})
export class MultiplePaidBySheetComponent implements OnInit {
  public members = signal<FamilyMember[]>([]);
  public totalAmount = signal<number>(0);
  public currencySymbol = signal<string>('₹');

  // Member amounts map: userId -> amount
  public amounts: { [key: string]: number | null } = {};

  public totalAllocated = computed(() => {
    let sum = 0;
    for (const userId in this.amounts) {
      if (this.amounts[userId]) {
        sum += this.amounts[userId] || 0;
      }
    }
    return sum;
  });

  public remainingAmount = computed(() => {
    return this.totalAmount() - this.totalAllocated();
  });

  isValid = computed(() => {
    return Math.abs(this.totalAllocated() - this.totalAmount()) < 0.01;
  });

  private memberColors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];
  avatarColor(userId: string): string {
    let hash = 0;
    for (const c of userId) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
    return this.memberColors[hash % this.memberColors.length];
  }

  constructor(
    public bottomSheetRef: MatBottomSheetRef<MultiplePaidBySheetComponent>,
    @Inject(MAT_BOTTOM_SHEET_DATA) public data: MultiplePaidBySheetData
  ) {}

  ngOnInit(): void {
    if (this.data) {
      this.members.set(this.data.members || []);
      this.totalAmount.set(this.data.totalAmount || 0);
      if (this.data.currencySymbol) {
        this.currencySymbol.set(this.data.currencySymbol);
      }

      // Initialize amounts
      this.data.members.forEach(m => {
        this.amounts[m.userId] = null;
      });

      if (this.data.initialPaidBy && this.data.initialPaidBy.length > 0) {
        this.data.initialPaidBy.forEach(p => {
          this.amounts[p.userId] = p.amount;
        });
      } else if (this.data.members.length > 0) {
        // Just empty initialization
      }
    }
  }

  onAmountChange(userId: string, input: any): void {
    // Force ChangeDetection update via model binding
    const val = parseFloat(input);
    if (!isNaN(val)) {
      this.amounts[userId] = val;
    } else {
      this.amounts[userId] = null;
    }
    // Update computed values
    this.totalAllocated = computed(() => {
      let sum = 0;
      for (const uid in this.amounts) {
        if (this.amounts[uid]) {
          sum += this.amounts[uid] || 0;
        }
      }
      return sum;
    });
    this.remainingAmount = computed(() => {
      return this.totalAmount() - this.totalAllocated();
    });
    this.isValid = computed(() => {
      return Math.abs(this.totalAllocated() - this.totalAmount()) < 0.01;
    });
  }

  onSave(): void {
    const result: PaidByMember[] = [];
    this.members().forEach(m => {
      const amt = this.amounts[m.userId];
      if (amt && amt > 0) {
        result.push({
          userId: m.userId,
          displayName: m.displayName,
          photoURL: m.photoURL,
          amount: amt
        });
      }
    });
    this.bottomSheetRef.dismiss(result);
  }

  onCancel(): void {
    this.bottomSheetRef.dismiss();
  }
}
