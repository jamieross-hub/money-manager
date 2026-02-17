import { Component, Input, Output, EventEmitter , ChangeDetectionStrategy} from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Auth } from '@angular/fire/auth';
import { SplitwiseGroup } from 'src/app/util/models/splitwise.model';
import { AddMemberDialogComponent } from '../add-member-dialog/add-member-dialog.component';
import { CurrencyService } from 'src/app/util/service/currency.service';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';

@Component({
  selector: 'app-group',
  templateUrl: './group.component.html',
  styleUrls: ['./group.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GroupComponent {
  @Input() group!: SplitwiseGroup;
  @Input() isSelected: boolean = false;
  @Input() isMobile: boolean = false;
  @Output() groupSelected = new EventEmitter<SplitwiseGroup>();
  @Output() addMember = new EventEmitter<{ groupId: string, request: any }>();
  @Output() deleteGroup = new EventEmitter<SplitwiseGroup>();

  constructor(
    private router: Router,
    private auth: Auth,
    private dialog: MatDialog,
    public breakpointService: BreakpointService,
    private currencyService: CurrencyService
  ) { }

  onGroupClick(): void {
    // Navigate to group details page
    this.router.navigate(['dashboard/splitwise/group', this.group.id]);
  }

  openAddMemberDialog(event: Event): void {
    event.stopPropagation();

    const dialogRef = this.dialog.open(AddMemberDialogComponent, {
      data: { group: this.group },
      disableClose: true,
      panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : 'desktop-dialog',
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.addMember.emit({
          groupId: this.group.id!,
          request: result
        });
      }
    });
  }

  onDeleteGroup(event: Event): void {
    event.stopPropagation();
    this.deleteGroup.emit(this.group);
  }

  getGroupMemberCount(): number {
    return this.group.members.filter(member => member.isActive).length;
  }

  getCurrentUserRole(): string {
    const currentUser = this.auth.currentUser;
    if (!currentUser) return '';

    const member = this.group.members.find(m => m.userId === currentUser.uid);
    return member?.role || '';
  }

  canManageGroup(): boolean {
    const role = this.getCurrentUserRole();
    return role === 'admin' || role === 'owner';
  }

  formatDate(date: Date | any): string {
    if (!date) return '';
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    return dateObj.toLocaleDateString();
  }

  formatCurrency(amount: number, currency?: string): string {
    return this.currencyService.formatAmount(amount);
  }
} 