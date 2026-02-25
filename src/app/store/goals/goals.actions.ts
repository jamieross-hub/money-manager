import { createAction, props } from '@ngrx/store';
import { Goal } from '../../util/service/db/goals.service';

// Load goals
export const loadGoals = createAction(
  '[Goals] Load Goals',
  props<{ userId: string }>()
);

export const loadGoalsSuccess = createAction(
  '[Goals] Load Goals Success',
  props<{ goals: Goal[] }>()
);

export const loadGoalsFailure = createAction(
  '[Goals] Load Goals Failure',
  props<{ error: any }>()
);

// Create goal
export const createGoal = createAction(
  '[Goals] Create Goal',
  props<{ userId: string; goal: Goal }>()
);

export const createGoalSuccess = createAction(
  '[Goals] Create Goal Success',
  props<{ goal: Goal }>()
);

export const createGoalFailure = createAction(
  '[Goals] Create Goal Failure',
  props<{ error: any }>()
);

// Update goal
export const updateGoal = createAction(
  '[Goals] Update Goal',
  props<{ userId: string; goalId: string; goal: Partial<Goal> }>()
);

export const updateGoalSuccess = createAction(
  '[Goals] Update Goal Success',
  props<{ goal: Goal }>()
);

export const updateGoalFailure = createAction(
  '[Goals] Update Goal Failure',
  props<{ error: any }>()
);

// Delete goal
export const deleteGoal = createAction(
  '[Goals] Delete Goal',
  props<{ userId: string; goalId: string }>()
);

export const deleteGoalSuccess = createAction(
  '[Goals] Delete Goal Success',
  props<{ goalId: string }>()
);

export const deleteGoalFailure = createAction(
  '[Goals] Delete Goal Failure',
  props<{ error: any }>()
);

// Update current amount
export const updateCurrentAmount = createAction(
  '[Goals] Update Current Amount',
  props<{ userId: string; goalId: string; amount: number }>()
);

export const updateCurrentAmountSuccess = createAction(
  '[Goals] Update Current Amount Success',
  props<{ goal: Goal }>()
);

export const updateCurrentAmountFailure = createAction(
  '[Goals] Update Current Amount Failure',
  props<{ error: any }>()
);

// Clear State
export const clearGoals = createAction('[Goals] Clear Goals');