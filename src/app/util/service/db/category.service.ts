import { Injectable, OnDestroy } from '@angular/core';
import { Firestore, collection, addDoc, doc, updateDoc, deleteDoc, collectionData, getDocs, getDoc, deleteField, setDoc, onSnapshot, query, orderBy, Timestamp } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, Subject, takeUntil, BehaviorSubject } from 'rxjs';
import { Category } from 'src/app/util/models';
import { TransactionType, SyncStatus } from '../../config/enums';
import { AppState } from 'src/app/store/app.state';
import { Store } from '@ngrx/store';
import * as CategoriesActions from 'src/app/store/categories/categories.actions';
import * as CategoriesSelectors from 'src/app/store/categories/categories.selectors';
import * as ProfileSelectors from 'src/app/store/profile/profile.selectors';
import { MatDialog } from '@angular/material/dialog';
import { ParentCategorySelectorDialogComponent, ParentCategorySelectorData } from 'src/app/component/dashboard/category/parent-category-selector-dialog/parent-category-selector-dialog.component';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { NotificationService } from '../notification.service';
import { CommonSyncService, SyncItem } from '../common-sync.service';
import { LocalIndexDBStorageService } from '../indexdb-storage.service';
import { UserService } from './user.service';
import { FamilyService } from 'src/app/modules/family/services/family.service';
import { LocalStorageKeyHelper } from '../../models/local-storage.model';
import { of, map, from, catchError, tap, timeout, switchMap, distinctUntilChanged, take } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class CategoryService implements OnDestroy {
    private readonly destroy$ = new Subject<void>();
    private categories: { [key: string]: Category } = {};
    private categoriesSubject = new BehaviorSubject<Category[]>([]);
    private activeListenerPath: string | null = null;

    constructor(
        private firestore: Firestore,
        private auth: Auth,
        private store: Store<AppState>,
        private dialog: MatDialog,
        private notificationService: NotificationService,
        private localStorageUtility: LocalIndexDBStorageService,
        protected userService: UserService,
        private commonSyncService: CommonSyncService,
        private familyService: FamilyService
    ) {
        this.store.select(CategoriesSelectors.selectAllCategories)
            .pipe(takeUntil(this.destroy$))
            .subscribe(categories => {
            this.categories = {}; // Clear map to avoid accumulating stale entries from previous modes/contexts
            categories.forEach((category: Category) => {
                if (category.id) {
                    this.categories[category.id] = category;
                }
            });
        });
    }

    /**
     * Get the categories collection path
     */
    protected getCategoriesPath(userId: string, familyId?: string): string {
        const fid = familyId || this.getFamilyId();
        if (fid) {
            return `family-groups/${fid}/categories`;
        }
        return `users/${userId}/categories`;
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    /**
     * Get a specific category document path
     */
    protected getCategoryPath(userId: string, categoryId: string): string {
        return `${this.getCategoriesPath(userId)}/${categoryId}`;
    }

    private isGuest(): boolean {
        return this.userService.getCurrentUserId() === 'offline-guest';
    }

    /**
     * Get the family ID for cache key
     */
    protected getFamilyId(): string | undefined {
        const profile = this.store.selectSignal(ProfileSelectors.selectProfile)();
        const isFamilyMode = profile?.preferences?.isFamilyMode || false;
        return isFamilyMode ? (this.familyService.activeFamilyId() || undefined) : undefined;
    }

    /** Returns which NgRx bucket should receive incoming data */
    protected getActiveContext(): 'personal' | 'family' {
        return this.getFamilyId() ? 'family' : 'personal';
    }

    private getUserCategoriesCollection(userId: string, familyId?: string) {
        return collection(this.firestore, this.getCategoriesPath(userId, familyId));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Individual-item store helpers
    // key = categoryId (personal) | familyId_categoryId (family)
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Build the store key for a category
     */
    private getCategoryStoreKey(categoryId: string, familyId?: string): string {
        return LocalStorageKeyHelper.getCategoryItemKey(categoryId, familyId ?? this.getFamilyId());
    }

    /**
     * Read all categories for the current context from the individual-item cache.
     * • Family mode  → categories whose familyId matches
     * • Personal mode → categories that belong to userId without a familyId field
     */
    private readCategoriesFromStore(userId: string): Category[] {
        const familyId = this.getFamilyId();
        if (familyId) {
            return this.localStorageUtility.getCategoriesByFamilyIdSync(familyId) as Category[];
        }
        const categories = this.localStorageUtility.getPersonalCategoriesSync(userId) as Category[];

        // Proactive migration: Ensure personal categories have userId field for future indexing
        const itemsToMigrate = categories
            .filter(c => !c.userId && c.id)
            .map(c => {
                c.userId = userId;
                return {
                    key: LocalStorageKeyHelper.getCategoryItemKey(c.id!, undefined),
                    value: c
                };
            });
            
        if (itemsToMigrate.length > 0) {
            this.localStorageUtility.setCategories(itemsToMigrate);
        }

        return categories;
    }

    /**
     * Persist an array of categories into the individual-item store.
     */
    private writeCategoriesToStore(categories: Category[], familyId?: string): void {
        const fid = familyId ?? this.getFamilyId();
        const items = categories
            .filter(category => category?.id)
            .map(category => ({
                key: LocalStorageKeyHelper.getCategoryItemKey(category.id!, fid),
                value: fid ? { ...category, familyId: fid } : category
            }));
            
        if (items.length > 0) {
            this.localStorageUtility.setCategories(items);
        }
    }

    /**
     * Replace the entire set of categories for the current context with a fresh list.
     * Removes stale keys that are no longer in the new list.
     */
    private replaceCategoriesInStore(categories: Category[]): void {
        const familyId = this.getFamilyId();
        const newIds = new Set(categories.map(c => c.id));

        // Remove stale entries
        const existing = familyId
            ? this.localStorageUtility.getCategoriesByFamilyIdSync(familyId) as Category[]
            : this.localStorageUtility.getPersonalCategoriesSync(this.userService.getCurrentUserId() || '') as Category[];

        existing.forEach(cat => {
            if (cat?.id && !newIds.has(cat.id)) {
                const staleKey = LocalStorageKeyHelper.getCategoryItemKey(cat.id, familyId);
                this.localStorageUtility.removeCategory(staleKey);
            }
        });

        // Upsert all new categories
        this.writeCategoriesToStore(categories, familyId);
    }

    /** 
     * Get all categories with real-time sync.
     * Reacts automatically to changes in the user's family mode preference.
     */
    getCategories(userId: string): Observable<Category[]> {
        if (this.isGuest()) {
            const categories = this.localStorageUtility.getEntities<Category>('categories');
            this.categoriesSubject.next(categories);
            return of(categories);
        }

        /**
         * ⚠️ ARCHITECTURE ALIGNMENT: Source of Truth = IndexedDB (individual-item store)
         *
         * Components subscribe to categoriesSubject which is updated by the
         * central background sync listener.
         */
        return this.localStorageUtility.isReady$.pipe(
            switchMap(() => {
                // 1. Emit cached categories immediately from the individual-item store
                const cachedCategories = this.readCategoriesFromStore(userId);
                
                console.log(`[CategoryService] 💨 Emitting ${cachedCategories.length} cached categories in getCategories`);
                this.categoriesSubject.next(cachedCategories);


                // 2. Return reactive subject
                return this.categoriesSubject.asObservable();
            })
        );
    }

    /**
     * Set up a real-time listener for categories
     * Managed by CommonSyncService
     */
    listenToCategories(userId: string): Observable<void> {
        if (this.isGuest()) return of(undefined);

        const currentPath = this.getCategoriesPath(userId);
        if (this.activeListenerPath === currentPath) {
            console.log(`[CategoryService] 🛡️ Listener already active for path: ${currentPath}`);
            return of(undefined);
        }
        this.activeListenerPath = currentPath;

        return new Observable<void>(observer => {
            // 0. Emit cached categories immediately from the individual-item store
            // This ensures the UI feels instant when switching contexts (Personal <-> Family)
            const cachedCategories = this.readCategoriesFromStore(userId);
            
            console.log(`[CategoryService] 💨 Emitting ${cachedCategories.length} cached categories before listener starts`);
            this.categoriesSubject.next(cachedCategories);
            this.store.dispatch(CategoriesActions.loadCategoriesSuccess({
                categories: cachedCategories,
                context: this.getActiveContext()
            }));


            const currentPath = this.getCategoriesPath(userId);
            
            console.log(`[CategoryService] 🔌 Starting real-time listener for path: ${currentPath}`);

            const categoriesRef = query(
                collection(this.firestore, currentPath),
                orderBy('name', 'asc')
            );

            let isFirstSnapshot = true;

            const unsubscribe = onSnapshot(categoriesRef,
                (querySnapshot) => {
                    if (isFirstSnapshot) {
                        isFirstSnapshot = false;

                        const firestoreCategories: Category[] = [];
                         querySnapshot.forEach((docSnap) => {
                             const data: any = docSnap.data();
                             const currentFamilyId = this.getFamilyId();

                             if (currentFamilyId && !data?.familyId) {
                                 data.familyId = currentFamilyId;
                             }

                             if (data && docSnap.id && data.name) {
                                 const category: Category = {
                                    id: docSnap.id,
                                    userId: userId,
                                    ...data
                                };
                                firestoreCategories.push(category);
                            }
                        });

                        const localCategories = this.readCategoriesFromStore(userId);
                        const merged = this.mergeFirestoreAndLocal(firestoreCategories, localCategories);

                        const currentFamilyId = this.getFamilyId();
                        const filteredMerged = merged.filter(c => currentFamilyId ? !!c.familyId : !c.familyId);

                        this.replaceCategoriesInStore(filteredMerged);

                        this.categories = {};
                        filteredMerged.forEach(cat => {
                            if (cat.id) this.categories[cat.id] = cat;
                        });

                        this.categoriesSubject.next(filteredMerged);
                        this.store.dispatch(CategoriesActions.loadCategoriesSuccess({
                            categories: filteredMerged,
                            context: this.getActiveContext()
                        }));

                        observer.next();
                        return;
                    }

                    const changes = querySnapshot.docChanges();
                    if (changes.length === 0) {
                        observer.next();
                        return;
                    }

                    const current = this.categoriesSubject.getValue();
                    const catMap = new Map<string, Category>(current.map(c => [c.id!, c]));

                    changes.forEach((change) => {
                        const docSnap = change.doc;
                        if (change.type === 'removed') {
                            catMap.delete(docSnap.id);
                            const familyId = this.getFamilyId();
                            const itemKey = LocalStorageKeyHelper.getCategoryItemKey(docSnap.id, familyId);
                            this.localStorageUtility.removeCategory(itemKey);
                        } else {
                            const data = docSnap.data();
                            const currentFamilyId = this.getFamilyId();

                            if (currentFamilyId && !data?.['familyId']) {
                                data['familyId'] = currentFamilyId;
                            }

                            if (data && docSnap.id && data['name']) {
                                const cat = { id: docSnap.id, userId: userId, ...data } as Category;
                                const existing = catMap.get(cat.id!);
                                const isLocalPending = existing?.syncStatus === 'pending';
                                if (!isLocalPending) {
                                    catMap.set(cat.id!, cat);
                                    this.updateCategoryCache(userId, 'update', cat);
                                }
                            }
                        }
                    });

                    const currentFamilyId = this.getFamilyId();
                    const filtered = Array.from(catMap.values()).filter(c => currentFamilyId ? !!c.familyId : !c.familyId);
                    const updatedList = filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                    this.categories = {};
                    updatedList.forEach(c => { if (c.id) this.categories[c.id] = c; });

                    this.categoriesSubject.next(updatedList);
                    this.store.dispatch(CategoriesActions.loadCategoriesSuccess({
                        categories: updatedList,
                        context: this.getActiveContext()
                    }));

                    observer.next();
                },
                (error) => {
                    console.warn(`[CategoryService] ⚠️ Real-time listener failed for ${currentPath} (may be offline):`, error);
                    observer.complete();
                }
            );

            return () => {
                console.log(`[CategoryService] 🔌 Stopping listener for: ${currentPath}`);
                this.activeListenerPath = null; // 🔌 Reset on unsubscribe
                unsubscribe();
            };
        });
    }

    /** Pull categories from Firestore once and update local cache */
    pullFromFirestore(userId: string, familyId?: string): Observable<void> {
        if (this.isGuest()) return of(undefined);

        // Ensure we have an active auth user before attempting pull
        const currentUser = this.auth.currentUser;
        if (!currentUser || currentUser.uid !== userId) {
            console.warn(`[CategoryService] Pull skipped: Auth user mismatch or not logged in (UID: ${currentUser?.uid}, expected: ${userId})`);
            return of(undefined);
        }

        const categoriesRef = this.getUserCategoriesCollection(userId, familyId);

        console.log(`[CategoryService] Pulling categories for user: ${userId}`);

        return from(getDocs(categoriesRef)).pipe(
            timeout(15000),
            tap((querySnapshot: any) => {
                const categories: Category[] = [];
                querySnapshot.forEach((docSnap: any) => {
                    const data: any = docSnap.data();
                    
                    // If pulling for a family and missing familyId, assign it proactively
                    if (familyId && !data?.familyId) {
                         data.familyId = familyId;
                    }

                    // Require both an id and a name — consistent with listenToCategories.
                    if (data && docSnap.id && data.name) {
                        const category: Category = {
                            id: docSnap.id,
                            userId: userId,
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
                            isSystem: data?.isSystem || false,
                            familyId: data?.familyId || familyId || ''
                        };
                        categories.push(category);
                    } else if (docSnap.id) {
                        console.warn('[CategoryService] Skipping invalid/empty category document:', docSnap.id, { hasName: !!data?.name });
                    }
                });

                console.log(`[CategoryService] Pulled ${categories.length} categories from Firestore`);

                // Merge with local pending categories to protect offline writes
                const localCategories = this.readCategoriesFromStore(userId);
                const merged = this.mergeFirestoreAndLocal(categories, localCategories);
                const currentFamilyId = this.getFamilyId();
                const filteredMerged = merged.filter(c => currentFamilyId ? !!c.familyId : !c.familyId);

                // Replace individual-item store with fresh data
                this.replaceCategoriesInStore(filteredMerged);
                
                // Update internal categories map - Clear first to remove cross-context stale data
                this.categories = {};
                filteredMerged.forEach(cat => {
                    if (cat.id) this.categories[cat.id] = cat;
                });

                // Update Subject so UI reflects the fresh data immediately
                this.categoriesSubject.next(filteredMerged);

                // Update NgRx state — include context so data goes into the correct bucket
                this.store.dispatch(CategoriesActions.loadCategoriesSuccess({
                    categories: filteredMerged,
                    context: this.getActiveContext()
                }));
            }),
            map(() => undefined),
            catchError(error => {
                if (error.code === 'permission-denied') {
                    console.error(`[CategoryService] Permission Denied for user ${userId}. Check Firestore rules.`);
                } else {
                    console.error('[CategoryService] Pull failed:', error);
                }
                return of(undefined);
            })
        );
    }

    findOrCreateSystemCategory(
        userId: string,
        categoryName: string,
        type: TransactionType,
        icon: string,
        color: string
    ): Observable<string> {
        return this.getCategories(userId).pipe(
            take(1),
            switchMap(categories => {
                // Try to find by flag first
                let existing = categories.find(c => c.isSystem && c.type === type && c.name?.toLowerCase() === categoryName.toLowerCase());
                
                if (existing?.id) return of(existing.id);

                // Fallback: search by name and type for backward compatibility
                const legacy = categories.find(c => 
                    c.name?.toLowerCase() === categoryName.toLowerCase() && 
                    c.type === type
                );

                if (legacy) {
                    // Migrate legacy category by setting isSystem to true
                    return this.updateCategory(
                        userId, 
                        legacy.id!, 
                        legacy.name || categoryName, 
                        legacy.type!, 
                        legacy.icon || icon, 
                        legacy.color || color, 
                        legacy.budget, 
                        legacy.parentCategoryId, 
                        legacy.isSubCategory, 
                        legacy.group, 
                        undefined, // groupIcon
                        true // isSystem
                    ).pipe(
                        map(() => legacy.id!)
                    );
                }

                // Neither found, create new with deterministic ID to prevent duplicates from race conditions
                const systemId = `sys_${type}_${categoryName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
                return this.createCategory(userId, categoryName, type, icon, color, undefined, true, systemId);
            })
        );
    }

    createCategory(
        userId: string, 
        name: string, 
        type: TransactionType, 
        icon: string, 
        color: string, 
        group?: string, 
        isSystem: boolean = false,
        id?: string
    ): Observable<string> {
        const categoryId = id || this.generateCategoryId(userId);
        const categoryData: Category = {
            id: categoryId,
            userId,
            name,
            type,
            icon,
            color,
            group: group || undefined,
            isSystem,
            createdAt: Timestamp.now() as any,
            syncStatus: SyncStatus.PENDING,
            familyId: this.getFamilyId() || ''
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
            // 1. Dispatch store updates immediately (Optimistic)
            this.store.dispatch(CategoriesActions.createCategorySuccess({
                category: categoryData
            }));

            // 2. Update individual-item store immediately
            this.updateCategoryCache(userId, 'create', categoryData);

            // 3. Complete observer immediately with the new ID
            observer.next(categoryId);
            observer.complete();

            // 4. Always add to sync queue
            this.addToSyncQueue('create', categoryData, userId).catch(error => {
                console.error(`Error adding category to sync queue for ${userId}:`, error);
            });
        });
    }

    /** Update a category */
    updateCategory(userId: string, categoryId: string, name: string, type: TransactionType, icon: string, color: string, budgetData?: any, parentCategoryId?: string | null, isSubCategory?: boolean, group?: string, groupIcon?: string, isSystem?: boolean): Observable<void> {
        const currentCategory = this.categories[categoryId];
        const updatedCategory: Category = {
            ...currentCategory,
            id: categoryId,
            name,
            type,
            icon,
            color,
            group: group !== undefined ? group : currentCategory?.group,
            groupIcon: groupIcon !== undefined ? groupIcon : currentCategory?.groupIcon,
            budget: budgetData !== undefined ? budgetData : currentCategory?.budget,
            parentCategoryId: parentCategoryId !== undefined ? (parentCategoryId === null ? undefined : parentCategoryId) : currentCategory?.parentCategoryId,
            isSubCategory: isSubCategory !== undefined ? isSubCategory : currentCategory?.isSubCategory,
            isSystem: isSystem !== undefined ? isSystem : currentCategory?.isSystem,
            syncStatus: SyncStatus.PENDING
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
            // 1. Dispatch store updates immediately (Optimistic)
            this.store.dispatch(CategoriesActions.updateCategorySuccess({ category: updatedCategory }));

            // 2. Update individual-item store immediately
            this.updateCategoryCache(userId, 'update', updatedCategory);

            // 3. Complete observer immediately
            observer.next();
            observer.complete();

            // 4. Perform Sync operations in background
            const syncUpdates = async () => {
                try {
                    // 1. Sync the category itself
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
                            updateData.parentCategoryId = null; // Use null to clear in sync service
                            updateData.isSubCategory = false;

                            if (currentCategory?.parentCategoryId) {
                                // Update old parent's subCategories
                                const parent = this.categories[currentCategory.parentCategoryId];
                                if (parent) {
                                    const updatedSubCats = (parent.subCategories || []).filter(id => id !== categoryId);
                                    await this.addToSyncQueue('update', { id: parent.id, subCategories: updatedSubCats }, userId);
                                }
                            }
                        } else {
                            updateData.parentCategoryId = parentCategoryId;
                            updateData.isSubCategory = true;

                            if (currentCategory?.parentCategoryId && currentCategory.parentCategoryId !== parentCategoryId) {
                                // Update old parent
                                const oldParent = this.categories[currentCategory.parentCategoryId];
                                if (oldParent) {
                                    const updatedSubCats = (oldParent.subCategories || []).filter(id => id !== categoryId);
                                    await this.addToSyncQueue('update', { id: oldParent.id, subCategories: updatedSubCats }, userId);
                                }
                            }

                            // Update new parent
                            const newParent = this.categories[parentCategoryId];
                            if (newParent) {
                                const subCats = newParent.subCategories || [];
                                if (!subCats.includes(categoryId)) {
                                    const updatedSubCats = [...subCats, categoryId];
                                    await this.addToSyncQueue('update', { id: newParent.id, subCategories: updatedSubCats }, userId);
                                }
                            }
                        }
                    } else if (isSubCategory !== undefined) {
                        updateData.isSubCategory = isSubCategory;
                    }

                    await this.addToSyncQueue('update', { id: categoryId, ...updateData }, userId);
                } catch (error) {
                    console.error('Failed to queue category sync updates:', error);
                }
            };

            syncUpdates();
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

            // 2. Remove from individual-item store immediately
            this.updateCategoryCache(userId, 'delete', { id: categoryId } as Category);

            // 3. Complete observer immediately
            observer.next();
            observer.complete();

            // 4. Perform Sync operations in background
            const syncDelete = async () => {
                try {
                    if (categoryData) {
                        if (categoryData.isSubCategory && categoryData.parentCategoryId) {
                            const parent = this.categories[categoryData.parentCategoryId];
                            if (parent) {
                                const updatedSubCats = (parent.subCategories || []).filter(id => id !== categoryId);
                                await this.addToSyncQueue('update', { id: parent.id, subCategories: updatedSubCats }, userId);
                            }
                        } else if (categoryData.subCategories && categoryData.subCategories.length > 0) {
                            // Sub-categories will be deleted by the cloud function/backend if implemented,
                            // but here we queue explicit deletes for each.
                            for (const subId of categoryData.subCategories) {
                                await this.addToSyncQueue('delete', { id: subId }, userId);
                            }
                        }
                    }
                    await this.addToSyncQueue('delete', { id: categoryId }, userId);
                } catch (error) {
                    console.error('Failed to queue category delete sync:', error);
                }
            };

            syncDelete();
        });
    }

    getCategoryNameById(categoryId: string): string {
        return this.categories[categoryId]?.name || '';
    }

    /** Get cached categories (synchronous) optionally filtered by type */
    public getCachedCategories(type?: TransactionType): Category[] {
        const familyId = this.getFamilyId();
        const all = (Object.values(this.categories) as Category[])
            .filter(c => familyId ? !!c.familyId : !c.familyId);
            
        if (!type) return all;
        return all.filter(c => c.type === type);
    }

    /** Remove a category from its parent (convert to main category) */
    removeFromParentCategory(userId: string, categoryId: string): Observable<void> {
        const currentCategory = this.categories[categoryId];
        if (!currentCategory || !currentCategory.parentCategoryId) return of(undefined);

        return new Observable<void>(observer => {
            // Optimistic update
            const updatedCategory = { 
                ...currentCategory, 
                parentCategoryId: undefined, 
                isSubCategory: false,
                syncStatus: SyncStatus.PENDING
            };
            this.updateCategoryCache(userId, 'update', updatedCategory);
            this.store.dispatch(CategoriesActions.updateCategorySuccess({ category: updatedCategory }));

            const parentCategory = this.categories[currentCategory.parentCategoryId!];
            if (parentCategory) {
                const updatedSubCats = (parentCategory.subCategories || []).filter(id => id !== categoryId);
                const updatedParent = { 
                    ...parentCategory, 
                    subCategories: updatedSubCats,
                    syncStatus: SyncStatus.PENDING
                };
                this.updateCategoryCache(userId, 'update', updatedParent);
                this.store.dispatch(CategoriesActions.updateCategorySuccess({ category: updatedParent }));
            }

            observer.next();
            observer.complete();

            // Sync
            const syncRemove = async () => {
                try {
                    if (currentCategory.parentCategoryId) {
                        const parent = this.categories[currentCategory.parentCategoryId];
                        if (parent) {
                            const updatedSubCats = (parent.subCategories || []).filter(id => id !== categoryId);
                            await this.addToSyncQueue('update', { id: parent.id, subCategories: updatedSubCats }, userId);
                        }
                    }
                    await this.addToSyncQueue('update', { id: categoryId, parentCategoryId: null, isSubCategory: false }, userId);
                } catch (error) {
                    console.error('Failed to sync removeFromParentCategory:', error);
                }
            };
            syncRemove();
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
     * Add category to sync queue
     */
    private async addToSyncQueue(operation: 'create' | 'update' | 'delete', data: any, userId: string): Promise<void> {
        const syncItem: Omit<SyncItem, 'timestamp' | 'retryCount'> = {
            id: data.id || this.generateCategoryId(userId),
            type: 'category',
            operation: operation,
            data: data,
            maxRetries: 3,
            collectionPath: this.getCategoriesPath(userId)
        };

        const result = await this.commonSyncService.registerSyncItem(syncItem);
        if (!result.success) {
            console.error('Failed to register category for sync:', result.errors);
        }
    }

    /**
     * Generate a unique category ID
     */
    private generateCategoryId(userId: string): string {
        return doc(collection(this.firestore, this.getCategoriesPath(userId))).id;
    }

    /**
     * Update the individual-item store when categories are created, updated, or deleted.
     * Replaces the old bulk-array updateCategoryCache pattern.
     */
    protected updateCategoryCache(userId: string, operation: 'create' | 'update' | 'delete', category?: Category): void {
        try {
            const familyId = this.getFamilyId();

            if (!category || (!category.id && !category.name)) {
                if (operation !== 'delete') return;
            }

            switch (operation) {
                case 'create':
                    if (category && (category.id || category.name)) {
                        const key = LocalStorageKeyHelper.getCategoryItemKey(category.id!, familyId);
                        const categoryToSave = familyId ? { ...category, familyId: familyId } : category;
                        this.localStorageUtility.setCategory(key, categoryToSave);
                    }
                    break;

                case 'update':
                    if (category && category.id) {
                        const key = LocalStorageKeyHelper.getCategoryItemKey(category.id, familyId);
                        // Merge with existing so partial updates don't wipe other fields
                        const existing = this.localStorageUtility.getCategory<Category>(key, false);
                        const merged = existing ? { ...existing, ...category } : category;
                        const categoryToSave = familyId ? { ...merged, familyId: familyId } : merged;
                        this.localStorageUtility.setCategory(key, categoryToSave);
                    }
                    break;

                case 'delete':
                    if (category && category.id) {
                        const key = LocalStorageKeyHelper.getCategoryItemKey(category.id, familyId);
                        this.localStorageUtility.removeCategory(key);
                    }
                    break;
            }
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

                this.notificationService.info('Category deleted successfully');
                this.notificationService.successVibration();
            }
        });
    }

    /**
     * Merge Firestore categories with pending local changes to preserve offline writes
     */
    private mergeFirestoreAndLocal(firestoreCategories: Category[], localCategories: Category[]): Category[] {
        const firestoreMap = new Map<string, Category>(
            firestoreCategories.map(c => [c.id!, c])
        );

        const pendingLocal = localCategories.filter(localCat => {
            if (!localCat.id) return false;
            const inFirestore = firestoreMap.has(localCat.id);
            const isPending = localCat.syncStatus === SyncStatus.PENDING;
            return !inFirestore || isPending;
        });

        const pendingLocalMap = new Map<string, Category>(
            pendingLocal.map(c => [c.id!, c])
        );

        return [
            ...firestoreCategories.map(c => pendingLocalMap.get(c.id!) ?? c),
            ...pendingLocal.filter(c => !firestoreMap.has(c.id!))
        ];
    }
}
