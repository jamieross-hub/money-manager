import { Injectable, inject, signal } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
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
  FamilyTransaction,
  FamilyStats,
  FamilyMemberStats,
  CreateFamilyRequest,
  AddFamilyTransactionRequest,
  UpdateFamilyTransactionRequest
} from 'src/app/util/models/family.model';

const ACTIVE_FAMILY_ID_KEY = 'active_family_id';
import { NotificationService } from 'src/app/util/service/notification.service';
import { TransactionType, AccountType } from 'src/app/util/config/enums';
import { defaultCategoriesForNewUser } from 'src/app/util/config/config';
import { Category, Account, User } from 'src/app/util/models';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import * as ProfileActions from 'src/app/store/profile/profile.actions';
import { UserService } from 'src/app/util/service/db/user.service';

@Injectable({ providedIn: 'root' })
export class FamilyService {

  private readonly FAMILIES_COL = 'family-groups';

  constructor(
    private firestore: Firestore,
    private auth: Auth,
    private notificationService: NotificationService,
    private store: Store<AppState>,
    private userService: UserService
  ) {
    this.initializeActiveFamilyIdListener();
  }

  readonly activeFamilyId = signal<string | null>(this.getInitialActiveFamilyId());

  private initializeActiveFamilyIdListener(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key === ACTIVE_FAMILY_ID_KEY) {
          this.activeFamilyId.set(event.newValue);
        }
      });
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
      currency: request.currency || 'INR',
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
    try {
      this.store.dispatch(ProfileActions.updatePreferences({
        userId: user.uid,
        preferences: {
          familyId: familyId,
          isFamilyMode: true
        }
      }));
    } catch (e) {
      console.warn('Could not update user preferences with familyId:', e);
      // We don't throw here as the family is already created, but the user might need to toggle it manually
    }

    return familyData;
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
    const categoriesToCreate = defaultCategoriesForNewUser.slice(0, 8); // Just a subset for family
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
      this.store.dispatch(ProfileActions.updatePreferences({
        userId: user.uid,
        preferences: {
          familyId: family.id,
          isFamilyMode: true
        }
      }));
    } catch (e) {
      console.warn('Could not update user preferences with familyId:', e);
    }

    return family;
  }

  async getMyFamilies(): Promise<Family[]> {
    const user = this.currentUser;
    if (!user) return [];

    try {
      // Query all family groups where this user is a member
      const q = query(
        collection(this.firestore, this.FAMILIES_COL),
        where('memberIds', 'array-contains', user.uid),
        where('isActive', '==', true)
      );
      
      const snap = await getDocs(q);
      if (snap.empty) return [];

      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() as Omit<Family, 'id'> }));
    } catch (error) {
      console.error('Error fetching my families:', error);
      return [];
    }
  }

  private getInitialActiveFamilyId(): string | null {
    try {
      return localStorage.getItem(ACTIVE_FAMILY_ID_KEY);
    } catch {
      return null;
    }
  }

  setActiveFamily(id: string | null): void {
    this.activeFamilyId.set(id);
    try {
      if (id) {
        localStorage.setItem(ACTIVE_FAMILY_ID_KEY, id);
      } else {
        localStorage.removeItem(ACTIVE_FAMILY_ID_KEY);
      }
    } catch (e) {
      console.error('Error persisting active family id:', e);
    }
  }

  async getMyFamily(): Promise<Family | null> {
    const user = this.currentUser;
    if (!user) return null;

    const familyId = this.activeFamilyId();

    if (familyId) {
      const family = await this.getFamily(familyId);
      if (family?.isActive) return family;
    }

    return null;
  }

  async getFamily(familyId: string): Promise<Family | null> {
    const snap = await getDoc(this.getFamilyDoc(familyId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() as Omit<Family, 'id'> };
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

    // 3. Update current user's preferences via store
    this.store.dispatch(ProfileActions.updatePreferences({
      userId: user.uid,
      preferences: {
        familyId: null,
        isFamilyMode: false
      }
    }));
  }

  private async getMembershipRecord(familyId: string, userId: string): Promise<FamilyMember | null> {
    const snap = await getDoc(this.getMemberDoc(familyId, userId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() as Omit<FamilyMember, 'id'> };
  }

  // ─── Members ──────────────────────────────────────────────────────────────

  getMembers(familyId: string): Observable<FamilyMember[]> {
    const q = query(this.getMembersCol(familyId), where('isActive', '==', true));
    return from(getDocs(q)).pipe(
      map(snap => snap.docs.map(d => ({ id: d.id, ...d.data() as any } as FamilyMember))),
      catchError(() => of([]))
    );
  }

  async removeMember(familyId: string, memberId: string): Promise<void> {
    // memberId here should be the userId since we use it as doc ID
    await updateDoc(this.getMemberDoc(familyId, memberId), { isActive: false });
    await updateDoc(this.getFamilyDoc(familyId), { memberIds: arrayRemove(memberId) });
    this.notificationService.success('Member removed successfully');
  }

  async leaveFamily(familyId: string): Promise<void> {
    const user = this.currentUser;
    if (!user) return;
    await updateDoc(this.getMemberDoc(familyId, user.uid), { isActive: false });
    await updateDoc(this.getFamilyDoc(familyId), { memberIds: arrayRemove(user.uid) });
  }

  async updateMemberRole(familyId: string, memberId: string, role: 'admin' | 'member'): Promise<void> {
    await updateDoc(this.getMemberDoc(familyId, memberId), { role });
    this.notificationService.success('Role updated');
  }

  // ─── Transactions ─────────────────────────────────────────────────────────

  getTransactions(familyId: string): Observable<FamilyTransaction[]> {
    const q = query(this.getTransactionsCol(familyId), orderBy('date', 'desc'));
    return from(getDocs(q)).pipe(
      map(snap => snap.docs.map(d => ({ id: d.id, ...d.data() as any } as FamilyTransaction))),
      catchError(() => of([]))
    );
  }

  async addTransaction(request: AddFamilyTransactionRequest): Promise<FamilyTransaction> {
    const user = this.currentUser;
    if (!user) throw new Error('User not authenticated');

    const txData: Omit<FamilyTransaction, 'id'> = {
      familyId: request.familyId,
      userId: user.uid,
      userDisplayName: user.displayName || user.email?.split('@')[0] || 'Member',
      userPhotoURL: user.photoURL || '',
      amount: request.amount,
      type: request.type,
      category: request.category,
      date: request.date,
      note: request.note || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const ref = await addDoc(this.getTransactionsCol(request.familyId), txData);
    return { id: ref.id, ...txData };
  }

  async updateTransaction(familyId: string, txId: string, request: UpdateFamilyTransactionRequest): Promise<void> {
    const updateData: any = { updatedAt: new Date() };
    if (request.amount !== undefined) updateData.amount = request.amount;
    if (request.type) updateData.type = request.type;
    if (request.category) updateData.category = request.category;
    if (request.date) updateData.date = request.date;
    if (request.note !== undefined) updateData.note = request.note;

    await updateDoc(this.getTransactionDoc(familyId, txId), updateData);
  }

  async deleteTransaction(familyId: string, txId: string): Promise<void> {
    await deleteDoc(this.getTransactionDoc(familyId, txId));
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  computeStats(transactions: FamilyTransaction[], members: FamilyMember[]): FamilyStats {
    let totalIncome = 0;
    let totalExpense = 0;
    const memberMap = new Map<string, FamilyMemberStats>();

    // Init member breakdown
    members.forEach(m => {
      memberMap.set(m.userId, {
        userId: m.userId,
        displayName: m.displayName,
        photoURL: m.photoURL,
        totalIncome: 0,
        totalExpense: 0,
        netBalance: 0,
        transactionCount: 0,
      });
    });

    // Accumulate
    transactions.forEach(tx => {
      if (tx.type === 'income') {
        totalIncome += tx.amount;
      } else {
        totalExpense += tx.amount;
      }

      const memberStats = memberMap.get(tx.userId);
      if (memberStats) {
        if (tx.type === 'income') {
          memberStats.totalIncome += tx.amount;
        } else {
          memberStats.totalExpense += tx.amount;
        }
        memberStats.netBalance = memberStats.totalIncome - memberStats.totalExpense;
        memberStats.transactionCount++;
      }
    });

    return {
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense,
      transactionCount: transactions.length,
      memberBreakdown: Array.from(memberMap.values()),
    };
  }

  canEditTransaction(tx: FamilyTransaction, currentUserId: string, isAdmin: boolean): boolean {
    return isAdmin || tx.userId === currentUserId;
  }
}
