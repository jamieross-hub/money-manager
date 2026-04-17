import { Component, Inject, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';
import { MatDividerModule } from '@angular/material/divider';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { FamilyMemberStats, BalanceEntry } from 'src/app/util/models/family.model';
import { Transaction } from 'src/app/util/models/transaction.model';
import { CurrencyPipe, TruncatePipe, AppDatePipe } from 'src/app/util/pipes';
import { ImageFallbackDirective } from 'src/app/util/directives/image-fallback.directive';
import { TransactionType, TransactionStatus } from 'src/app/util/config/enums';
import { FamilyService } from '../../services/family.service';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from 'src/app/util/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-member-breakdown-sheet',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatRippleModule,
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
    const mode = this.data.mode || 'common';
    const activeMembersCount = this.data.activeMembersCount || 1;

    return this.txsData()
      .filter(tx => {
        if (tx.status === TransactionStatus.DELETED) return false;
        if (this.data.familyId && tx.familyId !== this.data.familyId) return false;
        
        // Check if member paid
        const isPayer = tx.splitData?.paidByUserId === userId || 
                      (tx.splitData?.paidBy?.some(p => p.userId === userId)) ||
                      (!tx.splitData && tx.userId === userId);
        
        // Check if member shared
        let isSharer = false;
        if (tx.splitData?.splitBetween) {
          isSharer = tx.splitData.splitBetween.some(s => s.userId === userId);
        } else {
          // Fallback logic
          if (mode === 'common') {
            // In common mode, all ACTIVE members share. 
            // We assume this member is active if they are in the list.
            isSharer = this.data.member.isActive;
          } else {
            isSharer = tx.userId === userId;
          }
        }
                       
        return isPayer || isSharer;
      })
      .slice(0, 15);
  });

  readonly memberCategories = computed(() => {
    const userId = this.memberData().userId;
    const mode = this.data.mode || 'common';
    const activeMembersCount = this.data.activeMembersCount || 1;
    const categoryMap = new Map<string, number>();
    let totalMemberSpent = 0;

    this.txsData().forEach(tx => {
      if (tx.status === TransactionStatus.DELETED || tx.type !== TransactionType.EXPENSE) return;
      if (this.data.familyId && tx.familyId !== this.data.familyId) return;
      
      let memberShare = 0;
      if (tx.splitData?.splitBetween) {
        const share = tx.splitData.splitBetween.find(s => s.userId === userId);
        if (share) memberShare = share.amount;
      } else {
        if (mode === 'common') {
          if (this.data.member.isActive) {
            memberShare = (tx.amount || 0) / activeMembersCount;
          }
        } else if (tx.userId === userId) {
          memberShare = tx.amount;
        }
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
      isCurrentUserAdmin?: boolean;
      familyId?: string;
      mode?: 'common' | 'split';
      activeMembersCount?: number;
    },
    private bottomSheetRef: MatBottomSheetRef<MemberBreakdownSheetComponent>
  ) {}

  private readonly familyService = inject(FamilyService);
  private readonly dialog = inject(MatDialog);

  async makeAdmin() {
    if (!this.data.familyId || !this.data.member.userId) return;

    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Promote to Admin',
        message: `Are you sure you want to promote ${this.data.member.displayName} to Admin? This will give them full access to manage family settings and members.`,
        confirmText: 'Promote',
        confirmColor: 'primary'
      }
    }).afterClosed().subscribe(async confirmed => {
      if (!confirmed) return;

      try {
        await this.familyService.updateMemberRole(this.data.familyId!, this.data.member.userId, 'admin');
        this.data.member.role = 'admin';
      } catch (error) {
        console.error('Failed to update member role:', error);
      }
    });
  }

  close() {
    this.bottomSheetRef.dismiss();
  }

  getTxAmountLabel(tx: Transaction): string {
    const userId = this.data.member.userId;
    const mode = this.data.mode || 'common';
    
    const isPayer = tx.splitData?.paidByUserId === userId || (tx.splitData?.paidBy?.some(p => p.userId === userId)) || (!tx.splitData && tx.userId === userId);
    
    let isSharer = false;
    if (tx.splitData?.splitBetween) {
      isSharer = tx.splitData.splitBetween.some(s => s.userId === userId);
    } else {
      if (mode === 'common') {
        isSharer = this.data.member.isActive;
      } else {
        isSharer = tx.userId === userId;
      }
    }

    if (isPayer && !isSharer) return 'Paid only';
    if (!isPayer && isSharer) return 'Your share';
    if (isPayer && isSharer) return 'Paid & Shared';
    return '';
  }

  getMemberShareInTx(tx: Transaction): number {
    const userId = this.data.member.userId;
    const mode = this.data.mode || 'common';
    const activeMembersCount = this.data.activeMembersCount || 1;

    if (tx.splitData?.splitBetween) {
      return tx.splitData.splitBetween.find(s => s.userId === userId)?.amount || 0;
    }
    
    if (mode === 'common' && this.data.member.isActive) {
      return (tx.amount || 0) / activeMembersCount;
    }

    return tx.userId === userId ? tx.amount : 0;
  }
}
