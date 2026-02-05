import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { UserService } from 'src/app/util/service/db/user.service';
import { Subscription, Observable, map } from 'rxjs';
import { Transaction } from '../../../util/models/transaction.model';
import { Account } from '../../../util/models/account.model';
import { NotificationService } from '../../../util/service/notification.service';
import { Category } from 'src/app/util/models';
import { Store } from '@ngrx/store';
import { AppState } from '../../../store/app.state';
import * as TransactionsSelectors from '../../../store/transactions/transactions.selectors';
import * as AccountsSelectors from '../../../store/accounts/accounts.selectors';
import * as CategoriesSelectors from '../../../store/categories/categories.selectors';
import { DateService } from 'src/app/util/service/date.service';
import { APP_CONFIG } from 'src/app/util/config/config';
import { EChartsOption } from 'echarts';
import { SsrService } from 'src/app/util/service/ssr.service';
import { KeyMetric, KeyMetricsConfig } from '../../../util/components/cards/key-metrics-summary-card/key-metrics-summary-card.component';
import { AnalyticsSummaryConfig, CategoryTrend as AnalyticsCategoryTrend, SpendingTrend as AnalyticsSpendingTrend, AccountBalance as AnalyticsAccountBalance } from '../../../util/components/cards/analytics-summary-card/analytics-summary-card.component';
import { TopCategoriesConfig, TopCategory } from '../../../util/components/cards/top-categories-card/top-categories-card.component';
import { RecentActivityConfig, RecentTransaction } from '../../../util/components/cards/recent-activity-card/recent-activity-card.component';
import { MonthlyTrendsConfig, MonthlyTrend } from '../../../util/components/cards/monthly-trends-card/monthly-trends-card.component';
import { CategoryBreakdownConfig, CategoryBreakdown } from '../../../util/components/cards/category-breakdown-card/category-breakdown-card.component';
import { QuickActionsFabConfig, QuickAction } from '../../../util/components/floating-action-buttons/quick-actions-fab/quick-actions-fab.component';
import { CurrencyService } from '../../../util/service/currency.service';

interface CategorySpending {
  category: string;
  amount: number;
  percentage: number;
  icon: string;
  color?: string;
}

interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
  savings: number;
}

interface DailyData {
  date: string;
  income: number;
  expenses: number;
  savings: number;
}

interface WeeklyData {
  week: string;
  income: number;
  expenses: number;
  savings: number;
}

interface YearlyData {
  year: string;
  income: number;
  expenses: number;
  savings: number;
}

interface AccountBalance {
  account: string;
  balance: number;
  color: string;
}

interface SpendingTrend {
  period: string;
  amount: number;
  change: number;
  percentage: number;
}

interface CategoryTrend {
  category: string;
  currentAmount: number;
  previousAmount: number;
  change: number;
  percentage: number;
  color: string;
}

interface UserPreferences {
  defaultChartType: 'pie' | 'bar' | 'line' | 'area' | 'radar' | 'funnel' | 'scatter' | 'heatmap';
  defaultAnalyticsView: 'overview' | 'trends' | 'categories' | 'accounts' | 'comparison' | 'forecast';
  defaultPeriod: 'daily' | 'weekly' | 'monthly' | 'yearly';
  showAdvancedAnalytics: boolean;
  chartHeight: 'small' | 'medium' | 'large';
  refreshInterval: number; // in minutes
  currencyFormat: 'INR' | 'USD' | 'EUR';
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  theme: 'light' | 'dark' | 'auto';
  showTooltips: boolean;
  showAnimations: boolean;
  exportFormat: 'pdf' | 'excel' | 'csv' | 'json';
  emailReports: boolean;
  emailFrequency: 'daily' | 'weekly' | 'monthly' | 'never';
}

@Component({
  selector: 'app-reports',
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.scss']
})
export class ReportsComponent implements OnInit, OnDestroy {
  // Observables from store
  transactions$: Observable<Transaction[]>;
  accounts$: Observable<Account[]>;
  categories$: Observable<Category[]>;
  transactionsLoading$: Observable<boolean>;
  accountsLoading$: Observable<boolean>;
  categoriesLoading$: Observable<boolean>;

  // Financial metrics
  totalIncome: number = 0;
  totalExpenses: number = 0;
  netSavings: number = 0;
  monthlyChange: number = 0;
  monthlyChangePercentage: number = 0;

  // Key metrics for the card component
  keyMetricsConfig: KeyMetricsConfig = {
    title: '',
    subtitle: '',
    showHeaderIcon: false,
    currency: 'INR',
    showTrends: true,
    showIcons: true,
    showPeriod: true,
    cardHeight: 'medium',
    layout: 'grid',
    columns: 2,
    theme: 'auto',
    animations: true,
    clickable: true,
    onMetricClick: (metric: KeyMetric) => this.onMetricClick(metric)
  };

  // Analytics summary for the card component
  analyticsSummaryConfig: AnalyticsSummaryConfig = {
    title: 'Analytics Summary',
    subtitle: 'Key insights and trends',
    currency: 'INR',
    showHeaderIcon: true,
    headerIcon: 'insights',
    showFooter: false,
    cardHeight: 'medium',
    theme: 'auto',
    animations: true,
    clickable: true,
    loading: false,
    maxItems: {
      categoryTrends: 3,
      spendingTrends: 3,
      accountBalances: 3
    },
    onCategoryClick: (trend: AnalyticsCategoryTrend) => this.onCategoryTrendClick(trend),
    onSpendingClick: (trend: AnalyticsSpendingTrend) => this.onSpendingTrendClick(trend),
    onAccountClick: (account: AnalyticsAccountBalance) => this.onAccountBalanceClick(account)
  };

  // Top categories for the card component
  topCategoriesConfig: TopCategoriesConfig = {
    title: 'Top Spending Categories',
    subtitle: 'Your highest expense areas',
    currency: 'INR',
    showHeaderIcon: true,
    headerIcon: 'category',
    headerIconColor: 'purple',
    showFooter: false,
    cardHeight: 'medium',
    theme: 'auto',
    animations: true,
    clickable: true,
    loading: false,
    maxItems: 5,
    period: 'monthly',
    transactionType: 'expense',
    onCategoryClick: (category: TopCategory) => {
      console.log('Top category clicked:', category);
      // Navigate to category details or show more info
    },
    onRefresh: () => {
      this.refreshData();
    }
  };

  // Recent activity for the card component
  recentActivityConfig: RecentActivityConfig = {
    title: 'Recent Activity',
    subtitle: 'Latest transactions',
    currency: 'INR',
    showHeaderIcon: true,
    headerIcon: 'schedule',
    headerIconColor: 'orange',
    showFooter: false,
    cardHeight: 'medium',
    theme: 'auto',
    animations: true,
    clickable: true,
    loading: false,
    maxItems: 5,
    period: 'monthly',
    transactionType: 'all',
    onTransactionClick: (transaction: RecentTransaction) => {
      console.log('Transaction clicked:', transaction);
      // Handle transaction click - could open edit dialog or details view
    },
    onRefresh: () => {
      this.refreshData();
    }
  };

