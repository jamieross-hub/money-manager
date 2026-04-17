import { Component, inject, OnInit, ChangeDetectionStrategy, signal, computed, effect, untracked, OnDestroy } from '@angular/core';
import { RouterModule } from '@angular/router';
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
import { FamilyMember, Settlement } from 'src/app/util/models/family.model';
import { Transaction } from 'src/app/util/models/transaction.model';
import { FamilyReportsProcessorService } from 'src/app/util/service/family-reports-processor.service';
import { CurrencyPipe, AbsPipe } from 'src/app/util/pipes';
import { PwaNavigationService } from 'src/app/util/service/pwa-navigation.service';
import { FamilyModeInfoSheet } from '../../dialogs/family-mode-info-sheet/family-mode-info-sheet';
import { DateUtil } from 'src/app/util/helpers/date.util';
import { AppViewService } from 'src/app/util/service/app-view.service';
import { FamilyService } from '../../services/family.service';
import * as FamilyActions from '../../store/family.actions';
import { Family } from 'src/app/util/models/family.model';
import { CategoryReportItem, ExpandedReportData } from 'src/app/util/models/report-card.model';
import { CategoryReportItemComponent } from 'src/app/util/components/cards/category-report-item/category-report-item.component';

// Material Modules 
import { MatTableModule } from '@angular/material/table';
import { MatDividerModule } from '@angular/material/divider';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';

