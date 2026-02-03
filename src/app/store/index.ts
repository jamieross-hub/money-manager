import { NgModule } from '@angular/core';
import { StoreModule, MetaReducer } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { environment } from '../../environments/environment';

import { transactionsReducer } from './transactions/transactions.reducer';
import { categoriesReducer } from './categories/categories.reducer';
import { accountsReducer } from './accounts/accounts.reducer';
import { budgetsReducer } from './budgets/budgets.reducer';
import { goalsReducer } from './goals/goals.reducer';
import { profileReducer } from './profile/profile.reducer';

import { TransactionsEffects } from './transactions/transactions.effects';
import { CategoriesEffects } from './categories/categories.effects';
import { AccountsEffects } from './accounts/accounts.effects';
import { BudgetsEffects } from './budgets/budgets.effects';
import { GoalsEffects } from './goals/goals.effects';
import { ProfileEffects } from './profile/profile.effects';

import { storageMetaReducer } from './storage.metareducer';

export const metaReducers: MetaReducer<any>[] = [storageMetaReducer];

@NgModule({
  imports: [
    StoreModule.forRoot({
      transactions: transactionsReducer,
      categories: categoriesReducer,
      accounts: accountsReducer,
      budgets: budgetsReducer,
      goals: goalsReducer,
      profile: profileReducer
    }, { metaReducers }),
    EffectsModule.forRoot([
      TransactionsEffects,
      CategoriesEffects,
      AccountsEffects,
      BudgetsEffects,
      GoalsEffects,
      ProfileEffects
    ]),
    StoreDevtoolsModule.instrument({
      maxAge: 25,
      logOnly: environment.production
    })
  ]
})
export class AppStoreModule { } 