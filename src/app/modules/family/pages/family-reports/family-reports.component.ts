import { Component, inject, OnInit, ChangeDetectionStrategy, signal, computed, DestroyRef, effect, untracked, OnDestroy } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { trigger, transition, style, animate } from '@angular/animations';
import { distinctUntilChanged, debounceTime } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import { CommonModule, DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import dayjs from 'dayjs';

import { AppState } from 'src/app/store/app.state';
import * as FamilySelectors from '../../store/family.selectors';
import * as TransactionsSelectors from 'src/app/store/transactions/transactions.selectors';
import * as CategoriesSelectors from 'src/app/store/categories/categories.selectors';
import * as ProfileSelectors from 'src/app/store/profile/profile.selectors';
import { FamilyMember } from 'src/app/util/models/family.model';
import { Transaction } from 'src/app/util/models/transaction.model';
import { FamilyService } from '../../services/family.service';
import { FamilyProcessorService } from 'src/app/util/service/family-processor.service';
import { CurrencyPipe, AbsPipe } from 'src/app/util/pipes';
import { PwaNavigationService } from 'src/app/util/service/pwa-navigation.service';
import { FamilyModeInfoSheet } from '../../dialogs/family-mode-info-sheet/family-mode-info-sheet';
import { DateUtil } from 'src/app/util/helpers/date.util';

// Material Modules 
import { MatTableModule } from '@angular/material/table';
import { MatDividerModule } from '@angular/material/divider';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-family-reports',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, 
    DecimalPipe, 
    MatButtonModule, 
    MatIconModule, 
    MatProgressSpinnerModule, 
    MatButtonToggleModule, 
    MatSelectModule, 
    MatFormFieldModule, 
    CurrencyPipe,
    AbsPipe,
    MatTableModule,
    MatDividerModule,
    MatCardModule
  ],
  templateUrl: './family-reports.component.html',
  styleUrls: ['./family-reports.component.scss'],
  animations: [
    trigger('expandCollapse', [
      transition(':enter', [
        style({ height: '0', opacity: 0, overflow: 'hidden' }),
        animate('300ms cubic-bezier(0.4, 0.0, 0.2, 1)', style({ height: '*', opacity: 1 }))
      ]),
      transition(':leave', [
        style({ height: '*', opacity: 1, overflow: 'hidden' }),
        animate('300ms cubic-bezier(0.4, 0.0, 0.2, 1)', style({ height: '0', opacity: 0 }))
      ])
    ])
  ]
})
export class FamilyReportsComponent implements OnInit, OnDestroy {
  private store = inject(Store<AppState>);
  private familyService = inject(FamilyService);
  private destroyRef = inject(DestroyRef);
  private familyProcessor = inject(FamilyProcessorService);
  private pwaNavigationService = inject(PwaNavigationService);

  members      = toSignal(this.store.select(FamilySelectors.selectFamilyMembers).pipe(debounceTime(50), distinctUntilChanged((a: FamilyMember[], b: FamilyMember[]) => a.length === b.length)), { initialValue: [] as FamilyMember[] });
  transactions = toSignal(this.store.select(TransactionsSelectors.selectAllTransactions).pipe(debounceTime(100), distinctUntilChanged((a: Transaction[], b: Transaction[]) => a.length === b.length && a[0]?.id === b[0]?.id && (a[0] as any)?.updatedAt === (b[0] as any)?.updatedAt)), { initialValue: [] as Transaction[] });
  loading      = toSignal(this.store.select(TransactionsSelectors.selectTransactionsLoading).pipe(distinctUntilChanged()), { initialValue: true });
  family       = toSignal(this.store.select(FamilySelectors.selectFamily));

  stats = this.familyProcessor.stats;
  isInsightsExpanded = signal(false);

  // Period selector (Signals)
  selectedPeriod = signal<'weekly' | 'monthly' | 'yearly'>('monthly');
  selectedYear = signal<number>(new Date().getFullYear());
  selectedMonth = signal<number | null>(new Date().getMonth());
  selectedWeekOffset = signal<number>(0);

