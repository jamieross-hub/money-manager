import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  onSnapshot
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
import { NotificationService } from 'src/app/util/service/notification.service';

@Injectable({ providedIn: 'root' })
export class FamilyService {

  private readonly FAMILIES_COL = 'family-groups';
  private readonly MEMBERS_COL = 'family-members';
  private readonly TRANSACTIONS_COL = 'family-transactions';

  constructor(
    private firestore: Firestore,
    private auth: Auth,
    private notificationService: NotificationService,
  ) {}

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

    const inviteCode = this.generateInviteCode();
    const familyData: Omit<Family, 'id'> = {
      name: request.name,
      ownerUserId: user.uid,
      inviteCode,
      currency: request.currency || 'INR',
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
    };

    const ref = await addDoc(collection(this.firestore, this.FAMILIES_COL), familyData);

    // Add creator as admin member
    await addDoc(collection(this.firestore, this.MEMBERS_COL), {
      familyId: ref.id,
      userId: user.uid,
      email: user.email || '',
      displayName: user.displayName || user.email?.split('@')[0] || 'Owner',
      photoURL: user.photoURL || '',
      role: 'admin',
      joinedAt: new Date(),
      isActive: true,
    } as Omit<FamilyMember, 'id'>);

    return { id: ref.id, ...familyData };
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

    // Check if already a member
    const existing = await this.getMembershipRecord(family.id!, user.uid);
    if (existing) {
      if (existing.isActive) {
        throw new Error('You are already a member of this family.');
      }
      // Reactivate membership
      await updateDoc(doc(this.firestore, this.MEMBERS_COL, existing.id!), { isActive: true, joinedAt: new Date() });
    } else {
      await addDoc(collection(this.firestore, this.MEMBERS_COL), {
        familyId: family.id!,
        userId: user.uid,
        email: user.email || '',
        displayName: user.displayName || user.email?.split('@')[0] || 'Member',
        photoURL: user.photoURL || '',
        role: 'member',
        joinedAt: new Date(),
        isActive: true,
      } as Omit<FamilyMember, 'id'>);
    }

    return family;
  }

  async getMyFamily(): Promise<Family | null> {
    const user = this.currentUser;
    if (!user) return null;

    const membersRef = collection(this.firestore, this.MEMBERS_COL);
    const q = query(membersRef, where('userId', '==', user.uid), where('isActive', '==', true));
    const snap = await getDocs(q);

    if (snap.empty) return null;

    const memberData = snap.docs[0].data() as FamilyMember;
    const familySnap = await getDoc(doc(this.firestore, this.FAMILIES_COL, memberData.familyId));

    if (!familySnap.exists()) return null;
    const family = { id: familySnap.id, ...familySnap.data() as Omit<Family, 'id'> };
    return family.isActive ? family : null;
  }

  async getFamily(familyId: string): Promise<Family | null> {
    const snap = await getDoc(doc(this.firestore, this.FAMILIES_COL, familyId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() as Omit<Family, 'id'> };
  }

  private async getMembershipRecord(familyId: string, userId: string): Promise<FamilyMember | null> {
    const q = query(
      collection(this.firestore, this.MEMBERS_COL),
      where('familyId', '==', familyId),
      where('userId', '==', userId)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() as Omit<FamilyMember, 'id'> };
  }

  // ─── Members ──────────────────────────────────────────────────────────────

  getMembers(familyId: string): Observable<FamilyMember[]> {
    const q = query(
      collection(this.firestore, this.MEMBERS_COL),
      where('familyId', '==', familyId),
      where('isActive', '==', true)
    );
    return from(getDocs(q)).pipe(
      map(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as FamilyMember))),
      catchError(() => of([]))
    );
  }

  async removeMember(familyId: string, memberId: string): Promise<void> {
    await updateDoc(doc(this.firestore, this.MEMBERS_COL, memberId), { isActive: false });
    this.notificationService.success('Member removed successfully');
  }

  async leaveFamily(familyId: string): Promise<void> {
    const user = this.currentUser;
    if (!user) return;
    const record = await this.getMembershipRecord(familyId, user.uid);
    if (record?.id) {
      await updateDoc(doc(this.firestore, this.MEMBERS_COL, record.id), { isActive: false });
    }
  }

  async updateMemberRole(memberId: string, role: 'admin' | 'member'): Promise<void> {
    await updateDoc(doc(this.firestore, this.MEMBERS_COL, memberId), { role });
    this.notificationService.success('Role updated');
  }

  // ─── Transactions ─────────────────────────────────────────────────────────

  getTransactions(familyId: string): Observable<FamilyTransaction[]> {
    const q = query(
      collection(this.firestore, this.TRANSACTIONS_COL),
      where('familyId', '==', familyId),
      orderBy('date', 'desc')
    );
    return from(getDocs(q)).pipe(
      map(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as FamilyTransaction))),
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

    const ref = await addDoc(collection(this.firestore, this.TRANSACTIONS_COL), txData);
    return { id: ref.id, ...txData };
  }

  async updateTransaction(txId: string, request: UpdateFamilyTransactionRequest): Promise<void> {
    const updateData: any = { updatedAt: new Date() };
    if (request.amount !== undefined) updateData.amount = request.amount;
    if (request.type) updateData.type = request.type;
    if (request.category) updateData.category = request.category;
    if (request.date) updateData.date = request.date;
    if (request.note !== undefined) updateData.note = request.note;

    await updateDoc(doc(this.firestore, this.TRANSACTIONS_COL, txId), updateData);
  }

  async deleteTransaction(txId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, this.TRANSACTIONS_COL, txId));
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
