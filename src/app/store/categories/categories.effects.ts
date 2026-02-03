import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, mergeMap, catchError } from 'rxjs/operators';
import { CategoryService } from '../../util/service/db/category.service';
import * as CategoriesActions from './categories.actions';

@Injectable()
export class CategoriesEffects {
  loadCategories$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CategoriesActions.loadCategories),
      mergeMap(({ userId }) =>
        this.categoryService.getCategories(userId).pipe(
          map((categories) =>
            CategoriesActions.loadCategoriesSuccess({ categories })
          ),
          catchError((error) =>
            of(CategoriesActions.loadCategoriesFailure({ error }))
          )
        )
      )
    )
  );

  createCategory$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CategoriesActions.createCategory),
      mergeMap(({ userId, name, categoryType, icon, color, group }) =>
        this.categoryService
          .createCategory(userId, name, categoryType, icon, color, group)
          .pipe(
            map(() => {
              // Reload categories to get the updated list
              return CategoriesActions.loadCategories({ userId });
            }),
            catchError((error) =>
              of(CategoriesActions.createCategoryFailure({ error }))
            )
          )
      )
    )
  );

  updateCategory$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CategoriesActions.updateCategory),
      mergeMap(
        ({ userId, categoryId, name, categoryType, icon, color, budgetData, parentCategoryId, isSubCategory, group }) =>
          this.categoryService
            .updateCategory(
              userId,
              categoryId,
              name,
              categoryType,
              icon,
              color,
              budgetData,
              parentCategoryId,
              isSubCategory,
              group
            )
            .pipe(
              map(() => {
                // Reload categories to get the updated data
                return CategoriesActions.loadCategories({ userId });
              }),
              catchError((error) =>
                of(CategoriesActions.updateCategoryFailure({ error }))
              )
            )
      )
    )
  );

  deleteCategory$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CategoriesActions.deleteCategory),
      mergeMap(({ userId, categoryId }) =>
        this.categoryService.deleteCategory(userId, categoryId).pipe(
          map(() => CategoriesActions.deleteCategorySuccess({ categoryId })),
          catchError((error) =>
            of(CategoriesActions.deleteCategoryFailure({ error }))
          )
        )
      )
    )
  );

  removeFromParentCategory$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CategoriesActions.removeFromParentCategory),
      mergeMap(({ userId, categoryId }) =>
        this.categoryService
          .removeFromParentCategory(userId, categoryId)
          .pipe(
            map(() => {
              // Reload categories to get the updated data
              return CategoriesActions.loadCategories({ userId });
            }),
            catchError((error) =>
              of(CategoriesActions.removeFromParentCategoryFailure({ error }))
            )
          )
      )
    )
  );

  constructor(
    private actions$: Actions,
    private categoryService: CategoryService
  ) { }
}