  readonly periodOptions: ('weekly' | 'monthly' | 'yearly')[] = ['weekly', 'monthly', 'yearly'];
  readonly availableYears = computed(() => {
    const txns = this.transactions();
    if (!txns || txns.length === 0) return [new Date().getFullYear()];
    const years = new Set<number>();
    txns.forEach((t: Transaction) => {
      const d = DateUtil.toDate(t.date);
      if (d) years.add(d.getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  });

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
  monthlySummaries = this.familyProcessor.monthlySummaries;
  filteredMonthlySummaries = this.familyProcessor.filteredMonthlySummaries;
  expandedCategoryId = signal<string | null>(null);

  toggleExpand(categoryId: string): void {
    this.expandedCategoryId.update(current => current === categoryId ? null : categoryId);
  }

  private toDateHelper(d: any): Date | null {
    if (!d) return null;
    if (d instanceof Date) return d;
    return DateUtil.toDate(d);
  }

  expandedItemData = computed(() => {
    const catId = this.expandedCategoryId();
    if (!catId) return null;

    const allTxns = this.transactions() || [];
    const allCats = this.allCategories() || [];
    const profile = this.store.selectSignal(ProfileSelectors.selectProfile)();
    const uid = profile?.uid;

    // Filter transactions relevant to the current user if in single mode
    let txns = allTxns;
    if (this.categoryViewMode() === 'single' && uid) {
      const mode = this.family()?.mode || 'common';
      const mList = this.members() || [];
      const activeMembers = mList.filter(m => m.isActive);

      txns = allTxns.filter(t => {
        const type = (t as any).type;
        const isExpense = type !== 'income' && type !== 1 && type !== '1';
        if (!isExpense) return false;

        const amount = Number(t.amount) || 0;
        if (amount <= 0) return false;

        if (t.splitData?.splitBetween && t.splitData.splitBetween.length > 0) {
          return t.splitData.splitBetween.some(s => s.userId === uid && Number(s.amount) > 0);
        } else {
          if (mode === 'common') return true; // In common mode, everyone shares all transactions
          return t.userId === uid;
        }
      });
    } else {
      // In group mode, just filter for expenses
      txns = allTxns.filter(t => {
        const type = (t as any).type;
        return type !== 'income' && type !== 1 && type !== '1';
      });
    }

    if (catId.startsWith('group_')) {
      const groupName = catId.replace('group_', '');
      const groupCatIds = new Set(allCats.filter(c => c.group === groupName).map(c => c.name.toLowerCase()));
      const items = txns.filter(t => t.category && groupCatIds.has(t.category.toLowerCase()));
      
      const breakdownMap = new Map<string, { categoryName: string; amount: number; transactionCount: number; categoryIcon?: string }>();
      let totalGroupAmount = 0;

      for (const t of items) {
        const catName = t.category || 'Uncategorized';
        const amt = Number(t.amount) || 0;
        if (!breakdownMap.has(catName)) {
          const cObj = allCats.find(c => c.name.toLowerCase() === catName.toLowerCase());
          breakdownMap.set(catName, { 
            categoryName: catName, 
            amount: 0, 
            transactionCount: 0,
            categoryIcon: cObj?.icon
          });
        }
        const b = breakdownMap.get(catName)!;
        b.amount += amt;
        b.transactionCount += 1;
        totalGroupAmount += amt;
      }

      const breakdown = Array.from(breakdownMap.values()).map(b => ({
        ...b,
        categoryId: b.categoryName,
        percentage: totalGroupAmount > 0 ? (b.amount / totalGroupAmount) * 100 : 0
      })).sort((a, b) => b.amount - a.amount);

      return {
        isGroup: true,
        groupName,
        transactions: items.map(t => ({ ...t, date: this.toDateHelper(t.date) })).sort((a, b) => ((b.date as Date)?.getTime() || 0) - ((a.date as Date)?.getTime() || 0)),
        breakdown
      };
    } else {
      const items = txns.filter(t => t.category && t.category.toLowerCase() === catId.toLowerCase());
      return {
        isGroup: false,
        transactions: items.map(t => ({ ...t, date: this.toDateHelper(t.date) })).sort((a, b) => ((b.date as Date)?.getTime() || 0) - ((a.date as Date)?.getTime() || 0))
      };
    }
  });

  totalHistory = computed(() => {
    const hist = this.filteredMonthlySummaries() || [];
    return hist.reduce((acc, curr) => ({
      income: acc.income + (curr.income || 0),
      expense: acc.expense + (curr.expense || 0),
      savings: acc.savings + (curr.savings || 0),
    }), { income: 0, expense: 0, savings: 0 });
  });

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
      totalSpent = baseBreakdown.reduce((sum: number, b: { amount: number }) => sum + b.amount, 0);
    }

    const groupMap = new Map<string, { 
      category: string; 
      amount: number; 
      percentage: number; 
      isGroup: boolean; 
      groupIcon?: string; 
      group?: string;
      categoryColor?: string;
    }>();

    for (const c of baseBreakdown as any[]) {
      const catObj = allCats.find((cat: any) => cat.name.toLowerCase() === c.category.toLowerCase());
      const group = catObj?.group;
      let color = catObj?.color;

      if (group) {
        if (!groupMap.has(group)) {
          groupMap.set(group, { 
            category: group, 
            amount: 0, 
            percentage: 0, 
            isGroup: true, 
            groupIcon: catObj?.groupIcon, 
            group,
            categoryColor: color || this.stringToColor(group)
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
          group: undefined,
          categoryColor: color || this.stringToColor(c.category)
        });
      }
    }

    const groupItems = Array.from(groupMap.values());
    const maxAmount = groupItems.length > 0 ? Math.max(...groupItems.map((g: any) => g.amount)) : 0;

    return groupItems.map((g: any) => {
      const isGroup = g.isGroup;
      const categoryId = isGroup ? 'group_' + g.group : g.category;
      const categoryName = isGroup ? g.group : g.category;
      
      return {
        ...g,
        categoryId,
        categoryName,
        percentage: maxAmount > 0 ? (g.amount / maxAmount) * 100 : 0
      };
    }).sort((a: any, b: any) => b.amount - a.amount);
  });

  private stringToColor(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
  }

  dateRange = computed(() => {
    const tx = this.transactions() || [];
    if (tx.length === 0) return 'No data';
    const dates = tx.map((t: Transaction) => {
      const d = t.date;
      if (!d) return 0;
      if (d instanceof Date) return d.getTime();
      return DateUtil.toDate(d)?.getTime() || 0;
    }).filter((v: number) => !!v).sort((a: number, b: number) => a - b);
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
    const expenses = txs.filter((t: Transaction) => {
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

  smartInsights = computed(() => {
    const insights = [];
    const ts = this.topSpender();
    const tc = this.topCategory();
    const le = this.largestExpense();

    if (ts) {
      insights.push({
        type: 'spender',
        label: 'Top Spender',
        value: ts.name,
        amount: ts.amount,
        isCurrency: true,
        icon: 'payments',
        colorClass: 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300',
        badgeClass: 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/20 text-red-600 dark:text-red-400'
      });
    }

    if (tc) {
      insights.push({
        type: 'category',
        label: 'Top Category',
        value: tc.name,
        amount: tc.percentage,
        isPercentage: true,
        icon: 'category',
        colorClass: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300',
        badgeClass: 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/20 text-amber-600 dark:text-amber-400'
      });
    }

    if (le) {
      insights.push({
        type: 'expense',
        label: 'Largest Expense',
        value: le.note,
        amount: le.amount,
        isCurrency: true,
        icon: 'receipt_long',
        colorClass: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300',
        badgeClass: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/20 text-emerald-600 dark:text-emerald-400'
      });
    }

    return insights;
  });

  private memberColors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];

  constructor() {
    // Effect to sync filtered transactions with processor
    effect(() => {
      const mode = this.family()?.mode;
      const allTxns = this.transactions() || [];
      const period = this.selectedPeriod();
      const year = this.selectedYear();
      const month = this.selectedMonth();
      const offset = this.selectedWeekOffset();

      if (mode === 'common') {
        const filtered = this.filterTransactions(allTxns, period, year, month, offset);
        untracked(() => {
          this.familyProcessor.transactionsOverride.set(filtered);
          this.familyProcessor.process({
            transactions: filtered,
            allTransactions: allTxns,
            members: this.members() || [],
            settlements: [],
            familyId: this.family()?.id || '',
            mode: 'common',
            currentUserId: undefined,
            sessionStartTime: Date.now(),
            selectedPeriod: period,
            selectedYear: year,
            selectedMonth: month,
            selectedWeekOffset: offset
          });
        });
      } else {
        untracked(() => {
          this.familyProcessor.transactionsOverride.set(null);
        });
      }
    });
  }

  ngOnInit() {}

  ngOnDestroy() {
    this.familyProcessor.transactionsOverride.set(null);
  }

  private filterTransactions(txns: Transaction[], period: string, year: number, month: number | null, offset: number): Transaction[] {
    if (period === 'monthly') {
      const targetMonth = month ?? new Date().getMonth();
      return txns.filter(t => {
        const d = dayjs(DateUtil.toDate(t.date));
        return d.year() === year && d.month() === targetMonth;
      });
    } else if (period === 'yearly') {
      return txns.filter(t => {
        const d = dayjs(DateUtil.toDate(t.date));
        return d.year() === year;
      });
    } else if (period === 'weekly') {
      const startOfWeek = dayjs().add(offset, 'week').startOf('week');
      const endOfWeek = dayjs().add(offset, 'week').endOf('week');
      return txns.filter(t => {
        const d = dayjs(DateUtil.toDate(t.date));
        return d.isAfter(startOfWeek.subtract(1, 'ms')) && d.isBefore(endOfWeek.add(1, 'ms'));
      });
    }
    return txns;
  }

  getPeriodLabel(): string {
    const period = this.selectedPeriod();
    if (period === 'monthly') {
      return dayjs().month(this.selectedMonth() || 0).year(this.selectedYear()).format('MMMM YYYY');
    } else if (period === 'yearly') {
      return this.selectedYear().toString();
    } else if (period === 'weekly') {
      const start = dayjs().add(this.selectedWeekOffset(), 'week').startOf('week');
      const end = dayjs().add(this.selectedWeekOffset(), 'week').endOf('week');
      return `${start.format('DD MMM')} - ${end.format('DD MMM YYYY')}`;
    }
    return '';
  }

  selectPeriod(period: 'weekly' | 'monthly' | 'yearly'): void {
    this.selectedPeriod.set(period);
    this.selectedWeekOffset.set(0);
    if (period === 'yearly') this.selectedMonth.set(null);
    else if (this.selectedMonth() === null) this.selectedMonth.set(new Date().getMonth());
  }

  previousPeriod(): void {
    const period = this.selectedPeriod();
    if (period === 'weekly') {
      this.selectedWeekOffset.update((o: number) => o - 1);
    } else if (period === 'monthly') {
      if (this.selectedMonth() === 0) {
        this.selectedMonth.set(11);
        this.selectedYear.update((y: number) => y - 1);
      } else {
        this.selectedMonth.update((m: number | null) => (m || 0) - 1);
      }
    } else if (period === 'yearly') {
      this.selectedYear.update((y: number) => y - 1);
    }
  }

  nextPeriod(): void {
    const period = this.selectedPeriod();
    if (period === 'weekly') {
      this.selectedWeekOffset.update((o: number) => o + 1);
    } else if (period === 'monthly') {
      if (this.selectedMonth() === 11) {
        this.selectedMonth.set(0);
        this.selectedYear.update((y: number) => y + 1);
      } else {
        this.selectedMonth.update((m: number | null) => (m || 0) + 1);
      }
    } else if (period === 'yearly') {
      this.selectedYear.update((y: number) => y + 1);
    }
  }

  canGoNext(): boolean {
    const period = this.selectedPeriod();
    if (period === 'weekly') return this.selectedWeekOffset() < 0;
    if (period === 'monthly') {
      const now = dayjs();
      const selected = dayjs().year(this.selectedYear()).month(this.selectedMonth() || 0);
      return selected.isBefore(now, 'month');
    }
    if (period === 'yearly') return this.selectedYear() < new Date().getFullYear();
    return false;
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

  openModeInfo(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.pwaNavigationService.openBottomSheet(FamilyModeInfoSheet, {
      panelClass: ['bg-transparent', 'auto-height-sheet'],
      closeOnNavigation: false,
    });
  }
}
