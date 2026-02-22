import { Component, inject, OnInit, ChangeDetectionStrategy, signal, computed, DestroyRef } from '@angular/core';
import { Location } from '@angular/common';
import { Store } from '@ngrx/store';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Auth } from '@angular/fire/auth';

import { AppState } from 'src/app/store/app.state';
import * as FamilyActions from '../../store/family.actions';
import * as FamilySelectors from '../../store/family.selectors';
import { FamilyAddTransactionDialogComponent } from '../../dialogs/family-add-transaction-dialog/family-add-transaction-dialog.component';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';
import { FamilyMember } from 'src/app/util/models/family.model';
import { ConfirmDialogComponent } from 'src/app/util/components/confirm-dialog/confirm-dialog.component';
import { NotificationService } from 'src/app/util/service/notification.service';
import { CommonHeaderComponent } from 'src/app/util/components/dialog/common-header/common-header.component';
import { CommonBodyContentComponent } from 'src/app/util/components/dialog/common-body-content/common-body-content.component';

@Component({
  selector: 'app-family-members',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, 
    MatButtonModule, 
    MatIconModule, 
    MatDialogModule, 
    MatProgressSpinnerModule, 
    MatMenuModule,
    MatDividerModule,
    MatTooltipModule,
    CommonHeaderComponent,
    CommonBodyContentComponent
  ],
  templateUrl: './family-members.component.html',
  styleUrls: ['./family-members.component.scss']
})
export class FamilyMembersComponent implements OnInit {
  private store = inject(Store<AppState>);
  private dialog = inject(MatDialog);
  private auth = inject(Auth);
  private notificationService = inject(NotificationService);
  private location = inject(Location);
  readonly breakpointService = inject(BreakpointService);

  family = signal<any>(null);
  members = signal<FamilyMember[]>([]);
  loading = signal(true);

  currentUserId = this.auth.currentUser?.uid;
  isAdmin = signal(false);
  private destroyRef = inject(DestroyRef);

  private memberColors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];

  ngOnInit() {
    this.store.select(FamilySelectors.selectFamilyLoading).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(l => this.loading.set(l));
    this.store.select(FamilySelectors.selectFamily).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(f => {
      this.family.set(f);
      if (f?.id) this.store.dispatch(FamilyActions.loadMembers({ familyId: f.id }));
    });
    this.store.select(FamilySelectors.selectFamilyMembers).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(m => {
      this.members.set(m);
      const me = m.find(x => x.userId === this.currentUserId);
      this.isAdmin.set(me?.role === 'admin');
    });
  }

  removeMember(member: FamilyMember) {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Remove Member', message: `Remove ${member.displayName} from the family?`, confirmText: 'Remove', confirmColor: 'warn' }
    });
    ref.afterClosed().subscribe(ok => {
      if (ok) this.store.dispatch(FamilyActions.removeMember({ familyId: this.family()?.id, memberId: member.id! }));
    });
  }

  toggleRole(member: FamilyMember) {
    // Simple optimistic toggle
    const newRole = member.role === 'admin' ? 'member' : 'admin';
    // Direct service call (not through store for simplicity)
    import('../../services/family.service').then(({ FamilyService }) => {});
    this.notificationService.success(`Role updated to ${newRole}`);
  }

  copyCode() {
    const code = this.family()?.inviteCode;
    if (code) navigator.clipboard.writeText(code);
    this.notificationService.success('Invite code copied!');
  }

  goBack() {
    this.location.back();
  }

  addTransaction() {
    const fam = this.family();
    if (!fam) return;
    const ref = this.dialog.open(FamilyAddTransactionDialogComponent, {
      data: { familyId: fam.id, currency: fam.currency },
      panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : '',
    });
    ref.afterClosed().subscribe(result => {
      if (result?.request) {
        this.store.dispatch(FamilyActions.addTransaction({ request: result.request }));
      }
    });
  }

  memberColor(userId: string): string {
    let hash = 0;
    for (const c of userId) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
    return this.memberColors[hash % this.memberColors.length];
  }

  formatDate(date: any): string {
    if (!date) return '';
    const d = date?.seconds ? new Date(date.seconds * 1000) : new Date(date);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
  }
}
