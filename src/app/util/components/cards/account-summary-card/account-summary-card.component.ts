import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { Observable, Subject, takeUntil } from 'rxjs';
import { Store } from '@ngrx/store';
import { Account, LoanDetails } from 'src/app/util/models/account.model';
import { AccountType } from 'src/app/util/config/enums';
import { AppState } from 'src/app/store/app.state';
import * as AccountsSelectors from 'src/app/store/accounts/accounts.selectors';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { CurrencyPipe } from 'src/app/util/pipes/currency.pipe';

@Component({
  selector: 'app-account-summary-card',
  templateUrl: './account-summary-card.component.html',
  styleUrls: ['./account-summary-card.component.scss'],
  standalone: true,
  imports: [CommonModule, MatIconModule, MatCardModule, CurrencyPipe]
})
export class AccountSummaryCardComponent implements OnInit, OnDestroy {



  // Observables from store
  public accounts$: Observable<Account[]>;
  public totalBalance$: Observable<number>;

  public accounts: Account[] = [];
  private destroy$ = new Subject<void>();

  constructor(private store: Store<AppState>) {
    // Initialize selectors
    this.accounts$ = this.store.select(AccountsSelectors.selectAllAccounts);
    this.totalBalance$ = this.store.select(AccountsSelectors.selectTotalBalance);
  }

  ngOnInit(): void {
    this.accounts$
      .pipe(takeUntil(this.destroy$))
      .subscribe(accounts => {
        this.accounts = accounts;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Get positive balance accounts
   */
  public getPositiveAccounts(): Account[] {
    return this.accounts.filter(account => {
      if (account.type === AccountType.LOAN && account.loanDetails) {
        // For loan accounts, check if remaining balance is negative (meaning it's paid off)
        return -(account.loanDetails.remainingBalance || 0) > 0;
      }
      return account.balance > 0;
    });
  }

  /**
   * Get negative balance accounts
   */
  public getNegativeAccounts(): Account[] {
    return this.accounts.filter(account => {
      if (account.type === AccountType.LOAN && account.loanDetails) {
        // For loan accounts, check if remaining balance is positive (meaning money is owed)
        return -(account.loanDetails.remainingBalance || 0) < 0;
      }
      return account.balance < 0;
    });
  }

  /**
   * Get total positive balance
   */
  public getTotalPositiveBalance(): number {
    return this.getPositiveAccounts().reduce((total, account) => {
      if (account.type === AccountType.LOAN && account.loanDetails) {
        return total + (-(account.loanDetails.remainingBalance || 0));
      }
      return total + account.balance;
    }, 0);
  }

  /**
   * Get total negative balance
   */
  public getTotalNegativeBalance(): number {
    return this.getNegativeAccounts().reduce((total, account) => {
      if (account.type === AccountType.LOAN) {
        const loanDetails = account.loanDetails as LoanDetails;
        return total - loanDetails.remainingBalance;
      }
      return total + account.balance;
    }, 0);
  }
} 