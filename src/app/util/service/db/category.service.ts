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
        private hapticFeedback: HapticFeedbackService
    ) { 

        this.store.select(CategoriesSelectors.selectAllCategories).subscribe(categories => {
            categories.forEach((category: Category) => {
                if (category.id) {
                    this.categories[category.id] = category;
                }
            });
        });
    }

    private getUserCategoriesCollection(userId: string) {
        return collection(this.firestore, `users/${userId}/categories`);
    }

    /** Get all categories */
    getCategories(userId: string): Observable<Category[]> {
        const categoriesRef = this.getUserCategoriesCollection(userId); // Ensure userId is passed
        return new Observable<Category[]>(observer => {
            getDocs(categoriesRef).then(querySnapshot => {
                const categories: Category[] = [];
                querySnapshot.forEach(doc => {
                    const data:any = doc.data();
                    // Handle existing categories that might not have icon or color field
                    const category: Category = {
                        id: doc.id,
                        name: data?.name,
                        type: data?.type,
                        icon: data?.icon || 'category',
                        color: data?.color || '#46777f', // Default blue color
                        createdAt: data?.createdAt,
                        budget: data?.budget || null,
                        parentCategoryId: data?.parentCategoryId || null,
                        isSubCategory: data?.isSubCategory || false,
                        subCategories: data?.subCategories || [],
                    };
                    categories.push(category);
                });
                observer.next(categories);
                observer.complete(); // Complete the observable to prevent memory leaks
            }).catch(error => {
                observer.error(error);
            });
        });
    }

    createCategory(userId: string, name: string, type: TransactionType, icon: string, color: string): Observable<string> {
        return new Observable<string>(observer => {
            const categoryId = this.generateCategoryId();
            const categoryRef = doc(this.firestore, `users/${userId}/categories/${categoryId}`);
            
            setDoc(categoryRef, {
                name,
                type,
                icon,
                color,
                createdAt: Date.now()
            }).then(() => {
                observer.next(categoryId);
                observer.complete();
            }).catch(error => {
                observer.error(error);
            });
        });
    }

    /** Update a category */
    updateCategory(userId: string, categoryId: string, name: string, type: TransactionType, icon: string, color: string, budgetData?: any, parentCategoryId?: string | null, isSubCategory?: boolean): Observable<void> {
        return new Observable<void>(observer => {
            const categoryRef = doc(this.firestore, `users/${userId}/categories/${categoryId}`);
            
            // First, get the current category data to handle subCategories array updates
            getDoc(categoryRef).then((categoryDoc) => {
                if (categoryDoc.exists()) {
                    const currentCategory = categoryDoc.data() as Category;
                    const updateData: Omit<Category, 'createdAt'> = { name, type, icon, color };
                    
                    // Add budget data if provided
                    if (budgetData) {
                        updateData.budget = budgetData;
                    }
                    
                    // Handle parent category changes
                    if (parentCategoryId !== undefined) {
                        if (parentCategoryId === null || parentCategoryId === undefined) {
                            // Removing from parent category
                            if (currentCategory.parentCategoryId) {
                                // Remove from old parent's subCategories array
                                const oldParentCategory = this.categories[currentCategory.parentCategoryId];
                                if (oldParentCategory && oldParentCategory.subCategories) {
                                    const updatedSubCategories = oldParentCategory.subCategories.filter(id => id !== categoryId);
                                    updateDoc(doc(this.firestore, `users/${userId}/categories/${currentCategory.parentCategoryId}`), {
                                        subCategories: updatedSubCategories
                                    });
                                }
                            }
                            // Remove the field from Firestore
                            (updateData as any).parentCategoryId = deleteField();
                        } else {
                            // Adding to a new parent category
                            if (currentCategory.parentCategoryId && currentCategory.parentCategoryId !== parentCategoryId) {
                                // Remove from old parent's subCategories array
                                const oldParentCategory = this.categories[currentCategory.parentCategoryId];
                                if (oldParentCategory && oldParentCategory.subCategories) {
                                    const updatedSubCategories = oldParentCategory.subCategories.filter(id => id !== categoryId);
                                    updateDoc(doc(this.firestore, `users/${userId}/categories/${currentCategory.parentCategoryId}`), {
                                        subCategories: updatedSubCategories
                                    });
                                }
                            }
                            
                            // Add to new parent's subCategories array
                            const newParentCategory = this.categories[parentCategoryId];
                            if (newParentCategory) {
                                const updatedSubCategories = [...(newParentCategory.subCategories || []), categoryId];
                                updateDoc(doc(this.firestore, `users/${userId}/categories/${parentCategoryId}`), {
                                    subCategories: updatedSubCategories
                                });
                            }
                            
                            updateData.parentCategoryId = parentCategoryId;
                        }
                    }
                    
                    if (isSubCategory !== undefined) {
                        updateData.isSubCategory = isSubCategory;
                    }
                    
                    // Update the category
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

    getCategoryNameById(categoryId: string):string {
        return this.categories[categoryId]?.name || '';
    }

    /** Get cached categories (synchronous) optionally filtered by type */
    public getCachedCategories(type?: TransactionType) : Category[] {
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
