// Example of how to use NgRx store in your components

import { Component, OnInit , ChangeDetectionStrategy} from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { AppState } from './app.state';

// Import actions
import * as TransactionsActions from './transactions/transactions.actions';
import * as CategoriesActions from './categories/categories.actions';
import * as AccountsActions from './accounts/accounts.actions';

// Import selectors
import * as TransactionsSelectors from './transactions/transactions.selectors';
import * as CategoriesSelectors from './categories/categories.selectors';
import * as AccountsSelectors from './accounts/accounts.selectors';

// Import models
import { Transaction } from '../util/models/transaction.model';
import { Category } from '../util/models/category.model';
import { Account } from '../util/models/account.model';
import { TransactionType } from '../util/config/enums';

@Component({
  selector: 'app-example',
  template: `
    <div>
      <h2>Transactions</h2>
      <div *ngIf="transactionsLoading$ | async">Loading transactions...</div>
      <div *ngIf="transactions$ | async as transactions">
        <div *ngFor="let transaction of transactions">
          {{ transaction.payee }} - {{ transaction.amount }}
        </div>
      </div>
      
      <h2>Categories</h2>
      <div *ngIf="categoriesLoading$ | async">Loading categories...</div>
      <div *ngIf="categories$ | async as categories">
        <div *ngFor="let category of categories">
          {{ category.name }} - {{ category.type }}
        </div>
      </div>
      
      <h2>Accounts</h2>
      <div *ngIf="accountsLoading$ | async">Loading accounts...</div>
      <div *ngIf="accounts$ | async as accounts">
        <div *ngFor="let account of accounts">
          {{ account.name }} - {{ account.balance }}
        </div>
      </div>
      
      <button (click)="loadData()">Load Data</button>
      <button (click)="createTransaction()">Create Transaction</button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExampleComponent implements OnInit {

  // Observables from store
  transactions$: Observable<Transaction[]>;
  transactionsLoading$: Observable<boolean>;
  transactionsError$: Observable<any>;

  categories$: Observable<Category[]>;
  categoriesLoading$: Observable<boolean>;
  categoriesError$: Observable<any>;

  accounts$: Observable<Account[]>;
  accountsLoading$: Observable<boolean>;
  accountsError$: Observable<any>;

  // Computed values
  totalIncome$: Observable<number>;
  totalExpenses$: Observable<number>;
  netBalance$: Observable<number>;

  constructor(private store: Store<AppState>) {
    // Initialize selectors
    this.transactions$ = this.store.select(TransactionsSelectors.selectAllTransactions);
    this.transactionsLoading$ = this.store.select(TransactionsSelectors.selectTransactionsLoading);
    this.transactionsError$ = this.store.select(TransactionsSelectors.selectTransactionsError);

    this.categories$ = this.store.select(CategoriesSelectors.selectAllCategories);
    this.categoriesLoading$ = this.store.select(CategoriesSelectors.selectCategoriesLoading);
    this.categoriesError$ = this.store.select(CategoriesSelectors.selectCategoriesError);

    this.accounts$ = this.store.select(AccountsSelectors.selectAllAccounts);
    this.accountsLoading$ = this.store.select(AccountsSelectors.selectAccountsLoading);
    this.accountsError$ = this.store.select(AccountsSelectors.selectAccountsError);

    // Computed selectors
    this.totalIncome$ = this.store.select(TransactionsSelectors.selectTotalIncome);
    this.totalExpenses$ = this.store.select(TransactionsSelectors.selectTotalExpenses);
    this.netBalance$ = this.store.select(TransactionsSelectors.selectNetBalance);
  }

  ngOnInit() {
    // Load initial data
    this.loadData();
  }

  loadData() {
    const userId = 'current-user-id'; // Get from auth service

    // Dispatch actions to load data
    this.store.dispatch(TransactionsActions.loadTransactions({ userId }));
    this.store.dispatch(CategoriesActions.loadCategories({ userId }));
    this.store.dispatch(AccountsActions.loadAccounts({ userId }));
  }

  createTransaction() {
    const userId = 'current-user-id';
    const newTransaction = {
      payee: 'Test Payee',
      userId: userId,
      accountId: 'account-id',
      amount: 100,
      category: 'Food',
      type: 'expense' as const,
      date: new Date() as any,
      notes: 'Test transaction'
    };

    this.store.dispatch(TransactionsActions.createTransaction({
      userId,
      transaction: newTransaction as any
    }));
  }

  createCategory() {
    const userId = 'current-user-id';

    this.store.dispatch(CategoriesActions.createCategory({
      userId,
      name: 'New Category',
      categoryType: TransactionType.EXPENSE,
      icon: 'category',
      color: '#FF5722'
    }));
  }

  createAccount() {
    const userId = 'current-user-id';
    const accountData = {
      name: 'New Account',
      type: 'bank' as const,
      balance: 1000,
      description: 'Test account',
      currency: 'USD'
    };

    this.store.dispatch(AccountsActions.createAccount({
      userId,
      accountData: accountData as any
    }));
  }

  updateTransaction(transactionId: string) {
    const userId = 'current-user-id';
    const updates = {
      amount: 150,
      notes: 'Updated transaction'
    };

    this.store.dispatch(TransactionsActions.updateTransaction({
      userId,
      transactionId,
      transaction: updates
    }));
  }

  deleteTransaction(transactionId: string) {
    const userId = 'current-user-id';

    this.store.dispatch(TransactionsActions.deleteTransaction({
      userId,
      transactionId
    }));
  }
}

/*
USAGE IN COMPONENTS:

1. Inject Store in constructor:
   constructor(private store: Store<AppState>) {}

2. Select data using selectors:
   this.transactions$ = this.store.select(TransactionsSelectors.selectAllTransactions);

3. Dispatch actions:
   this.store.dispatch(TransactionsActions.loadTransactions({ userId }));

4. Use in template:
   <div *ngIf="transactions$ | async as transactions">
     <div *ngFor="let transaction of transactions">
       {{ transaction.payee }}
     </div>
   </div>

5. Handle loading states:
   <div *ngIf="transactionsLoading$ | async">Loading...</div>

6. Handle errors:
   <div *ngIf="transactionsError$ | async as error">{{ error }}</div>

7. Use computed selectors:
   <div>Total Income: {{ totalIncome$ | async | currency }}</div>
   <div>Total Expenses: {{ totalExpenses$ | async | currency }}</div>
   <div>Net Balance: {{ netBalance$ | async | currency }}</div>
*/ 