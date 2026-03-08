import { Injectable, InjectionToken, Inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Category } from 'src/app/util/models';
import { CategoryService } from './category.service';
import { TransactionType } from '../../config/enums';

export const PERSONAL_CATEGORY_SERVICE = new InjectionToken<CategoryService>('PersonalCategoryService');

@Injectable({
    providedIn: 'root'
})
export class CategoryFacadeService {
    constructor(
        @Inject(PERSONAL_CATEGORY_SERVICE) private categoryService: CategoryService
    ) {}

    getCategories(userId: string): Observable<Category[]> {
        return this.categoryService.getCategories(userId);
    }

    pullFromFirestore(userId: string): Observable<void> {
        return this.categoryService.pullFromFirestore(userId);
    }

    findOrCreateSystemCategory(
        userId: string,
        categoryName: string,
        type: TransactionType,
        icon: string,
        color: string
    ): Observable<string> {
        return this.categoryService.findOrCreateSystemCategory(userId, categoryName, type, icon, color);
    }

    createCategory(userId: string, name: string, type: TransactionType, icon: string, color: string, group?: string, isSystem: boolean = false): Observable<string> {
        return this.categoryService.createCategory(userId, name, type, icon, color, group, isSystem);
    }

    updateCategory(userId: string, categoryId: string, name: string, type: TransactionType, icon: string, color: string, budgetData?: any, parentCategoryId?: string | null, isSubCategory?: boolean, group?: string, isSystem?: boolean): Observable<void> {
        return this.categoryService.updateCategory(userId, categoryId, name, type, icon, color, budgetData, parentCategoryId, isSubCategory, group, isSystem);
    }

    deleteCategory(userId: string, categoryId: string): Observable<void> {
        return this.categoryService.deleteCategory(userId, categoryId);
    }

    getCategoryNameById(categoryId: string): string {
        return this.categoryService.getCategoryNameById(categoryId);
    }

    getCachedCategories(type?: TransactionType): Category[] {
        return this.categoryService.getCachedCategories(type);
    }

    removeFromParentCategory(userId: string, categoryId: string): Observable<void> {
        return this.categoryService.removeFromParentCategory(userId, categoryId);
    }

    getCategoryWithSubCategories(userId: string, categoryId: string): Observable<Category | null> {
        return this.categoryService.getCategoryWithSubCategories(userId, categoryId);
    }

    hasSubCategories(categoryId: string): boolean {
        return this.categoryService.hasSubCategories(categoryId);
    }

    getSubCategoriesCount(categoryId: string): number {
        return this.categoryService.getSubCategoriesCount(categoryId);
    }

    openParentCategorySelectorDialog(category: Category): Observable<Category | null> {
        return this.categoryService.openParentCategorySelectorDialog(category);
    }

    performDelete(category: Category, userId: string): void {
        this.categoryService.performDelete(category, userId);
    }
}
