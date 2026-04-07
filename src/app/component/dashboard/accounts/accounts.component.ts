import { Component, OnInit, OnDestroy, Input, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { UserService } from 'src/app/util/service/db/user.service';
import { Subject, takeUntil, Observable, of } from 'rxjs';
import { Account, LoanDetails } from 'src/app/util/models/account.model';
import { MatDialog } from '@angular/material/dialog';
import { BreakpointObserver } from '@angular/cdk/layout';
import { AddAccountDialogComponent } from './add-account-dialog/add-account-dialog.component';
import { AccountStatementDialogComponent } from './account-statement-dialog/account-statement-dialog.component';
import { NotificationService } from 'src/app/util/service/notification.service';
import { ConfirmDialogComponent } from 'src/app/util/components/confirm-dialog/confirm-dialog.component';
import { Store } from '@ngrx/store';
import { AppState } from '../../../store/app.state';
import * as AccountsActions from '../../../store/accounts/accounts.actions';
import * as AccountsSelectors from '../../../store/accounts/accounts.selectors';
import * as TransactionsActions from '../../../store/transactions/transactions.actions';
import * as TransactionsSelectors from '../../../store/transactions/transactions.selectors';
import { DateService } from 'src/app/util/service/date.service';
import { AccountType } from 'src/app/util/config/enums';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';
import { ACCOUNT_GROUPS, AccountGroup, getAccountGroup } from 'src/app/util/config/account.config';
import { Transaction } from 'src/app/util/models/transaction.model';
import * as ProfileSelectors from '../../../store/profile/profile.selectors';
import { BehaviorSubject, combineLatest, map, distinctUntilChanged } from 'rxjs';
import { CurrencyService } from 'src/app/util/service/currency.service';
import { FooterService } from 'src/app/component/dashboard/footer/footer.service';

interface AccountViewModel {
  account: Account;
  icon: string;
  color?: string;
  balanceClass: string;
  isLoan: boolean;
  loanRemainingBalance?: number;
  isCreditCard: boolean;
  maskedId: string;
  formattedName: string;
  formattedInstitution: string;
  formattedBalance: string;
  // Payment Due Status
  isPaymentDue: boolean;
  daysUntilDue?: number;
  paymentDueStatus?: 'overdue' | 'due-soon' | 'upcoming';
  nextDueDate?: Date;
}

interface GroupViewModel {
  id: string;
  name: string;
  accounts: AccountViewModel[];
  totalBalance: number;
  formattedTotalBalance: string;
  isCollapsed: boolean;
  count: number;
}

import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';
import { AccountSummaryCardComponent } from 'src/app/util/components/cards/account-summary-card/account-summary-card.component';
import { AccountStatsPipe } from 'src/app/util/pipes/account-stats.pipe';


@Component({
  selector: 'user-accounts',
  templateUrl: './accounts.component.html',
  styleUrls: ['./accounts.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatMenuModule,
    MatTooltipModule,
    TranslateModule,
    AccountSummaryCardComponent,
    AccountStatsPipe
  ]
})
export class AccountsComponent implements OnInit, OnDestroy {


  // Observables from store
  public accounts$: Observable<Account[]> = of([]);
  public isLoading$: Observable<boolean>;
  public error$: Observable<any>;
  public totalBalance$: Observable<number>;
  public totalAssets$: Observable<number>;
  public totalLiabilities$: Observable<number>;
  public bankBalance$: Observable<number>;
  public cashBalance$: Observable<number>;
  public creditBalance$: Observable<number>;
  public investmentBalance$: Observable<number>;
  public userCurrency$: Observable<string | undefined>;

  // Component state
  public accounts: Account[] = [];
  public isLoading: boolean = false;
  public errorMessage: string = '';
  public selectedAccount: Account | null = null;
  public expandedAccount: Account | null = null;
  public isListViewMode: boolean = false; // Add this property for list view toggle
  public transactions: Transaction[] = []; // Store transactions for access in template
  public collapsedGroups$ = new BehaviorSubject<Map<string, boolean>>(new Map());
  public groupedAccountsViewModel: GroupViewModel[] = [];

  // Private properties
  private userId: string = '';
  private destroy$ = new Subject<void>();

  constructor(
    private readonly auth: Auth,
    private readonly router: Router,
    private readonly dialog: MatDialog,
    private readonly store: Store<AppState>,
    public readonly dateService: DateService,
    public readonly breakpointService: BreakpointService,
    private readonly userService: UserService,
    private readonly cdr: ChangeDetectorRef,
    private readonly notificationService: NotificationService,
    private readonly currencyService: CurrencyService,
    private readonly footerService: FooterService
  ) {

    if (this.breakpointService.device.isMobile) {
      this.isListViewMode = true;
    }

    // Initialize selectors
    this.accounts$ = this.store.select(AccountsSelectors.selectAllAccounts) || of([]);
    this.isLoading$ = this.store.select(AccountsSelectors.selectAccountsLoading);
    this.error$ = this.store.select(AccountsSelectors.selectAccountsError);
    this.totalBalance$ = this.store.select(AccountsSelectors.selectTotalBalance);
    this.totalAssets$ = this.store.select(AccountsSelectors.selectTotalAssets);
    this.totalLiabilities$ = this.store.select(AccountsSelectors.selectTotalLiabilities);
    this.bankBalance$ = this.store.select(AccountsSelectors.selectTotalBalanceByType(AccountType.BANK));
    this.cashBalance$ = this.store.select(AccountsSelectors.selectTotalBalanceByType(AccountType.CASH));
    this.creditBalance$ = this.store.select(AccountsSelectors.selectTotalBalanceByType(AccountType.CREDIT));
    this.investmentBalance$ = this.store.select(AccountsSelectors.selectTotalBalanceByType(AccountType.INVESTMENT));
    this.userCurrency$ = this.store.select(ProfileSelectors.selectUserCurrency);
  }

  ngOnInit(): void {
    this.initializeComponent();
    this.setupViewModel();
    this.setupFooter();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.footerService.resetConfig();
  }

  private setupFooter(): void {
    this.footerService.patchConfig({
      fab: {
        id: 'fab',
        icon: 'account_balance',
        label: 'Account',
        bgClass: 'add-btn-green',
        isFab: true,
        action: () => this.addAccount()
      }
    });
  }

  /**
   * Initialize the component by loading user accounts
   */
  private async initializeComponent(): Promise<void> {
    const userId = this.userService.getCurrentUserId();

    if (!userId) {
      this.errorMessage = 'User not authenticated';
      return;
    }

    this.userId = userId;
    this.loadUserAccounts();
  }

  /**
   * Load all accounts for the current user
   */
  private loadUserAccounts(): void {
    this.store.dispatch(AccountsActions.loadAccounts({ userId: this.userId }));
    this.store.dispatch(TransactionsActions.loadTransactions({ userId: this.userId }));

    // Subscribe to store data for backward compatibility
    this.accounts$
      .pipe(takeUntil(this.destroy$))
      .subscribe(accounts => {
        this.accounts = accounts;
      });

    this.isLoading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loading => {
        this.isLoading = loading;
      });

    this.error$
      .pipe(takeUntil(this.destroy$))
      .subscribe(error => {
        if (error) {
          this.errorMessage = 'Failed to load accounts';
          console.error('Error loading accounts:', error);
        }
      });

    // Subscribe to transactions
    this.store.select(TransactionsSelectors.selectAllTransactions)
      .pipe(takeUntil(this.destroy$))
      .subscribe(transactions => {
        this.transactions = transactions || [];
      });
  }

  private setupViewModel(): void {
    combineLatest([
      this.accounts$.pipe(distinctUntilChanged()),
      this.collapsedGroups$.pipe(distinctUntilChanged()),
      this.userCurrency$.pipe(distinctUntilChanged())
    ]).pipe(
      takeUntil(this.destroy$),
      map(([accounts, collapsedMap, currencyCode]) => {


        return ACCOUNT_GROUPS.map(group => {
          const groupAccounts = accounts.filter(account => group.accountTypes.includes(account.type));
          if (groupAccounts.length === 0) return null;

          const totalBalance = groupAccounts.reduce((total, account) => {
            let balance = account.balance;
            if (account.type === AccountType.LOAN && account.loanDetails) {
              balance = -(account.loanDetails.remainingBalance ?? 0);
            }
            return total + balance;
          }, 0);

          const accountViewModels: AccountViewModel[] = groupAccounts.map(account => {
            const rawBalance = account.type === AccountType.LOAN && account.loanDetails
              ? -(account.loanDetails.remainingBalance ?? 0)
              : account.balance;

            return {
              account,
              icon: account.icon || this.getAccountIcon(account.type),
              color: account.color || '#60a5fa',
              balanceClass: this.getBalanceClass(account),
              isLoan: account.type === AccountType.LOAN && !!account.loanDetails,
              loanRemainingBalance: account.loanDetails?.remainingBalance,
              isCreditCard: account.type === AccountType.CREDIT,
              maskedId: account.accountId.slice(-4),
              formattedName: this.toTitleCase(account.name),
              formattedInstitution: this.toTitleCase(account.institution || account.type),
              formattedBalance: this.currencyService.formatAmount(rawBalance,{round:true}),
              ...this.getPaymentDueStatus(account)
            };
          });

          return {
            id: group.id,
            name: group.name,
            accounts: accountViewModels,
            totalBalance,
            formattedTotalBalance: this.currencyService.formatAmount(totalBalance ,{compact:true}),
            isCollapsed: collapsedMap.get(group.id) || false,
            count: groupAccounts.length
          } as GroupViewModel;
        }).filter((g): g is GroupViewModel => g !== null);
      })
    ).subscribe(viewModel => {
      this.groupedAccountsViewModel = viewModel;
      this.cdr.markForCheck();
    });
  }

  private toTitleCase(str: string): string {
    return str ? str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') : '';
  }





  /**
   * Clear any error messages
   */
  public clearError(): void {
    this.errorMessage = '';
  }

  /**
   * Toggle between list view and detailed view modes
   */
  public toggleListViewMode(): void {
    this.isListViewMode = !this.isListViewMode;
  }

  /**
   * Track function for ngFor to optimize rendering performance
   */
  public trackByAccountId(index: number, account: Account): string {
    return account.accountId;
  }

  /**
   * Open dialog for adding/editing accounts
   */
  public openAccountDialog(account?: Account): void {
    const dialogRef = this.dialog.open(AddAccountDialogComponent, {
      panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : 'desktop-dialog',
      closeOnNavigation: false,
      data: account || null
    });

    dialogRef.afterClosed().subscribe(result => {
    });
  }

  /**
   * Edit an existing account
   */
  public editAccount(account: Account): void {
    this.openAccountDialog(account);
  }

  /**
   * Delete an account
   */
  public async deleteAccount(account: Account): Promise<void> {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Account',
        message: `Are you sure you want to delete "${account.name}"? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        confirmColor: 'warn',
        closeOnNavigation: false
      }
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        try {
          // Delete all transactions linked to this account first
          const linkedTransactions = this.transactions.filter(t => t.accountId === account.accountId);
          linkedTransactions.forEach(t => {
            this.store.dispatch(TransactionsActions.deleteTransaction({ userId: this.userId, transactionId: t.id! }));
          });

          // Then delete the account itself
          this.store.dispatch(AccountsActions.deleteAccount({ userId: this.userId, accountId: account.accountId }));

          const txMsg = linkedTransactions.length > 0
            ? ` and ${linkedTransactions.length} linked transaction(s) deleted.`
            : '';
          this.notificationService.info(`Account deleted successfully${txMsg}`);
        } catch (error) {
          this.notificationService.error('Failed to delete account');
          console.error('Error deleting account:', error);
        }
      }
    });
  }

  /**
   * Add a new account
   */
  public addAccount(): void {
    this.openAccountDialog();
  }

  public viewAccountStatement(account: Account): void {
    this.dialog.open(AccountStatementDialogComponent, {
      data: { account },
      width: '90vw',
      maxWidth: '800px',
      maxHeight: '90vh',
      closeOnNavigation: false,
      panelClass: 'account-statement-dialog'
    });
  }

  /**
   * Calculate monthly interest for loan accounts
   */
  public calculateMonthlyInterest(account: Account): number {
    if (account.type !== 'loan' || !account.loanDetails) {
      return 0;
    }

    const { interestRate, remainingBalance } = account.loanDetails;
    // Monthly interest = (Annual Rate / 12) * Remaining Balance
    return (interestRate / 12 / 100) * (remainingBalance ?? 0);
  }

  /**
   * Check if account is a loan account
   */
  public isLoanAccount(account: Account): boolean {
    return account.type === 'loan' && !!account.loanDetails;
  }

  /**
   * Get loan details safely
   */
  public getLoanDetails(account: Account): LoanDetails | undefined {
    return account.loanDetails;
  }

  public isCreditCardAccount(account: Account): boolean {
    return account.type === AccountType.CREDIT;
  }



  public getDaySuffix(day: number): string {
    if (day >= 11 && day <= 13) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  }



  /**
   * Handle account click to show/hide actions
   */
  public onAccountClick(account: Account): void {
    if (this.selectedAccount?.accountId === account.accountId) {
      this.selectedAccount = null;
    } else {
      this.selectedAccount = account;
    }
  }

  /**
   * Get balance class for styling
   */
  public getBalanceClass(account: Account): string {
    if (account.type === 'loan') {
      return 'loan-account';
    }
    return account.balance >= 0 ? 'positive-balance' : 'negative-balance';
  }

  /**
   * Get account icon based on type
   */
  public getAccountIcon(type: string): string {
    switch (type) {
      case 'bank':
        return 'account_balance';
      case 'cash':
        return 'payments';
      case 'credit':
        return 'credit_card';
      case 'loan':
        return 'account_balance_wallet';
      default:
        return 'account_balance';
    }
  }

  /**
   * Toggle account expansion to show/hide details
   */
  public toggleAccountExpansion(account: Account): void {
    if (!this.breakpointService.device.isMobile) return;

    if (this.expandedAccount?.accountId === account.accountId) {
      this.expandedAccount = null;
    } else {
      this.expandedAccount = account;
      this.notificationService.lightVibration();
    }
  }

  /**
   * Get recent transactions for an account
   */
  public getRecentTransactions(account: Account): Transaction[] {
    // Filter transactions for this specific account
    const accountTransactions = this.transactions.filter(t => t.accountId === account.accountId);

    // Sort by date (most recent first) and return the last 10 transactions
    return accountTransactions
      .filter(t => t.date)
      .sort((a, b) => {
        if (!a.date || !b.date) return 0;
        const dateA = this.dateService.toDate(a.date);
        const dateB = this.dateService.toDate(b.date);
        if (!dateA || !dateB) return 0;
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 10);
  }



  /**
   * Get account statistics from actual transaction data
   */
  // Removed getAccountStats from here as it is now handled by AccountStatsPipe in the template

  // Account Grouping Methods
  public getAccountGroups(): AccountGroup[] {
    return ACCOUNT_GROUPS;
  }

  public getAccountGroup(account: Account): AccountGroup | undefined {
    return getAccountGroup(account.type);
  }

  public getAccountsByGroup(accounts: Account[], groupId: string): Account[] {
    const group = ACCOUNT_GROUPS.find(g => g.id === groupId);
    if (!group) return [];

    return accounts.filter(account => group.accountTypes.includes(account.type));
  }

  public getGroupTotalBalance(accounts: Account[], groupId: string): number {
    const groupAccounts = this.getAccountsByGroup(accounts, groupId);
    return groupAccounts.reduce((total, account) => {
      let balance = account.balance;
      if (account.type === AccountType.LOAN && account.loanDetails) {
        balance = -(account.loanDetails.remainingBalance ?? 0);
      }
      return total + balance;
    }, 0);
  }

  public getGroupedAccounts(accounts: Account[]): { group: AccountGroup; accounts: Account[]; totalBalance: number }[] {
    return ACCOUNT_GROUPS.map(group => {
      const groupAccounts = this.getAccountsByGroup(accounts, group.id);
      const totalBalance = this.getGroupTotalBalance(accounts, group.id);

      return {
        group,
        accounts: groupAccounts,
        totalBalance
      };
    }).filter(groupData => groupData.accounts.length > 0); // Only show groups with accounts
  }

  /**
   * Toggle collapse state for a group
   */
  public toggleGroupCollapse(groupId: string): void {
    const currentMap = this.collapsedGroups$.value;
    const newMap = new Map(currentMap);
    const currentState = newMap.get(groupId) || false;
    newMap.set(groupId, !currentState);
    this.collapsedGroups$.next(newMap);
  }

  /**
   * Check if a group is collapsed
   */
  /**
   * Check if a group is collapsed
   */
  public isGroupCollapsed(groupId: string): boolean {
    return this.collapsedGroups$.value.get(groupId) || false;
  }

  // --- Methods for Tests ---

  public getPositiveAccounts(): Account[] {
    return this.accounts.filter(a => a.balance > 0);
  }

  public getNegativeAccounts(): Account[] {
    return this.accounts.filter(a => a.balance <= 0);
  }

  public getTotalPositiveBalance(): number {
    return this.getPositiveAccounts().reduce((sum, a) => sum + a.balance, 0);
  }

  public getTotalNegativeBalance(): number {
    return this.getNegativeAccounts().reduce((sum, a) => sum + a.balance, 0);
  }

  /**
   * Get payment due status for an account
   */
  private getPaymentDueStatus(account: Account): { isPaymentDue: boolean, daysUntilDue?: number, paymentDueStatus?: 'overdue' | 'due-soon' | 'upcoming', nextDueDate?: Date } {
    if (account.type !== AccountType.LOAN) {
      return { isPaymentDue: false };
    }

    let nextDueDate: Date | undefined;

    if (account.type === AccountType.LOAN && account.loanDetails?.nextDueDate) {
      const date = this.dateService.toDate(account.loanDetails.nextDueDate);
      nextDueDate = date || undefined;
    }

    if (!nextDueDate) {
      return { isPaymentDue: false };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(nextDueDate);
    dueDate.setHours(0, 0, 0, 0);

    const diffTime = dueDate.getTime() - today.getTime();
    const daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let status: 'overdue' | 'due-soon' | 'upcoming' = 'upcoming';
    if (daysUntilDue < 0) {
      status = 'overdue';
    } else if (daysUntilDue <= 7) {
      status = 'due-soon';
    }

    return {
      isPaymentDue: daysUntilDue <= 7,
      daysUntilDue,
      paymentDueStatus: status,
      nextDueDate
    };
  }
}

