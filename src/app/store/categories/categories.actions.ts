import { createAction, props } from '@ngrx/store';
import { Budget, Category } from '../../util/models';
import { TransactionType } from 'src/app/util/config/enums';

// Load Categories
export const loadCategories = createAction(
  '[Categories] Load Categories',
  props<{ userId: string }>()
);

export const loadCategoriesSuccess = createAction(
  '[Categories] Load Categories Success',
  props<{ categories: Category[] }>()
);

export const loadCategoriesFailure = createAction(
  '[Categories] Load Categories Failure',
  props<{ error: any }>()
);

// Create Category
export const createCategory = createAction(
  '[Categories] Create Category',
  props<{
    userId: string;
    name: string;
    categoryType: TransactionType;
    icon: string;
    color: string;
    group?: string;
  }>()
);

export const createCategorySuccess = createAction(
  '[Categories] Create Category Success',
  props<{ category: Category }>()
);

export const createCategoryFailure = createAction(
  '[Categories] Create Category Failure',
  props<{ error: any }>()
);

// Update Category
export const updateCategory = createAction(
  '[Categories] Update Category',
  props<{
    userId: string;
    categoryId: string;
    name: string;
    categoryType: TransactionType;
    icon: string;
    color: string;
    budgetData?: Budget;
    parentCategoryId?: string | null;
    isSubCategory?: boolean;
    group?: string;
  }>()
);

export const updateCategorySuccess = createAction(
  '[Categories] Update Category Success',
  props<{ category: Category }>()
);

export const updateCategoryFailure = createAction(
  '[Categories] Update Category Failure',
  props<{ error: any }>()
);

// Delete Category
export const deleteCategory = createAction(
  '[Categories] Delete Category',
  props<{ userId: string; categoryId: string }>()
);

export const deleteCategorySuccess = createAction(
  '[Categories] Delete Category Success',
  props<{ categoryId: string }>()
);

export const deleteCategoryFailure = createAction(
  '[Categories] Delete Category Failure',
  props<{ error: any }>()
);



// Remove from Parent Category
export const removeFromParentCategory = createAction(
  '[Categories] Remove From Parent Category',
  props<{ userId: string; categoryId: string }>()
);

export const removeFromParentCategorySuccess = createAction(
  '[Categories] Remove From Parent Category Success',
  props<{ categoryId: string }>()
);

export const removeFromParentCategoryFailure = createAction(
  '[Categories] Remove From Parent Category Failure',
  props<{ error: any }>()
);

// Clear State
export const clearCategories = createAction('[Categories] Clear Categories'); 