import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { Account, LoanDetails } from 'src/app/util/models/account.model';
import { AccountType } from 'src/app/util/config/enums';
import { AppState } from 'src/app/store/app.state';
import * as AccountsSelectors from 'src/app/store/accounts/accounts.selectors';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { CurrencyPipe } from 'src/app/util/pipes/currency.pipe';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-account-summary-card',
  templateUrl: './account-summary-card.component.html',
  styleUrls: ['./account-summary-card.component.scss'],
  standalone: true,
  imports: [CommonModule, MatIconModule, MatCardModule, CurrencyPipe , RouterModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccountSummaryCardComponent {
  private readonly store = inject(Store<AppState>);
  public readonly breakpointService = inject(BreakpointService);

  // Signals from store
  public readonly accounts = toSignal(this.store.select(AccountsSelectors.selectAllAccounts), { initialValue: [] });
  public readonly totalBalance = toSignal(this.store.select(AccountsSelectors.selectTotalBalance), { initialValue: 0 });

  /**
   * Positive balance accounts
   */
  public readonly positiveAccounts = computed(() => 
    this.accounts().filter(account => {
      if (account.type === AccountType.LOAN && account.loanDetails) {
        return -(account.loanDetails.remainingBalance ?? 0) > 0;
      }
      if (account.type === AccountType.CREDIT) {
        return account.balance > 0;
      }
      return account.balance >= 0;
    })
  );

  /**
   * Negative balance accounts
   */
  public readonly negativeAccounts = computed(() => 
    this.accounts().filter(account => {
      if (account.type === AccountType.LOAN && account.loanDetails) {
        return -(account.loanDetails.remainingBalance ?? 0) <= 0;
      }
      if (account.type === AccountType.CREDIT) {
        return account.balance <= 0;
      }
      return account.balance < 0;
    })
  );

  /**
   * Total positive balance
   */
  public readonly totalPositiveBalance = computed(() => 
    this.positiveAccounts().reduce((total, account) => {
      if (account.type === AccountType.LOAN && account.loanDetails) {
        return total + (-(account.loanDetails.remainingBalance ?? 0));
      }
      return total + account.balance;
    }, 0)
  );

  /**
   * Total negative balance
   */
  public readonly totalNegativeBalance = computed(() => 
    this.negativeAccounts().reduce((total, account) => {
      if (account.type === AccountType.LOAN) {
        const loanDetails = account.loanDetails as LoanDetails;
        return total - (loanDetails.remainingBalance ?? 0);
      }
      return total + account.balance;
    }, 0)
  );
}
 