  monthlyTrendsConfig: MonthlyTrendsConfig = {
    title: 'Monthly Trends',
    subtitle: 'Compare monthly performance',
    currency: 'INR',
    showHeaderIcon: true,
    headerIcon: 'trending_up',
    headerIconColor: 'green',
    showFooter: false,
    cardHeight: 'medium',
    theme: 'auto',
    animations: true,
    clickable: true,
    loading: false,
    maxItems: 6,
    period: 'monthly',
    transactionType: 'all',
    showIncome: true,
    showExpenses: true,
    showSavings: true,
    showChange: true,
    layout: 'grid',
    onMonthClick: (month: MonthlyTrend) => {
      console.log('Month clicked:', month);
      // Handle month click - could show detailed view or filter
    },
    onRefresh: () => {
      this.refreshData();
    }
  };

  categoryBreakdownConfig: CategoryBreakdownConfig = {
    title: 'Category Breakdown',
    subtitle: 'Spending by category',
    currency: 'INR',
    showHeaderIcon: true,
    headerIcon: 'category',
    headerIconColor: 'blue',
    showFooter: false,
    cardHeight: 'medium',
    theme: 'auto',
    animations: true,
    clickable: true,
    loading: false,
    maxItems: 8,
    period: 'monthly',
    transactionType: 'expense',
    showProgressBar: true,
    showPercentage: true,
    showCount: false,
    showAverage: false,
    layout: 'list',
    chartType: 'bar',
    onCategoryClick: (category: CategoryBreakdown) => {
      console.log('Category clicked:', category);
      // Handle category click - could show detailed view or filter
    },
    onRefresh: () => {
      this.refreshData();
    }
  };

  quickActionsFabConfig: QuickActionsFabConfig = {
    title: 'Quick Actions',
    mainButtonIcon: 'add',
    mainButtonColor: 'primary',
    mainButtonTooltip: 'Quick Actions',
    showLabels: false,
    animations: true,
    autoHide: false,
    autoHideDelay: 3000,
    theme: 'auto',
    actions: [
      {
        id: 'add-transaction',
        label: 'Add Transaction',
        icon: 'receipt',
        color: 'accent',
        tooltip: 'Add Transaction'
      },
      {
        id: 'export-report',
        label: 'Export Report',
        icon: 'file_download',
        color: 'warn',
        tooltip: 'Export Report'
      },
      {
        id: 'refresh-data',
        label: 'Refresh Data',
        icon: 'refresh',
        color: 'primary',
        tooltip: 'Refresh Data',
        loading: false
      }
    ],
    onActionClick: (action: QuickAction) => {
      console.log('Quick action clicked:', action);
      switch (action.id) {
        case 'add-transaction':
          this.addTransaction();
          break;
        case 'export-report':
          this.exportReport();
          break;
        case 'refresh-data':
          this.refreshData();
          break;
      }
    },
    onMainButtonClick: () => {
      console.log('Main FAB clicked');
    }
  };



  // Data arrays
  transactions: Transaction[] = [];
  accounts: Account[] = [];
  categories: Category[] = [];
  topCategories: CategorySpending[] = [];
  recentTransactions: Transaction[] = [];
  monthlyTrends: MonthlyData[] = [];

  // Enhanced analytics data
  dailyData: DailyData[] = [];
  weeklyData: WeeklyData[] = [];
  yearlyData: YearlyData[] = [];
  accountBalances: AccountBalance[] = [];
  spendingTrends: SpendingTrend[] = [];
  categoryTrends: CategoryTrend[] = [];
  averageDailySpending: number = 0;
  averageMonthlySpending: number = 0;
  savingsRate: number = 0;
  expenseGrowthRate: number = 0;
  incomeGrowthRate: number = 0;

  // Time period
  selectedPeriod: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'monthly';

  // Chart and view options
  selectedChartType: 'pie' | 'bar' | 'line' | 'area' | 'radar' | 'funnel' | 'scatter' | 'heatmap' = 'pie';
  selectedAnalyticsView: 'overview' | 'trends' | 'categories' | 'accounts' | 'comparison' | 'forecast' = 'overview';
  showAdvancedAnalytics: boolean = false;

  // Available options for UI
  availableChartTypes: ('pie' | 'bar' | 'line' | 'area' | 'radar' | 'funnel' | 'scatter' | 'heatmap')[] = ['pie', 'bar', 'line', 'area', 'radar', 'funnel', 'scatter', 'heatmap'];
  availableAnalyticsViews: ('overview' | 'trends' | 'categories' | 'accounts' | 'comparison' | 'forecast')[] = ['overview', 'trends', 'categories', 'accounts', 'comparison', 'forecast'];

  // Loading states
  isLoading: boolean = true;
  hasData: boolean = false;

  // Chart options
  pieChartOption: EChartsOption = {};
  barChartOption: EChartsOption = {};
  lineChartOption: EChartsOption = {};
  areaChartOption: EChartsOption = {};
  radarChartOption: EChartsOption = {};
  funnelChartOption: EChartsOption = {};
  scatterChartOption: EChartsOption = {};
  heatmapChartOption: EChartsOption = {};

  // Theme detection
  isDarkMode: boolean = false;

  // User preferences
  userPreferences: UserPreferences = {
    defaultChartType: 'pie',
    defaultAnalyticsView: 'overview',
    defaultPeriod: 'monthly',
    showAdvancedAnalytics: false,
    chartHeight: 'medium',
    refreshInterval: 5,
    currencyFormat: 'INR',
    dateFormat: 'DD/MM/YYYY',
    theme: 'auto',
    showTooltips: true,
    showAnimations: true,
    exportFormat: 'pdf',
    emailReports: false,
    emailFrequency: 'never'
  };

  // UI state
  showPreferencesDialog: boolean = false;
  showQuickFilters: boolean = false;
  showExportOptions: boolean = false;
  showHelpTooltip: boolean = false;
  showQuickActions: boolean = false;
  isRefreshing: boolean = false;

  private subscriptions: Subscription[] = [];

  constructor(
    private router: Router,
    private auth: Auth,
    private notificationService: NotificationService,
    private store: Store<AppState>,
    public dateService: DateService,
    private ssrService: SsrService,
    private userService: UserService,
    private currencyService: CurrencyService
  ) {
    // Initialize selectors
    this.transactions$ = this.store.select(TransactionsSelectors.selectAllTransactions);
    this.accounts$ = this.store.select(AccountsSelectors.selectAllAccounts);
    this.categories$ = this.store.select(CategoriesSelectors.selectAllCategories);
    this.transactionsLoading$ = this.store.select(TransactionsSelectors.selectTransactionsLoading);
    this.accountsLoading$ = this.store.select(AccountsSelectors.selectAccountsLoading);
    this.categoriesLoading$ = this.store.select(CategoriesSelectors.selectCategoriesLoading);
  }

