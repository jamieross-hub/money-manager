import { Component, inject, OnInit, ChangeDetectionStrategy, signal, computed, effect, DestroyRef } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Store } from '@ngrx/store';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { Auth } from '@angular/fire/auth';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatRippleModule } from '@angular/material/core';

import { AppState } from 'src/app/store/app.state';
import * as FamilyActions from '../../store/family.actions';
import * as FamilySelectors from '../../store/family.selectors';
import { FamilyService } from '../../services/family.service';
import { FamilyCreateDialogComponent } from '../../dialogs/family-create-dialog/family-create-dialog.component';
import { FamilyJoinDialogComponent } from '../../dialogs/family-join-dialog/family-join-dialog.component';
import { FamilyAddTransactionDialogComponent } from '../../dialogs/family-add-transaction-dialog/family-add-transaction-dialog.component';
import { FamilyTransaction, FamilyStats, Family, FamilyMember } from 'src/app/util/models/family.model';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';
import { QuickActionsFabComponent, QuickActionsFabConfig, QuickAction } from 'src/app/util/components/floating-action-buttons/quick-actions-fab/quick-actions-fab.component';

@Component({
  selector: 'app-family-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, 
    RouterModule, 
    MatButtonModule, 
    MatIconModule, 
    MatProgressSpinnerModule, 
    MatTooltipModule, 
    MatRippleModule,
    QuickActionsFabComponent
  ],
  templateUrl: './family-dashboard.component.html',
  styleUrls: ['./family-dashboard.component.scss']
})
export class FamilyDashboardComponent implements OnInit {
  private store = inject(Store<AppState>);
  private dialog = inject(MatDialog);
  private auth = inject(Auth);
  private familyService = inject(FamilyService);
  private router = inject(Router);
  readonly breakpointService = inject(BreakpointService);
  private destroyRef = inject(DestroyRef);

  family = toSignal(this.store.select(FamilySelectors.selectFamily), { initialValue: null });
  members = toSignal(this.store.select(FamilySelectors.selectFamilyMembers), { initialValue: [] as FamilyMember[] });
  transactions = toSignal(this.store.select(FamilySelectors.selectFamilyTransactions), { initialValue: [] as FamilyTransaction[] });
  recentTxns = toSignal(this.store.select(FamilySelectors.selectRecentTransactions), { initialValue: [] as FamilyTransaction[] });
  loading = toSignal(this.store.select(FamilySelectors.selectFamilyLoading), { initialValue: true });

  constructor() {
    effect(() => {
      const fam = this.family();
      if (fam?.id) {
        this.store.dispatch(FamilyActions.loadMembers({ familyId: fam.id }));
        this.store.dispatch(FamilyActions.loadTransactions({ familyId: fam.id }));
      }
    }, { allowSignalWrites: true });
  }

  stats = computed(() => {
    const fam = this.family();
    if (!fam) return null;
    return this.familyService.computeStats(this.transactions(), this.members());
  });

  // No longer needed: recentTxns is now a toSignal

  fabConfig = computed<QuickActionsFabConfig>(() => ({
    mainButtonIcon: 'add',
    mainButtonColor: 'primary',
    mainButtonTooltip: 'Add Transaction',
    actions: []
  }));

  private memberColors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];

  ngOnInit() {
    this.store.dispatch(FamilyActions.loadMyFamily());
  }

  createFamily() {
    const ref = this.dialog.open(FamilyCreateDialogComponent, { disableClose: true });
    ref.afterClosed().subscribe(result => {
      if (result) this.store.dispatch(FamilyActions.createFamily({ request: result }));
    });
  }

  joinFamily() {
    const ref = this.dialog.open(FamilyJoinDialogComponent, { disableClose: true });
    ref.afterClosed().subscribe(code => {
      if (code) this.store.dispatch(FamilyActions.joinFamily({ inviteCode: code }));
    });
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

  copyCode(code: string) {
    navigator.clipboard.writeText(code);
  }

  memberColor(userId: string): string {
    let hash = 0;
    for (const c of userId) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
    return this.memberColors[hash % this.memberColors.length];
  }

  formatDate(date: any): string {
    if (!date) return '';
    const d = date?.seconds ? new Date(date.seconds * 1000) : new Date(date);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }
}
