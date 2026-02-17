import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyPipe } from 'src/app/util/pipes';
import { Auth } from '@angular/fire/auth';
import { NotificationService } from 'src/app/util/service/notification.service';
import { CurrencyService } from 'src/app/util/service/currency.service';
import { Store } from '@ngrx/store';
import { Observable, Subscription } from 'rxjs';
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
export class TotalBalanceComponent implements OnInit, OnDestroy {

  // Observables from store
  totalIncome$: Observable<number>;
  totalExpenses$: Observable<number>;
  netBalance$: Observable<number>;
  totalExpensesByMonth$: Observable<number>;
  totalIncomeByMonth$: Observable<number>;

  // Local properties
  totalSpendAmt = 0;
  totalIncomeAmt = 0;
  showYearly = false;
  userCurrency = this.currencyService.getDefaultCurrency();
  private subscriptions = new Subscription();

  constructor(
    private notificationService: NotificationService,
    private currencyService: CurrencyService,
    private store: Store<AppState>,
    private userService: UserService
  ) {
    // Initialize selectors
    this.totalIncome$ = this.store.select(TransactionsSelectors.selectTotalIncome);
    this.totalIncomeByMonth$ = this.store.select(TransactionsSelectors.selectTotalIncomeByMonth(dayjs().month(), dayjs().year()));
    this.totalExpenses$ = this.store.select(TransactionsSelectors.selectTotalExpenses);
    this.totalExpensesByMonth$ = this.store.select(TransactionsSelectors.selectTotalExpensesByMonth(dayjs().month(), dayjs().year()));
    this.netBalance$ = this.store.select(TransactionsSelectors.selectNetBalance);
  }

  ngOnInit() {
    // Subscribe to currency changes
    this.subscriptions.add(
      this.currencyService.currentCurrency$.subscribe(currency => {
        this.userCurrency = currency;
      })
    );

    // Load transactions from store
    const userId = this.userService.getCurrentUserId();
    if (userId) {
      this.store.dispatch(TransactionsActions.loadTransactions({ userId }));
    }

    // Subscribe to store data for backward compatibility
    this.subscriptions.add(
      this.totalIncome$.subscribe(income => {
        this.totalIncomeAmt = income;
      })
    );

    this.subscriptions.add(
      this.totalExpenses$.subscribe(expenses => {
        this.totalSpendAmt = expenses;
      })
    );

  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  toggleExpenseIncome() {
    this.showYearly = !this.showYearly;
  }

}
