import { Injectable, inject, signal, OnDestroy, Injector } from '@angular/core';
import { QuickAction, QuickActionsFabConfig } from 'src/app/util/components/floating-action-buttons/quick-actions-fab/quick-actions-fab.component';
import { Observable, from, of, firstValueFrom, Subject, forkJoin } from 'rxjs';
import { map, catchError, filter, take, switchMap, takeUntil, tap } from 'rxjs/operators';
import {
  Firestore,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  onSnapshot,
  writeBatch,
  arrayUnion,
  arrayRemove
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import {
  Family,
  FamilyMember,
  FamilyStats,
  FamilyMemberStats,
  CreateFamilyRequest,
  AddFamilyTransactionRequest,
  UpdateFamilyTransactionRequest,
  Settlement,
  AddSettlementRequest,
  BalanceEntry,
} from 'src/app/util/models/family.model';
import { Transaction } from 'src/app/util/models/transaction.model';

const ACTIVE_FAMILY_ID_KEY = 'active_family_id';
import { NotificationService } from 'src/app/util/service/notification.service';
import { LocalStorageKey, LocalStorageKeyHelper } from 'src/app/util/models/local-storage.model';
import * as FamilyActions from '../store/family.actions';
import { TransactionType, AccountType, TransactionStatus } from 'src/app/util/config/enums';
import { defaultCategoriesForNewUser } from 'src/app/util/config/config';
import { Category, Account, User } from 'src/app/util/models';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import * as ProfileActions from 'src/app/store/profile/profile.actions';
import * as fromProfile from 'src/app/store/profile/profile.selectors';
import { UserService } from 'src/app/util/service/db/user.service';
import { FamilyCreateDialogComponent } from '../dialogs/family-create-dialog/family-create-dialog.component';
import { FamilyJoinDialogComponent } from '../dialogs/family-join-dialog/family-join-dialog.component';
import { selectUserFamilies } from '../store/family.selectors';
import { MatDialog } from '@angular/material/dialog';
import { LocalIndexDBStorageService } from 'src/app/util/service/indexdb-storage.service';

import { CategoryFacadeService } from 'src/app/util/service/db/category-facade.service';
import { TransactionsFacadeService } from 'src/app/util/service/db/transactions-facade.service';
import { CommonSyncService } from 'src/app/util/service/common-sync.service';
import { SyncStatus } from 'src/app/util/config/enums';
import { selectAllAccounts } from 'src/app/store/accounts/accounts.selectors';

@Injectable({ providedIn: 'root' })
export class FamilyService implements OnDestroy {
  private readonly destroy$ = new Subject<void>();

  private readonly FAMILIES_COL = 'family-groups';

  readonly activeFamilyId = signal<string | null>(null);
  readonly sharedSelectedGroup = signal<any | null>(null);

  constructor(
    private firestore: Firestore,
    private auth: Auth,
    private notificationService: NotificationService,
    private store: Store<AppState>,
    private userService: UserService,
    private storageService: LocalIndexDBStorageService,
    private dialog: MatDialog,
    private injector: Injector
  ) {
    this.syncActiveFamilyWithProfile();
  }

  private isTransitioning = false;

  private syncActiveFamilyWithProfile(): void {
    // 1. Initial load from storage when ready
    this.storageService.isReady$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        const storedId = this.getInitialActiveFamilyId();
        if (storedId) {
          this.activeFamilyId.set(storedId);
        }
      });

    // 2. Sync the signal with store preferences when they change
    this.store.select(fromProfile.selectUserPreferences)
      .pipe(takeUntil(this.destroy$))
      .subscribe(prefs => {
        if (prefs && prefs.activeFamilyId !== undefined) {
          if (this.isTransitioning) {
            if (prefs.activeFamilyId === this.activeFamilyId()) {
              this.isTransitioning = false;
            }
            return;
          }

          if (prefs.activeFamilyId !== this.activeFamilyId()) {
            this.activeFamilyId.set(prefs.activeFamilyId);
            // Also sync to persistent storage for immediate availability on next boot
            try {
              if (prefs.activeFamilyId) {
                this.storageService.setItem(ACTIVE_FAMILY_ID_KEY, prefs.activeFamilyId);
              } else {
                this.storageService.removeItem(ACTIVE_FAMILY_ID_KEY);
              }
            } catch (e) {
              console.error('Error persisting active family id to storage:', e);
            }
          }
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }


  fabConfig: QuickActionsFabConfig = {
    mainButtonIcon: 'groups',
    mainButtonColor: 'accent',
    mainButtonTooltip: 'Group Actions',
    showLabels: true,
    animations: true,
    autoHide: false,
    theme: 'auto',
    actions: [
      {
        id: 'add-group', 
        label: 'Create Group',
        icon: 'add_circle',
        color: 'primary',
        tooltip: 'Create group'
      },
      {
        id: 'join-group',
        label: 'Join Group',
        icon: 'link',
        color: 'accent',
        tooltip: 'Join group'
      }
    ]
  };

  handleFabAction(action: QuickAction): void {
    if (action.id === 'add-group') {
      this.openCreateDialog();
    } else if (action.id === 'join-group') {
      this.openJoinDialog();
    }
  }

  // ─── Path Helpers ────────────────────────────────────────────────────────

  private getFamilyDoc(familyId: string) {
    return doc(this.firestore, this.FAMILIES_COL, familyId);
  }

  private getMembersCol(familyId: string) {
    return collection(this.firestore, `${this.FAMILIES_COL}/${familyId}/members`);
  }

  private getMemberDoc(familyId: string, userId: string) {
    return doc(this.firestore, `${this.FAMILIES_COL}/${familyId}/members/${userId}`);
  }

  private getTransactionsCol(familyId: string) {
    return collection(this.firestore, `${this.FAMILIES_COL}/${familyId}/transactions`);
  }

  private getTransactionDoc(familyId: string, txId: string) {
    return doc(this.firestore, `${this.FAMILIES_COL}/${familyId}/transactions/${txId}`);
  }

  private getSettlementsCol(familyId: string) {
    return collection(this.firestore, `${this.FAMILIES_COL}/${familyId}/settlements`);
  }

  // ─── Utility ─────────────────────────────────────────────────────────────

  private generateInviteCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
    let code = 'FAM-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  private get currentUser() {
    return this.auth.currentUser;
  }

  // ─── Dialog Helpers ──────────────────────────────────────────────────────

  openCreateDialog(): void {
    this.store.select(selectUserFamilies).pipe(take(1)).subscribe(families => {
      const existingNames = (families || []).map(f => f.name);
      const ref = this.dialog.open(FamilyCreateDialogComponent, { 
        disableClose: true,
        data: { existingNames }
      });
      ref.afterClosed().subscribe(async (result: CreateFamilyRequest | undefined) => {
        if (result) {
          this.store.dispatch(FamilyActions.createFamily({ request: result }));
        }
      });
    });
  }

  openJoinDialog(): void {
    const ref = this.dialog.open(FamilyJoinDialogComponent, { disableClose: true });
    ref.afterClosed().subscribe(async (code: string | undefined) => {
      if (code) {
        this.store.dispatch(FamilyActions.joinFamily({ inviteCode: code }));
      }
    });
  }

  // ─── Family CRUD ──────────────────────────────────────────────────────────

  async createFamily(request: CreateFamilyRequest): Promise<Family> {
    const user = this.currentUser;
    if (!user) throw new Error('User not authenticated');

    const familyRef = doc(collection(this.firestore, this.FAMILIES_COL));
    const familyId = familyRef.id;

    const inviteCode = this.generateInviteCode();
    const familyData: Family = {
      id: familyId,
      name: request.name,
      ownerUserId: user.uid,
      inviteCode,
      mode: request.mode ?? 'common',
      icon: request.icon,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      memberIds: [user.uid]
    };

    await setDoc(familyRef, familyData);

    // 2. Add creator as admin member
    await setDoc(this.getMemberDoc(familyId, user.uid), {
      familyId: familyId,
      userId: user.uid,
      email: user.email || '',
      displayName: user.displayName || user.email?.split('@')[0] || 'Owner',
      photoURL: user.photoURL || '',
      role: 'admin',
      joinedAt: new Date(),
      isActive: true,
    } as Omit<FamilyMember, 'id'>);

    // 3. Initialize defaults (categories/accounts)
    await this.initializeFamilyDefaults(familyId, user.uid);

    // 4. Finally, update user's preferences with familyId
    // This completes the "Group Created" state transition for the user
    // 4. Finally, update user's preferences with familyId
    // This completes the "Group Created" state transition for the user
    try {
      this.setActiveFamily(familyId);
      this.store.dispatch(ProfileActions.updatePreferences({
        userId: user.uid,
        preferences: {
          activeFamilyId: familyId,
          isFamilyMode: true
        }
      }));
    } catch (e) {
      console.warn('Could not update user preferences with activeFamilyId:', e);
      // We don't throw here as the family is already created, but the user might need to toggle it manually
    }

    return familyData;
  }

  async updateFamily(familyId: string, request: Partial<CreateFamilyRequest>): Promise<void> {
    const user = this.currentUser;
    if (!user) throw new Error('User not authenticated');

    const updateData: any = {
      updatedAt: new Date()
    };
    if (request.name !== undefined) updateData.name = request.name;
    if (request.mode !== undefined) updateData.mode = request.mode;
    if (request.icon !== undefined) updateData.icon = request.icon;

    await updateDoc(this.getFamilyDoc(familyId), updateData);
    
    // Update local cache
    const cacheKey = `family-${familyId}`;
    try {
      const cached = this.storageService.getItem<Family>(cacheKey);
      if (cached) {
        this.storageService.setItem(cacheKey, { ...cached, ...updateData });
      }
    } catch (e) {}
  }

  private async initializeFamilyDefaults(familyId: string, userId: string): Promise<void> {
    const batch = writeBatch(this.firestore);

    // 1. Create Default Account
    const accountId = 'acc_fam_' + Date.now();
    const accountData: Account = {
      accountId,
      userId: familyId, // Shared family account
      name: 'Family Savings',
      type: AccountType.BANK,
      balance: 0,
      description: 'Default family savings account',
      institution: 'Family Bank',
      currency: 'INR',
      createdAt: new Date() as any,
      isActive: true
    };
    const accountRef = doc(this.firestore, `family-groups/${familyId}/accounts/${accountId}`);
    batch.set(accountRef, accountData);

    // 2. Create Default Categories
    const categoriesToCreate = defaultCategoriesForNewUser // Just a subset for family
    for (const cat of categoriesToCreate) {
      const catId = 'cat_fam_' + Math.random().toString(36).substr(2, 9);
      const catData: Category = {
        id: catId,
        name: cat.name,
        type: cat.type,
        icon: cat.icon,
        color: cat.color,
        createdAt: Date.now() as any
      };
      const catRef = doc(this.firestore, `family-groups/${familyId}/categories/${catId}`);
      batch.set(catRef, catData);
    }

    await batch.commit();
  }

  async joinByCode(inviteCode: string): Promise<Family> {
    const user = this.currentUser;
    if (!user) throw new Error('User not authenticated');

    const normalizedCode = inviteCode.trim().toUpperCase();
    const familiesRef = collection(this.firestore, this.FAMILIES_COL);
    const q = query(familiesRef, where('inviteCode', '==', normalizedCode), where('isActive', '==', true));
    const snap = await getDocs(q);

    if (snap.empty) {
      throw new Error('Invalid invite code. Please check and try again.');
    }

    const familyDoc = snap.docs[0];
    const family: Family = { id: familyDoc.id, ...familyDoc.data() as Omit<Family, 'id'> };

    // Check if already a member using doc ID
    const existingSnap = await getDoc(this.getMemberDoc(family.id!, user.uid));
    const existing = existingSnap.exists() ? { id: existingSnap.id, ...existingSnap.data() as Omit<FamilyMember, 'id'> } : null;
    
    if (existing) {
      if (existing.isActive) {
        throw new Error('You are already a member of this family.');
      }
      // Reactivate membership
      await updateDoc(this.getMemberDoc(family.id!, user.uid), { isActive: true, joinedAt: new Date() });
      await updateDoc(this.getFamilyDoc(family.id!), { memberIds: arrayUnion(user.uid) });
    } else {
      await setDoc(this.getMemberDoc(family.id!, user.uid), {
        familyId: family.id!,
        userId: user.uid,
        email: user.email || '',
        displayName: user.displayName || user.email?.split('@')[0] || 'Member',
        photoURL: user.photoURL || '',
        role: 'member',
        joinedAt: new Date(),
        isActive: true,
      } as Omit<FamilyMember, 'id'>);
      await updateDoc(this.getFamilyDoc(family.id!), { memberIds: arrayUnion(user.uid) });
    }

    // Update user's preferences with familyId
    try {
      // ONLY switch if no family is currently active
      if (!this.activeFamilyId()) {
        this.store.dispatch(ProfileActions.updatePreferences({
          userId: user.uid,
          preferences: {
            activeFamilyId: family.id,
            isFamilyMode: true
          }
        }));
      }
    } catch (e) {
      console.warn('Could not update user preferences with activeFamilyId:', e);
    }

    return family;
  }

  getMyFamilies(): Observable<Family[]> {
    const syncUser = this.store.selectSignal(fromProfile.selectProfile)();
    
    // If we have a user now, start the stream immediately
    if (syncUser) {
      return this._getFamiliesStream(syncUser);
    }

    // Otherwise wait for the profile to be loaded
    return this.store.select(fromProfile.selectProfile).pipe(
      filter(profile => !!profile),
      take(1),
      switchMap(user => this._getFamiliesStream(user!))
    );
  }

  private _getFamiliesStream(user: User): Observable<Family[]> {
    return this.storageService.isReady$.pipe(
      switchMap(() => {
        const cacheKey = `${LocalStorageKey.FAMILIES_CACHE}-${user.uid}`;
        
        return new Observable<Family[]>(observer => {
          // 1. Emit cached data immediately if available (Synchronous)
          try {
            const cached = this.storageService.getItem<Family[]>(cacheKey);
            if (cached && Array.isArray(cached)) {
              observer.next(cached);
            }
          } catch (e) {
            console.error('Error loading cached families:', e);
          }

          // 2. Real-time updates
          const q = query(
            collection(this.firestore, this.FAMILIES_COL),
            where('memberIds', 'array-contains', user.uid),
            where('isActive', '==', true)
          );

          const unsubscribe = onSnapshot(q, (snap) => {
            const families = snap.docs.map(doc => ({ id: doc.id, ...doc.data() as Omit<Family, 'id'> }));
            
            // Cache the fresh data
            try {
              this.storageService.setItem(cacheKey, families);
            } catch (e) {
              console.error('Error caching families:', e);
            }

            observer.next(families);
          }, (err) => {
            console.error('Error in families listener:', err);
          });
          return () => unsubscribe();
        });
      })
    );
  }

  /**
   * Returns families from local cache synchronously if a user ID is available.
   * Useful for seeding the store during component initialization.
   */
  getCachedFamiliesSync(): Family[] {
    const user = this.store.selectSignal(fromProfile.selectProfile)();
    if (!user) return [];
    
    const cacheKey = `${LocalStorageKey.FAMILIES_CACHE}-${user.uid}`;
    try {
      const cached = this.storageService.getItem<Family[]>(cacheKey);
      return (cached && Array.isArray(cached)) ? cached : [];
    } catch {
      return [];
    }
  }

  /**
   * Returns an Observable of families where the current user is a member
   * but the group has been deleted (isActive === false) by the admin.
   * Members can still VIEW these groups but cannot perform any actions.
   */
  getDeletedFamilies(): Observable<Family[]> {
    const user = this.store.selectSignal(fromProfile.selectProfile)();
    if (!user) return of([]);

    return new Observable<Family[]>(observer => {
      const q = query(
        collection(this.firestore, this.FAMILIES_COL),
        where('memberIds', 'array-contains', user.uid),
        where('isActive', '==', false)
      );

      const unsubscribe = onSnapshot(q, (snap) => {
        const families = snap.docs.map(d => ({ id: d.id, ...d.data() as Omit<Family, 'id'> }));
        observer.next(families);
      }, (err) => {
        console.error('Error in deleted families listener:', err);
        observer.next([]);
      });
      return () => unsubscribe();
    });
  }

  private getInitialActiveFamilyId(): string | null {
    try {
      return this.storageService.getItem(ACTIVE_FAMILY_ID_KEY) || '';
    } catch {
      return null;
    }
  }

  setActiveFamily(id: string | null): void {
    const previousId = this.activeFamilyId();
    if (previousId === id) return;

    this.isTransitioning = true;
    this.activeFamilyId.set(id);
    try {
      if (id) {
        this.storageService.setItem(ACTIVE_FAMILY_ID_KEY, id);
      } else {
        this.storageService.removeItem(ACTIVE_FAMILY_ID_KEY);
      }

      // Also sync to user preferences
      const userId = this.userService.getCurrentUserId();
      if (userId) {
        this.store.dispatch(ProfileActions.updatePreferences({
          userId,
          preferences: { 
            activeFamilyId: id,
            isFamilyMode: !!id 
          }
        }));
      }
    } catch (e) {
      console.error('Error persisting active family id:', e);
    }
  }

  async getMyFamily(): Promise<Family | null> {
    const user = this.currentUser;
    if (!user) return null;

    const familyId = this.activeFamilyId();
    if (!familyId) return null;

    return this.getFamily(familyId);
  }

  async getFamily(familyId: string): Promise<Family | null> {
    await firstValueFrom(this.storageService.isReady$);
    const cacheKey = LocalStorageKeyHelper.getFamilyCacheKey(familyId);
    try {
      const cached = this.storageService.getItem<Family>(cacheKey);
      if (cached) return cached;
    } catch (e) {}

    const docRef = this.getFamilyDoc(familyId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const family = { id: snap.id, ...snap.data() as Omit<Family, 'id'> };
      try {
        this.storageService.setItem(cacheKey, family);
      } catch (e) {}
      return family;
    }
    return null;
  }

  async deleteFamily(familyId: string): Promise<void> {
    const user = this.currentUser;
    if (!user) throw new Error('User not authenticated');

    const family = await this.getFamily(familyId);
    if (!family) throw new Error('Family not found');

    if (family.ownerUserId !== user.uid) {
      throw new Error('Only the family owner can delete the family.');
    }

    // 1. Mark family as inactive
    await updateDoc(this.getFamilyDoc(familyId), {
      isActive: false,
      updatedAt: new Date()
    });

    // 2. Update all members' preferences to remove familyId
    const membersSnap = await getDocs(this.getMembersCol(familyId));
    const batch = writeBatch(this.firestore);

    for (const memberDoc of membersSnap.docs) {
      const memberData = memberDoc.data() as FamilyMember;
      const userRef = doc(this.firestore, 'users', memberData.userId);
      
      // Update member's isActive in family subcollection (optional but good for history)
      batch.update(memberDoc.ref, { isActive: false });

      // We can't easily update other users' documents here without higher permissions
      // or a cloud function. However, the UI should handle the case where the family is inactive.
      // For the current user, we can dispatch the update.
    }

    await batch.commit();

    // 3. Update current user's preferences via store ONLY IF the deleted family was active
    if (this.activeFamilyId() === familyId) {
      this.store.dispatch(ProfileActions.updatePreferences({
        userId: user.uid,
        preferences: {
          activeFamilyId: null,
          isFamilyMode: false
        }
      }));
    }
  }

  async updateFamilyBanner(familyId: string, banner: string): Promise<void> {
    const user = this.currentUser;
    if (!user) throw new Error('User not authenticated');

    await updateDoc(this.getFamilyDoc(familyId), {
      banner,
      updatedAt: new Date()
    });
    this.notificationService.info('Banner updated successfully');
  }

  private async getMembershipRecord(familyId: string, userId: string): Promise<FamilyMember | null> {
    const snap = await getDoc(this.getMemberDoc(familyId, userId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() as Omit<FamilyMember, 'id'> };
  }

  // ─── Members ──────────────────────────────────────────────────────────────

  getMembers(familyId: string): Observable<FamilyMember[]> {
    return this.storageService.isReady$.pipe(
      switchMap(() => {
        const cacheKey = LocalStorageKeyHelper.getMembersCacheKey(familyId);
        
        return new Observable<FamilyMember[]>(observer => {
          // 1. Emit cached members immediately
          try {
            const cached = this.storageService.getItem<FamilyMember[]>(cacheKey);
            if (cached && Array.isArray(cached)) {
              observer.next(cached);
            }
          } catch (e) {
            console.error('Error loading cached members:', e);
          }

          const q = query(this.getMembersCol(familyId));
          const unsubscribe = onSnapshot(q, (snap) => {
            const members = snap.docs.map(d => ({ id: d.id, ...d.data() as any } as FamilyMember));
            
            // 2. Cache the members
            try {
              this.storageService.setItem(cacheKey, members);
            } catch (e) {
              console.error('Error caching members:', e);
            }

            observer.next(members);
          }, (err) => {
            console.error('Members listener error:', err);
          });
          return () => unsubscribe();
        });
      })
    );
  }

  getCachedMembersSync(familyId: string): FamilyMember[] {
    try {
      const cached = this.storageService.getItem<FamilyMember[]>(`family-members-${familyId}`);
      return (cached && Array.isArray(cached)) ? cached : [];
    } catch {
      return [];
    }
  }

  async removeMember(familyId: string, memberId: string): Promise<void> {
    // memberId here should be the userId since we use it as doc ID
    await updateDoc(this.getMemberDoc(familyId, memberId), { isActive: false });
    await updateDoc(this.getFamilyDoc(familyId), { memberIds: arrayRemove(memberId) });
    this.notificationService.info('Member removed successfully');
  }

  async leaveFamily(familyId: string): Promise<void> {
    const user = this.currentUser;
    if (!user) return;
    await updateDoc(this.getMemberDoc(familyId, user.uid), { isActive: false });
    await updateDoc(this.getFamilyDoc(familyId), { memberIds: arrayRemove(user.uid) });
  }

  async updateMemberRole(familyId: string, memberId: string, role: 'admin' | 'member'): Promise<void> {
    await updateDoc(this.getMemberDoc(familyId, memberId), { role });
    this.notificationService.info('Role updated');
  }

  async addMemberByEmail(familyId: string, email: string): Promise<void> {
    const user = await this.userService.getUserByEmail(email);
    if (!user) {
      throw new Error('User not found. Please ask them to sign up first.');
    }

    // Check if already a member
    const existingSnap = await getDoc(this.getMemberDoc(familyId, user.uid));
    if (existingSnap.exists() && existingSnap.data()?.['isActive']) {
      throw new Error('User is already a member of this family.');
    }

    // Add or reactivate
    const memberData: Omit<FamilyMember, 'id'> = {
      familyId,
      userId: user.uid,
      email: user.email || '',
      displayName: user.displayName || user.email?.split('@')[0] || 'Member',
      photoURL: user.photoURL || '',
      role: 'member',
      joinedAt: new Date(),
      isActive: true,
    };

    await setDoc(this.getMemberDoc(familyId, user.uid), memberData);
    await updateDoc(this.getFamilyDoc(familyId), {
      memberIds: arrayUnion(user.uid),
      updatedAt: new Date()
    });

    this.notificationService.success(`${user.displayName} added to family!`);
  }

  // ─── Transactions ─────────────────────────────────────────────────────────

  // ─── Stats ────────────────────────────────────────────────────────────────

  // ─── Stats ────────────────────────────────────────────────────────────────

  computeStats(transactions: Transaction[], members: FamilyMember[], mode: 'common' | 'split' = 'common'): FamilyStats {
    let totalIncome = 0;
    let totalExpense = 0;
    const memberMap = new Map<string, FamilyMemberStats>();
    const categoryMap = new Map<string, number>();

    // Init member breakdown
    members.forEach(m => {
      memberMap.set(m.userId, {
        userId: m.userId,
        displayName: m.displayName,
        photoURL: m.photoURL,
        totalIncome: 0,
        totalExpense: 0,
        totalPaid: 0,
        netBalance: 0,
        transactionCount: 0,
        isActive: m.isActive,
      });
    });

    const activeMembers = members.filter(m => m.isActive);

    let transactionCount = 0;
    // Accumulate
    transactions.forEach(tx => {
      // Skip deleted transactions
      if (tx.status === TransactionStatus.DELETED) return;

      // Skip settlements for expense/income stats as they are internal transfers
      if (tx.category === 'Settlement' || tx.type === TransactionType.TRANSFER) return;

      const amount = Number(tx.amount) || 0;
      if (amount <= 0) return;

      transactionCount++;
      const isIncome = tx.type === TransactionType.INCOME;
      if (isIncome) {
        totalIncome += amount;
      } else {
        totalExpense += amount;
        categoryMap.set(tx.category, (categoryMap.get(tx.category) || 0) + amount);
      }

      // 1. Payment credit/debit (who physically handled the money)
      if (tx.splitData?.paidByUserId === 'multiple' && tx.splitData.paidBy?.length) {
        tx.splitData.paidBy.forEach(p => {
          const mStats = memberMap.get(p.userId);
          if (mStats) {
            const pAmt = Number(p.amount) || 0;
            mStats.totalPaid += isIncome ? -pAmt : pAmt;
          }
        });
      } else {
        const payerId = tx.splitData?.paidByUserId || tx.userId;
        const mStats = memberMap.get(payerId);
        if (mStats) {
          mStats.totalPaid += isIncome ? -amount : amount;
        }
      }

      // 2. Share (who consumes the benefit)
      if (tx.splitData?.splitBetween && tx.splitData.splitBetween.length > 0) {
        tx.splitData.splitBetween.forEach(share => {
          const mStats = memberMap.get(share.userId);
          if (mStats) {
            const shareAmt = Number(share.amount) || 0;
            if (isIncome) mStats.totalIncome += shareAmt;
            else mStats.totalExpense += shareAmt;
          }
        });
      } else if (mode === 'common') {
        const shareAmt = Math.round((amount / activeMembers.length) * 100) / 100;
        activeMembers.forEach(m => {
          const mStats = memberMap.get(m.userId);
          if (mStats) {
            if (isIncome) mStats.totalIncome += shareAmt;
            else mStats.totalExpense += shareAmt;
          }
        });
      } else {
        const mStats = memberMap.get(tx.userId);
        if (mStats) {
          if (isIncome) mStats.totalIncome += amount;
          else mStats.totalExpense += amount;
        }
      }

      // Always count for the recorder
      const recorderStats = memberMap.get(tx.userId);
      if (recorderStats) recorderStats.transactionCount++;
    });

    // Finalize net balances and member breakdown
    const memberBreakdown = Array.from(memberMap.values()).map(m => ({
      ...m,
      netBalance: Math.round((m.totalPaid + m.totalIncome - m.totalExpense) * 100) / 100
    }));

    const categoryBreakdown = Array.from(categoryMap.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totalExpense > 0 ? (amount / totalExpense) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      totalIncome,
      totalExpense,
      netBalance: Math.round((totalIncome - totalExpense) * 100) / 100,
      transactionCount,
      memberBreakdown,
      categoryBreakdown,
    };
  }

  canEditTransaction(tx: Transaction, currentUserId: string, isAdmin: boolean): boolean {
    return isAdmin || tx.userId === currentUserId;
  }

  // ─── Settlements ────────────────────────────────────────────────────────────────────

  getSettlements(familyId: string): Observable<Settlement[]> {
    return this.storageService.isReady$.pipe(
      switchMap(() => {
        const cacheKey = LocalStorageKeyHelper.getSettlementsCacheKey(familyId);

        return new Observable<Settlement[]>(observer => {
          // 1. Emit cached settlements immediately
          try {
            const cached = this.storageService.getItem<Settlement[]>(cacheKey);
            if (cached && Array.isArray(cached)) {
              observer.next(cached);
            }
          } catch (e) {
            console.error('Error loading cached settlements:', e);
          }

          const q = query(this.getSettlementsCol(familyId), orderBy('settledAt', 'desc'));
          const unsubscribe = onSnapshot(q, (snap) => {
            const settlements = snap.docs.map(d => ({ id: d.id, ...d.data() as any } as Settlement));
            
            // 2. Cache the settlements
            try {
              this.storageService.setItem(cacheKey, settlements);
            } catch (e) {
              console.error('Error caching settlements:', e);
            }

            observer.next(settlements);
          }, (err) => {
            console.error('Settlements listener error:', err);
          });
          return () => unsubscribe();
        });
      })
    );
  }

  getCachedSettlementsSync(familyId: string): Settlement[] {
    try {
      const cached = this.storageService.getItem<Settlement[]>(`family-settlements-${familyId}`);
      return (cached && Array.isArray(cached)) ? cached : [];
    } catch {
      return [];
    }
  }

  async addSettlement(request: AddSettlementRequest): Promise<Settlement> {
    const user = this.currentUser;
    if (!user) throw new Error('User not authenticated');

    const now = new Date();
    const data: Omit<Settlement, 'id'> = {
      familyId: request.familyId,
      fromUserId: request.fromUserId,
      fromDisplayName: request.fromDisplayName,
      fromPhotoURL: request.fromPhotoURL || '',
      toUserId: request.toUserId,
      toDisplayName: request.toDisplayName,
      toPhotoURL: request.toPhotoURL || '',
      amount: request.amount,
      method: request.method,
      note: request.note || '',
      settledAt: now,
      createdAt: now,
    };

    const ref = await addDoc(this.getSettlementsCol(request.familyId), data);
    const settlement = { id: ref.id, ...data };
    
    // Dispatch success to update store
    this.store.dispatch(FamilyActions.addSettlementSuccess({ settlement }));
    
    return settlement;
  }

  /**
   * Orchestrates creating a settlement record AND its corresponding transaction record.
   * This logic is consolidated here to avoid complex NgRx effect loops.
   */
  async recordSettlement(request: AddSettlementRequest): Promise<void> {
    const categoryFacade = this.injector.get(CategoryFacadeService);
    const commonSyncService = this.injector.get(CommonSyncService);

    try {
      const userId = this.userService.getCurrentUserId();
      if (!userId || userId === 'offline-guest') {
        throw new Error('Valid user session required for settlement');
      }

      // 1. Create the Settlement record
      const settlement = await this.addSettlement(request);

      // 2. Resolve Category for 'Settlement'
      const categoryId = await firstValueFrom(
        categoryFacade.findOrCreateSystemCategory(
          userId,
          'Settlement',
          TransactionType.TRANSFER,
          'handshake',
          '#10b981'
        ).pipe(take(1))
      );

      // 3. Resolve Default Account
      const accounts = await firstValueFrom(this.store.select(selectAllAccounts).pipe(take(1)));
      const defaultAcc = accounts.find(a => a.type === AccountType.BANK) || accounts[0];
      const accountId = defaultAcc?.accountId || 'settlement';

      // 4. Prepare Transaction
      const now = new Date();
      const amIPaying = userId === settlement.fromUserId;
      const payee = amIPaying ? settlement.toDisplayName : settlement.fromDisplayName;

      const transferTx: AddFamilyTransactionRequest = {
        accountId,
        familyId: settlement.familyId,
        categoryId,
        category: 'Settlement',
        payee,
        amount: settlement.amount,
        type: amIPaying ? TransactionType.EXPENSE : TransactionType.INCOME,
        date: now,
        status: TransactionStatus.COMPLETED,
        notes: `Settlement: ${settlement.fromDisplayName} \u2192 ${settlement.toDisplayName}${settlement.note ? ' | ' + settlement.note : ''}`,
        settlementId: settlement.id,
        settlementFamilyId: settlement.familyId,
        settlementFromUserId: settlement.fromUserId,
        settlementToUserId: settlement.toUserId,
        userDisplayName: amIPaying ? settlement.fromDisplayName : settlement.toDisplayName,
        userPhotoURL: (amIPaying ? settlement.fromPhotoURL : settlement.toPhotoURL) || '',
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId
      };

      // 5. Create Transaction (This will trigger the addTransaction$ effect)
      this.store.dispatch(FamilyActions.addTransaction({ request: transferTx }));
      
      this.notificationService.success('Settlement & Transaction recorded ✔️');
    } catch (error) {
      console.error('Failed to record settlement/transaction:', error);
      this.notificationService.error('Error recording settlement');
      throw error;
    }
  }

  async deleteSettlementAndNotify(familyId: string, settlementId: string): Promise<void> {
    try {
      const deletedTxIds = await this.deleteSettlement(familyId, settlementId);
      this.store.dispatch(FamilyActions.deleteSettlementSuccess({ settlementId, deletedTxIds }));
      this.notificationService.success('Settlement reverted');
    } catch (error) {
      console.error('Failed to revert settlement:', error);
      this.notificationService.error('Failed to revert settlement');
    }
  }

  async deleteSettlement(familyId: string, settlementId: string): Promise<string[]> {
    const batch = writeBatch(this.firestore);
    const deletedTxIds: string[] = [];
    
    // 1. Delete the settlement record itself
    batch.delete(doc(this.firestore, `${this.FAMILIES_COL}/${familyId}/settlements/${settlementId}`));

    // 2. Clear associated shared transactions in family collection
    const q = query(this.getTransactionsCol(familyId), where('settlementId', '==', settlementId));
    const snap = await getDocs(q);
    
    snap.forEach(d => {
      deletedTxIds.push(d.id);
      batch.update(d.ref, { 
        status: TransactionStatus.DELETED, 
        updatedAt: new Date() 
      });
    });

    await batch.commit();
    return deletedTxIds;
  }

  /**
   * Compute net balances globally using a greedy settlement algorithm mechanism.
   * Returns entries where `amount > 0` (from owes to).
   */
  computeBalances(
    transactions: Transaction[],
    members: FamilyMember[],
    settlements: Settlement[],
    mode: 'common' | 'split' = 'common'
  ): BalanceEntry[] {
    const netBalances = new Map<string, number>();
    const activeMembers = members.filter(m => m.isActive);

    // Initialize all members to ensure they appear in balances even if they have no transactions
    for (const m of members) {
      if (!netBalances.has(m.userId)) {
        netBalances.set(m.userId, 0);
      }
    }

    // Round inside updateBalance to prevent long-term floating point drift
    const updateBalance = (userId: string, amount: number) => {
      const current = netBalances.get(userId) || 0;
      const updated = Math.round((current + amount) * 100) / 100;
      netBalances.set(userId, updated);
    };

    // Calculate net balances from transactions
    for (const tx of transactions) {
      if (tx.status === TransactionStatus.DELETED) continue;
      // Skip settlements for balance stats as they are mapped from settlements collection
      if (tx.category === 'Settlement' || tx.type === TransactionType.TRANSFER) continue;
      
      const txAmount = Number(tx.amount) || 0;
      if (txAmount <= 0) continue;

      const multiplier = tx.type === TransactionType.INCOME ? -1 : 1;

      // 1. Handle Debits (Shares)
      if (tx.splitData?.splitBetween && tx.splitData.splitBetween.length > 0) {
        for (const share of tx.splitData.splitBetween) {
          const shareAmt = Number(share.amount) || 0;
          updateBalance(share.userId, -shareAmt * multiplier);
        }
      } else if (mode === 'common') {
        const shareAmt = Math.round((txAmount / activeMembers.length) * 100) / 100;
        activeMembers.forEach(m => updateBalance(m.userId, -shareAmt * multiplier));
      } else {
        updateBalance(tx.userId, -txAmount * multiplier);
      }

      // 2. Handle Credits (Payments)
      if (tx.splitData?.paidByUserId === 'multiple' && tx.splitData.paidBy?.length) {
        for (const payer of tx.splitData.paidBy) {
          const payerAmt = Number(payer.amount) || 0;
          updateBalance(payer.userId, payerAmt * multiplier);
        }
      } else {
        const payerId = tx.splitData?.paidByUserId || tx.userId;
        updateBalance(payerId, txAmount * multiplier);
      }
    }

    // Process settlements
    for (const s of settlements) {
      const settleAmt = Number(s.amount) || 0;
      if (settleAmt <= 0) continue;
      updateBalance(s.fromUserId, settleAmt); // Sender paid off debt, balance increases
      updateBalance(s.toUserId, -settleAmt);  // Receiver got paid, balance decreases
    }

    // Balance corruption safety check
    const totalNet = Array.from(netBalances.values()).reduce((sum, v) => sum + v, 0);
    if (Math.abs(totalNet) > 0.1) {
      console.error("Balance corruption detected: net balances do not sum to zero", totalNet);
    }

    // Separate into creditors (positive) and debtors (negative)
    const creditors: { id: string; amount: number }[] = [];
    const debtors: { id: string; amount: number }[] = [];

    for (const [userId, amount] of netBalances.entries()) {
      const roundedAmount = Math.round(amount * 100) / 100;
      if (roundedAmount >= 0.01) { 
        creditors.push({ id: userId, amount: roundedAmount });
      } else if (roundedAmount <= -0.01) {
        debtors.push({ id: userId, amount: Math.abs(roundedAmount) });
      }
    }

    const result: BalanceEntry[] = [];
    const memberMap = new Map(members.map(m => [m.userId, m]));

    // Strictly Greedy matching by re-sorting remaining pools at every iteration
    while (debtors.length > 0 && creditors.length > 0) {
      debtors.sort((a, b) => b.amount - a.amount);
      creditors.sort((a, b) => b.amount - a.amount);

      const debtor = debtors[0];
      const creditor = creditors[0];

      // Settle the minimum of the two
      const settleAmt = Math.min(debtor.amount, creditor.amount);
      const roundedSettleAmt = Math.round(settleAmt * 100) / 100;

      if (roundedSettleAmt < 0.01) {
        break;
      }

      const fromMember = memberMap.get(debtor.id);
      const toMember = memberMap.get(creditor.id);

      result.push({
        fromUserId: debtor.id,
        fromDisplayName: fromMember?.displayName ?? debtor.id,
        fromPhotoURL: fromMember?.photoURL,
        toUserId: creditor.id,
        toDisplayName: toMember?.displayName ?? creditor.id,
        toPhotoURL: toMember?.photoURL,
        amount: roundedSettleAmt,
      });

      // Update balances and cleanly discard zeroed out members
      debtor.amount = Math.round((debtor.amount - roundedSettleAmt) * 100) / 100;
      creditor.amount = Math.round((creditor.amount - roundedSettleAmt) * 100) / 100;

      if (debtor.amount < 0.01) debtors.shift();
      if (creditor.amount < 0.01) creditors.shift();
    }

    return result;
  }


  pullFromFirestore(userId: string): Observable<void> {
    const familyId = this.activeFamilyId();
    
    // 1. Pull user's families list
    const familiesRef = query(
      collection(this.firestore, this.FAMILIES_COL),
      where('memberIds', 'array-contains', userId),
      where('isActive', '==', true)
    );

    const pullFamilies$ = from(getDocs(familiesRef)).pipe(
      map(snap => {
        const families = snap.docs.map(doc => ({ id: doc.id, ...doc.data() as any } as Family));
        const cacheKey = `${LocalStorageKey.FAMILIES_CACHE}-${userId}`;
        this.storageService.setItem(cacheKey, families);
        this.store.dispatch(FamilyActions.loadUserFamiliesSuccess({ families }));
        return void 0;
      }),
      catchError(err => {
        console.error('[FamilyService] Failed to pull families:', err);
        return of(void 0);
      })
    );

    // 2. If an active family exists, pull its members and settlements as well
    if (familyId) {
       console.log(`[FamilyService] Active family detected (${familyId}), pulling members and settlements...`);
       
       const pullMembers$ = from(getDocs(this.getMembersCol(familyId))).pipe(
         tap(snap => {
           const members = snap.docs.map(d => ({ id: d.id, ...d.data() as any } as FamilyMember));
           const cacheKey = LocalStorageKeyHelper.getMembersCacheKey(familyId);
           this.storageService.setItem(cacheKey, members);
           this.store.dispatch(FamilyActions.loadMembersSuccess({ members }));
         }),
         map(() => void 0),
         catchError(() => of(void 0))
       );

       const pullSettlements$ = this.pullSettlementsFromFirestore(familyId);

       // 3. Combine everyone - Note: Transactions are pulled by TransactionsService independently
       return forkJoin([pullFamilies$, pullMembers$, pullSettlements$]).pipe(
         map(() => void 0)
       );
    }

    return pullFamilies$;
  }

  /**
   * Pull settlements from Firestore and update local cache/Store
   */
  pullSettlementsFromFirestore(familyId: string): Observable<void> {
    const settlementsRef = query(
      this.getSettlementsCol(familyId), 
      orderBy('settledAt', 'desc')
    );

    return from(getDocs(settlementsRef)).pipe(
      tap(snap => {
        const settlements = snap.docs.map(d => ({ id: d.id, ...d.data() as any } as Settlement));
        const cacheKey = LocalStorageKeyHelper.getSettlementsCacheKey(familyId);
        this.storageService.setItem(cacheKey, settlements);
        this.store.dispatch(FamilyActions.loadSettlementsSuccess({ settlements }));
      }),
      map(() => void 0),
      catchError(err => {
        console.error(`[FamilyService] Failed to pull settlements for ${familyId}:`, err);
        return of(void 0);
      })
    );
  }
}
