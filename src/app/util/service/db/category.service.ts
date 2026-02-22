import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, doc, updateDoc, deleteDoc, collectionData, getDocs, getDoc, deleteField, setDoc, onSnapshot } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable } from 'rxjs';
import { Category } from 'src/app/util/models';
import { TransactionType } from '../../config/enums';
import { AppState } from 'src/app/store/app.state';
import { Store } from '@ngrx/store';
import * as CategoriesActions from 'src/app/store/categories/categories.actions';
import * as CategoriesSelectors from 'src/app/store/categories/categories.selectors';
import { MatDialog } from '@angular/material/dialog';
import { ParentCategorySelectorDialogComponent, ParentCategorySelectorData } from 'src/app/component/dashboard/category/parent-category-selector-dialog/parent-category-selector-dialog.component';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { NotificationService } from '../notification.service';
import { HapticFeedbackService } from '../haptic-feedback.service';
import { LocalIndexDBStorageService } from '../indexdb-storage.service';
import { UserService } from './user.service';
import { LocalStorageKeyHelper } from '../../models/local-storage.model';
import { of, map, from, catchError, tap } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class CategoryService {
    private categories: { [key: string]: Category } = {};
    constructor(
        private firestore: Firestore,
        private store: Store<AppState>,
        private dialog: MatDialog,
        private notificationService: NotificationService,
        private hapticFeedback: HapticFeedbackService,
        private localStorageUtility: LocalIndexDBStorageService,
        private userService: UserService
    ) {
        this.store.select(CategoriesSelectors.selectAllCategories).subscribe(categories => {
            categories.forEach((category: Category) => {
                if (category.id) {
                    this.categories[category.id] = category;
                }
            });
        });
    }

    private isGuest(): boolean {
        return this.userService.getCurrentUserId() === 'offline-guest';
    }

    private getUserCategoriesCollection(userId: string) {
        return collection(this.firestore, `users/${userId}/categories`);
    }

    /** Get all categories (Local-Only) */
    getCategories(userId: string): Observable<Category[]> {
        if (this.isGuest()) {
            return of(this.localStorageUtility.getEntities<Category>('categories'));
        }

        return new Observable<Category[]>(observer => {
            try {
                const cachedCategories = this.localStorageUtility.getItem<Category[]>(LocalStorageKeyHelper.getCategoriesCacheKey(userId));
                if (cachedCategories) {
                    observer.next(cachedCategories);
                } else {
                    observer.next([]);
                }
            } catch (error) {
                console.warn('[CategoryService] Failed to load cached categories:', error);
                observer.next([]);
            }
            observer.complete();
        });
    }

    /** Pull categories from Firestore once and update local cache */
    pullFromFirestore(userId: string): Observable<void> {
        if (this.isGuest()) return of(undefined);

        const categoriesRef = this.getUserCategoriesCollection(userId);

        console.log(`[CategoryService] Pulling categories for user: ${userId}`);

        return from(getDocs(categoriesRef)).pipe(
            tap(querySnapshot => {
                const categories: Category[] = [];
                querySnapshot.forEach(docSnap => {
                    const data: any = docSnap.data();
                    const category: Category = {
                        id: docSnap.id,
                        name: data?.name,
                        type: data?.type,
                        icon: data?.icon || 'category',
                        color: data?.color || '#46777f',
                        createdAt: data?.createdAt,
                        budget: data?.budget || null,
                        parentCategoryId: data?.parentCategoryId || null,
                        isSubCategory: data?.isSubCategory || false,
                        subCategories: data?.subCategories || [],
                        group: data?.group,
                        isSystem: data?.isSystem || false
                    };
                    categories.push(category);
                });

                console.log(`[CategoryService] Pulled ${categories.length} categories from Firestore`);

                // Update cache
                this.localStorageUtility.setItem(LocalStorageKeyHelper.getCategoriesCacheKey(userId), categories);
                
                // Update NgRx state
                this.store.dispatch(CategoriesActions.loadCategoriesSuccess({ categories }));
            }),
            map(() => undefined),
            catchError(error => {
                console.error('[CategoryService] Pull failed:', error);
                return of(undefined);
            })
        );
    }

    createCategory(userId: string, name: string, type: TransactionType, icon: string, color: string, group?: string, isSystem: boolean = false): Observable<string> {
        const categoryId = this.generateCategoryId();
        const categoryData: Category = {
            id: categoryId,
            name,
            type,
            icon,
            color,
            group: group || undefined,
            isSystem,
            createdAt: Date.now() as any
        };

        if (this.isGuest()) {
            this.localStorageUtility.saveEntity('categories', categoryData, 'id');
            // Update store immediately
            this.store.dispatch(CategoriesActions.createCategorySuccess({
                category: categoryData
            }));
            return of(categoryId);
        }

        return new Observable<string>(observer => {
            const categoryRef = doc(this.firestore, `users/${userId}/categories/${categoryId}`);
            
            // 1. Dispatch store updates immediately (Optimistic)
            this.store.dispatch(CategoriesActions.createCategorySuccess({
                category: categoryData
            }));

            // 2. Update cache immediately
            this.updateCategoryCache(userId, 'create', categoryData);

            // 3. Complete observer immediately with the new ID
            observer.next(categoryId);
            observer.complete();

            // 4. Perform Firestore operation in background
            setDoc(categoryRef, {
                name,
                type,
                icon,
                color,
                group: group || null,
                isSystem,
                createdAt: Date.now()
            }).catch(error => {
                console.error(`Error creating category for ${userId} in Firestore:`, error);
                // In a full implementation, we might want to rollback or mark as "sync failed"
            });
        });
    }

    /** Update a category */
    updateCategory(userId: string, categoryId: string, name: string, type: TransactionType, icon: string, color: string, budgetData?: any, parentCategoryId?: string | null, isSubCategory?: boolean, group?: string, isSystem?: boolean): Observable<void> {
        const currentCategory = this.categories[categoryId];
        const updatedCategory: Category = {
            ...currentCategory,
            id: categoryId,
            name,
            type,
            icon,
            color,
            group: group !== undefined ? group : currentCategory?.group,
            budget: budgetData !== undefined ? budgetData : currentCategory?.budget,
            parentCategoryId: parentCategoryId !== undefined ? (parentCategoryId === null ? undefined : parentCategoryId) : currentCategory?.parentCategoryId,
            isSubCategory: isSubCategory !== undefined ? isSubCategory : currentCategory?.isSubCategory,
            isSystem: isSystem !== undefined ? isSystem : currentCategory?.isSystem
        };

        if (this.isGuest()) {
            const categories = this.localStorageUtility.getEntities<Category>('categories');
            const index = categories.findIndex(c => c.id === categoryId);
            if (index !== -1) {
                // Logic for parent/sub-category updates
                if (parentCategoryId !== undefined) {
                    if (parentCategoryId === null) {
                        // Removing from parent
                        if (currentCategory?.parentCategoryId) {
                            const pIndex = categories.findIndex(c => c.id === currentCategory.parentCategoryId);
                            if (pIndex !== -1) {
                                categories[pIndex].subCategories = (categories[pIndex].subCategories || []).filter(id => id !== categoryId);
                                this.store.dispatch(CategoriesActions.updateCategorySuccess({ category: categories[pIndex] }));
                            }
                        }
                    } else {
                        // Adding to new parent
                        if (currentCategory?.parentCategoryId && currentCategory.parentCategoryId !== parentCategoryId) {
                            const oldPIndex = categories.findIndex(c => c.id === currentCategory.parentCategoryId);
                            if (oldPIndex !== -1) {
                                categories[oldPIndex].subCategories = (categories[oldPIndex].subCategories || []).filter(id => id !== categoryId);
                                this.store.dispatch(CategoriesActions.updateCategorySuccess({ category: categories[oldPIndex] }));
                            }
                        }
                        const newPIndex = categories.findIndex(c => c.id === parentCategoryId);
                        if (newPIndex !== -1) {
                            const subCats = categories[newPIndex].subCategories || [];
                            if (!subCats.includes(categoryId)) {
                                categories[newPIndex].subCategories = [...subCats, categoryId];
                                this.store.dispatch(CategoriesActions.updateCategorySuccess({ category: categories[newPIndex] }));
                            }
                        }
                    }
                }

                categories[index] = updatedCategory;
                this.localStorageUtility.saveEntities('categories', categories);
                
                // Update store
                this.store.dispatch(CategoriesActions.updateCategorySuccess({ category: updatedCategory }));
            }
            return of(undefined);
        }

        return new Observable<void>(observer => {
            const categoryRef = doc(this.firestore, `users/${userId}/categories/${categoryId}`);
            
            // 1. Dispatch store updates immediately (Optimistic)
            this.store.dispatch(CategoriesActions.updateCategorySuccess({ category: updatedCategory }));

            // 2. Update cache immediately
            this.updateCategoryCache(userId, 'update', updatedCategory);

            // 3. Complete observer immediately
            observer.next();
            observer.complete();

            // 4. Perform Firestore operation in background
            const updateFirestore = async () => {
                try {
                    const updateData: any = {
                        name,
                        type,
                        icon,
                        color,
                        group: group !== undefined ? group : (currentCategory?.group || null),
                        isSystem: isSystem !== undefined ? isSystem : (currentCategory?.isSystem || false)
                    };

                    if (budgetData !== undefined) updateData.budget = budgetData;

                    if (parentCategoryId !== undefined) {
                        if (parentCategoryId === null) {
                            updateData.parentCategoryId = deleteField();
                            updateData.isSubCategory = false;

                            if (currentCategory?.parentCategoryId) {
                                const oldParentRef = doc(this.firestore, `users/${userId}/categories/${currentCategory.parentCategoryId}`);
                                const parentDoc = await getDoc(oldParentRef);
                                if (parentDoc.exists()) {
                                    const parentData = parentDoc.data() as Category;
                                    const updatedSubCategories = (parentData.subCategories || []).filter(id => id !== categoryId);
                                    await updateDoc(oldParentRef, { subCategories: updatedSubCategories });
                                    
                                    // Also update local store for the parent
                                    this.store.dispatch(CategoriesActions.updateCategorySuccess({ 
                                        category: { ...parentData, id: parentDoc.id, subCategories: updatedSubCategories } as Category 
                                    }));
                                }
                            }
                        } else {
                            updateData.parentCategoryId = parentCategoryId;
                            updateData.isSubCategory = true;

                            if (currentCategory?.parentCategoryId && currentCategory.parentCategoryId !== parentCategoryId) {
                                const oldParentRef = doc(this.firestore, `users/${userId}/categories/${currentCategory.parentCategoryId}`);
                                const parentDoc = await getDoc(oldParentRef);
                                if (parentDoc.exists()) {
                                    const parentData = parentDoc.data() as Category;
                                    const updatedSubCategories = (parentData.subCategories || []).filter(id => id !== categoryId);
                                    await updateDoc(oldParentRef, { subCategories: updatedSubCategories });
                                    this.store.dispatch(CategoriesActions.updateCategorySuccess({ 
                                        category: { ...parentData, id: parentDoc.id, subCategories: updatedSubCategories } as Category 
                                    }));
                                }
                            }

                            const newParentRef = doc(this.firestore, `users/${userId}/categories/${parentCategoryId}`);
                            const parentDoc = await getDoc(newParentRef);
                            if (parentDoc.exists()) {
                                const parentData = parentDoc.data() as Category;
                                const subCats = parentData.subCategories || [];
                                if (!subCats.includes(categoryId)) {
                                    const updatedSubCategories = [...subCats, categoryId];
                                    await updateDoc(newParentRef, { subCategories: updatedSubCategories });
                                    this.store.dispatch(CategoriesActions.updateCategorySuccess({ 
                                        category: { ...parentData, id: parentDoc.id, subCategories: updatedSubCategories } as Category 
                                    }));
                                }
                            }
                        }
                    } else if (isSubCategory !== undefined) {
                        updateData.isSubCategory = isSubCategory;
                    }

                    await updateDoc(categoryRef, updateData);
                } catch (error) {
                    console.error('Failed to update category online:', error);
                }
            };

            updateFirestore();
        });
    }

    /** Delete a category */
    deleteCategory(userId: string, categoryId: string): Observable<void> {
        const categoryData = this.categories[categoryId];

        if (this.isGuest()) {
            const categories = this.localStorageUtility.getEntities<Category>('categories');
            const index = categories.findIndex(c => c.id === categoryId);
            if (index === -1) return of(undefined);

            const cat = categories[index];

            if (cat.isSubCategory && cat.parentCategoryId) {
                // Remove from parent
                const pIndex = categories.findIndex(c => c.id === cat.parentCategoryId);
                if (pIndex !== -1) {
                    categories[pIndex].subCategories = (categories[pIndex].subCategories || []).filter(id => id !== categoryId);
                    this.store.dispatch(CategoriesActions.updateCategorySuccess({ category: categories[pIndex] }));
                }
            } else if (cat.subCategories && cat.subCategories.length > 0) {
                // Delete sub-categories
                const subIds = cat.subCategories || [];
                subIds.forEach(id => this.store.dispatch(CategoriesActions.deleteCategorySuccess({ categoryId: id })));
                const finalCategories = categories.filter(c => !subIds.includes(c.id!) && c.id !== categoryId);
                this.localStorageUtility.saveEntities('categories', finalCategories);
                this.store.dispatch(CategoriesActions.deleteCategorySuccess({ categoryId }));
                return of(undefined);
            }

            this.localStorageUtility.deleteEntity('categories', categoryId, 'id');
            this.store.dispatch(CategoriesActions.deleteCategorySuccess({ categoryId }));
            return of(undefined);
        }

        return new Observable<void>(observer => {
            // 1. Dispatch store updates immediately (Optimistic)
            if (categoryData) {
                if (categoryData.isSubCategory && categoryData.parentCategoryId) {
                    const parent = this.categories[categoryData.parentCategoryId];
                    if (parent) {
                        const updatedSubCategories = (parent.subCategories || []).filter(id => id !== categoryId);
                        this.store.dispatch(CategoriesActions.updateCategorySuccess({ 
                            category: { ...parent, subCategories: updatedSubCategories } 
                        }));
                    }
                } else if (categoryData.subCategories && categoryData.subCategories.length > 0) {
                    categoryData.subCategories.forEach(id => {
                        this.store.dispatch(CategoriesActions.deleteCategorySuccess({ categoryId: id }));
                        this.updateCategoryCache(userId, 'delete', { id } as Category);
                    });
                }
            }
            this.store.dispatch(CategoriesActions.deleteCategorySuccess({ categoryId }));

            // 2. Update cache immediately
            this.updateCategoryCache(userId, 'delete', { id: categoryId } as Category);

            // 3. Complete observer immediately
            observer.next();
            observer.complete();

            // 4. Perform Firestore operation in background
            const deleteFirestore = async () => {
                try {
                    const categoryRef = doc(this.firestore, `users/${userId}/categories/${categoryId}`);
                    // Fetch data to be sure (since background)
                    const categoryDoc = await getDoc(categoryRef);
                    if (!categoryDoc.exists()) return;
                    
                    const data = categoryDoc.data() as Category;

                    if (data.isSubCategory && data.parentCategoryId) {
                        const parentRef = doc(this.firestore, `users/${userId}/categories/${data.parentCategoryId}`);
                        const parentDoc = await getDoc(parentRef);
                        if (parentDoc.exists()) {
                            const parentData = parentDoc.data() as Category;
                            const updatedSubCategories = (parentData.subCategories || []).filter(id => id !== categoryId);
                            await updateDoc(parentRef, { subCategories: updatedSubCategories });
                        }
                        await deleteDoc(categoryRef);
                    } else if (data.subCategories && data.subCategories.length > 0) {
                        const deletePromises = data.subCategories.map(subId =>
                            deleteDoc(doc(this.firestore, `users/${userId}/categories/${subId}`))
                        );
                        await Promise.all(deletePromises);
                        await deleteDoc(categoryRef);
                    } else {
                        await deleteDoc(categoryRef);
                    }
                } catch (error) {
                    console.error('Failed to delete category online:', error);
                }
            };

            deleteFirestore();
        });
    }

    getCategoryNameById(categoryId: string): string {
        return this.categories[categoryId]?.name || '';
    }

    /** Get cached categories (synchronous) optionally filtered by type */
    public getCachedCategories(type?: TransactionType): Category[] {
        const all = Object.values(this.categories) as Category[];
        if (!type) return all;
        return all.filter(c => c.type === type);
    }

    /** Remove a category from its parent (convert to main category) */
    removeFromParentCategory(userId: string, categoryId: string): Observable<void> {
        return new Observable<void>(observer => {
            const categoryRef = doc(this.firestore, `users/${userId}/categories/${categoryId}`);

            getDoc(categoryRef).then((categoryDoc) => {
                if (categoryDoc.exists()) {
                    const currentCategory = categoryDoc.data() as Category;

                    if (currentCategory.parentCategoryId) {
                        // Remove from parent's subCategories array
                        const parentCategory = this.categories[currentCategory.parentCategoryId];
                        if (parentCategory && parentCategory.subCategories) {
                            const updatedSubCategories = parentCategory.subCategories.filter(id => id !== categoryId);
                            updateDoc(doc(this.firestore, `users/${userId}/categories/${currentCategory.parentCategoryId}`), {
                                subCategories: updatedSubCategories
                            }).then(() => {
                                // Update the category to remove parent reference
                                updateDoc(categoryRef, {
                                    parentCategoryId: deleteField(),
                                    isSubCategory: false
                                }).then(() => {
                                    observer.next();
                                    observer.complete();
                                }).catch(error => {
                                    observer.error(error);
                                });
                            }).catch(error => {
                                observer.error(error);
                            });
                        } else {
                            // Parent category not found, just update the category
                            updateDoc(categoryRef, {
                                parentCategoryId: deleteField(),
                                isSubCategory: false
                            }).then(() => {
                                observer.next();
                                observer.complete();
                            }).catch(error => {
                                observer.error(error);
                            });
                        }
                    } else {
                        // Category is already a main category
                        observer.next();
                        observer.complete();
                    }
                } else {
                    observer.error(new Error('Category not found'));
                }
            }).catch(error => {
                observer.error(error);
            });
        });
    }

    getCategoryWithSubCategories(userId: string, categoryId: string): Observable<Category | null> {
        return new Observable<Category | null>(observer => {
            this.getCategories(userId).subscribe(categories => {
                observer.next(categories.find(cat => cat.id === categoryId) || null);
                observer.complete();
            }, error => {
                observer.error(error);
            });
        });
    }

    hasSubCategories(categoryId: string): boolean {
        const category = this.categories[categoryId];
        return (category?.subCategories && category.subCategories.length > 0) || false;
    }

    /** Get sub-categories count for a category */
    getSubCategoriesCount(categoryId: string): number {
        const category = this.categories[categoryId];
        return category?.subCategories?.length || 0;
    }

    /**
     * Open parent category selector dialog
     */
    openParentCategorySelectorDialog(category: Category): Observable<Category | null> {
        return new Observable<Category | null>(observer => {
            try {
                // Get all categories from the current state
                const allCategories = Object.values(this.categories);
                const availableParentCategories = allCategories.filter(cat =>
                    cat.id !== category.id &&
                    !cat.isSubCategory &&
                    !cat.parentCategoryId
                );

                const dialogRef = this.dialog.open(ParentCategorySelectorDialogComponent, {
                    width: '500px',
                    maxWidth: '90vw',
                    data: {
                        title: 'Select Parent Category',
                        message: `Select a parent category for "${category.name}"`,
                        categories: availableParentCategories
                    } as ParentCategorySelectorData,
                    disableClose: false
                });

                dialogRef.afterClosed().subscribe(result => {
                    observer.next(result);
                    observer.complete();
                });
            } catch (error) {
                console.error('Error opening parent category selector dialog:', error);
                observer.error(error);
            }
        });
    }

    /**
     * Generate a unique category ID
     */
    private generateCategoryId(): string {
        return 'cat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Update category cache when categories are created, updated, or deleted
     */
    private updateCategoryCache(userId: string, operation: 'create' | 'update' | 'delete', category?: Category): void {
        try {
            const cacheKey = LocalStorageKeyHelper.getCategoriesCacheKey(userId);
            const cachedCategories = this.localStorageUtility.getItem<Category[]>(cacheKey) || [];

            switch (operation) {
                case 'create':
                    if (category) {
                        cachedCategories.push(category);
                    }
                    break;
                case 'update':
                    if (category) {
                        const index = cachedCategories.findIndex(c => c.id === category.id);
                        if (index !== -1) {
                            cachedCategories[index] = { ...cachedCategories[index], ...category };
                        }
                    }
                    break;
                case 'delete':
                    if (category) {
                        const index = cachedCategories.findIndex(c => c.id === category.id);
                        if (index !== -1) {
                            cachedCategories.splice(index, 1);
                        }
                    }
                    break;
            }

            this.localStorageUtility.setItem(cacheKey, cachedCategories);
        } catch (error) {
            console.error('Error updating category cache:', error);
        }
    }

    public performDelete(category: Category, userId: string): void {
        const dialogRef = this.dialog.open(ConfirmDialogComponent, {
            width: '400px',
            data: {
                title: 'Delete Category',
                message: `Are you sure you want to delete "${category.name}"? This action cannot be undone.`,
                confirmText: 'Delete',
                cancelText: 'Cancel',
                confirmColor: 'warn'
            }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                if (!category.id) {
                    this.notificationService.error('Category ID not found');
                    return;
                }

                this.store.dispatch(CategoriesActions.deleteCategory({
                    userId: userId,
                    categoryId: category.id
                }));

                this.notificationService.success('Category deleted successfully');
                this.hapticFeedback.successVibration();
            }
        });
    }
}
