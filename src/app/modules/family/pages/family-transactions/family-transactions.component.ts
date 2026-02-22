import { Component, inject, OnInit, ChangeDetectionStrategy, signal, computed, DestroyRef } from '@angular/core';
import { Store } from '@ngrx/store';
import { MatDialog } from '@angular/material/dialog';
import { Auth } from '@angular/fire/auth';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AppState } from 'src/app/store/app.state';
import * as FamilyActions from '../../store/family.actions';
import * as FamilySelectors from '../../store/family.selectors';
import { FamilyTransaction, FamilyMember } from 'src/app/util/models/family.model';
import { FamilyAddTransactionDialogComponent } from '../../dialogs/family-add-transaction-dialog/family-add-transaction-dialog.component';
import { ConfirmDialogComponent } from 'src/app/util/components/confirm-dialog/confirm-dialog.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';

@Component({
  selector: 'app-family-transactions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatSelectModule, MatFormFieldModule, FormsModule,
    MatProgressSpinnerModule, MatChipsModule, MatTooltipModule],
  templateUrl: './family-transactions.component.html',
  styleUrls: ['./family-transactions.component.scss']
})
export class FamilyTransactionsComponent implements OnInit {
  private store = inject(Store<AppState>);
  private dialog = inject(MatDialog);
  private auth = inject(Auth);
  readonly breakpointService = inject(BreakpointService);

  family = signal<any>(null);
  members = signal<FamilyMember[]>([]);
  transactions = signal<FamilyTransaction[]>([]);
  loading = signal(true);

  selectedType: 'all' | 'income' | 'expense' = 'all';
  selectedMember: string | null = null;

  typeFilters: { label: string, value: 'all' | 'income' | 'expense' }[] = [
    { label: 'All', value: 'all' },
    { label: 'Expenses', value: 'expense' },
    { label: 'Income', value: 'income' },
  ];

  filtered = computed(() => this.transactions().filter(tx => {
    const typeOk = this.selectedType === 'all' || tx.type === this.selectedType;
    const memberOk = !this.selectedMember || tx.userId === this.selectedMember;
    return typeOk && memberOk;
  }));

  filteredIncome = computed(() => this.filtered().filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0));
  filteredExpense = computed(() => this.filtered().filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0));

  private currentUserId = this.auth.currentUser?.uid;
  private isAdmin = signal(false);
  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    this.store.select(FamilySelectors.selectFamilyLoading).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(l => this.loading.set(l));
    this.store.select(FamilySelectors.selectFamily).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(f => {
      this.family.set(f);
      if (f?.id) {
        this.store.dispatch(FamilyActions.loadTransactions({ familyId: f.id }));
        this.store.dispatch(FamilyActions.loadMembers({ familyId: f.id }));
      }
    });
    this.store.select(FamilySelectors.selectFamilyTransactions).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(t => this.transactions.set(t));
    this.store.select(FamilySelectors.selectFamilyMembers).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(m => {
      this.members.set(m);
      const me = m.find(x => x.userId === this.currentUserId);
      this.isAdmin.set(me?.role === 'admin');
    });
  }

  canEdit(tx: FamilyTransaction) {
    return this.isAdmin() || tx.userId === this.currentUserId;
  }

  addTx() {
    const fam = this.family();
    if (!fam) return;
    const ref = this.dialog.open(FamilyAddTransactionDialogComponent, {
      data: { familyId: fam.id, currency: fam.currency },
      panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : '',
    });
    ref.afterClosed().subscribe(r => {
      if (r?.request) this.store.dispatch(FamilyActions.addTransaction({ request: r.request }));
    });
  }

  editTx(tx: FamilyTransaction) {
    const fam = this.family();
    if (!fam) return;
    const ref = this.dialog.open(FamilyAddTransactionDialogComponent, {
      data: { familyId: fam.id, currency: fam.currency, transaction: tx },
      panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : '',
    });
    ref.afterClosed().subscribe(r => {
      if (r?.isEditing && r?.request) {
        this.store.dispatch(FamilyActions.updateTransaction({ txId: r.txId, request: r.request }));
      }
    });
  }

  deleteTx(tx: FamilyTransaction) {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Delete Transaction', message: `Delete this ${tx.category} entry of ${tx.amount}?`, confirmText: 'Delete', confirmColor: 'warn' }
    });
    ref.afterClosed().subscribe(ok => {
      if (ok) this.store.dispatch(FamilyActions.deleteTransaction({ txId: tx.id! }));
    });
  }

  formatDate(date: any): string {
    if (!date) return '';
    const d = date?.seconds ? new Date(date.seconds * 1000) : new Date(date);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
  }
}
