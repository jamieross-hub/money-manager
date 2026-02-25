import { createAction, props } from '@ngrx/store';
import { Budget } from '../../util/service/db/budgets.service';

// Load budgets
export const loadBudgets = createAction(
  '[Budgets] Load Budgets',
  props<{ userId: string }>()
);

export const loadBudgetsSuccess = createAction(
  '[Budgets] Load Budgets Success',
  props<{ budgets: Budget[] }>()
);

export const loadBudgetsFailure = createAction(
  '[Budgets] Load Budgets Failure',
  props<{ error: any }>()
);

// Create budget
export const createBudget = createAction(
  '[Budgets] Create Budget',
  props<{ userId: string; budget: Budget }>()
);

export const createBudgetSuccess = createAction(
  '[Budgets] Create Budget Success',
  props<{ budget: Budget }>()
);

export const createBudgetFailure = createAction(
  '[Budgets] Create Budget Failure',
  props<{ error: any }>()
);

// Update budget
export const updateBudget = createAction(
  '[Budgets] Update Budget',
  props<{ userId: string; budgetId: string; budget: Partial<Budget> }>()
);

export const updateBudgetSuccess = createAction(
  '[Budgets] Update Budget Success',
  props<{ budget: Budget }>()
);

export const updateBudgetFailure = createAction(
  '[Budgets] Update Budget Failure',
  props<{ error: any }>()
);

// Delete budget
export const deleteBudget = createAction(
  '[Budgets] Delete Budget',
  props<{ userId: string; budgetId: string }>()
);

export const deleteBudgetSuccess = createAction(
  '[Budgets] Delete Budget Success',
  props<{ budgetId: string }>()
);

export const deleteBudgetFailure = createAction(
  '[Budgets] Delete Budget Failure',
  props<{ error: any }>()
);

// Update spent amount
export const updateSpent = createAction(
  '[Budgets] Update Spent',
  props<{ userId: string; budgetId: string; amount: number }>()
);

export const updateSpentSuccess = createAction(
  '[Budgets] Update Spent Success',
  props<{ budget: Budget }>()
);

export const updateSpentFailure = createAction(
  '[Budgets] Update Spent Failure',
  props<{ error: any }>()
);

// Clear State
export const clearBudgets = createAction('[Budgets] Clear Budgets');