import { createReducer, on } from '@ngrx/store';
import { CategoriesState, CategoriesBucket, CategoriesContext, initialState } from './categories.state';
import * as CategoriesActions from './categories.actions';
import { Category } from '../../util/models/category.model';

function ctx(state: CategoriesState, actionCtx?: CategoriesContext): CategoriesContext {
  return actionCtx ?? state.activeContext;
}

function updateBucket(
  state: CategoriesState,
  context: CategoriesContext,
  patch: Partial<CategoriesBucket>
): CategoriesState {
  return { ...state, [context]: { ...state[context], ...patch } };
}

export const categoriesReducer = createReducer(
  initialState,

  // ── Context switch ──────────────────────────────────────────────────────────
  on(CategoriesActions.setCategoriesContext, (state, { context }) => ({
    ...state,
    activeContext: context
  })),

  // ── Load Categories ─────────────────────────────────────────────────────────
  on(CategoriesActions.loadCategories, (state) => ({
    ...state,
    loading: true,
    error: null
  })),

  on(CategoriesActions.loadCategoriesSuccess, (state, { categories, context }) => {
    const target = ctx(state, context);
    const entities = categories.reduce((acc, category) => {
      if (category.id) acc[category.id] = category;
      return acc;
    }, {} as { [id: string]: Category });
    const ids = categories.map(c => c.id).filter((id): id is string => !!id);
    return updateBucket({ ...state, loading: false, error: null }, target, { entities, ids });
  }),

  on(CategoriesActions.loadCategoriesFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),

  // ── Create Category ─────────────────────────────────────────────────────────
  on(CategoriesActions.createCategory, (state) => ({
    ...state,
    loading: true,
    error: null
  })),

  on(CategoriesActions.createCategorySuccess, (state, { category, context }) => {
    if (!category.id) return state;
    const target = ctx(state, context);
    const bucket = state[target];
    return updateBucket({ ...state, loading: false, error: null }, target, {
      entities: { ...bucket.entities, [category.id]: category },
      ids: bucket.ids.includes(category.id) ? bucket.ids : [...bucket.ids, category.id]
    });
  }),

  on(CategoriesActions.createCategoryFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),

  // ── Update Category ─────────────────────────────────────────────────────────
  on(CategoriesActions.updateCategory, (state) => ({
    ...state,
    loading: true,
    error: null
  })),

  on(CategoriesActions.updateCategorySuccess, (state, { category, context }) => {
    if (!category.id) return state;
    const target = ctx(state, context);
    const bucket = state[target];
    return updateBucket({ ...state, loading: false, error: null }, target, {
      entities: {
        ...bucket.entities,
        [category.id]: { ...bucket.entities[category.id], ...category }
      }
    });
  }),

  on(CategoriesActions.updateCategoryFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),

  // ── Delete Category ─────────────────────────────────────────────────────────
  on(CategoriesActions.deleteCategory, (state) => ({
    ...state,
    loading: true,
    error: null
  })),

  on(CategoriesActions.deleteCategorySuccess, (state, { categoryId, context }) => {
    const target = ctx(state, context);
    const bucket = state[target];
    const { [categoryId]: _removed, ...remainingEntities } = bucket.entities;
    return updateBucket({ ...state, loading: false, error: null }, target, {
      entities: remainingEntities,
      ids: bucket.ids.filter(id => id !== categoryId)
    });
  }),

  on(CategoriesActions.deleteCategoryFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),

  // ── Remove from Parent Category ─────────────────────────────────────────────
  on(CategoriesActions.removeFromParentCategory, (state) => ({
    ...state,
    loading: true,
    error: null
  })),

  on(CategoriesActions.removeFromParentCategorySuccess, (state, { categoryId }) => {
    const bucket = state[state.activeContext];
    const category = bucket.entities[categoryId];
    if (!category) return state;
    return updateBucket({ ...state, loading: false, error: null }, state.activeContext, {
      entities: {
        ...bucket.entities,
        [categoryId]: { ...category, parentCategoryId: undefined, isSubCategory: false }
      }
    });
  }),

  on(CategoriesActions.removeFromParentCategoryFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),

  // ── Clear State ─────────────────────────────────────────────────────────────
  // Only clears the active bucket — the other context's data is preserved
  on(CategoriesActions.clearCategories, (state) =>
    updateBucket({ ...state }, state.activeContext, { entities: {}, ids: [] })
  )
);