import { Component, Inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { FamilyMember, PaidByMember } from 'src/app/util/models/family.model';
import { ImageFallbackDirective } from 'src/app/util/directives/image-fallback.directive';
import { MobileBackButtonService } from 'src/app/util/service/mobile-back-button.service';

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
    MatButtonModule,
    ImageFallbackDirective
  ]
})
export class MultiplePaidBySheetComponent implements OnInit {
  public members = signal<FamilyMember[]>([]);
  public totalAmount = signal<number>(0);
  public currencySymbol = signal<string>('₹');

  // Member amounts map: userId -> amount
  public amountsValues = signal<{ [key: string]: number | null }>({});

  // Expose the signal value as a plain object for template ngModel binding
  get amounts(): { [key: string]: number | null } {
    return this.amountsValues();
  }

  public totalAllocated = computed(() => {
    let sum = 0;
    const currentAmounts = this.amountsValues();
    for (const userId in currentAmounts) {
      const val = currentAmounts[userId];
      if (val) {
        sum += val;
      }
    }
    // Prevent floating point artifacts by rounding to 2 decimal places
    return Math.round(sum * 100) / 100;
  });

  public remainingAmount = computed(() => {
    return Math.round((this.totalAmount() - this.totalAllocated()) * 100) / 100;
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
    @Inject(MAT_BOTTOM_SHEET_DATA) public data: MultiplePaidBySheetData,
    private mobileBackButtonService: MobileBackButtonService
  ) {}

  ngOnInit(): void {
    this.mobileBackButtonService.openModal('paid-by-sheet', this.bottomSheetRef);
    if (this.data) {
      this.members.set(this.data.members || []);
      this.totalAmount.set(this.data.totalAmount || 0);
      if (this.data.currencySymbol) {
        this.currencySymbol.set(this.data.currencySymbol);
      }

      // Initialize amounts
      const initialAmounts: { [key: string]: number | null } = {};
      this.data.members.forEach(m => {
        initialAmounts[m.userId] = null;
      });

      if (this.data.initialPaidBy && this.data.initialPaidBy.length > 0) {
        this.data.initialPaidBy.forEach(p => {
          initialAmounts[p.userId] = p.amount;
        });
      }
      this.amountsValues.set(initialAmounts);
    }
  }

  onAmountChange(userId: string, input: any): void {
    const val = parseFloat(input);
    const current = { ...this.amountsValues() };
    if (!isNaN(val)) {
      current[userId] = val;
    } else {
      current[userId] = null;
    }
    this.amountsValues.set(current);
  }

  onSave(): void {
    const result: PaidByMember[] = [];
    const currentAmounts = this.amountsValues();
    this.members().forEach(m => {
      const amt = currentAmounts[m.userId];
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
