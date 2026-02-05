import { Component, Input, Output, EventEmitter } from '@angular/core';
import { SplitwiseGroup } from 'src/app/util/models/splitwise.model';
import { CurrencyService } from 'src/app/util/service/currency.service';

@Component({
  selector: 'app-members',
  templateUrl: './members.component.html',
  styleUrls: ['./members.component.scss']
})
export class MembersComponent {
  @Input() group!: SplitwiseGroup;
  @Input() isMobile: boolean = false;
  @Output() addMember = new EventEmitter<void>();
  Math = Math; // Make Math available in template

  constructor(private currencyService: CurrencyService) { }

  formatCurrency(amount: number, currency?: string): string {
    return this.currencyService.formatAmount(amount);
  }

  getGroupMemberCount(): number {
    return this.group?.members.filter(member => member.isActive).length || 0;
  }

  getPositiveBalanceMembers(): any[] {
    if (!this.group) return [];
    // This should be calculated from transactions, not from member.balance
    // For now, return empty array - this needs to be implemented with proper balance calculation
    return [];
  }

  getNegativeBalanceMembers(): any[] {
    if (!this.group) return [];
    // This should be calculated from transactions, not from member.balance
    // For now, return empty array - this needs to be implemented with proper balance calculation
    return [];
  }

  getNeutralBalanceMembers(): any[] {
    if (!this.group) return [];
    // This should be calculated from transactions, not from member.balance
    // For now, return empty array - this needs to be implemented with proper balance calculation
    return [];
  }

  onAddMember(): void {
    this.addMember.emit();
  }
} 