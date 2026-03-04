import { Component, OnInit, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyPipe } from 'src/app/util/pipes';
import { CurrencyService } from 'src/app/util/service/currency.service';
import { Store } from '@ngrx/store';
import dayjs from 'dayjs';
import { AppState } from 'src/app/store/app.state';
import * as TransactionsActions from 'src/app/store/transactions/transactions.actions';
import * as TransactionsSelectors from 'src/app/store/transactions/transactions.selectors';
import { UserService } from 'src/app/util/service/db/user.service';

@Component({
  selector: 'total-balance',
  templateUrl: './total-balance.component.html',
  styleUrl: './total-balance.component.scss',
  standalone: true,
  imports: [CommonModule, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TotalBalanceComponent implements OnInit {
  private readonly currencyService = inject(CurrencyService);
  private readonly store = inject(Store<AppState>);
  private readonly userService = inject(UserService);

  // Signals from store
  readonly totalIncome = this.store.selectSignal(TransactionsSelectors.selectTotalIncome);
  readonly totalExpenses = this.store.selectSignal(TransactionsSelectors.selectTotalExpenses);
  readonly totalIncomeByMonth = this.store.selectSignal(TransactionsSelectors.selectTotalIncomeByMonth(dayjs().month(), dayjs().year()));
  readonly totalExpensesByMonth = this.store.selectSignal(TransactionsSelectors.selectTotalExpensesByMonth(dayjs().month(), dayjs().year()));

  readonly showYearly = signal(false);
  readonly userCurrency = this.currencyService.currentCurrency;

  ngOnInit() {
    const userId = this.userService.getCurrentUserId();
    if (userId) {
      this.store.dispatch(TransactionsActions.loadTransactions({ userId }));
    }
  }

  toggleExpenseIncome() {
    this.showYearly.update(v => !v);
  }
}
