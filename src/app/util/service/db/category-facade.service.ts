import { Injectable, InjectionToken, Inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Category } from 'src/app/util/models';
import { CategoryService } from './category.service';
import { FamilyCategoryService } from './family-category.service';
import { UserService } from './user.service';
import { TransactionType } from '../../config/enums';

export const PERSONAL_CATEGORY_SERVICE = new InjectionToken<CategoryService>('PersonalCategoryService');

@Injectable({
    providedIn: 'root'
})
export class CategoryFacadeService {
    constructor(
        @Inject(PERSONAL_CATEGORY_SERVICE) private personalService: CategoryService,
        private familyService: FamilyCategoryService,
        private userService: UserService
    ) {}

    private get activeService(): CategoryService {
        const profile = this.userService.getCurrentUserSnapshot();
        const isFamilyMode = profile?.preferences?.isFamilyMode || false;
        return isFamilyMode ? this.familyService : this.personalService;
    }

    getCategories(userId: string): Observable<Category[]> {
        return this.activeService.getCategories(userId);
    }

    pullFromFirestore(userId: string): Observable<void> {
        return this.activeService.pullFromFirestore(userId);
    }

    createCategory(userId: string, name: string, type: TransactionType, icon: string, color: string, group?: string, isSystem: boolean = false): Observable<string> {
        return this.activeService.createCategory(userId, name, type, icon, color, group, isSystem);
    }

    updateCategory(userId: string, categoryId: string, name: string, type: TransactionType, icon: string, color: string, budgetData?: any, parentCategoryId?: string | null, isSubCategory?: boolean, group?: string, isSystem?: boolean): Observable<void> {
        return this.activeService.updateCategory(userId, categoryId, name, type, icon, color, budgetData, parentCategoryId, isSubCategory, group, isSystem);
    }

    deleteCategory(userId: string, categoryId: string): Observable<void> {
        return this.activeService.deleteCategory(userId, categoryId);
    }

    getCategoryNameById(categoryId: string): string {
        return this.activeService.getCategoryNameById(categoryId);
    }

    getCachedCategories(type?: TransactionType): Category[] {
        return this.activeService.getCachedCategories(type);
    }

    removeFromParentCategory(userId: string, categoryId: string): Observable<void> {
        return this.activeService.removeFromParentCategory(userId, categoryId);
    }

    getCategoryWithSubCategories(userId: string, categoryId: string): Observable<Category | null> {
        return this.activeService.getCategoryWithSubCategories(userId, categoryId);
    }

    hasSubCategories(categoryId: string): boolean {
        return this.activeService.hasSubCategories(categoryId);
    }

    getSubCategoriesCount(categoryId: string): number {
        return this.activeService.getSubCategoriesCount(categoryId);
    }

    openParentCategorySelectorDialog(category: Category): Observable<Category | null> {
        return this.activeService.openParentCategorySelectorDialog(category);
    }

    performDelete(category: Category, userId: string): void {
        this.activeService.performDelete(category, userId);
    }
}