  ngOnInit(): void {
    this.loadPreferences();
    this.detectTheme();
    this.loadData();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private loadData(): void {
    const userId = this.userService.getCurrentUserId();
    if (!userId) {
      this.isLoading = false;
      this.notificationService.error('User not authenticated');
      return;
    }

    // Subscribe to store data
    const transactionsSub = this.transactions$.subscribe(transactions => {
      this.transactions = transactions;
      this.calculateFinancialMetrics();
      this.calculateTopCategories();
      this.getRecentTransactions();
      this.calculateMonthlyTrends();
      this.calculateEnhancedAnalytics();
      this.updateCharts(); // Initialize charts with new data
      this.isLoading = false;
      this.hasData = this.transactions.length > 0;
    });

    const accountsSub = this.accounts$.subscribe(accounts => {
      this.accounts = accounts;
    });

    const categoriesSub = this.categories$.subscribe(categories => {
      this.categories = categories;
    });

    this.subscriptions.push(transactionsSub, accountsSub, categoriesSub);
  }

  private calculateFinancialMetrics(): void {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    // Filter transactions for current month
    const currentMonthTransactions = this.transactions.filter(t => {
      const transactionDate = this.dateService.toDate(t.date);
      return transactionDate?.getMonth() === currentMonth &&
        transactionDate?.getFullYear() === currentYear;
    });

    // Filter transactions for last month
    const lastMonthTransactions = this.transactions.filter(t => {
      const transactionDate = this.dateService.toDate(t.date);
      return transactionDate?.getMonth() === lastMonth &&
        transactionDate?.getFullYear() === lastYear;
    });

    // Calculate current month metrics
    this.totalIncome = currentMonthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    this.totalExpenses = currentMonthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    this.netSavings = this.totalIncome - this.totalExpenses;

    // Calculate last month metrics for comparison
    const lastMonthIncome = lastMonthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const lastMonthExpenses = lastMonthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const lastMonthSavings = lastMonthIncome - lastMonthExpenses;

    // Calculate monthly change
    this.monthlyChange = this.netSavings - lastMonthSavings;
    this.monthlyChangePercentage = lastMonthSavings !== 0
      ? ((this.monthlyChange / lastMonthSavings) * 100)
      : 0;

  }


  private calculateTopCategories(): void {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const currentMonthExpenses = this.transactions.filter(t => {
      const transactionDate = this.dateService.toDate(t.date);
      return t.type === 'expense' &&
        transactionDate?.getMonth() === currentMonth &&
        transactionDate?.getFullYear() === currentYear;
    });

    // Group by category ID and calculate totals
    const categoryTotals = new Map<string, number>();

    currentMonthExpenses.forEach(transaction => {
      const current = categoryTotals.get(transaction.categoryId) || 0;
      categoryTotals.set(transaction.categoryId, current + transaction.amount);
    });

    // Convert to array and sort by amount
    const totalExpenses = this.totalExpenses;
    this.topCategories = Array.from(categoryTotals.entries())
      .map(([categoryId, amount]) => {
        const categoryData = this.categories.find(c => c.id === categoryId);
        return {
          category: categoryData?.name || 'Unknown',
          amount,
          percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
          icon: categoryData?.icon || 'category',
          // color: categoryData?.color  || '#46777f'
        };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5); // Top 5 categories
  }

  private getRecentTransactions(): void {
    this.recentTransactions = this.transactions
      .sort((a, b) => (this.dateService.toDate(b.date)?.getTime() ?? 0) - (this.dateService.toDate(a.date)?.getTime() ?? 0))
      .slice(0, 5); // Last 5 transactions
  }

  private calculateMonthlyTrends(): void {
    const now = new Date();
    const months: MonthlyData[] = [];

    // Calculate data for last 6 months
    for (let i = 5; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = month.toLocaleDateString(APP_CONFIG.REGIONAL.LANGUAGE_DEFAULT, { month: 'short' });

      const monthTransactions = this.transactions.filter(t => {
        const transactionDate = this.dateService.toDate(t.date);
        return transactionDate?.getMonth() === month.getMonth() &&
          transactionDate?.getFullYear() === month.getFullYear();
      });

      const income = monthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const expenses = monthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      months.push({
        month: monthName,
        income,
        expenses,
        savings: income - expenses
      });
    }

    this.monthlyTrends = months;
  }

  private calculateEnhancedAnalytics(): void {
    this.calculateDailyData();
    this.calculateWeeklyData();
    this.calculateYearlyData();
    this.calculateAccountBalances();
    this.calculateSpendingTrends();
    this.calculateCategoryTrends();
    this.calculateGrowthRates();
    this.populateAnalyticsSummary();
  }

  private calculateDailyData(): void {
    const now = new Date();
    const dailyData: DailyData[] = [];

    // Calculate data for last 30 days
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
      const dateStr = date.toISOString().split('T')[0];

      const dayTransactions = this.transactions.filter(t => {
        const transactionDate = this.dateService.toDate(t.date);
        return transactionDate?.toDateString() === date.toDateString();
      });

      const income = dayTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const expenses = dayTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      dailyData.push({
        date: dateStr,
        income,
        expenses,
        savings: income - expenses
      });
    }

    this.dailyData = dailyData;
  }

  private calculateWeeklyData(): void {
    const now = new Date();
    const weeklyData: WeeklyData[] = [];

    // Calculate data for last 12 weeks
    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date(now.getTime() - (i * 7 * 24 * 60 * 60 * 1000));
      const weekEnd = new Date(weekStart.getTime() + (6 * 24 * 60 * 60 * 1000));
      const weekStr = `Week ${Math.ceil((weekStart.getTime() - new Date(weekStart.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))}`;

      const weekTransactions = this.transactions.filter(t => {
        const transactionDate = this.dateService.toDate(t.date);
        return transactionDate && transactionDate >= weekStart && transactionDate <= weekEnd;
      });

      const income = weekTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const expenses = weekTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      weeklyData.push({
        week: weekStr,
        income,
        expenses,
        savings: income - expenses
      });
    }

    this.weeklyData = weeklyData;
  }

  private calculateYearlyData(): void {
    const now = new Date();
    const yearlyData: YearlyData[] = [];

    // Calculate data for last 5 years
    for (let i = 4; i >= 0; i--) {
      const year = now.getFullYear() - i;
      const yearStr = year.toString();

      const yearTransactions = this.transactions.filter(t => {
        const transactionDate = this.dateService.toDate(t.date);
        return transactionDate?.getFullYear() === year;
      });

      const income = yearTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const expenses = yearTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      yearlyData.push({
        year: yearStr,
        income,
        expenses,
        savings: income - expenses
      });
    }

    this.yearlyData = yearlyData;
  }

