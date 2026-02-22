import { Component, inject, OnInit, ChangeDetectionStrategy, signal, computed, DestroyRef } from '@angular/core';
import { Store } from '@ngrx/store';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AppState } from 'src/app/store/app.state';
import * as FamilySelectors from '../../store/family.selectors';
import { FamilyTransaction, FamilyMember, FamilyStats } from 'src/app/util/models/family.model';
import { FamilyService } from '../../services/family.service';

@Component({
  selector: 'app-family-reports',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './family-reports.component.html',
  styleUrls: ['./family-reports.component.scss']
})
export class FamilyReportsComponent implements OnInit {
  private store = inject(Store<AppState>);
  private familyService = inject(FamilyService);
  private destroyRef = inject(DestroyRef);

  members = signal<FamilyMember[]>([]);
  transactions = signal<FamilyTransaction[]>([]);
  loading = signal(true);

  stats = computed(() => {
    if (!this.transactions().length && !this.members().length) return null;
    return this.familyService.computeStats(this.transactions(), this.members());
  });

  categoryBreakdown = computed(() => {
    const expenses = this.transactions().filter(t => t.type === 'expense');
    const total = expenses.reduce((s, t) => s + t.amount, 0);
    const map = new Map<string, number>();
    expenses.forEach(t => map.set(t.category, (map.get(t.category) || 0) + t.amount));
    return Array.from(map.entries())
      .map(([category, amount]) => ({ category, amount, percentage: total > 0 ? (amount / total) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount);
  });

  private memberColors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];

  ngOnInit() {
    this.store.select(FamilySelectors.selectFamilyLoading).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(l => this.loading.set(l));
    this.store.select(FamilySelectors.selectFamilyTransactions).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(t => this.transactions.set(t));
    this.store.select(FamilySelectors.selectFamilyMembers).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(m => this.members.set(m));
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
