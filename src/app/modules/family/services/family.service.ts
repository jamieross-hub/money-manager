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
import { TransactionType, AccountType, TransactionStatus } from 'src/app/util/config/enums';
import { defaultCategoriesForNewUser } from 'src/app/util/config/config';
import { Category, Account, User } from 'src/app/util/models';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import * as ProfileActions from 'src/app/store/profile/profile.actions';
import * as fromProfile from 'src/app/store/profile/profile.selectors';
import { UserService } from 'src/app/util/service/db/user.service';
import { LocalIndexDBStorageService } from 'src/app/util/service/indexdb-storage.service';

@Injectable({ providedIn: 'root' })
export class FamilyService {

  private readonly FAMILIES_COL = 'family-groups';

  constructor(
    private firestore: Firestore,
    private auth: Auth,
    private notificationService: NotificationService,
    private store: Store<AppState>,
    private userService: UserService,
    private storageService: LocalIndexDBStorageService
  ) {
    this.syncActiveFamilyWithProfile();
  }

  private isTransitioning = false;

  private syncActiveFamilyWithProfile(): void {
    // Sync the signal with store preferences when they change
    this.store.select(fromProfile.selectUserPreferences).subscribe(prefs => {
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

  readonly activeFamilyId = signal<string | null>(this.getInitialActiveFamilyId());

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
      return this.storageService.getItem(ACTIVE_FAMILY_ID_KEY);
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
      if (userId && userId !== 'offline-guest') {
        this.store.dispatch(ProfileActions.updatePreferences({
          userId,
          preferences: { activeFamilyId: id }
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
    this.notificationService.success('Banner updated successfully');
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

  getTransactions(familyId: string): Observable<Transaction[]> {
    const q = query(this.getTransactionsCol(familyId), orderBy('date', 'desc'));
    return from(getDocs(q)).pipe(
      map(snap => snap.docs.map(d => ({ id: d.id, ...d.data() as any } as Transaction))),
      catchError(() => of([]))
    );
  }

  async addTransaction(request: AddFamilyTransactionRequest): Promise<Transaction> {
    const user = this.currentUser;
    if (!user) throw new Error('User not authenticated');

    const txData: Omit<Transaction, 'id'> = {
      familyId: request.familyId,
      userId: user.uid,
      userDisplayName: user.displayName || user.email?.split('@')[0] || 'Member',
      userPhotoURL: user.photoURL || '',
      amount: request.amount,
      type: request.type,
      categoryId: request.categoryId,
      category: request.category || '',
      date: request.date,
      notes: request.notes || request.note || '',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: user.uid,
      updatedBy: user.uid,
      settlementId: request.settlementId,
      settlementFamilyId: request.settlementFamilyId,
      settlementFromUserId: request.settlementFromUserId,
      settlementToUserId: request.settlementToUserId,
      status: TransactionStatus.COMPLETED,
      syncStatus: (request as any).syncStatus || (TransactionStatus.COMPLETED as any) // Compatibility
    };

    const ref = await addDoc(this.getTransactionsCol(request.familyId), txData);
    return { id: ref.id, ...txData };
  }

  async updateTransaction(familyId: string, txId: string, request: UpdateFamilyTransactionRequest): Promise<void> {
    const updateData: any = { updatedAt: new Date(), updatedBy: this.currentUser?.uid || '' };
    if (request.amount !== undefined) updateData.amount = request.amount;
    if (request.type) updateData.type = request.type;
    if (request.categoryId) updateData.categoryId = request.categoryId;
    if (request.category) updateData.category = request.category;
    if (request.date) updateData.date = request.date;
    if (request.notes !== undefined) updateData.notes = request.notes;
    else if ((request as any).note !== undefined) updateData.notes = (request as any).note;

    await updateDoc(this.getTransactionDoc(familyId, txId), updateData);
  }

  async deleteTransaction(familyId: string, txId: string): Promise<Transaction> {
    const docRef = this.getTransactionDoc(familyId, txId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error('Transaction not found');
    const transaction = { id: snap.id, ...snap.data() as any } as Transaction;

    await updateDoc(docRef, {
      status: TransactionStatus.DELETED,
      updatedAt: new Date()
    });

    return { ...transaction, status: TransactionStatus.DELETED };
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  computeStats(transactions: Transaction[], members: FamilyMember[]): FamilyStats {
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

    let transactionCount = 0;
    // Accumulate
    transactions.forEach(tx => {
      // Skip deleted transactions
      if (tx.status === TransactionStatus.DELETED) return;

      // Skip settlements for expense/income stats as they are internal transfers
      if (tx.category === 'Settlement') return;

      transactionCount++;
      if (tx.type === 'income') {
        totalIncome += tx.amount;
      } else {
        totalExpense += tx.amount;
      }

      if (tx.splitData?.splitBetween && tx.splitData.splitBetween.length > 0) {
        // In split mode, attribute share based on splitData
        tx.splitData.splitBetween.forEach(share => {
          const mStats = memberMap.get(share.userId);
          if (mStats) {
            if (tx.type === 'income') {
              mStats.totalIncome += share.amount;
            } else {
              mStats.totalExpense += share.amount;
            }
          }
        });
        
        // Count the transaction for whoever recorded it
        const recorderStats = memberMap.get(tx.userId);
        if (recorderStats) {
          recorderStats.transactionCount++;
        }
      } else {
        // Simple mode: attribute to the recording user
        const memberStats = memberMap.get(tx.userId);
        if (memberStats) {
          if (tx.type === 'income') {
            memberStats.totalIncome += tx.amount;
          } else {
            memberStats.totalExpense += tx.amount;
          }
          memberStats.transactionCount++;
        }
      }
    });

    // Finalize net balances and member breakdown
    const memberBreakdown = Array.from(memberMap.values()).map(m => ({
      ...m,
      netBalance: m.totalIncome - m.totalExpense
    }));

    return {
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense,
      transactionCount,
      memberBreakdown,
    };
  }

  canEditTransaction(tx: Transaction, currentUserId: string, isAdmin: boolean): boolean {
    return isAdmin || tx.userId === currentUserId;
  }

  // ─── Settlements ────────────────────────────────────────────────────────────────────

  getSettlements(familyId: string): Observable<Settlement[]> {
    const q = query(this.getSettlementsCol(familyId), orderBy('settledAt', 'desc'));
    return from(getDocs(q)).pipe(
      map(snap => snap.docs.map(d => ({ id: d.id, ...d.data() as any } as Settlement))),
      catchError(() => of([]))
    );
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
    return { id: ref.id, ...data };
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
   * Compute net balances from split-expense shares minus recorded settlements.
   * Returns entries where `amount > 0` (from owes to).
   */
  computeBalances(
    transactions: Transaction[],
    members: FamilyMember[],
    settlements: Settlement[]
  ): BalanceEntry[] {
    // Step 1: accumulate raw owed amounts between pairs.
    // key = `${debtorId}::${creditorId}` → amount owed
    const pairMap = new Map<string, number>();

    const adjust = (debtorId: string, creditorId: string, delta: number) => {
      if (debtorId === creditorId) return;
      const key = `${debtorId}::${creditorId}`;
      pairMap.set(key, (pairMap.get(key) ?? 0) + delta);
    };

    // Split expense shares → debtor owes payer
    for (const tx of transactions) {
      if (tx.status === TransactionStatus.DELETED) continue;
      if (tx.type !== 'expense' || !tx.splitData) continue;
      const { paidByUserId, splitBetween, paidBy } = tx.splitData;

      if (paidByUserId === 'multiple' && paidBy?.length) {
         const netMap = new Map<string, number>();

         // Add all amounts paid
         for (const payer of paidBy) {
             netMap.set(payer.userId, payer.amount);
         }

         // Subtract all amounts owed
         for (const share of splitBetween) {
             netMap.set(share.userId, (netMap.get(share.userId) || 0) - share.amount);
         }

         const creditors: {id: string, amt: number}[] = [];
         const debtors: {id: string, amt: number}[] = [];

         for (const [uid, amt] of netMap.entries()) {
             if (amt > 0.01) creditors.push({ id: uid, amt });
             else if (amt < -0.01) debtors.push({ id: uid, amt: Math.abs(amt) });
         }

         // Match debtors to creditors
         let cIdx = 0;
         for (const debtor of debtors) {
             let debt = debtor.amt;
             while (debt > 0.01 && cIdx < creditors.length) {
                 const creditor = creditors[cIdx];
                 const settleAmt = Math.min(debt, creditor.amt);
                 adjust(debtor.id, creditor.id, settleAmt);
                 debt -= settleAmt;
                 creditor.amt -= settleAmt;
                 if (creditor.amt < 0.01) {
                     cIdx++;
                 }
             }
         }
      } else {
         for (const share of splitBetween) {
           if (share.userId !== paidByUserId) {
             adjust(share.userId, paidByUserId, share.amount);
           }
         }
      }
    }

    // Settlements → reduce debt (from paid to)
    for (const s of settlements) {
      adjust(s.fromUserId, s.toUserId, -s.amount);
    }

    // Step 2: collapse symmetric pairs and keep only positives
    const seen = new Set<string>();
    const memberMap = new Map(members.map(m => [m.userId, m]));
    const result: BalanceEntry[] = [];

    for (const [key, amount] of pairMap.entries()) {
      if (seen.has(key)) continue;
      const [debtorId, creditorId] = key.split('::');
      const reverseKey = `${creditorId}::${debtorId}`;
      seen.add(key);
      seen.add(reverseKey);

      const net = amount - (pairMap.get(reverseKey) ?? 0);
      if (Math.abs(net) < 0.01) continue;

      const [fromId, toId] = net > 0 ? [debtorId, creditorId] : [creditorId, debtorId];
      const fromMember = memberMap.get(fromId);
      const toMember = memberMap.get(toId);

      result.push({
        fromUserId: fromId,
        fromDisplayName: fromMember?.displayName ?? fromId,
        fromPhotoURL: fromMember?.photoURL,
        toUserId: toId,
        toDisplayName: toMember?.displayName ?? toId,
        toPhotoURL: toMember?.photoURL,
        amount: Math.abs(net),
      });
    }

    return result.sort((a, b) => b.amount - a.amount);
  }

  pullFromFirestore(userId: string): Observable<void> {
    const familyId = this.activeFamilyId();
    if (familyId) {
      // Re-trigger family load to refresh data from server
      this.store.dispatch(ProfileActions.updatePreferences({ userId, preferences: {} })); 
      // The store effects or components will reload if needed, or we can explicitly reload:
      this.store.dispatch({ type: '[Family] Load Family', familyId });
      this.store.dispatch({ type: '[Family] Load Members', familyId });
      this.store.dispatch({ type: '[Family] Load Transactions', familyId });
    }
    return of(void 0);
  }
}
