import { createReducer, on } from '@ngrx/store';
import { GoalsState, initialState } from './goals.state';
import * as GoalsActions from './goals.actions';

export const goalsReducer = createReducer(
  initialState,
  
  // Load goals
  on(GoalsActions.loadGoals, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  
  on(GoalsActions.loadGoalsSuccess, (state, { goals }) => ({
    ...state,
    goals,
    loading: false,
    error: null
  })),
  
  on(GoalsActions.loadGoalsFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),
  
  // Create goal
  on(GoalsActions.createGoal, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  
  on(GoalsActions.createGoalSuccess, (state, { goal }) => ({
    ...state,
    goals: [...state.goals, goal],
    loading: false,
    error: null
  })),
  
  on(GoalsActions.createGoalFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),
  
  // Update goal
  on(GoalsActions.updateGoal, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  
  on(GoalsActions.updateGoalSuccess, (state, { goal }) => ({
    ...state,
    goals: state.goals.map(g => g.goalId === goal.goalId ? goal : g),
    loading: false,
    error: null
  })),
  
  on(GoalsActions.updateGoalFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),
  
  // Delete goal
  on(GoalsActions.deleteGoal, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  
  on(GoalsActions.deleteGoalSuccess, (state, { goalId }) => ({
    ...state,
    goals: state.goals.filter(g => g.goalId !== goalId),
    loading: false,
    error: null
  })),
  
  on(GoalsActions.deleteGoalFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),
  
  // Update current amount
  on(GoalsActions.updateCurrentAmount, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  
  on(GoalsActions.updateCurrentAmountSuccess, (state, { goal }) => ({
    ...state,
    goals: state.goals.map(g => g.goalId === goal.goalId ? goal : g),
    loading: false,
    error: null
  })),
  
  on(GoalsActions.updateCurrentAmountFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),

  // Clear State
  on(GoalsActions.clearGoals, () => initialState)
); 