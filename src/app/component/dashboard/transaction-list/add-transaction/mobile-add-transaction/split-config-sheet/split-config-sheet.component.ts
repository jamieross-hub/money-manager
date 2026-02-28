import { Component, Inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';
import { MatTabsModule } from '@angular/material/tabs';
import { FamilyMember, SplitBetweenMember } from 'src/app/util/models/family.model';

export type SplitMode = 'equally' | 'unequally' | 'percentage';

export interface SplitConfigSheetData {
  members: FamilyMember[];
  totalAmount: number;
  initialMode: SplitMode;
  initialSplits: SplitBetweenMember[];
}

interface SplitItem {
  userId: string;
  displayName: string;
  photoURL?: string;
  included: boolean; // For 'equally'
  amount: number | null; // For 'unequally'
  percentage: number | null; // For 'percentage'
}

@Component({
  selector: 'app-split-config-sheet',
  templateUrl: './split-config-sheet.component.html',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatRippleModule,
    MatTabsModule
  ]
})
export class SplitConfigSheetComponent implements OnInit {
  public members = signal<SplitItem[]>([]);
  public totalAmount = signal<number>(0);
  public currentMode = signal<SplitMode>('equally');

  public readonly modes: { value: SplitMode; label: string; icon: string }[] = [
    { value: 'equally', label: 'Equally', icon: 'pie_chart' },
    { value: 'unequally', label: 'Exact Amounts', icon: 'payments' },
    { value: 'percentage', label: 'Percentages', icon: 'percent' },
  ];

