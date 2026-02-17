import { Component, OnInit, OnDestroy , ChangeDetectionStrategy} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Subject } from 'rxjs';
import { takeUntil, filter } from 'rxjs/operators';
import { Auth } from '@angular/fire/auth';
import { MatDialog } from '@angular/material/dialog';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { NotificationService } from 'src/app/util/service/notification.service';
import { SplitwiseGroup, SplitTransaction, SplitSettlement } from 'src/app/util/models/splitwise.model';
import { AddMemberDialogComponent } from '../add-member-dialog/add-member-dialog.component';
import { EditTransactionDialogComponent } from '../edit-transaction-dialog/edit-transaction-dialog.component';

// NgRx
import { AppState } from '../../../store/app.state';
import * as SplitwiseActions from '../store/splitwise.actions';
import { selectSplitwiseState } from '../store/splitwise.selectors';
import { ConfirmDialogComponent } from 'src/app/util/components/confirm-dialog/confirm-dialog.component';
import { SplitwiseService } from '../services/splitwise.service';
import { CurrencyService } from 'src/app/util/service/currency.service';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';

@Component({
  selector: 'app-group-details',
  templateUrl: './group-details.component.html',
  styleUrls: ['./group-details.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GroupDetailsComponent implements OnInit, OnDestroy {
  group: SplitwiseGroup | null = null;
  transactions: SplitTransaction[] = [];
  settlements: SplitSettlement[] = [];
  error: string | null = null;
  currentUser: any = null;
  isMobile: boolean = false;
  isLoading: boolean = false;
  Math = Math; // Make Math available in template
  showBalances: boolean = true; // Toggle for balance display
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auth: Auth,
    private store: Store<AppState>,
    private dialog: MatDialog,
    private notificationService: NotificationService,
    private breakpointObserver: BreakpointObserver,
    private splitwiseService: SplitwiseService,
    private currencyService: CurrencyService,
    public breakpointService: BreakpointService
  ) {
    // Observe breakpoints for mobile detection
    this.breakpointObserver.observe([Breakpoints.Handset])
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        this.isMobile = result.matches;
      });
  }

  ngOnInit(): void {
    this.currentUser = this.auth.currentUser;
    this.subscribeToStore();
    this.loadGroupDetails();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private subscribeToStore(): void {
    this.store.select(selectSplitwiseState)
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.isLoading = state.loading;
        this.error = state.error;

        // Get the group from the selected group or find by ID
        const groupId = this.route.snapshot.paramMap.get('id');
        if (groupId) {
          this.group = state.groups.find(g => g.id === groupId) || null;

          // If group not found in store, try to load it
          if (!this.group && !this.isLoading) {
            this.splitwiseService.getGroupById(groupId).then(group => {
              this.group = group;
            });
          }
        }

        // Get transactions and settlements for the current group
        this.transactions = state.transactions.filter(t => t.groupId === groupId);
        this.settlements = state.settlements.filter(s => s.groupId === groupId);

        // Debug balance calculations
        if (this.transactions.length > 0) {
          console.log('=== DEBUG: Balance Calculations ===');
          this.calculateNetBalances();
          console.log('=== END DEBUG ===');
        }

        // Show error notification if there's an error
        if (this.error) {
          this.notificationService.error(this.error);
          this.store.dispatch(SplitwiseActions.clearError());
        }

        // Log state changes for debugging
        console.log('Store state updated:', {
          loading: state.loading,
          transactionsCount: state.transactions.length,
          settlementsCount: state.settlements.length,
          error: state.error
        });
      });
  }

  // Reload data after successful operations
  private reloadData(): void {
    const groupId = this.route.snapshot.paramMap.get('id');
    if (groupId) {
      this.store.dispatch(SplitwiseActions.loadTransactions({ groupId }));
      this.store.dispatch(SplitwiseActions.loadSettlements({ groupId }));
    }
  }

  private loadGroupDetails(): void {
    const groupId = this.route.snapshot.paramMap.get('id');
    if (groupId) {
      this.store.dispatch(SplitwiseActions.loadGroupById({ groupId }));
      this.store.dispatch(SplitwiseActions.loadTransactions({ groupId }));
      this.store.dispatch(SplitwiseActions.loadSettlements({ groupId }));
    }
  }

  goBack(): void {
    this.router.navigate(['dashboard/splitwise']);
  }

  openAddMemberDialog(): void {
    if (!this.group) return;

    const dialogRef = this.dialog.open(AddMemberDialogComponent, {
      data: { group: this.group },
      disableClose: true,
      panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : 'desktop-dialog',
    });

    dialogRef.afterClosed().subscribe((result: any) => {
      if (result) {
        if (result.action === 'delete') {
          this.store.dispatch(SplitwiseActions.removeMember({
            groupId: this.group!.id!,
            userId: result.userId
          }));
        } else {
        this.store.dispatch(SplitwiseActions.addMember({
          groupId: this.group!.id!,
          request: result
        }));
        }
      }
    });
  }

  deleteGroup(): void {
    if (!this.group) return;
    
    this.dialog.open(ConfirmDialogComponent, {
      width: '300px',
      data: {
        title: 'Delete Group',
        message: 'Are you sure you want to delete the group "${this.group.name}"?',
        confirmText: 'Delete',
        cancelText: 'Cancel',
      },
    }).afterClosed().subscribe((result: any) => {
      if (result) {
        this.store.dispatch(SplitwiseActions.deleteGroup({ groupId: this.group?.id! }));
        this.goBack();
      }
    });
  }

  getCurrentUserRole(): string {
    if (!this.group || !this.currentUser) return '';

    const member = this.group.members.find(m => m.userId === this.currentUser.uid);
    return member?.role || '';
  }

  canManageGroup(): boolean {
    const role = this.getCurrentUserRole();
    return role === 'admin';
  }

  getGroupMemberCount(): number {
    return this.group?.members.filter(member => member.isActive).length || 0;
  }

  formatDate(date: Date | any): string {
    if (!date) return '';
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    return dateObj.toLocaleDateString();
  }

  formatCurrency(amount: number): string {
    return this.currencyService.formatAmount(amount);
  }

  getTotalBalance(): number {
    if (!this.group) return 0;
    // Calculate total balance from transactions instead of member.balance
    return this.transactions.reduce((total, transaction) => {
      return total + transaction.splits.reduce((splitTotal, split) => splitTotal + split.amount, 0);
    }, 0);
  }

  // Improved algorithm to calculate net balances considering settlements
  calculateNetBalances(): Record<string, Record<string, number>> {
    const balances: Record<string, Record<string, number>> = {};

    // Step 1: Process Transactions (Expenses)
    for (const transaction of this.transactions) {
      const paidBy = transaction.createdBy; // Who paid for the transaction
      
      for (const split of transaction.splits) {
        const { userId, amount: splitAmount } = split;
        
        if (userId === paidBy) {
          // The person who paid doesn't owe anyone, but others owe them
          continue;
        } else {
          // This person owes the person who paid
          if (!balances[userId]) balances[userId] = {};
          if (!balances[userId][paidBy]) balances[userId][paidBy] = 0;
          
          balances[userId][paidBy] += splitAmount;
        }
      }
    }

    // Step 2: Process Settlements
    for (const settlement of this.settlements) {
      if (settlement.status === 'cancelled') continue; // Skip cancelled settlements
      
      const { fromUserId, toUserId, amount } = settlement;

      // fromUserId paid toUserId, so reduce debt
      if (!balances[fromUserId]) balances[fromUserId] = {};
      if (!balances[fromUserId][toUserId]) balances[fromUserId][toUserId] = 0;

      balances[fromUserId][toUserId] -= amount;
    }

    // Step 3: Simplify balances to show only net one-way debts
    const simplifiedBalances = this.simplifyBalances(balances);
    return simplifiedBalances;
  }

  // Simplify balances to show only net one-way debts
  simplifyBalances(balances: Record<string, Record<string, number>>): Record<string, Record<string, number>> {
    const result: Record<string, Record<string, number>> = {};
    const visited = new Set<string>();

    for (const userA in balances) {
      for (const userB in balances[userA]) {
        const key = `${userA}_${userB}`;
        const reverseKey = `${userB}_${userA}`;
        
        if (visited.has(key) || visited.has(reverseKey)) continue;

        const amountAB = balances[userA]?.[userB] || 0;
        const amountBA = balances[userB]?.[userA] || 0;

        const net = amountAB - amountBA;

        if (net > 0) {
          if (!result[userA]) result[userA] = {};
          result[userA][userB] = Math.round(net * 100) / 100;
        } else if (net < 0) {
          if (!result[userB]) result[userB] = {};
          result[userB][userA] = Math.round(-net * 100) / 100;
        }

        visited.add(key);
        visited.add(reverseKey);
      }
    }

    return result;
  }

  getMemberBalances(): any[] {
    if (!this.group) return [];

    // Step 1: Calculate simplified net balances
    const simplifiedBalances = this.calculateNetBalances();
    
    // Step 2: Convert to the expected format for display
    const balances: any[] = [];
    
    this.group.members.forEach(member => {
      const memberBalances = simplifiedBalances[member.userId] || {};
      
      // Calculate total owed by this member to others (only positive amounts)
      let totalOwed = 0;
      Object.values(memberBalances).forEach((amount: any) => {
        if (amount > 0) {
          totalOwed += amount;
        }
      });
      
      // Calculate total amount this member has paid for others (transactions they created)
      let totalPaid = 0;
      this.transactions.forEach(transaction => {
        if (transaction.createdBy === member.userId) {
          // This member paid for this transaction
          // Calculate how much they paid for others (excluding their own share)
          const memberSplit = transaction.splits.find(split => split.userId === member.userId);
          if (memberSplit) {
            // They paid the total amount, but their own share should be excluded
            totalPaid += transaction.totalAmount - memberSplit.amount;
          } else {
            // If they're not in the splits, they paid the full amount for others
            totalPaid += transaction.totalAmount;
          }
        }
      });
      
      // Calculate net balance (positive = they owe you, negative = you owe them)
      const netBalance = totalPaid - totalOwed;
      
      balances.push({
        userId: member.userId,
        displayName: member.displayName,
        email: member.email,
        totalPaid: totalPaid,
        totalOwed: totalOwed,
        netBalance: netBalance,
        simplifiedBalances: memberBalances // Keep simplified balances for reference
      });
    });

    return balances.sort((a, b) => b.netBalance - a.netBalance);
  }

  // Get detailed balance breakdown for a user (simplified)
  getDetailedBalanceBreakdown(userId: string): any[] {
    const simplifiedBalances = this.calculateNetBalances();
    const userBalances = simplifiedBalances[userId] || {};
    const breakdown: any[] = [];

    // Check what this user owes to others (only positive amounts)
    Object.entries(userBalances).forEach(([otherUserId, amount]) => {
      if (amount > 0) {
        breakdown.push({
          type: 'owes',
          otherUserId: otherUserId,
          otherUserName: this.getMemberName(otherUserId),
          amount: amount,
          message: `${this.getMemberName(userId)} owes ${this.getMemberName(otherUserId)} ${this.formatCurrency(amount)}`
        });
      }
    });

    // Check what others owe to this user
    Object.keys(simplifiedBalances).forEach(otherUserId => {
      if (otherUserId !== userId) {
        const otherBalances = simplifiedBalances[otherUserId] || {};
        const owedToUser = otherBalances[userId] || 0;
        
        if (owedToUser > 0) {
          breakdown.push({
            type: 'owed',
            otherUserId: otherUserId,
            otherUserName: this.getMemberName(otherUserId),
            amount: owedToUser,
            message: `${this.getMemberName(otherUserId)} owes ${this.getMemberName(userId)} ${this.formatCurrency(owedToUser)}`
          });
        }
      }
    });

    return breakdown.sort((a, b) => b.amount - a.amount);
  }

  // Get balance between two specific users (simplified)
  getBalanceBetweenUsers(userId1: string, userId2: string): number {
    const simplifiedBalances = this.calculateNetBalances();
    
    const balance1to2 = simplifiedBalances[userId1]?.[userId2] || 0;
    const balance2to1 = simplifiedBalances[userId2]?.[userId1] || 0;
    
    // Return net balance (positive = userId1 owes userId2, negative = userId2 owes userId1)
    return balance1to2 - balance2to1;
  }

  // Get simplified balance summary
  getBalanceSummary(): { owes: any[], owed: any[] } {
    const balances = this.getMemberBalances();
    const owes = balances.filter(b => b.netBalance < 0);
    const owed = balances.filter(b => b.netBalance > 0);
    return { owes, owed };
  }

  // Calculate who owes what to whom
  getSettlementSuggestions(): any[] {
    const balances = this.getMemberBalances();
    const suggestions: any[] = [];
    const transactions = this.transactions;
    
    if (!this.currentUser?.uid) return suggestions;

    // Find current user's balance
    const currentUserBalance = balances.find(b => b.userId === this.currentUser.uid);
    if (!currentUserBalance) return suggestions;

    const currentUserNetBalance = currentUserBalance.netBalance;

    if (currentUserNetBalance < 0) {
      // Current user owes money - show who they should pay
      const debtAmount = Math.abs(currentUserNetBalance);
      const creditors = balances.filter(b => b.netBalance > 0 && b.userId !== this.currentUser.uid);
      
      creditors.forEach(creditor => {
        const availableCredit = creditor.netBalance;
        
        // Use the new balance calculation to get exact amount owed
        const exactAmountOwed = this.getBalanceBetweenUsers(this.currentUser.uid, creditor.userId);
        
        if (exactAmountOwed > 0) {
          const settlementAmount = Math.min(exactAmountOwed, availableCredit);
          
          if (settlementAmount > 0) {
            suggestions.push({
              fromUserId: this.currentUser.uid,
              fromUserName: currentUserBalance.displayName,
              toUserId: creditor.userId,
              toUserName: creditor.displayName,
              amount: settlementAmount,
              currency: this.group?.currency || 'USD',
              type: 'you_owe',
              originalTransactionId: transactions.find(t => t.splits.some(s => s.userId === creditor.userId))?.originalTransactionId || ''
            });
          }
        }
      });
    } else if (currentUserNetBalance > 0) {
      // Current user is owed money - show who should pay them
      const creditAmount = currentUserNetBalance;
      const debtors = balances.filter(b => b.netBalance < 0 && b.userId !== this.currentUser.uid);
      
      debtors.forEach(debtor => {
        // Use the new balance calculation to get exact amount owed
        const exactAmountOwed = this.getBalanceBetweenUsers(debtor.userId, this.currentUser.uid);
        
        if (exactAmountOwed > 0) {
          const settlementAmount = Math.min(exactAmountOwed, creditAmount);
          
          if (settlementAmount > 0) {
            suggestions.push({
              fromUserId: debtor.userId,
              fromUserName: debtor.displayName,
              toUserId: this.currentUser.uid,
              toUserName: currentUserBalance.displayName,
              amount: settlementAmount,
              currency: this.group?.currency || 'USD',
              type: 'owed_to_you',
              originalTransactionId: transactions.find(t => t.splits.some(s => s.userId === debtor.userId))?.originalTransactionId || ''
            });
          }
        }
      });
    } else {
      // Current user is balanced - show other settlements that don't involve them
      const owes = balances.filter(b => b.netBalance < 0 && b.userId !== this.currentUser.uid);
      const owed = balances.filter(b => b.netBalance > 0 && b.userId !== this.currentUser.uid);

      owes.forEach(debtor => {
        const debtAmount = Math.abs(debtor.netBalance);
        let remainingDebt = debtAmount;

        owed.forEach(creditor => {
          if (remainingDebt <= 0) return;
          
          const availableCredit = creditor.netBalance;
          
          // Use the new balance calculation to get exact amount owed
          const exactAmountOwed = this.getBalanceBetweenUsers(debtor.userId, creditor.userId);
          
          if (exactAmountOwed > 0) {
            const settlementAmount = Math.min(remainingDebt, availableCredit, exactAmountOwed);
            
            if (settlementAmount > 0) {
              suggestions.push({
                fromUserId: debtor.userId,
                fromUserName: debtor.displayName,
                toUserId: creditor.userId,
                toUserName: creditor.displayName,
                amount: settlementAmount,
                currency: this.group?.currency || 'USD',
                type: 'others',
                originalTransactionId: transactions.find(t => t.splits.some(s => s.userId === debtor.userId))?.originalTransactionId || ''
              });
              
              remainingDebt -= settlementAmount;
            }
          }
        });
      });
    }

    // Filter out suggestions that already have settlements
    return suggestions.filter(suggestion => {
      const existingSettlement = this.settlements.find(s => 
        s.fromUserId === suggestion.fromUserId && 
        s.toUserId === suggestion.toUserId &&
        s.status !== 'cancelled'
      );
      return !existingSettlement;
    });
  }

  // Create settlement between members
  createSettlement(suggestion: any): void {
    if (!this.group) {
      this.notificationService.error('Group not found');
      return;
    }

    if (!this.currentUser?.uid) {
      this.notificationService.error('User not authenticated');
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Settlement',
        message: `Confirm settlement of ${this.formatCurrency(suggestion.amount)} from ${suggestion.fromUserName} to ${suggestion.toUserName}?`,
        confirmText: 'Confirm',
        cancelText: 'Cancel',
      },
    });

    dialogRef.afterClosed().subscribe((result: boolean) => {
      if (result) {
        try {
          console.log('Creating settlement:', suggestion);

          this.store.dispatch(SplitwiseActions.createSettlement({
            groupId: this.group!.id!,
            fromUserId: suggestion.fromUserId,
            toUserId: suggestion.toUserId,
            amount: suggestion.amount,
            notes: `Settlement created from balance summary`,
            originalTransactionId: suggestion.originalTransactionId
          }));

          // Show success notification
          this.notificationService.success('Settlement created successfully');
          
          // Reload data after a short delay to ensure the update is processed
          setTimeout(() => {
            this.reloadData();
          }, 1000);
        } catch (error) {
          console.error('Error creating settlement:', error);
          this.notificationService.error('Failed to create settlement');
        }
      }
    });
  }

  // Toggle balance display
  toggleBalanceDisplay(): void {
    this.showBalances = !this.showBalances;
  }

  // Get member balance color
  getBalanceColor(balance: number): string {
    if (balance > 0) return 'positive';
    if (balance < 0) return 'negative';
    return 'neutral';
  }

  // Get settlement subtitle based on current user's situation
  getSettlementSubtitle(): string {
    if (!this.currentUser?.uid) return 'Quick settlements to balance the group';
    
    const balances = this.getMemberBalances();
    const currentUserBalance = balances.find(b => b.userId === this.currentUser.uid);
    
    if (!currentUserBalance) return 'Quick settlements to balance the group';
    
    if (currentUserBalance.netBalance < 0) {
      return 'You owe money to these members';
    } else if (currentUserBalance.netBalance > 0) {
      return 'These members owe you money';
    } else {
      return 'Other members can settle their balances';
    }
  }

  // Get personalized settlement message
  getSettlementMessage(suggestion: any): string {
    switch (suggestion.type) {
      case 'you_owe':
        return `You owe ${suggestion.toUserName}`;
      case 'owed_to_you':
        return `${suggestion.fromUserName} owes you`;
      case 'others':
        return `${suggestion.fromUserName} owes ${suggestion.toUserName}`;
      default:
        return 'Settlement suggestion';
    }
  }

  // Get current user status message
  getCurrentUserStatus(balance: number): string {
    if (balance < 0) {
      return '(You owe)';
    } else if (balance > 0) {
      return '(You are owed)';
    } else {
      return '(Balanced)';
    }
  }

  // Get settlement status for a specific user pair
  getSettlementStatus(fromUserId: string, toUserId: string): { exists: boolean; status: string; amount: number } {
    const settlement = this.settlements.find(s => 
      s.fromUserId === fromUserId && 
      s.toUserId === toUserId
    );
    
    if (!settlement) {
      return { exists: false, status: '', amount: 0 };
    }
    
    return { 
      exists: true, 
      status: settlement.status, 
      amount: settlement.amount 
    };
  }

  // Check if a settlement suggestion is already pending
  isSettlementPending(fromUserId: string, toUserId: string): boolean {
    const settlement = this.settlements.find(s => 
      s.fromUserId === fromUserId && 
      s.toUserId === toUserId && 
      s.status === 'pending'
    );
    return !!settlement;
  }

  // Check if a settlement suggestion is already completed
  isSettlementCompleted(fromUserId: string, toUserId: string): boolean {
    const settlement = this.settlements.find(s => 
      s.fromUserId === fromUserId && 
      s.toUserId === toUserId && 
      s.status === 'completed'
    );
    return !!settlement;
  }

  // Get existing settlements summary
  getExistingSettlementsSummary(): any[] {
    if (!this.currentUser?.uid) return [];

    const summary: any[] = [];
    
    // Get settlements involving current user
    const userSettlements = this.settlements.filter(s => 
      (s.fromUserId === this.currentUser.uid || s.toUserId === this.currentUser.uid) &&
      s.status !== 'cancelled'
    );

    userSettlements.forEach(settlement => {
      const isFromUser = settlement.fromUserId === this.currentUser.uid;
      const otherUserId = isFromUser ? settlement.toUserId : settlement.fromUserId;
      const otherUserName = this.getMemberName(otherUserId);
      
      summary.push({
        fromUserId: settlement.fromUserId,
        fromUserName: this.getMemberName(settlement.fromUserId),
        toUserId: settlement.toUserId,
        toUserName: this.getMemberName(settlement.toUserId),
        amount: settlement.amount,
        currency: settlement.currency,
        status: settlement.status,
        isInvolvingCurrentUser: true,
        isFromCurrentUser: isFromUser,
        otherUserName: otherUserName
      });
    });

    return summary;
  }

  // Get pending settlements count
  getPendingSettlementsCount(): number {
    return this.settlements.filter(s => s.status === 'pending').length;
  }

  // Get completed settlements count
  getCompletedSettlementsCount(): number {
    return this.settlements.filter(s => s.status === 'completed').length;
  }

  // Get completed settlements
  getCompletedSettlements(): SplitSettlement[] {
    return this.settlements.filter(s => s.status === 'completed');
  }



  getTransactionCreatorName(transaction: SplitTransaction): string {
    return this.getMemberName(transaction.createdBy);
  }

  // Get transaction title
  getTransactionTitle(transaction: SplitTransaction): string {
    const memberCount = transaction.splits.length;
    return `Transaction (${memberCount} members)`;
  }



  getTotalTransactionAmount(): number {
    return this.transactions.reduce((total, transaction) => total + transaction.totalAmount, 0);
  }

  getTransactionCount(): number {
    return this.transactions.length;
  }

  getSettlementCount(): number {
    return this.settlements.length;
  }

  getMemberName(userId: string): string {
    if (!this.group) return 'Unknown';
    const member = this.group.members.find(m => m.userId === userId);
    return member?.displayName || 'Unknown';
  }

  // Debug method to show transaction details
  getTransactionDetails(): any[] {
    return this.transactions.map(transaction => {
      const totalSplitAmount = transaction.splits.reduce((sum, split) => sum + split.amount, 0);
      const splitRatio = transaction.totalAmount / totalSplitAmount;
      
      return {
        id: transaction.id,
        totalAmount: transaction.totalAmount,
        paidBy: this.getMemberName(transaction.createdBy),
        totalSplitAmount: totalSplitAmount,
        splitRatio: splitRatio,
        splits: transaction.splits.map(split => ({
          userId: split.userId,
          userName: this.getMemberName(split.userId),
          splitAmount: split.amount,
          actualAmount: split.amount * splitRatio,
          isPaidBy: split.userId === transaction.createdBy
        }))
      };
    });
  }



  toggleMembers(): void {
    // Navigate to the members page instead of toggling
    this.router.navigate(['dashboard/splitwise/members', this.group?.id]);
  }

  addTransaction(): void {
    // Navigate to add transaction page or open dialog
    this.router.navigate(['dashboard/transactions'], {
      queryParams: { 
        splitGroupId: this.group?.id,
        returnUrl: this.router.url
      }
    });
  }

  openEditTransactionDialog(transaction: SplitTransaction): void {
    if (!this.group) return;

    const dialogRef = this.dialog.open(EditTransactionDialogComponent, {
      data: {
        transaction: transaction,
        groupMembers: this.group.members
      },
      disableClose: true,
      panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : 'desktop-dialog',
    });

    dialogRef.afterClosed().subscribe((result: any) => {
      if (result) {
        // Update the transaction with new splits
        this.splitwiseService.updateSplitTransaction(transaction.id!, {
          amount: result.totalAmount,
          splits: result.splits
        }).then(() => {
          this.notificationService.success('Transaction updated successfully');
          this.reloadData();
        }).catch((error) => {
          console.error('Error updating transaction:', error);
          this.notificationService.error('Failed to update transaction');
        });
      }
    });
  }
} 