import { createReducer, on } from '@ngrx/store';
import { BudgetsState, initialState } from './budgets.state';
import * as BudgetsActions from './budgets.actions';

export const budgetsReducer = createReducer(
  initialState,
  
  // Load budgets
  on(BudgetsActions.loadBudgets, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  
  on(BudgetsActions.loadBudgetsSuccess, (state, { budgets }) => ({
    ...state,
    budgets,
    loading: false,
    error: null
  })),
  
  on(BudgetsActions.loadBudgetsFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),
  
  // Create budget
  on(BudgetsActions.createBudget, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  
  on(BudgetsActions.createBudgetSuccess, (state, { budget }) => ({
    ...state,
    budgets: [...state.budgets, budget],
    loading: false,
    error: null
  })),
  
  on(BudgetsActions.createBudgetFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),
  
  // Update budget
  on(BudgetsActions.updateBudget, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  
  on(BudgetsActions.updateBudgetSuccess, (state, { budget }) => ({
    ...state,
    budgets: state.budgets.map(b => b.budgetId === budget.budgetId ? budget : b),
    loading: false,
    error: null
  })),
  
  on(BudgetsActions.updateBudgetFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),
  
  // Delete budget
  on(BudgetsActions.deleteBudget, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  
  on(BudgetsActions.deleteBudgetSuccess, (state, { budgetId }) => ({
    ...state,
    budgets: state.budgets.filter(b => b.budgetId !== budgetId),
    loading: false,
    error: null
  })),
  
  on(BudgetsActions.deleteBudgetFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),
  
  // Update spent
  on(BudgetsActions.updateSpent, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  
  on(BudgetsActions.updateSpentSuccess, (state, { budget }) => ({
    ...state,
    budgets: state.budgets.map(b => b.budgetId === budget.budgetId ? budget : b),
    loading: false,
    error: null
  })),
  
  on(BudgetsActions.updateSpentFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),

  // Clear State
  on(BudgetsActions.clearBudgets, () => initialState)
); 