  private calculateAccountBalances(): void {
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

    this.accountBalances = this.accounts.map((account, index) => {
      const accountTransactions = this.transactions.filter(t => t.accountId === account.accountId);
      let balance = accountTransactions.reduce((sum, t) => {
        return sum + (t.type === 'income' ? t.amount : -t.amount);
      }, account.balance || 0);

      // Handle loan accounts specially - use negative remaining balance
      if (account.type === 'loan' && account.loanDetails) {
        balance = -(account.loanDetails.remainingBalance || 0);
      }

      return {
        account: account.name,
        balance: balance,
        color: colors[index % colors.length]
      };
    });
  }

  private calculateSpendingTrends(): void {
    const periods = ['Last 7 Days', 'Last 30 Days', 'Last 3 Months', 'Last 6 Months', 'Last Year'];
    const trendData: SpendingTrend[] = [];

    periods.forEach((period, index) => {
      const days = [7, 30, 90, 180, 365][index];
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));

      const periodTransactions = this.transactions.filter(t => {
        const transactionDate = this.dateService.toDate(t.date);
        return transactionDate && transactionDate >= startDate && transactionDate <= endDate;
      });

      const amount = periodTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      // Calculate change from previous period
      const previousStartDate = new Date(startDate.getTime() - (days * 24 * 60 * 60 * 1000));
      const previousPeriodTransactions = this.transactions.filter(t => {
        const transactionDate = this.dateService.toDate(t.date);
        return transactionDate && transactionDate >= previousStartDate && transactionDate < startDate;
      });

      const previousAmount = previousPeriodTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      const change = amount - previousAmount;
      const percentage = previousAmount > 0 ? ((change / previousAmount) * 100) : 0;

      trendData.push({
        period,
        amount,
        change,
        percentage
      });
    });

    this.spendingTrends = trendData;
  }

  private calculateCategoryTrends(): void {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#84CC16'];

    this.categoryTrends = this.categories.map((category, index) => {
      // Current month data
      const currentMonthTransactions = this.transactions.filter(t => {
        const transactionDate = this.dateService.toDate(t.date);
        return t.categoryId === category.id &&
          t.type === 'expense' &&
          transactionDate?.getMonth() === currentMonth &&
          transactionDate?.getFullYear() === currentYear;
      });

      const currentAmount = currentMonthTransactions.reduce((sum, t) => sum + t.amount, 0);

      // Previous month data
      const previousMonthTransactions = this.transactions.filter(t => {
        const transactionDate = this.dateService.toDate(t.date);
        return t.categoryId === category.id &&
          t.type === 'expense' &&
          transactionDate?.getMonth() === lastMonth &&
          transactionDate?.getFullYear() === lastYear;
      });

      const previousAmount = previousMonthTransactions.reduce((sum, t) => sum + t.amount, 0);

      const change = currentAmount - previousAmount;
      const percentage = previousAmount > 0 ? ((change / previousAmount) * 100) : 0;

      return {
        category: category.name,
        currentAmount,
        previousAmount,
        change,
        percentage,
        color: colors[index % colors.length]
      };
    }).filter(trend => trend.currentAmount > 0 || trend.previousAmount > 0)
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
      .slice(0, 8); // Top 8 categories
  }

  private calculateGrowthRates(): void {
    // Calculate average daily spending
    const totalExpenses = this.transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalDays = this.transactions.length > 0 ?
      Math.max(1, Math.ceil((new Date().getTime() - (this.dateService.toDate(this.transactions[0].date)?.getTime() || 0)) / (24 * 60 * 60 * 1000))) : 30;

    this.averageDailySpending = totalExpenses / totalDays;
    this.averageMonthlySpending = this.averageDailySpending * 30;

    // Calculate savings rate
    const totalIncome = this.transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    this.savingsRate = totalIncome > 0 ? ((this.netSavings / totalIncome) * 100) : 0;

    // Calculate growth rates
    const currentMonthExpenses = this.totalExpenses;
    const lastMonthExpenses = this.transactions
      .filter(t => {
        const transactionDate = this.dateService.toDate(t.date);
        const lastMonth = new Date().getMonth() === 0 ? 11 : new Date().getMonth() - 1;
        const lastYear = new Date().getMonth() === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear();
        return t.type === 'expense' &&
          transactionDate?.getMonth() === lastMonth &&
          transactionDate?.getFullYear() === lastYear;
      })
      .reduce((sum, t) => sum + t.amount, 0);

    this.expenseGrowthRate = lastMonthExpenses > 0 ?
      ((currentMonthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100 : 0;

    const currentMonthIncome = this.totalIncome;
    const lastMonthIncome = this.transactions
      .filter(t => {
        const transactionDate = this.dateService.toDate(t.date);
        const lastMonth = new Date().getMonth() === 0 ? 11 : new Date().getMonth() - 1;
        const lastYear = new Date().getMonth() === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear();
        return t.type === 'income' &&
          transactionDate?.getMonth() === lastMonth &&
          transactionDate?.getFullYear() === lastYear;
      })
      .reduce((sum, t) => sum + t.amount, 0);

    this.incomeGrowthRate = lastMonthIncome > 0 ?
      ((currentMonthIncome - lastMonthIncome) / lastMonthIncome) * 100 : 0;
  }

  private populateAnalyticsSummary(): void {
    // Convert category trends to analytics format
    const analyticsCategoryTrends: AnalyticsCategoryTrend[] = this.categoryTrends.map(trend => ({
      category: trend.category,
      change: trend.change,
      percentage: trend.percentage,
      color: trend.color,
      icon: 'category'
    }));

    // Convert spending trends to analytics format
    const analyticsSpendingTrends: AnalyticsSpendingTrend[] = this.spendingTrends.map(trend => ({
      period: trend.period,
      amount: trend.amount,
      change: trend.change,
      percentage: trend.percentage
    }));

    // Convert account balances to analytics format
    const analyticsAccountBalances: AnalyticsAccountBalance[] = this.accountBalances.map(account => ({
      account: account.account,
      balance: account.balance,
      color: account.color,
      icon: 'account_balance'
    }));

    // Update the analytics summary config
    this.analyticsSummaryConfig = {
      ...this.analyticsSummaryConfig,
      loading: false
    };
  }

  onPeriodChange(period: 'daily' | 'weekly' | 'monthly' | 'yearly'): void {
    this.selectedPeriod = period;
    this.notificationService.info(`Report period changed to ${period}`);
    // TODO: Implement period-specific calculations
    console.log('Period changed to:', period);
    // Update charts with new period data
    this.updateCharts();
  }

  onChartTypeChange(chartType: 'pie' | 'bar' | 'line' | 'area' | 'radar' | 'funnel' | 'scatter' | 'heatmap'): void {
    this.selectedChartType = chartType;
    this.notificationService.info(`Chart type changed to ${chartType}`);
    this.updateCharts();
  }

  onAnalyticsViewChange(view: 'overview' | 'trends' | 'categories' | 'accounts' | 'comparison' | 'forecast'): void {
    this.selectedAnalyticsView = view;
    this.notificationService.info(`Analytics view changed to ${view}`);
    this.updateCharts();
  }

  toggleAdvancedAnalytics(): void {
    this.showAdvancedAnalytics = !this.showAdvancedAnalytics;
    this.userPreferences.showAdvancedAnalytics = this.showAdvancedAnalytics;
    this.savePreferences();
    this.notificationService.info(this.showAdvancedAnalytics ? 'Advanced analytics enabled' : 'Advanced analytics disabled');
  }

  // Preferences management
  openPreferencesDialog(): void {
    this.showPreferencesDialog = true;
  }

  closePreferencesDialog(): void {
    this.showPreferencesDialog = false;
  }

  savePreferences(): void {
    // Save to localStorage
    localStorage.setItem('reports-preferences', JSON.stringify(this.userPreferences));
    this.notificationService.success('Preferences saved successfully');
  }

  loadPreferences(): void {
    const saved = localStorage.getItem('reports-preferences');
    if (saved) {
      this.userPreferences = { ...this.userPreferences, ...JSON.parse(saved) };
      this.selectedChartType = this.userPreferences.defaultChartType;
      this.selectedAnalyticsView = this.userPreferences.defaultAnalyticsView;
      this.selectedPeriod = this.userPreferences.defaultPeriod;
      this.showAdvancedAnalytics = this.userPreferences.showAdvancedAnalytics;
    }
  }

  resetPreferences(): void {
    this.userPreferences = {
      defaultChartType: 'pie',
      defaultAnalyticsView: 'overview',
      defaultPeriod: 'monthly',
      showAdvancedAnalytics: false,
      chartHeight: 'medium',
      refreshInterval: 5,
      currencyFormat: 'INR',
      dateFormat: 'DD/MM/YYYY',
      theme: 'auto',
      showTooltips: true,
      showAnimations: true,
      exportFormat: 'pdf',
      emailReports: false,
      emailFrequency: 'never'
    };
    this.savePreferences();
    this.notificationService.info('Preferences reset to default');
  }

  // UI interactions
  toggleQuickFilters(): void {
    this.showQuickFilters = !this.showQuickFilters;
  }

  applyFilters(): void {
    // TODO: Implement filter application logic
    this.notificationService.info('Filters applied successfully');
    this.toggleQuickFilters();
    this.refreshData();
  }

  toggleExportOptions(): void {
    this.showExportOptions = !this.showExportOptions;
  }

  toggleHelpTooltip(): void {
    this.showHelpTooltip = !this.showHelpTooltip;
  }

  toggleQuickActions(): void {
    this.showQuickActions = !this.showQuickActions;
  }

  refreshData(): void {
    this.isRefreshing = true;
    setTimeout(() => {
      this.loadData();
      this.isRefreshing = false;
      this.notificationService.success('Data refreshed successfully');
    }, 1000);
  }

  // Chart height getter
  getChartHeight(): string {
    switch (this.userPreferences.chartHeight) {
      case 'small':
        return 'h-48 sm:h-56';
      case 'large':
        return 'h-80 sm:h-96';
      default:
        return 'h-64 sm:h-80';
    }
  }
  // Currency formatting based on preferences
  formatCurrencyWithPreference(amount: number): string {
    return this.currencyService.formatAmount(amount);
  }

  exportReport(): void {
    try {
      // TODO: Implement export functionality
      console.log('Export report clicked');
      this.notificationService.info('Export feature coming soon');
    } catch (error) {
      console.error('Error exporting report:', error);
      this.notificationService.error('Failed to export report');
    }
  }

  generateReport(): void {
    try {
      // TODO: Implement report generation
      console.log('Generate report clicked');
      this.notificationService.info('Report generation feature coming soon');
    } catch (error) {
      console.error('Error generating report:', error);
      this.notificationService.error('Failed to generate report');
    }
  }

  addTransaction(): void {
    this.router.navigate(['/dashboard/transaction-list/add-transaction']);
  }

  onMetricClick(metric: KeyMetric): void {
    // Handle metric click - could navigate to detailed view or show more info
    console.log('Metric clicked:', metric);
    // You can add navigation logic here based on the metric type
    switch (metric.title) {
      case 'Total Income':
        // Navigate to income transactions
        break;
      case 'Total Expenses':
        // Navigate to expense transactions
        break;
      case 'Net Savings':
        // Show savings breakdown
        break;
      case 'Monthly Change':
        // Show trend analysis
        break;
    }
  }

  onCategoryTrendClick(trend: AnalyticsCategoryTrend): void {
    console.log('Category trend clicked:', trend);
    // Navigate to category details or show more information
    this.notificationService.info(`Category: ${trend.category} - ${trend.change >= 0 ? '+' : ''}${trend.percentage.toFixed(1)}%`);
  }

  onSpendingTrendClick(trend: AnalyticsSpendingTrend): void {
    console.log('Spending trend clicked:', trend);
    // Navigate to spending details or show more information
    this.notificationService.info(`Period: ${trend.period} - ${this.formatCurrency(trend.amount)}`);
  }

  onAccountBalanceClick(account: AnalyticsAccountBalance): void {
    console.log('Account balance clicked:', account);
    // Navigate to account details or show more information
    this.notificationService.info(`Account: ${account.account} - ${this.formatCurrency(account.balance)}`);
  }

  // Helper methods for template
  getMonthlyChangeDisplay(): string {
    const sign = this.monthlyChange >= 0 ? '+' : '';
    return `${sign}${this.monthlyChangePercentage.toFixed(1)}%`;
  }

  getMonthlyChangeColor(): string {
    return this.monthlyChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  }

  getMonthlyChangeIcon(): string {
    return this.monthlyChange >= 0 ? 'trending_up' : 'trending_down';
  }

  formatCurrency(amount: number): string {
    return this.currencyService.formatAmount(amount);
  }

  getTransactionIcon(transaction: Transaction): string {
    return transaction.type === 'income' ? 'trending_up' : 'trending_down';
  }

  getTransactionColor(transaction: Transaction): string {
    return transaction.type === 'income' ? 'text-green-600' : 'text-red-600';
  }

  // Helper methods for chart selection
  getCurrentChartOption(): EChartsOption {
    switch (this.selectedChartType) {
      case 'pie':
        return this.pieChartOption;
      case 'bar':
        return this.barChartOption;
      case 'line':
        return this.lineChartOption;
      case 'area':
        return this.areaChartOption;
      case 'radar':
        return this.radarChartOption;
      case 'funnel':
        return this.funnelChartOption;
      case 'scatter':
        return this.scatterChartOption;
      case 'heatmap':
        return this.heatmapChartOption;
      default:
        return this.pieChartOption;
    }
  }

  getChartTitle(): string {
    switch (this.selectedChartType) {
      case 'pie':
        return 'Spending by Category';
      case 'bar':
        return 'Monthly Financial Trends';
      case 'line':
        return 'Financial Trends Over Time';
      case 'area':
        return 'Daily Spending Patterns';
      case 'radar':
        return 'Category Performance Comparison';
      case 'funnel':
        return 'Spending Funnel Analysis';
      case 'scatter':
        return 'Income vs Expenses Correlation';
      case 'heatmap':
        return 'Weekly Spending Heatmap';
      default:
        return 'Financial Analytics';
    }
  }

  // Chart initialization methods
  private initializePieChart(): void {
    if (this.topCategories.length === 0) {
      this.pieChartOption = {
        title: {
          text: 'No Data Available',
          left: 'center',
          top: 'center',
          textStyle: {
            color: this.isDarkMode ? '#9CA3AF' : '#666',
            fontSize: 16
          }
        }
      };
      return;
    }

    const data = this.topCategories.map(category => ({
      name: category.category,
      value: category.amount,
      itemStyle: { color: category.color }
    }));

    this.pieChartOption = {
      title: {
        text: 'Spending by Category',
        left: 'center',
        textStyle: {
          color: this.isDarkMode ? '#F9FAFB' : '#333',
          fontSize: 16,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: this.isDarkMode ? '#374151' : '#FFFFFF',
        borderColor: this.isDarkMode ? '#4B5563' : '#E5E7EB',
        textStyle: {
          color: this.isDarkMode ? '#F9FAFB' : '#374151'
        },
        formatter: (params: any) => {
          const percentage = ((params.value / this.totalExpenses) * 100).toFixed(1);
          return `${params.name}<br/>${this.formatCurrency(params.value)} (${percentage}%)`;
        }
      },
      legend: {
        orient: 'vertical',
        left: 'left',
        top: 'middle',
        textStyle: {
          color: this.isDarkMode ? '#F9FAFB' : '#333'
        }
      },
      series: [
        {
          name: 'Spending',
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['60%', '50%'],
          avoidLabelOverlap: false,
          label: {
            show: false,
            position: 'center'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: '18',
              fontWeight: 'bold',
              color: this.isDarkMode ? '#F9FAFB' : '#333'
            }
          },
          labelLine: {
            show: false
          },
          data: data
        }
      ]
    };
  }

  private initializeBarChart(): void {
    if (this.monthlyTrends.length === 0) {
      this.barChartOption = {
        title: {
          text: 'No Data Available',
          left: 'center',
          top: 'center',
          textStyle: {
            color: this.isDarkMode ? '#9CA3AF' : '#666',
            fontSize: 16
          }
        }
      };
      return;
    }

    const months = this.monthlyTrends.map(item => item.month);
    const incomeData = this.monthlyTrends.map(item => item.income);
    const expenseData = this.monthlyTrends.map(item => item.expenses);
    const savingsData = this.monthlyTrends.map(item => item.savings);

    this.barChartOption = {
      title: {
        text: 'Monthly Financial Trends',
        left: 'center',
        textStyle: {
          color: this.isDarkMode ? '#F9FAFB' : '#333',
          fontSize: 16,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        backgroundColor: this.isDarkMode ? '#374151' : '#FFFFFF',
        borderColor: this.isDarkMode ? '#4B5563' : '#E5E7EB',
        textStyle: {
          color: this.isDarkMode ? '#F9FAFB' : '#374151'
        },
        formatter: (params: any) => {
          let result = `${params[0].axisValue}<br/>`;
          params.forEach((param: any) => {
            result += `${param.marker} ${param.seriesName}: ${this.formatCurrency(param.value)}<br/>`;
          });
          return result;
        }
      },
      legend: {
        data: ['Income', 'Expenses', 'Savings'],
        top: 'bottom',
        textStyle: {
          color: this.isDarkMode ? '#F9FAFB' : '#333'
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: months,
        axisLabel: {
          color: this.isDarkMode ? '#F9FAFB' : '#333'
        },
        axisLine: {
          lineStyle: {
            color: this.isDarkMode ? '#4B5563' : '#E5E7EB'
          }
        }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: this.isDarkMode ? '#F9FAFB' : '#333',
          formatter: (value: number) => this.formatCurrency(value)
        },
        axisLine: {
          lineStyle: {
            color: this.isDarkMode ? '#4B5563' : '#E5E7EB'
          }
        },
        splitLine: {
          lineStyle: {
            color: this.isDarkMode ? '#4B5563' : '#E5E7EB'
          }
        }
      },
      series: [
        {
          name: 'Income',
          type: 'bar',
          data: incomeData,
          itemStyle: {
            color: '#10B981'
          },
          emphasis: {
            itemStyle: {
              color: '#059669'
            }
          }
        },
        {
          name: 'Expenses',
          type: 'bar',
          data: expenseData,
          itemStyle: {
            color: '#EF4444'
          },
          emphasis: {
            itemStyle: {
              color: '#DC2626'
            }
          }
        },
        {
          name: 'Savings',
          type: 'bar',
          data: savingsData,
          itemStyle: {
            color: '#3B82F6'
          },
          emphasis: {
            itemStyle: {
              color: '#2563EB'
            }
          }
        }
      ]
    };
  }

  private initializeLineChart(): void {
    if (this.monthlyTrends.length === 0) {
      this.lineChartOption = {
        title: {
          text: 'No Data Available',
          left: 'center',
          top: 'center',
          textStyle: {
            color: this.isDarkMode ? '#9CA3AF' : '#666',
            fontSize: 16
          }
        }
      };
      return;
    }

    const months = this.monthlyTrends.map(item => item.month);
    const incomeData = this.monthlyTrends.map(item => item.income);
    const expenseData = this.monthlyTrends.map(item => item.expenses);
    const savingsData = this.monthlyTrends.map(item => item.savings);

    this.lineChartOption = {
      title: {
        text: 'Financial Trends Over Time',
        left: 'center',
        textStyle: {
          color: this.isDarkMode ? '#F9FAFB' : '#333',
          fontSize: 16,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: this.isDarkMode ? '#374151' : '#FFFFFF',
        borderColor: this.isDarkMode ? '#4B5563' : '#E5E7EB',
        textStyle: {
          color: this.isDarkMode ? '#F9FAFB' : '#374151'
        }
      },
      legend: {
        data: ['Income', 'Expenses', 'Savings'],
        top: 'bottom',
        textStyle: {
          color: this.isDarkMode ? '#F9FAFB' : '#333'
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: months,
        axisLabel: {
          color: this.isDarkMode ? '#F9FAFB' : '#333'
        },
        axisLine: {
          lineStyle: {
            color: this.isDarkMode ? '#4B5563' : '#E5E7EB'
          }
        }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: this.isDarkMode ? '#F9FAFB' : '#333',
          formatter: (value: number) => this.formatCurrency(value)
        },
        axisLine: {
          lineStyle: {
            color: this.isDarkMode ? '#4B5563' : '#E5E7EB'
          }
        },
        splitLine: {
          lineStyle: {
            color: this.isDarkMode ? '#4B5563' : '#E5E7EB'
          }
        }
      },
      series: [
        {
          name: 'Income',
          type: 'line',
          data: incomeData,
          smooth: true,
          itemStyle: {
            color: '#10B981'
          },
          lineStyle: {
            color: '#10B981',
            width: 3
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(16, 185, 129, 0.3)' },
                { offset: 1, color: 'rgba(16, 185, 129, 0.1)' }
              ]
            }
          }
        },
        {
          name: 'Expenses',
          type: 'line',
          data: expenseData,
          smooth: true,
          itemStyle: {
            color: '#EF4444'
          },
          lineStyle: {
            color: '#EF4444',
            width: 3
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(239, 68, 68, 0.3)' },
                { offset: 1, color: 'rgba(239, 68, 68, 0.1)' }
              ]
            }
          }
        },
        {
          name: 'Savings',
          type: 'line',
          data: savingsData,
          smooth: true,
          itemStyle: {
            color: '#3B82F6'
          },
          lineStyle: {
            color: '#3B82F6',
            width: 3
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
                { offset: 1, color: 'rgba(59, 130, 246, 0.1)' }
              ]
            }
          }
        }
      ]
    };
  }

  private initializeAreaChart(): void {
    if (this.dailyData.length === 0) {
      this.areaChartOption = {
        title: {
          text: 'No Data Available',
          left: 'center',
          top: 'center',
          textStyle: {
            color: this.isDarkMode ? '#9CA3AF' : '#666',
            fontSize: 16
          }
        }
      };
      return;
    }

    const dates = this.dailyData.map(item => item.date);
    const incomeData = this.dailyData.map(item => item.income);
    const expenseData = this.dailyData.map(item => item.expenses);

    this.areaChartOption = {
      title: {
        text: 'Daily Spending Patterns',
        left: 'center',
        textStyle: {
          color: this.isDarkMode ? '#F9FAFB' : '#333',
          fontSize: 16,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: this.isDarkMode ? '#374151' : '#FFFFFF',
        borderColor: this.isDarkMode ? '#4B5563' : '#E5E7EB',
        textStyle: {
          color: this.isDarkMode ? '#F9FAFB' : '#374151'
        }
      },
      legend: {
        data: ['Income', 'Expenses'],
        top: 'bottom',
        textStyle: {
          color: this.isDarkMode ? '#F9FAFB' : '#333'
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: {
          color: this.isDarkMode ? '#F9FAFB' : '#333'
        },
        axisLine: {
          lineStyle: {
            color: this.isDarkMode ? '#4B5563' : '#E5E7EB'
          }
        }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: this.isDarkMode ? '#F9FAFB' : '#333',
          formatter: (value: number) => this.formatCurrency(value)
        },
        axisLine: {
          lineStyle: {
            color: this.isDarkMode ? '#4B5563' : '#E5E7EB'
          }
        },
        splitLine: {
          lineStyle: {
            color: this.isDarkMode ? '#4B5563' : '#E5E7EB'
          }
        }
      },
      series: [
        {
          name: 'Income',
          type: 'line',
          stack: 'Total',
          data: incomeData,
          areaStyle: {
            color: '#10B981'
          },
          itemStyle: {
            color: '#10B981'
          }
        },
        {
          name: 'Expenses',
          type: 'line',
          stack: 'Total',
          data: expenseData,
          areaStyle: {
            color: '#EF4444'
          },
          itemStyle: {
            color: '#EF4444'
          }
        }
      ]
    };
  }

  private initializeRadarChart(): void {
    if (this.categoryTrends.length === 0) {
      this.radarChartOption = {
        title: {
          text: 'No Data Available',
          left: 'center',
          top: 'center',
          textStyle: {
            color: this.isDarkMode ? '#9CA3AF' : '#666',
            fontSize: 16
          }
        }
      };
      return;
    }

    const categories = this.categoryTrends.map(item => item.category);
    const currentData = this.categoryTrends.map(item => item.currentAmount);
    const previousData = this.categoryTrends.map(item => item.previousAmount);

    this.radarChartOption = {
      title: {
        text: 'Category Performance Comparison',
        left: 'center',
        textStyle: {
          color: this.isDarkMode ? '#F9FAFB' : '#333',
          fontSize: 16,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        backgroundColor: this.isDarkMode ? '#374151' : '#FFFFFF',
        borderColor: this.isDarkMode ? '#4B5563' : '#E5E7EB',
        textStyle: {
          color: this.isDarkMode ? '#F9FAFB' : '#374151'
        }
      },
      legend: {
        data: ['Current Month', 'Previous Month'],
        top: 'bottom',
        textStyle: {
          color: this.isDarkMode ? '#F9FAFB' : '#333'
        }
      },
      radar: {
        indicator: categories.map(category => ({
          name: category,
          max: Math.max(...currentData, ...previousData) * 1.2
        })),
        center: ['50%', '50%'],
        radius: '60%',
        axisName: {
          color: this.isDarkMode ? '#F9FAFB' : '#333'
        },
        splitLine: {
          lineStyle: {
            color: this.isDarkMode ? '#4B5563' : '#E5E7EB'
          }
        },
        splitArea: {
          show: false
        }
      },
      series: [
        {
          name: 'Category Performance',
          type: 'radar',
          data: [
            {
              value: currentData,
              name: 'Current Month',
              itemStyle: {
                color: '#3B82F6'
              },
              areaStyle: {
                color: 'rgba(59, 130, 246, 0.3)'
              }
            },
            {
              value: previousData,
              name: 'Previous Month',
              itemStyle: {
                color: '#10B981'
              },
              areaStyle: {
                color: 'rgba(16, 185, 129, 0.3)'
              }
            }
          ]
        }
      ]
    };
  }

  private initializeFunnelChart(): void {
    if (this.spendingTrends.length === 0) {
      this.funnelChartOption = {
        title: {
          text: 'No Data Available',
          left: 'center',
          top: 'center',
          textStyle: {
            color: this.isDarkMode ? '#9CA3AF' : '#666',
            fontSize: 16
          }
        }
      };
      return;
    }

    const data = this.spendingTrends.map(trend => ({
      name: trend.period,
      value: trend.amount
    }));

    this.funnelChartOption = {
      title: {
        text: 'Spending Funnel Analysis',
        left: 'center',
        textStyle: {
          color: this.isDarkMode ? '#F9FAFB' : '#333',
          fontSize: 16,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: this.isDarkMode ? '#374151' : '#FFFFFF',
        borderColor: this.isDarkMode ? '#4B5563' : '#E5E7EB',
        textStyle: {
          color: this.isDarkMode ? '#F9FAFB' : '#374151'
        },
        formatter: (params: any) => {
          return `${params.name}<br/>${this.formatCurrency(params.value)}`;
        }
      },
      series: [
        {
          name: 'Spending',
          type: 'funnel',
          left: '10%',
          top: 60,
          width: '80%',
          height: '80%',
          min: 0,
          max: Math.max(...data.map(item => item.value)),
          minSize: '0%',
          maxSize: '100%',
          sort: 'descending',
          gap: 2,
          label: {
            show: true,
            position: 'inside',
            color: this.isDarkMode ? '#F9FAFB' : '#333'
          },
          labelLine: {
            length: 10,
            lineStyle: {
              width: 1,
              type: 'solid'
            }
          },
          itemStyle: {
            borderColor: this.isDarkMode ? '#374151' : '#FFFFFF',
            borderWidth: 1
          },
          emphasis: {
            label: {
              fontSize: 20
            }
          },
          data: data
        }
      ]
    };
  }

  private initializeScatterChart(): void {
    if (this.dailyData.length === 0) {
      this.scatterChartOption = {
        title: {
          text: 'No Data Available',
          left: 'center',
          top: 'center',
          textStyle: {
            color: this.isDarkMode ? '#9CA3AF' : '#666',
            fontSize: 16
          }
        }
      };
      return;
    }

    const data = this.dailyData.map((item, index) => [index, item.expenses, item.income]);

    this.scatterChartOption = {
      title: {
        text: 'Income vs Expenses Correlation',
        left: 'center',
        textStyle: {
          color: this.isDarkMode ? '#F9FAFB' : '#333',
          fontSize: 16,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: this.isDarkMode ? '#374151' : '#FFFFFF',
        borderColor: this.isDarkMode ? '#4B5563' : '#E5E7EB',
        textStyle: {
          color: this.isDarkMode ? '#F9FAFB' : '#374151'
        },
        formatter: (params: any) => {
          return `Day ${params.data[0] + 1}<br/>Expenses: ${this.formatCurrency(params.data[1])}<br/>Income: ${this.formatCurrency(params.data[2])}`;
        }
      },
      xAxis: {
        type: 'value',
        name: 'Day',
        axisLabel: {
          color: this.isDarkMode ? '#F9FAFB' : '#333'
        },
        axisLine: {
          lineStyle: {
            color: this.isDarkMode ? '#4B5563' : '#E5E7EB'
          }
        },
        splitLine: {
          lineStyle: {
            color: this.isDarkMode ? '#4B5563' : '#E5E7EB'
          }
        }
      },
      yAxis: {
        type: 'value',
        name: 'Amount',
        axisLabel: {
          color: this.isDarkMode ? '#F9FAFB' : '#333',
          formatter: (value: number) => this.formatCurrency(value)
        },
        axisLine: {
          lineStyle: {
            color: this.isDarkMode ? '#4B5563' : '#E5E7EB'
          }
        },
        splitLine: {
          lineStyle: {
            color: this.isDarkMode ? '#4B5563' : '#E5E7EB'
          }
        }
      },
      series: [
        {
          name: 'Income vs Expenses',
          type: 'scatter',
          data: data,
          symbolSize: 8,
          itemStyle: {
            color: '#3B82F6'
          }
        }
      ]
    };
  }

  private initializeHeatmapChart(): void {
    if (this.dailyData.length === 0) {
      this.heatmapChartOption = {
        title: {
          text: 'No Data Available',
          left: 'center',
          top: 'center',
          textStyle: {
            color: this.isDarkMode ? '#9CA3AF' : '#666',
            fontSize: 16
          }
        }
      };
      return;
    }

    const data = this.dailyData.map((item, index) => [
      Math.floor(index / 7), // Week
      index % 7, // Day of week
      item.expenses
    ]);

    this.heatmapChartOption = {
      title: {
        text: 'Weekly Spending Heatmap',
        left: 'center',
        textStyle: {
          color: this.isDarkMode ? '#F9FAFB' : '#333',
          fontSize: 16,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        position: 'top',
        backgroundColor: this.isDarkMode ? '#374151' : '#FFFFFF',
        borderColor: this.isDarkMode ? '#4B5563' : '#E5E7EB',
        textStyle: {
          color: this.isDarkMode ? '#F9FAFB' : '#374151'
        },
        formatter: (params: any) => {
          const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          return `Week ${params.data[0] + 1}, ${days[params.data[1]]}<br/>${this.formatCurrency(params.data[2])}`;
        }
      },
      grid: {
        height: '50%',
        top: '10%'
      },
      xAxis: {
        type: 'category',
        data: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        splitArea: {
          show: true
        },
        axisLabel: {
          color: this.isDarkMode ? '#F9FAFB' : '#333'
        }
      },
      yAxis: {
        type: 'category',
        data: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        splitArea: {
          show: true
        },
        axisLabel: {
          color: this.isDarkMode ? '#F9FAFB' : '#333'
        }
      },
      visualMap: {
        min: 0,
        max: Math.max(...this.dailyData.map(item => item.expenses)),
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '15%',
        textStyle: {
          color: this.isDarkMode ? '#F9FAFB' : '#333'
        },
        inRange: {
          color: ['#EBF8FF', '#3B82F6']
        }
      },
      series: [
        {
          name: 'Spending',
          type: 'heatmap',
          data: data,
          label: {
            show: true,
            color: this.isDarkMode ? '#F9FAFB' : '#333'
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }
      ]
    };
  }

  // Update charts when data changes
  private updateCharts(): void {
    this.initializePieChart();
    this.initializeBarChart();
    this.initializeLineChart();
    this.initializeAreaChart();
    this.initializeRadarChart();
    this.initializeFunnelChart();
    this.initializeScatterChart();
    this.initializeHeatmapChart();
  }

  // Detect current theme
  private detectTheme(): void {
    this.isDarkMode = document.documentElement.classList.contains('dark');

    // Listen for theme changes
    const observer = new MutationObserver(() => {
      this.isDarkMode = document.documentElement.classList.contains('dark');
      this.updateCharts(); // Re-initialize charts with new theme
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    // Listen for window resize to handle chart resizing
    if (this.ssrService.isClientSide()) {
      window.addEventListener('resize', () => {
        setTimeout(() => this.updateCharts(), 100);
      });
    }
  }
} 