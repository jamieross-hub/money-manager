import { createFeatureSelector, createSelector } from '@ngrx/store';
import { CategoriesState } from './categories.state';
import { TransactionType } from 'src/app/util/config/enums';
import { Category } from '../../util/models/category.model';

export const selectCategoriesState = createFeatureSelector<CategoriesState>('categories');

/** Active bucket (personal or family, driven by activeContext) */
export const selectCategoriesActiveBucket = createSelector(
  selectCategoriesState,
  (state) => state[state.activeContext]
);

export const selectAllCategories = createSelector(
  selectCategoriesActiveBucket,
  (bucket): Category[] =>
    bucket.ids
      .map(id => bucket.entities[id])
      .filter((c): c is Category => !!c)
);

export const selectCategoriesLoading = createSelector(
  selectCategoriesState,
  (state) => state.loading
);

export const selectCategoriesError = createSelector(
  selectCategoriesState,
  (state) => state.error
);

export const selectCategoryById = (categoryId: string) => createSelector(
  selectCategoriesActiveBucket,
  (bucket) => bucket.entities[categoryId]
);

export const selectCategoriesByType = (type: TransactionType) => createSelector(
  selectAllCategories,
  (categories) => categories.filter(c => c.type === type)
);

export const selectIncomeCategories = createSelector(
  selectAllCategories,
  (categories) => categories.filter(c => c.type === TransactionType.INCOME)
);

export const selectExpenseCategories = createSelector(
  selectAllCategories,
  (categories) => categories.filter(c => c.type === TransactionType.EXPENSE)
);

export const selectCategoryByName = (name: string) => createSelector(
  selectAllCategories,
  (categories) => categories.find(c => c.name.toLowerCase() === name.toLowerCase())
);