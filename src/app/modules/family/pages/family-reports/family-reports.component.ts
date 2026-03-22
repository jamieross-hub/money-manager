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
import * as CategoriesSelectors from 'src/app/store/categories/categories.selectors';
import * as ProfileSelectors from 'src/app/store/profile/profile.selectors';
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
    const cats = this.stats()?.categoryBreakdown || [];
    const allCats = this.allCategories() || [];
    return cats.filter(c => {
      const catObj = allCats.find(cat => cat.name.toLowerCase() === c.category.toLowerCase());
      return !catObj?.isSystem;
    });
  });

  allCategories = toSignal(this.store.select(CategoriesSelectors.selectAllCategories), { initialValue: [] });
  categoryViewMode = signal<'single' | 'group'>('group');

  groupedCategoryBreakdown = computed(() => {
    const allCats = this.allCategories() || [];
    let baseBreakdown: { category: string; amount: number }[] = [];
    let totalSpent = 0;

    if (this.categoryViewMode() === 'single') {
      const txs = this.transactions() || [];
      const profile = this.store.selectSignal(ProfileSelectors.selectProfile)();
      const uid = profile?.uid;
      if (!uid) return [];

      const fam = this.family();
      const mode = fam?.mode || 'common';
      const mList = this.members() || [];
      const activeMembers = mList.filter(m => m.isActive);

      const categoryMap = new Map<string, number>();
      let totalExpenseShare = 0;

      for (const t of txs) {
        const type = (t as any).type;
        const isExpense = type !== 'income' && type !== 1 && type !== '1';
        if (!isExpense) continue;

        const amount = Number(t.amount) || 0;
        if (amount <= 0) continue;

        let shareAmt = 0;

        if (t.splitData?.splitBetween && t.splitData.splitBetween.length > 0) {
          const share = t.splitData.splitBetween.find(s => s.userId === uid);
          if (share) shareAmt = Number(share.amount) || 0;
        } else {
          if (mode === 'common') {
            const activeCount = activeMembers.length || 1;
            shareAmt = Math.round((amount / activeCount) * 100) / 100;
          } else {
            if (t.userId === uid) shareAmt = amount;
          }
        }

        if (shareAmt > 0) {
          const cat = t.category || 'Uncategorized';
          const catObj = allCats.find(c => c.name.toLowerCase() === cat.toLowerCase());
          if (catObj?.isSystem) continue;

          totalExpenseShare += shareAmt;
          categoryMap.set(cat, (categoryMap.get(cat) || 0) + shareAmt);
        }
      }

      baseBreakdown = Array.from(categoryMap.entries()).map(([category, amount]) => ({ category, amount }));
      totalSpent = totalExpenseShare;
    } else {
      baseBreakdown = this.categoryBreakdown() || [];
      totalSpent = baseBreakdown.reduce((sum, b) => sum + b.amount, 0);
    }

    const groupMap = new Map<string, { category: string; amount: number; percentage: number; isGroup: boolean; groupIcon?: string; group?: string }>();

    for (const c of baseBreakdown) {
      const catObj = allCats.find(cat => cat.name.toLowerCase() === c.category.toLowerCase());
      const group = catObj?.group;

      if (group) {
        if (!groupMap.has(group)) {
          groupMap.set(group, { 
            category: group, 
            amount: 0, 
            percentage: 0, 
            isGroup: true, 
            groupIcon: catObj?.groupIcon, 
            group 
          });
        }
        const g = groupMap.get(group)!;
        g.amount += c.amount;
      } else {
        groupMap.set(c.category, { 
          category: c.category, 
          amount: c.amount, 
          percentage: 0, 
          isGroup: false, 
          groupIcon: catObj?.icon, 
          group: undefined 
        });
      }
    }

    return Array.from(groupMap.values()).map(g => ({
      ...g,
      percentage: totalSpent > 0 ? (g.amount / totalSpent) * 100 : 0
    })).sort((a, b) => b.amount - a.amount);
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
