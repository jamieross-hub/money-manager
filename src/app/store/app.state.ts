import { TransactionsState } from './transactions/transactions.state';
import { CategoriesState } from './categories/categories.state';
import { AccountsState } from './accounts/accounts.state';
import { BudgetsState } from './budgets/budgets.state';
import { GoalsState } from './goals/goals.state';
import { ProfileState } from './profile/profile.state';

export interface AppState {
  transactions: TransactionsState;
  categories: CategoriesState;
  accounts: AccountsState;
  budgets: BudgetsState;
  goals: GoalsState;
  profile: ProfileState;
} 