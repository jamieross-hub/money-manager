import { Component, Input, Output, EventEmitter, OnInit, OnDestroy , ChangeDetectionStrategy} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { Account } from 'src/app/util/models/account.model';
import { AccountType } from 'src/app/util/config/enums';
import { ACCOUNT_GROUPS, AccountGroup, getAccountGroup } from 'src/app/util/config/account.config';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatRippleModule } from '@angular/material/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSortModule } from '@angular/material/sort';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
	selector: "mobile-accounts-list",
	templateUrl: "./mobile-accounts-list.component.html",
	styleUrls: ["./mobile-accounts-list.component.scss"],
	standalone: true,
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		MatFormFieldModule,
		MatInputModule,
		MatButtonModule,
		MatIconModule,
		MatCheckboxModule,
		MatRippleModule,
		MatTooltipModule,
		MatDividerModule,
		MatListModule,
		MatTabsModule,
		MatCardModule,
		MatCheckboxModule,
		MatSlideToggleModule,
		MatAutocompleteModule,
		MatExpansionModule,
		MatChipsModule,
		MatSnackBarModule,
		MatSliderModule,
		MatStepperModule,
		MatTableModule,
		MatPaginatorModule,
		MatSortModule,
	],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MobileAccountsListComponent implements OnInit, OnDestroy {
	@Input() accounts: Account[] = [];
	@Output() editAccount = new EventEmitter<Account>();
	@Output() deleteAccount = new EventEmitter<Account>();
	@Output() addAccount = new EventEmitter<void>();

	public selectedAccount: Account | null = null;
	private destroy$ = new Subject<void>();

	constructor() { }

	ngOnInit(): void { }

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	onAccountClick(account: Account): void {
		if (this.selectedAccount?.accountId === account.accountId) {
			this.selectedAccount = null;
		} else {
			this.selectedAccount = account;
		}
	}

	onEditAccount(account: Account): void {
		this.editAccount.emit(account);
		this.selectedAccount = null;
	}

	onDeleteAccount(account: Account): void {
		this.deleteAccount.emit(account);
		this.selectedAccount = null;
	}

	onAddAccount(): void {
		this.addAccount.emit();
	}

	trackByAccountId(index: number, account: Account): string {
		return account.accountId;
	}

	getAccountIcon(type: string): string {
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

	getBalanceClass(account: Account): string {
		if (account.type === AccountType.LOAN) {
			return 'loan-account';
		}
		return account.balance >= 0 ? 'positive-balance' : 'negative-balance';
	}

	/**
	 * Calculate monthly interest for loan accounts
	 */
	calculateMonthlyInterest(account: Account): number {
		if (account.type !== 'loan' || !account.loanDetails) {
			return 0;
		}

		const { interestRate, remainingBalance } = account.loanDetails;
		// Monthly interest = (Annual Rate / 12) * Remaining Balance
		return (interestRate / 12 / 100) * remainingBalance;
	}

	/**
	 * Check if account is a loan account
	 */
	isLoanAccount(account: Account): boolean {
		return account.type === 'loan' && !!account.loanDetails;
	}

	/**
	 * Get loan details safely
	 */
	getLoanDetails(account: Account) {
		return account.loanDetails || null;
	}

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

	public getGroupedAccounts(accounts: Account[]): { group: AccountGroup; accounts: Account[] }[] {
		return ACCOUNT_GROUPS.map(group => {
			const groupAccounts = this.getAccountsByGroup(accounts, group.id);

			return {
				group,
				accounts: groupAccounts
			};
		}).filter(groupData => groupData.accounts.length > 0); // Only show groups with accounts
	}
} 