  // Helper arrays for avatars
  private memberColors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];
  avatarColor(userId: string): string {
    let hash = 0;
    for (const c of userId) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
    return this.memberColors[hash % this.memberColors.length];
  }

  getModeIndex(): number {
    return this.modes.findIndex(m => m.value === this.currentMode());
  }

  setModeByIndex(index: number): void {
    if (this.modes[index]) {
      this.setMode(this.modes[index].value);
    }
  }

  // --- Mobile Swipe Support ---
  private touchStartX = 0;
  private touchEndX = 0;
  private touchStartY = 0;
  private touchEndY = 0;

  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.changedTouches[0].screenX;
    this.touchStartY = event.changedTouches[0].screenY;
  }

  onTouchEnd(event: TouchEvent): void {
    this.touchEndX = event.changedTouches[0].screenX;
    this.touchEndY = event.changedTouches[0].screenY;
    this.handleSwipe();
  }

  private handleSwipe(): void {
    const swipeDistanceX = this.touchStartX - this.touchEndX;
    const swipeDistanceY = this.touchStartY - this.touchEndY;
    const swipeThreshold = 50; // Minimum distance to be considered a swipe

    // Ensure horizontal swipe is dominant to prevent accidental swipes on scroll
    if (Math.abs(swipeDistanceX) > swipeThreshold && Math.abs(swipeDistanceX) > Math.abs(swipeDistanceY)) {
      const currentIndex = this.getModeIndex();
      
      if (swipeDistanceX > 0) {
        // Swiped left, go to next tab
        if (currentIndex < this.modes.length - 1) {
          this.setModeByIndex(currentIndex + 1);
        }
      } else {
        // Swiped right, go to previous tab
        if (currentIndex > 0) {
          this.setModeByIndex(currentIndex - 1);
        }
      }
    }
  }

  // --- Computed totals based on mode ---
  
  public totalAllocatedAmount = computed(() => {
    const list = this.members();
    const mode = this.currentMode();
    const totalAmt = this.totalAmount();

    if (mode === 'equally') {
       // if equally, total allocated is always matching if count > 0, else 0
       const includedCount = list.filter(m => m.included).length;
       return includedCount > 0 ? totalAmt : 0;
    } 
    else if (mode === 'unequally') {
       return list.reduce((sum, item) => sum + (item.amount || 0), 0);
    }
    else {
       // Percentage mode -> derive allocated amount from percentages
       const percentSum = list.reduce((sum, item) => sum + (item.percentage || 0), 0);
       return (percentSum / 100) * totalAmt;
    }
  });

  public remainingAmount = computed(() => {
    return this.totalAmount() - this.totalAllocatedAmount();
  });

  public isValid = computed(() => {
    const mode = this.currentMode();
    const list = this.members();
    if (mode === 'equally') {
        return list.some(m => m.included) && this.totalAmount() > 0;
    } else if (mode === 'unequally') {
        return Math.abs(this.totalAllocatedAmount() - this.totalAmount()) < 0.01;
    } else if (mode === 'percentage') {
        const percentSum = list.reduce((sum, item) => sum + (item.percentage || 0), 0);
        return Math.abs(percentSum - 100) < 0.01;
    }
    return false;
  });

  constructor(
    public bottomSheetRef: MatBottomSheetRef<SplitConfigSheetComponent>,
    @Inject(MAT_BOTTOM_SHEET_DATA) public data: SplitConfigSheetData
  ) {}

  ngOnInit(): void {
    if (this.data) {
      this.totalAmount.set(this.data.totalAmount || 0);
      this.currentMode.set(this.data.initialMode || 'equally');

      // Reconcile initial data into member list
      const splitList: SplitItem[] = [];
      
      this.data.members.forEach(famMember => {
        // Find if this family member was in the existing split array
        const existing = this.data.initialSplits.find(s => s.userId === famMember.userId);
        
        splitList.push({
           userId: famMember.userId,
           displayName: famMember.displayName,
           photoURL: famMember.photoURL,
           // If we're equally splitting, see if they were included
           included: !!existing, 
           amount: existing ? existing.amount : null,
           percentage: existing ? existing.percentage : null
        });
      });

      // Edge case: if mode is equally but NO ONE is included (new transaction), include everyone
      if (this.currentMode() === 'equally' && !splitList.some(s => s.included)) {
          splitList.forEach(s => s.included = true);
      }

      this.members.set(splitList);
    }
  }

  setMode(mode: SplitMode) {
    this.currentMode.set(mode);
    const list = [...this.members()];
    const totalAmt = this.totalAmount();

    // Reset list based on transitions
    if (mode === 'equally') {
       // if transitioning to equal, we don't necessarily clear inclusion.
    } else if (mode === 'unequally') {
       // if from equal -> unequal, prefill amounts
       if (this.data.initialMode === 'equally') {
           const includedCount = list.filter(m => m.included).length;
           const chunk = includedCount > 0 ? (totalAmt / includedCount) : 0;
           list.forEach(m => {
               m.amount = m.included ? parseFloat(chunk.toFixed(2)) : null;
           });
       }
    } else if (mode === 'percentage') {
       // if from equal -> percentage, prefill percentages
       const includedCount = list.filter(m => m.included).length;
       const percentChunk = includedCount > 0 ? (100 / includedCount) : 0;
       list.forEach(m => {
           m.percentage = m.included ? parseFloat(percentChunk.toFixed(2)) : null;
       });
    }

    this.members.set(list);
  }

  toggleIncluded(userId: string) {
    if (this.currentMode() !== 'equally') return;
    
    const list = [...this.members()];
    const index = list.findIndex(m => m.userId === userId);
    if (index !== -1) {
       list[index] = { ...list[index], included: !list[index].included };
       this.members.set(list);
    }
  }

  onAmountChange() {
    // Force reactivity update when ngModel bindings fire
    this.members.set([...this.members()]);
  }

  getEqualAmount(): number {
    const list = this.members();
    const count = list.filter(m => m.included).length;
    if (count === 0) return 0;
    return this.totalAmount() / count;
  }

  getTotalPercentage(): number {
    return this.members().reduce((sum, item) => sum + (item.percentage || 0), 0);
  }

  onSave(): void {
    if (!this.isValid()) return;

    const list = this.members();
    const mode = this.currentMode();
    const totalAmt = this.totalAmount();
    const result: SplitBetweenMember[] = [];

    if (mode === 'equally') {
       const includedList = list.filter(m => m.included);
       const chunkSize = totalAmt / includedList.length;
       const percentSize = 100 / includedList.length;

       includedList.forEach(m => {
          result.push({
             userId: m.userId,
             displayName: m.displayName,
             photoURL: m.photoURL,
             amount: parseFloat(chunkSize.toFixed(2)),
             percentage: parseFloat(percentSize.toFixed(2))
          });
       });
    } else if (mode === 'unequally') {
       list.filter(m => m.amount && m.amount > 0).forEach(m => {
          const percent = (m.amount! / totalAmt) * 100;
          result.push({
            userId: m.userId,
            displayName: m.displayName,
            photoURL: m.photoURL,
            amount: m.amount!,
            percentage: parseFloat(percent.toFixed(2))
          });
       });
    } else if (mode === 'percentage') {
       list.filter(m => m.percentage && m.percentage > 0).forEach(m => {
          const amt = (m.percentage! / 100) * totalAmt;
          result.push({
            userId: m.userId,
            displayName: m.displayName,
            photoURL: m.photoURL,
            amount: parseFloat(amt.toFixed(2)),
            percentage: m.percentage!
          });
       });
    }

    this.bottomSheetRef.dismiss({
       mode: mode,
       splits: result
    });
  }

  onCancel(): void {
    this.bottomSheetRef.dismiss();
  }
}
