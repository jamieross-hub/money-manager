import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, doc, updateDoc, deleteDoc, collectionData, getDocs, getDoc, deleteField, setDoc } from '@angular/fire/firestore';
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
import { LocalStorageService } from '../local-storage.service';
import { UserService } from './user.service';
import { of, map } from 'rxjs';

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
        private localStorageUtility: LocalStorageService,
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

    /** Get all categories */
    getCategories(userId: string): Observable<Category[]> {
        if (this.isGuest()) {
            return of(this.localStorageUtility.getEntities<Category>('categories'));
        }

        const categoriesRef = this.getUserCategoriesCollection(userId); // Ensure userId is passed
        return new Observable<Category[]>(observer => {
            getDocs(categoriesRef).then(querySnapshot => {
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
                        group: data?.group
                    };
                    categories.push(category);
                });
                observer.next(categories);
                observer.complete();
            }).catch(error => {
                console.error(`Error fetching categories for ${userId}:`, error);
                observer.error(error);
            });
        });
    }

    createCategory(userId: string, name: string, type: TransactionType, icon: string, color: string, group?: string): Observable<string> {
        const categoryId = this.generateCategoryId();
        if (this.isGuest()) {
            const category: Category = {
                id: categoryId,
                name,
                type,
                icon,
                color,
                group,
                createdAt: Date.now() as any
            };
            this.localStorageUtility.saveEntity('categories', category, 'id');
            return of(categoryId);
        }

        return new Observable<string>(observer => {
            const categoryRef = doc(this.firestore, `users/${userId}/categories/${categoryId}`);
            setDoc(categoryRef, {
                name,
                type,
                icon,
                color,
                group: group || null,
                createdAt: Date.now()
            }).then(() => {
                observer.next(categoryId);
                observer.complete();
            }).catch(error => {
                console.error(`Error creating category for ${userId}:`, error);
                observer.error(error);
            });
        });
    }

    /** Update a category */
    updateCategory(userId: string, categoryId: string, name: string, type: TransactionType, icon: string, color: string, budgetData?: any, parentCategoryId?: string | null, isSubCategory?: boolean, group?: string): Observable<void> {
        if (this.isGuest()) {
            const categories = this.localStorageUtility.getEntities<Category>('categories');
            const index = categories.findIndex(c => c.id === categoryId);
            if (index !== -1) {
                const currentCategory = categories[index];
                const updatedCategory: Category = {
                    ...currentCategory,
                    name,
                    type,
                    icon,
                    color,
                    group: group !== undefined ? group : currentCategory.group,
                    budget: budgetData !== undefined ? budgetData : currentCategory.budget,
                    parentCategoryId: parentCategoryId !== undefined ? (parentCategoryId === null ? undefined : parentCategoryId) : currentCategory.parentCategoryId,
                    isSubCategory: isSubCategory !== undefined ? isSubCategory : currentCategory.isSubCategory
                };

                // Logic for parent/sub-category updates
                if (parentCategoryId !== undefined) {
                    if (parentCategoryId === null) {
                        // Removing from parent
                        if (currentCategory.parentCategoryId) {
                            const pIndex = categories.findIndex(c => c.id === currentCategory.parentCategoryId);
                            if (pIndex !== -1) {
                                categories[pIndex].subCategories = (categories[pIndex].subCategories || []).filter(id => id !== categoryId);
                            }
                        }
                    } else {
                        // Adding to new parent
                        if (currentCategory.parentCategoryId && currentCategory.parentCategoryId !== parentCategoryId) {
                            const oldPIndex = categories.findIndex(c => c.id === currentCategory.parentCategoryId);
                            if (oldPIndex !== -1) {
                                categories[oldPIndex].subCategories = (categories[oldPIndex].subCategories || []).filter(id => id !== categoryId);
                            }
                        }
                        const newPIndex = categories.findIndex(c => c.id === parentCategoryId);
                        if (newPIndex !== -1) {
                            const subCats = categories[newPIndex].subCategories || [];
                            if (!subCats.includes(categoryId)) {
                                categories[newPIndex].subCategories = [...subCats, categoryId];
                            }
                        }
                    }
                }

                categories[index] = updatedCategory;
                this.localStorageUtility.saveEntities('categories', categories);
            }
            return of(undefined);
        }

        return new Observable<void>(observer => {
            const categoryRef = doc(this.firestore, `users/${userId}/categories/${categoryId}`);

            getDoc(categoryRef).then((categoryDoc) => {
                if (categoryDoc.exists()) {
                    const currentCategory = categoryDoc.data() as Category;

                    // Prepare update data
                    const updateData: any = {
                        name,
                        type,
                        icon,
                        color
                    };

                    if (group !== undefined) {
                        updateData.group = group;
                    }

                    // Add budget data if provided
                    if (budgetData !== undefined) {
                        updateData.budget = budgetData;
                    }

                    // Handle parent category updates
                    if (parentCategoryId !== undefined) {
                        if (parentCategoryId === null) {
                            // Removing from parent
                            updateData.parentCategoryId = deleteField();
                            updateData.isSubCategory = false;

                            // Remove from old parent's subCategories array
                            if (currentCategory.parentCategoryId) {
                                const oldParentRef = doc(this.firestore, `users/${userId}/categories/${currentCategory.parentCategoryId}`);
                                getDoc(oldParentRef).then((parentDoc) => {
                                    if (parentDoc.exists()) {
                                        const parentData = parentDoc.data() as Category;
                                        const updatedSubCategories = (parentData.subCategories || []).filter(id => id !== categoryId);
                                        updateDoc(oldParentRef, { subCategories: updatedSubCategories });
                                    }
                                });
                            }
                        } else {
                            // Adding to new parent
                            updateData.parentCategoryId = parentCategoryId;
                            updateData.isSubCategory = true;

                            // Remove from old parent if exists
                            if (currentCategory.parentCategoryId && currentCategory.parentCategoryId !== parentCategoryId) {
                                const oldParentRef = doc(this.firestore, `users/${userId}/categories/${currentCategory.parentCategoryId}`);
                                getDoc(oldParentRef).then((parentDoc) => {
                                    if (parentDoc.exists()) {
                                        const parentData = parentDoc.data() as Category;
                                        const updatedSubCategories = (parentData.subCategories || []).filter(id => id !== categoryId);
                                        updateDoc(oldParentRef, { subCategories: updatedSubCategories });
                                    }
                                });
                            }

                            // Add to new parent's subCategories array
                            const newParentRef = doc(this.firestore, `users/${userId}/categories/${parentCategoryId}`);
                            getDoc(newParentRef).then((parentDoc) => {
                                if (parentDoc.exists()) {
                                    const parentData = parentDoc.data() as Category;
                                    const subCats = parentData.subCategories || [];
                                    if (!subCats.includes(categoryId)) {
                                        updateDoc(newParentRef, { subCategories: [...subCats, categoryId] });
                                    }
                                }
                            });
                        }
                    } else if (isSubCategory !== undefined) {
                        updateData.isSubCategory = isSubCategory;
                    }

                    // Update the category document
                    updateDoc(categoryRef, updateData).then(() => {
                        observer.next();
                        observer.complete();
                    }).catch(error => {
                        observer.error(error);
                    });
                } else {
                    observer.error(new Error('Category not found'));
                }
            }).catch(error => {
                observer.error(error);
            });
        });
    }

    /** Delete a category */
    deleteCategory(userId: string, categoryId: string): Observable<void> {
        if (this.isGuest()) {
            const categories = this.localStorageUtility.getEntities<Category>('categories');
            const index = categories.findIndex(c => c.id === categoryId);
            if (index === -1) return of(undefined);

            const categoryData = categories[index];

            if (categoryData.isSubCategory && categoryData.parentCategoryId) {
                // Remove from parent
                const pIndex = categories.findIndex(c => c.id === categoryData.parentCategoryId);
                if (pIndex !== -1) {
                    categories[pIndex].subCategories = (categories[pIndex].subCategories || []).filter(id => id !== categoryId);
                }
            } else if (categoryData.subCategories && categoryData.subCategories.length > 0) {
                // Delete sub-categories
                const subIds = categoryData.subCategories || [];
                const finalCategories = categories.filter(c => !subIds.includes(c.id!) && c.id !== categoryId);
                this.localStorageUtility.saveEntities('categories', finalCategories);
                return of(undefined);
            }

            this.localStorageUtility.deleteEntity('categories', categoryId, 'id');
            return of(undefined);
        }

        return new Observable<void>(observer => {
            const categoryRef = doc(this.firestore, `users/${userId}/categories/${categoryId}`);

            // First, get the category to check if it's a sub-category
            getDoc(categoryRef).then((categoryDoc) => {
                if (categoryDoc.exists()) {
                    const categoryData = categoryDoc.data() as Category;

                    // If it's a sub-category, remove its ID from parent's subCategories array
                    if (categoryData.isSubCategory && categoryData.parentCategoryId) {
                        const parentCategory = this.categories[categoryData.parentCategoryId];
                        if (parentCategory && parentCategory.subCategories) {
                            const updatedSubCategories = parentCategory.subCategories.filter(id => id !== categoryId);
                            updateDoc(doc(this.firestore, `users/${userId}/categories/${categoryData.parentCategoryId}`), {
                                subCategories: updatedSubCategories
                            }).then(() => {
                                // Now delete the sub-category
                                deleteDoc(categoryRef).then(() => {
                                    observer.next();
                                    observer.complete();
                                }).catch(error => {
                                    observer.error(error);
                                });
                            }).catch(error => {
                                observer.error(error);
                            });
                        } else {
                            // Parent category not found or no subCategories array, just delete the category
                            deleteDoc(categoryRef).then(() => {
                                observer.next();
                                observer.complete();
                            }).catch(error => {
                                observer.error(error);
                            });
                        }
                    } else {
                        // It's a main category, check if it has sub-categories and delete them first
                        if (categoryData.subCategories && categoryData.subCategories.length > 0) {
                            // Delete all sub-categories first
                            const deletePromises = categoryData.subCategories.map(subCategoryId =>
                                deleteDoc(doc(this.firestore, `users/${userId}/categories/${subCategoryId}`))
                            );

                            Promise.all(deletePromises).then(() => {
                                // Now delete the main category
                                deleteDoc(categoryRef).then(() => {
                                    observer.next();
                                    observer.complete();
                                }).catch(error => {
                                    observer.error(error);
                                });
                            }).catch(error => {
                                observer.error(error);
                            });
                        } else {
                            // No sub-categories, just delete the category
                            deleteDoc(categoryRef).then(() => {
                                observer.next();
                                observer.complete();
                            }).catch(error => {
                                observer.error(error);
                            });
                        }
                    }
                } else {
                    // Category doesn't exist, just complete
                    observer.next();
                    observer.complete();
                }
            }).catch(error => {
                observer.error(error);
            });
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
