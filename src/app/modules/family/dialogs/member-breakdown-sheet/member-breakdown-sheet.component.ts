import { Component, Inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { FamilyMemberStats, BalanceEntry } from 'src/app/util/models/family.model';
import { Transaction } from 'src/app/util/models/transaction.model';
import { CurrencyPipe, TruncatePipe, AppDatePipe } from 'src/app/util/pipes';
import { ImageFallbackDirective } from 'src/app/util/directives/image-fallback.directive';
import { TransactionType, TransactionStatus } from 'src/app/util/config/enums';

@Component({
  selector: 'app-member-breakdown-sheet',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
    CurrencyPipe,
    AppDatePipe,
    ImageFallbackDirective
  ],
  templateUrl: './member-breakdown-sheet.component.html',
  styleUrl: './member-breakdown-sheet.component.scss'
})
export class MemberBreakdownSheetComponent {
  
  // Wrap data in signals for better reactivity if needed, 
  // though MAT_BOTTOM_SHEET_DATA is usually static for the life of the sheet.
  private readonly memberData = signal(this.data.member);
  private readonly txsData = signal(this.data.transactions);
  private readonly balancesData = signal(this.data.balances);

  readonly memberTransactions = computed(() => {
    const userId = this.memberData().userId;
    return this.txsData()
      .filter(tx => {
        if (tx.status === TransactionStatus.DELETED) return false;
        
        // Check if member paid
        const isPayer = tx.splitData?.paidByUserId === userId || 
                      (tx.splitData?.paidBy?.some(p => p.userId === userId)) ||
                      (!tx.splitData && tx.userId === userId);
        
        // Check if member shared
        const isSharer = tx.splitData?.splitBetween?.some(s => s.userId === userId) || 
                       (!tx.splitData); // fallback logic usually includes everyone in 'common' mode
                       
        return isPayer || isSharer;
      })
      .slice(0, 15);
  });

  readonly memberCategories = computed(() => {
    const userId = this.memberData().userId;
    const categoryMap = new Map<string, number>();
    let totalMemberSpent = 0;

    this.txsData().forEach(tx => {
      if (tx.status === TransactionStatus.DELETED || tx.type !== TransactionType.EXPENSE) return;
      
      let memberShare = 0;
      if (tx.splitData?.splitBetween) {
        const share = tx.splitData.splitBetween.find(s => s.userId === userId);
        if (share) memberShare = share.amount;
      } else {
        // Simple fallback for common mode (equal split logic normally, but here we estimate)
        // If they created it and no split data, it might be 100% theirs or equally shared.
        // We'll stick to what the processor does: if it's there, it's there.
        if (tx.userId === userId) memberShare = tx.amount;
      }

      if (memberShare > 0) {
        categoryMap.set(tx.category, (categoryMap.get(tx.category) || 0) + memberShare);
        totalMemberSpent += memberShare;
      }
    });

    return Array.from(categoryMap.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totalMemberSpent > 0 ? (amount / totalMemberSpent) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  });

  readonly filteredBalances = computed(() => {
    const userId = this.memberData().userId;
    return this.balancesData().filter(b => b.fromUserId === userId || b.toUserId === userId);
  });

  constructor(
    @Inject(MAT_BOTTOM_SHEET_DATA) public data: { 
      member: FamilyMemberStats; 
      transactions: Transaction[]; 
      balances: BalanceEntry[];
      memberColor: string;
    },
    private bottomSheetRef: MatBottomSheetRef<MemberBreakdownSheetComponent>
  ) {}

  close() {
    this.bottomSheetRef.dismiss();
  }

  getTxAmountLabel(tx: Transaction): string {
    const userId = this.data.member.userId;
    const isPayer = tx.splitData?.paidByUserId === userId || (tx.splitData?.paidBy?.some(p => p.userId === userId)) || (!tx.splitData && tx.userId === userId);
    const isSharer = tx.splitData?.splitBetween?.some(s => s.userId === userId) || (!tx.splitData);

    if (isPayer && !isSharer) return 'Paid only';
    if (!isPayer && isSharer) return 'Your share';
    if (isPayer && isSharer) return 'Paid & Shared';
    return '';
  }

  getMemberShareInTx(tx: Transaction): number {
    const userId = this.data.member.userId;
    if (tx.splitData?.splitBetween) {
      return tx.splitData.splitBetween.find(s => s.userId === userId)?.amount || 0;
    }
    return tx.userId === userId ? tx.amount : 0;
  }
}
