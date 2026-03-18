import { Component, inject, OnInit, ChangeDetectionStrategy, signal, computed, DestroyRef } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, debounceTime } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AppState } from 'src/app/store/app.state';
import * as FamilySelectors from '../../store/family.selectors';
import * as TransactionsSelectors from 'src/app/store/transactions/transactions.selectors';
import { FamilyMember, FamilyStats } from 'src/app/util/models/family.model';
import { Transaction } from 'src/app/util/models/transaction.model';
import { FamilyService } from '../../services/family.service';
import { FamilyProcessorService } from 'src/app/util/service/family-processor.service';
import { CurrencyPipe } from 'src/app/util/pipes';

@Component({
  selector: 'app-family-reports',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule,CurrencyPipe],
  templateUrl: './family-reports.component.html',
  styleUrls: ['./family-reports.component.scss']
})
export class FamilyReportsComponent implements OnInit {
  private store = inject(Store<AppState>);
  private familyService = inject(FamilyService);
  private destroyRef = inject(DestroyRef);
  private familyProcessor = inject(FamilyProcessorService);

  members      = toSignal(this.store.select(FamilySelectors.selectFamilyMembers).pipe(debounceTime(50), distinctUntilChanged((a, b) => a.length === b.length)), { initialValue: [] as FamilyMember[] });
  transactions = toSignal(this.store.select(TransactionsSelectors.selectAllTransactions).pipe(debounceTime(50), distinctUntilChanged((a, b) => a.length === b.length && a[0]?.id === b[0]?.id && (a[0] as any)?.updatedAt === (b[0] as any)?.updatedAt)), { initialValue: [] as Transaction[] });
  loading      = toSignal(this.store.select(TransactionsSelectors.selectTransactionsLoading).pipe(distinctUntilChanged()), { initialValue: true });
  family       = toSignal(this.store.select(FamilySelectors.selectFamily));

  stats = this.familyProcessor.stats;

  categoryBreakdown = computed(() => {
    return this.stats()?.categoryBreakdown || [];
  });

  dateRange = computed(() => {
    const tx = this.transactions() || [];
    if (tx.length === 0) return 'No data';
    const dates = tx.map(t => {
      const d = t.date;
      if (!d) return 0;
      if (d instanceof Date) return d.getTime();
      if ((d as any).toDate) return (d as any).toDate().getTime();
      if ((d as any).seconds) return (d as any).seconds * 1000;
      return new Date(d as any).getTime();
    }).filter(v => !!v).sort((a, b) => a - b);
    if (dates.length === 0) return 'No data';
    const min = new Date(dates[0]);
    const max = new Date(dates[dates.length - 1]);
    const format = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return `${format(min)} – ${format(max)}`;
  });

  topSpender = computed(() => {
    const members = this.stats()?.memberBreakdown || [];
    if (members.length === 0) return null;
    let top = members[0];
    for (const m of members) {
      if (m.totalPaid > top.totalPaid) {
        top = m;
      }
    }
    return top.totalPaid > 0 ? { name: top.displayName, amount: top.totalPaid } : null;
  });

  topCategory = computed(() => {
    const cats = this.categoryBreakdown() || [];
    if (cats.length === 0) return null;
    let top = cats[0];
    for (const c of cats) {
      if (c.amount > top.amount) {
        top = c;
      }
    }
    const total = this.stats()?.totalExpense || 1;
    const pct = (top.amount / total) * 100;
    return top.amount > 0 ? { name: top.category, amount: top.amount, percentage: pct } : null;
  });

  largestExpense = computed(() => {
    const txs = this.transactions() || [];
    const expenses = txs.filter(t => {
      const type = (t as any).type;
      return type !== 'income' && type !== 1 && type !== '1';
    });
    if (expenses.length === 0) return null;
    let large = expenses[0];
    for (const t of expenses) {
      if (Number(t.amount) > Number(large.amount)) {
        large = t;
      }
    }
    return Number(large.amount) > 0 ? { note: large.note || large.category, amount: Number(large.amount) } : null;
  });

  private memberColors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];

  ngOnInit() {
    // Parent handles store dispatches or routing params handle them
  }

  memberColor(userId: string): string {
    let hash = 0;
    for (const c of userId) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
    return this.memberColors[hash % this.memberColors.length];
  }

  getCategoryIcon(cat: string): string {
    const map: Record<string, string> = {
      'Food & Dining': 'restaurant', 'Groceries': 'shopping_basket', 'Transport': 'directions_car',
      'Utilities': 'bolt', 'Rent/EMI': 'home', 'Healthcare': 'local_hospital',
      'Education': 'school', 'Shopping': 'shopping_bag', 'Entertainment': 'movie',
      'Travel': 'flight', 'Salary': 'payments', 'Business': 'business_center',
    };
    return map[cat] || 'category';
  }
}
