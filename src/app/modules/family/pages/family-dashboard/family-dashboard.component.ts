import { Component, inject, OnInit, ChangeDetectionStrategy, signal, computed, DestroyRef } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Store } from '@ngrx/store';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { FamilyTransaction, FamilyStats } from 'src/app/util/models/family.model';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';

@Component({
  selector: 'app-family-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule, MatRippleModule],
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

  family = signal<any>(null);
  members = signal<any[]>([]);
  transactions = signal<FamilyTransaction[]>([]);
  loading = signal(true);

  stats = computed(() => {
    const fam = this.family();
    if (!fam) return null;
    return this.familyService.computeStats(this.transactions(), this.members());
  });

  recentTxns = computed(() => this.transactions().slice(0, 5));

  private memberColors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];

  ngOnInit() {
    this.loadData();
  }

  private loadData() {
    this.loading.set(true);
    this.store.dispatch(FamilyActions.loadMyFamily());

    this.store.select(FamilySelectors.selectFamilyLoading)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(l => this.loading.set(l));

    this.store.select(FamilySelectors.selectFamily)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(fam => {
        this.family.set(fam);
        if (fam?.id) {
          this.store.dispatch(FamilyActions.loadMembers({ familyId: fam.id }));
          this.store.dispatch(FamilyActions.loadTransactions({ familyId: fam.id }));
        }
      });

    this.store.select(FamilySelectors.selectFamilyMembers)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(m => this.members.set(m));

    this.store.select(FamilySelectors.selectFamilyTransactions)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(t => this.transactions.set(t));
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