import { MathPipe } from 'src/app/util/pipes/math.pipe';

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
    MatCardModule,
    MatTooltipModule,
    MathPipe,
    CategoryReportItemComponent,
    RouterModule
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
  private reportsProcessor = inject(FamilyReportsProcessorService);
  private pwaNavigationService = inject(PwaNavigationService);
  private appViewService = inject(AppViewService);
  private familyService = inject(FamilyService);

  members      = toSignal(this.store.select(FamilySelectors.selectFamilyMembers).pipe(debounceTime(50), distinctUntilChanged((a: FamilyMember[], b: FamilyMember[]) => a.length === b.length)), { initialValue: [] as FamilyMember[] });
  transactions = toSignal(this.store.select(TransactionsSelectors.selectAllTransactions).pipe(debounceTime(100), distinctUntilChanged((a: Transaction[], b: Transaction[]) => a.length === b.length && a[0]?.id === b[0]?.id && (a[0] as any)?.updatedAt === (b[0] as any)?.updatedAt)), { initialValue: [] as Transaction[] });
  loading      = toSignal(this.store.select(TransactionsSelectors.selectTransactionsLoading).pipe(distinctUntilChanged()), { initialValue: true });
  family       = toSignal(this.store.select(FamilySelectors.selectFamily), { initialValue: null as Family | null });
  settlements  = toSignal(this.store.select(FamilySelectors.selectSettlements), { initialValue: [] as Settlement[] });

  stats = this.reportsProcessor.stats;
  isInsightsExpanded = signal(false);

  // Period selector (Signals)
  selectedPeriod = signal<'weekly' | 'monthly' | 'yearly'>('monthly');
  selectedYear = signal<number>(new Date().getFullYear());
  selectedMonth = signal<number | null>(new Date().getMonth());
  selectedWeekOffset = signal<number>(0);

  readonly periodOptions: ('weekly' | 'monthly' | 'yearly')[] = ['weekly', 'monthly', 'yearly'];
  // These are now provide by stats() which comes from the worker
  availableYears = computed(() => this.stats()?.availableYears || [new Date().getFullYear()]);
  groupedCategoryBreakdown = computed(() => this.stats()?.groupedCategoryBreakdown || []);
  totalHistory = computed(() => this.stats()?.totalHistory || { income: 0, expense: 0, savings: 0 });
  dateRangeLabel = computed(() => this.stats()?.dateRangeLabel || 'Loading...');

  allCategories = toSignal(this.store.select(CategoriesSelectors.selectAllCategories), { initialValue: [] });
  categoryViewMode = signal<'single' | 'group'>('group');
  monthlySummaries = this.reportsProcessor.monthlySummaries;
  filteredMonthlySummaries = this.reportsProcessor.filteredMonthlySummaries;
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

      txns = allTxns.filter((t: Transaction) => {
        const type = (t as any).type;
        const isExpense = type !== 'income' && type !== 1 && type !== '1';
        if (!isExpense) return false;

        const amount = Number(t.amount) || 0;
        if (amount <= 0) return false;

        if (t.splitData?.splitBetween && t.splitData.splitBetween.length > 0) {
          return t.splitData.splitBetween.some((s: any) => s.userId === uid && Number(s.amount) > 0);
        } else {
          if (mode === 'common') return true; // In common mode, everyone shares all transactions
          return t.userId === uid;
        }
      });
    } else {
      // In group mode, just filter for expenses
      txns = allTxns.filter((t: Transaction) => {
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

  // dateRangeLabel computed above replaces this manual calculation


  // Top Spender, Top Category and Largest Expense are now provided directly by the stats() signal from the worker.

  smartInsights = computed(() => {
    const insights = [];
    const s = this.stats();
    if (!s) return [];

    if (s.topSpender) {
      insights.push({
        type: 'spender',
        label: 'Top Spender',
        value: s.topSpender.name,
        amount: s.topSpender.amount,
        isCurrency: true,
        icon: 'payments',
        colorClass: 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300',
        badgeClass: 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/20 text-red-600 dark:text-red-400'
      });
    }

    if (s.topCategory) {
      insights.push({
        type: 'category',
        label: 'Top Category',
        value: s.topCategory.name,
        amount: s.topCategory.percentage,
        isPercentage: true,
        icon: 'category',
        colorClass: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300',
        badgeClass: 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/20 text-amber-600 dark:text-amber-400'
      });
    }

    if (s.largestExpense) {
      insights.push({
        type: 'expense',
        label: 'Largest Expense',
        value: s.largestExpense.note,
        amount: s.largestExpense.amount,
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
    effect(() => {
      const allTxns = this.transactions() || [];
      const period = this.selectedPeriod();
      const year = this.selectedYear();
      const month = this.selectedMonth();
      const offset = this.selectedWeekOffset();
      const mems = this.members() || [];
      const cats = this.allCategories() || [];
      const famId = this.family()?.id || '';
      const mode = (this.family()?.mode || 'common') as 'common' | 'split';
      const viewMode = this.categoryViewMode();
      const profile = this.store.selectSignal(ProfileSelectors.selectProfile)();
      const uid = profile?.uid;
      const settles = this.settlements() || [];

      if (!famId || !mems.length) return;

      untracked(() => {
        this.reportsProcessor.process({
          allTransactions: allTxns,
          members: mems,
          categories: cats,
          mode,
          familyId: famId,
          selectedPeriod: period,
          selectedYear: year,
          selectedMonth: month,
          selectedWeekOffset: offset,
          categoryViewMode: viewMode,
          currentUserId: uid,
          settlements: settles
        });
      });
    });
  }

  private appViewSub: any;

  ngOnInit() {
    // Sync the period toggler with the global app view (Weekly/Monthly/Yearly)
    // so that common-mode family reports match the app-level period selection.
    this.appViewSub = this.appViewService.appView$.subscribe(view => {
      if (view === 'WEEKLY') this.selectedPeriod.set('weekly');
      else if (view === 'YEARLY') this.selectedPeriod.set('yearly');
      else this.selectedPeriod.set('monthly');
    });

    // Ensure family is loaded in the store. 
    // If not, use the activeFamilyId from the service to trigger a load.
    const currentFamily = this.family();
    if (!currentFamily) {
      const activeId = this.familyService.activeFamilyId();
      if (activeId) {
        this.store.dispatch(FamilyActions.loadFamily({ familyId: activeId }));
      } else {
        this.store.dispatch(FamilyActions.loadMyFamily());
      }
    }
  }

  ngOnDestroy() {
    this.appViewSub?.unsubscribe();
    // We no longer call reportsProcessor.reset() here.
    // This allows the stats to persist in memory so they are "instant" 
    // when the user navigates back to the reports page.
  }

  // The worker now handles all filtering internally


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
