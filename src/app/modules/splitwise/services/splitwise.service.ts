import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, catchError, mergeMap } from 'rxjs/operators';
import { Firestore, collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, setDoc, query, where, orderBy, limit, writeBatch } from '@angular/fire/firestore';
import { Timestamp } from '@angular/fire/firestore';
import { Auth, User } from '@angular/fire/auth';
import { SyncStatus } from '../../../util/config/enums';

import {
  SplitwiseGroup,
  GroupInvitation,
  SplitTransaction,
  SplitSettlement,
  CreateGroupRequest,
  AddMemberRequest,
  CreateSplitTransactionRequest,
  GroupMember,
  GroupMemberRole,
  MemberBalance,
  SettlementStatus,
  CreateSettlementRequest,
  GroupSummary,
  InvitationStatus,
  TransactionSplit,
  UpdateGroupRequest,
  UpdateSplitTransactionRequest
} from '../../../util/models/splitwise.model';
import { NotificationService } from 'src/app/util/service/notification.service';
import { DateService } from 'src/app/util/service/date.service';
import { UserService } from 'src/app/util/service/db/user.service';
import { HapticFeedbackService } from 'src/app/util/service/haptic-feedback.service';
import { LocalIndexDBStorageService } from 'src/app/util/service/indexdb-storage.service';
import { LocalStorageKeyHelper } from 'src/app/util/models/local-storage.model';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import * as SplitwiseActions from '../store/splitwise.actions';
import * as SplitwiseSelectors from '../store/splitwise.selectors';
import { tap } from 'rxjs/operators';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root'
})
export class SplitwiseService {

  constructor(
    private firestore: Firestore,
    private auth: Auth,
    private notificationService: NotificationService,
    private dateService: DateService,
    private userService: UserService,
    private hapticFeedback: HapticFeedbackService,
    private storageService: LocalIndexDBStorageService,
    private store: Store<AppState>
  ) { }

  // Groups - Store-based
  getUserGroups(userId: string): Observable<SplitwiseGroup[]> {
    if (userId === 'offline-guest') return of([]);
    return this.store.select(SplitwiseSelectors.selectGroups);
  }

  /**
   * Pull Splitwise groups from Firestore
   */
  pullGroupsFromFirestore(userId: string): Observable<void> {
    const currentUser = this.auth.currentUser;
    if (!currentUser?.email) return of(undefined);

    const groupsRef = collection(this.firestore, 'splitwise-groups');
    const q = query(groupsRef, where('isActive', '==', true), orderBy('createdAt', 'desc'));

    console.log(`[SplitwiseService] Pulling groups for user: ${userId}`);

    return from(getDocs(q)).pipe(
      tap(snapshot => {
        const groups = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as SplitwiseGroup))
          .filter(group =>
            group.members.some(member =>
              member.email.toLowerCase() === currentUser.email?.toLowerCase() && member.isActive
            )
          );

        console.log(`[SplitwiseService] Pulled ${groups.length} groups`);

        this.storageService.setItem(LocalStorageKeyHelper.getSplitwiseGroupsCacheKey(userId), groups);
        this.store.dispatch(SplitwiseActions.loadGroupsSuccess({ groups }));
      }),
      map(() => undefined),
      catchError(error => {
        console.error('[SplitwiseService] Groups pull failed:', error);
        return of(undefined);
      })
    );
  }

  getGroupById(groupId: string): Promise<SplitwiseGroup | null> {
    return getDoc(doc(this.firestore, 'splitwise-groups', groupId)).then(doc => {
      if (doc.exists()) {
        return { id: doc.id, ...doc.data() } as SplitwiseGroup;
      }
      return null;
    });
  }

  createGroup(request: CreateGroupRequest, userId: string): Observable<SplitwiseGroup> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const groupData: Omit<SplitwiseGroup, 'id'> = {
      name: request.name,
      description: request.description || '',
      createdBy: userId,
      members: [{
        userId: currentUser.uid,
        email: currentUser.email || '',
        displayName: currentUser.displayName || currentUser.email || '',
        photoURL: currentUser.photoURL || '',
        role: GroupMemberRole.ADMIN,
        joinedAt: new Date(),
        isActive: true
      }],
      currency: request.currency || 'USD',
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      syncStatus: SyncStatus.SYNCED
    };

    const groupsRef = collection(this.firestore, 'splitwise-groups');
    return from(addDoc(groupsRef, groupData)).pipe(
      map(docRef => ({
        id: docRef.id,
        ...groupData
      } as SplitwiseGroup))
    );
  }

  deleteGroup(groupId: string, userId: string): Observable<void> {
    const groupRef = doc(this.firestore, 'splitwise-groups', groupId);
    return from(updateDoc(groupRef, {
      isActive: false,
      updatedAt: new Date()
    }));
  }

  // Invitations - Store-based
  getUserInvitations(userId: string): Observable<GroupInvitation[]> {
    if (userId === 'offline-guest') return of([]);
    return this.store.select(SplitwiseSelectors.selectInvitations);
  }

  /**
   * Pull invitations from Firestore
   */
  pullInvitationsFromFirestore(userId: string): Observable<void> {
    const currentUser = this.auth.currentUser;
    if (!currentUser?.email) return of(undefined);

    const invitationsRef = collection(this.firestore, 'splitwise-invitations');
    const q = query(
      invitationsRef,
      where('invitedEmail', '==', currentUser.email),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );

    console.log(`[SplitwiseService] Pulling invitations for user: ${userId}`);

    return from(getDocs(q)).pipe(
      tap(snapshot => {
        const invitations = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as GroupInvitation))
          .filter(invitation => !this.isInvitationExpired(invitation));

        console.log(`[SplitwiseService] Pulled ${invitations.length} invitations`);
        this.store.dispatch(SplitwiseActions.loadInvitationsSuccess({ invitations }));
      }),
      map(() => undefined),
      catchError(error => {
        console.error('[SplitwiseService] Invitations pull failed:', error);
        return of(undefined);
      })
    );
  }

  /**
   * Check if invitation is expired
   */
  private isInvitationExpired(invitation: GroupInvitation): boolean {
    let expiresAt: Date;

    if (invitation.expiresAt instanceof Timestamp) {
      expiresAt = invitation.expiresAt.toDate();
    } else if (invitation.expiresAt instanceof Date) {
      expiresAt = invitation.expiresAt;
    } else {
      expiresAt = new Date(invitation.expiresAt);
    }

    return expiresAt < new Date();
  }

  /**
   * Mark expired invitations as expired
   */
  async markExpiredInvitations(userId: string): Promise<void> {
    try {
      const currentUser = this.auth.currentUser;
      if (!currentUser?.email) return;

      // Use only common invitations collection
      const invitationsRef = collection(this.firestore, 'splitwise-invitations');
      const q = query(
        invitationsRef,
        where('invitedEmail', '==', currentUser.email),
        where('status', '==', 'pending')
      );

      const snapshot = await getDocs(q);
      const batch = writeBatch(this.firestore);
      let hasUpdates = false;

      snapshot.docs.forEach(doc => {
        const invitation = doc.data() as GroupInvitation;
        if (this.isInvitationExpired(invitation)) {
          batch.update(doc.ref, {
            status: InvitationStatus.EXPIRED,
            updatedAt: new Date()
          });
          hasUpdates = true;
        }
      });

      if (hasUpdates) {
        await batch.commit();
      }
    } catch (error) {
      console.error('Error marking expired invitations:', error);
    }
  }

  async acceptInvitation(invitationId: string, userId: string): Promise<void> {
    try {
      const currentUser = this.auth.currentUser;
      if (!currentUser) throw new Error('User not authenticated');

      // Get the invitation from common collection
      const invitationRef = doc(this.firestore, 'splitwise-invitations', invitationId);
      const invitationDoc = await getDoc(invitationRef);

      if (!invitationDoc.exists()) {
        throw new Error('Invitation not found');
      }

      const invitation = invitationDoc.data() as GroupInvitation;

      // Update invitation status
      await updateDoc(invitationRef, {
        status: InvitationStatus.ACCEPTED,
        updatedAt: new Date()
      });

      // Get the group from the common collection
      const groupRef = doc(this.firestore, 'splitwise-groups', invitation.groupId);
      const groupDoc = await getDoc(groupRef);

      if (!groupDoc.exists()) {
        throw new Error('Group not found');
      }

      const group = groupDoc.data() as SplitwiseGroup;

      // Update the member status in the common group
      const updatedMembers = group.members.map(member => {
        if (member.email.toLowerCase() === invitation.invitedEmail.toLowerCase()) {
          return {
            ...member,
            userId: currentUser.uid,
            displayName: currentUser.displayName || currentUser.email?.split('@')[0] || member.displayName,
            photoURL: currentUser.photoURL || member.photoURL,
            isActive: true
          };
        }
        return member;
      });

      await updateDoc(groupRef, {
        members: updatedMembers,
        updatedAt: new Date()
      });

      this.notificationService.success(`Successfully joined ${invitation.groupName}!`);

    } catch (error) {
      console.error('Error accepting invitation:', error);
      this.notificationService.error('Failed to accept invitation');
      throw error;
    }
  }

  async declineInvitation(invitationId: string, userId: string): Promise<void> {
    try {
      const currentUser = this.auth.currentUser;
      if (!currentUser) throw new Error('User not authenticated');

      // Get the invitation from common collection
      const invitationRef = doc(this.firestore, 'splitwise-invitations', invitationId);
      const invitationDoc = await getDoc(invitationRef);

      if (!invitationDoc.exists()) {
        throw new Error('Invitation not found');
      }

      const invitation = invitationDoc.data() as GroupInvitation;

      // Update invitation status
      await updateDoc(invitationRef, {
        status: InvitationStatus.DECLINED,
        updatedAt: new Date()
      });

      // Remove the member from the common group
      const groupRef = doc(this.firestore, 'splitwise-groups', invitation.groupId);
      const groupDoc = await getDoc(groupRef);

      if (groupDoc.exists()) {
        const group = groupDoc.data() as SplitwiseGroup;
        const updatedMembers = group.members.filter(member =>
          member.email.toLowerCase() !== invitation.invitedEmail.toLowerCase()
        );

        await updateDoc(groupRef, {
          members: updatedMembers,
          updatedAt: new Date()
        });
      }

      this.notificationService.success(`Invitation to ${invitation.groupName} declined`);

    } catch (error) {
      console.error('Error declining invitation:', error);
      this.notificationService.error('Failed to decline invitation');
      throw error;
    }
  }

  // Members
  async addMemberToGroup(groupId: string, request: AddMemberRequest, userId: string): Promise<SplitwiseGroup> {
    try {
      const currentUser = this.auth.currentUser;
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // Get the group from common collection
      const groupRef = doc(this.firestore, 'splitwise-groups', groupId);
      const groupDoc = await getDoc(groupRef);

      if (!groupDoc.exists()) {
        throw new Error('Group not found');
      }

      const group = groupDoc.data() as SplitwiseGroup;

      // Check if user is already a member
      const existingMember = group.members.find(member =>
        member.email.toLowerCase() === request.email.toLowerCase()
      );

      if (existingMember) {
        throw new Error('User is already a member of this group');
      }

      // Find if the user exists in the system
      const targetUser = await this.userService.findUserByEmail(request.email);

      if (targetUser) {
        // User exists - send invitation
        await this.sendGroupInvitation(groupId, request.email, userId);

        // Add member to group with pending status
        const newMember: GroupMember = {
          userId: targetUser.uid,
          email: request.email,
          displayName: targetUser.firstName || targetUser.email?.split('@')[0] || request.email.split('@')[0],
          photoURL: targetUser.photoURL || '',
          role: request.role || GroupMemberRole.MEMBER,
          joinedAt: new Date(),
          isActive: false // Will be true when user accepts invitation
        };

        const updatedMembers = [...group.members, newMember];
        await updateDoc(groupRef, {
          members: updatedMembers,
          updatedAt: new Date()
        });

        this.notificationService.success(`Invitation sent to ${request.email}`);

        return { id: groupId, ...group, members: updatedMembers, updatedAt: new Date() } as SplitwiseGroup;
      } else {
        // User doesn't exist - add as pending member
        const newMember: GroupMember = {
          userId: '', // Will be set when user registers and accepts invitation
          email: request.email,
          displayName: request.email.split('@')[0],
          role: request.role || GroupMemberRole.MEMBER,
          joinedAt: new Date(),
          isActive: false
        };

        const updatedMembers = [...group.members, newMember];
        await updateDoc(groupRef, {
          members: updatedMembers,
          updatedAt: new Date()
        });

        // Send invitation for non-registered user
        await this.sendGroupInvitation(groupId, request.email, userId);

        this.notificationService.success(`Invitation sent to ${request.email}. They will be added when they register and accept.`);

        return { id: groupId, ...group, members: updatedMembers, updatedAt: new Date() } as SplitwiseGroup;
      }
    } catch (error) {
      console.error('Error adding member to group:', error);
      this.notificationService.error(error instanceof Error ? error.message : 'Failed to add member');
      throw error;
    }
  }

  // Transactions
  getGroupTransactions(groupId: string, userId: string): Observable<SplitTransaction[]> {
    const transactionsRef = collection(this.firestore, 'splitwise-transactions');
    const q = query(
      transactionsRef,
      where('groupId', '==', groupId),
      orderBy('createdAt', 'desc')
    );

    return from(getDocs(q)).pipe(
      map(snapshot => snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as SplitTransaction))),
      catchError(error => {
        console.error('Error fetching group transactions:', error);
        return of([]);
      })
    );
  }

  // Settlements
  getGroupSettlements(groupId: string, userId: string): Observable<SplitSettlement[]> {
    const settlementsRef = collection(this.firestore, 'splitwise-settlements');
    const q = query(
      settlementsRef,
      where('groupId', '==', groupId),
      orderBy('createdAt', 'desc')
    );

    return from(getDocs(q)).pipe(
      map(snapshot => snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as SplitSettlement))),
      catchError(error => {
        console.error('Error fetching group settlements:', error);
        return of([]);
      })
    );
  }

  /**
   * Get settlements by transaction ID
   */
  getSettlementsByTransaction(transactionId: string): Observable<SplitSettlement[]> {
    const settlementsRef = collection(this.firestore, 'splitwise-settlements');
    const q = query(
      settlementsRef,
      where('originalTransactionId', '==', transactionId),
      orderBy('createdAt', 'desc')
    );

    return from(getDocs(q)).pipe(
      map(snapshot => snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as SplitSettlement))),
      catchError(error => {
        console.error('Error fetching settlements by transaction:', error);
        return of([]);
      })
    );
  }

  // Split Transactions
  createSplitTransaction(request: CreateSplitTransactionRequest, userId: string): Observable<SplitTransaction> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const splitTransactionData: Omit<SplitTransaction, 'id'> = {
      groupId: request.groupId,
      originalTransactionId: request.originalTransactionId,
      amount: request.amount,
      createdBy: userId,
      splits: request.splits.map(split => ({
        ...split,
        email: split.email || '',
        displayName: split.displayName || '' // Will be populated from user data
      })),
      totalAmount: request.amount,
      currency: 'USD', // Default currency
      createdAt: new Date(),
      updatedAt: new Date(),
      syncStatus: SyncStatus.SYNCED
    };

    const transactionsRef = collection(this.firestore, 'splitwise-transactions');
    return from(addDoc(transactionsRef, splitTransactionData)).pipe(
      map(docRef => ({
        id: docRef.id,
        ...splitTransactionData
      } as SplitTransaction))
    );
  }


  /**
   * Get group by ID
   */
  getGroup(groupId: string): Observable<SplitwiseGroup | null> {
    return from(getDoc(doc(this.firestore, 'splitwise-groups', groupId))).pipe(
      map(doc => {
        if (doc.exists()) {
          return { id: doc.id, ...doc.data() } as SplitwiseGroup;
        }
        return null;
      })
    );
  }

  /**
   * Update group
   */
  async updateGroup(groupId: string, request: UpdateGroupRequest): Promise<void> {
    try {
      const userId = this.userService.getCurrentUserId();
      if (!userId) throw new Error('User not authenticated');

      const updateData: any = {
        updatedAt: new Date()
      };

      if (request.name) updateData.name = request.name;
      if (request.description !== undefined) updateData.description = request.description;
      if (request.currency) updateData.currency = request.currency;

      await updateDoc(doc(this.firestore, 'splitwise-groups', groupId), updateData);

      this.notificationService.success('Group updated successfully');
    } catch (error) {
      console.error('Error updating group:', error);
      this.notificationService.error('Failed to update group');
      throw error;
    }
  }

  // ==================== MEMBER MANAGEMENT ====================


  /**
   * Remove member from group
   */
  async removeMemberFromGroup(groupId: string, memberUserId: string, userId: string): Promise<void> {
    try {
      if (!userId) throw new Error('User not authenticated');

      const groupRef = doc(this.firestore, 'splitwise-groups', groupId);
      const groupDoc = await getDoc(groupRef);

      if (!groupDoc.exists()) {
        throw new Error('Group not found');
      }

      const groupData = groupDoc.data() as SplitwiseGroup;
      const updatedMembers = groupData.members.filter(member => member.userId !== memberUserId);

      await updateDoc(groupRef, {
        members: updatedMembers,
        updatedAt: new Date()
      });

      this.notificationService.success('Member removed successfully');
    } catch (error) {
      console.error('Error removing member:', error);
      this.notificationService.error('Failed to remove member');
      throw error;
    }
  }


  /**
   * Get split transaction by ID
   */
  getSplitTransaction(transactionId: string): Observable<SplitTransaction | null> {
    return from(getDoc(doc(this.firestore, 'splitwise-transactions', transactionId))).pipe(
      map(doc => {
        if (doc.exists()) {
          return { id: doc.id, ...doc.data() } as SplitTransaction;
        }
        return null;
      })
    );
  }

  /**
   * Update split transaction
   */
  async updateSplitTransaction(transactionId: string, request: UpdateSplitTransactionRequest): Promise<void> {
    try {
      const userId = this.userService.getCurrentUserId();
      if (!userId) throw new Error('User not authenticated');

      const updateData: any = {
        updatedAt: new Date()
      };


      if (request.amount) updateData.amount = request.amount;
      if (request.type) updateData.type = request.type;
      if (request.date) updateData.date = this.dateService.toTimestamp(request.date);
      if (request.notes !== undefined) updateData.notes = request.notes;
      if (request.categoryId) updateData.categoryId = request.categoryId;
      if (request.category) updateData.category = request.category;

      if (request.splits) {
        // Get group for member details
        const transactionDoc = await getDoc(doc(this.firestore, 'splitwise-transactions', transactionId));
        if (!transactionDoc.exists()) {
          throw new Error('Transaction not found');
        }

        const transactionData = transactionDoc.data() as SplitTransaction;
        const groupDoc = await getDoc(doc(this.firestore, 'splitwise-groups', transactionData.groupId));
        const groupData = groupDoc.data() as SplitwiseGroup;

        const splitsWithDetails: TransactionSplit[] = request.splits.map(split => {
          const member = groupData.members.find(m => m.userId === split.userId);
          return {
            ...split,
            email: member?.email || '',
            displayName: member?.displayName || '',
            // Preserve the isPaid status from the request
            isPaid: split.isPaid !== undefined ? split.isPaid : false
          };
        });

        updateData.splits = splitsWithDetails;

        // Only update totalAmount if amount is provided
        if (request.amount) {
          updateData.totalAmount = request.amount;
        }

      }

      await updateDoc(doc(this.firestore, 'splitwise-transactions', transactionId), updateData);

      this.notificationService.success('Split transaction updated successfully');
    } catch (error) {
      console.error('Error updating split transaction:', error);
      this.notificationService.error('Failed to update split transaction');
      throw error;
    }
  }

  /**
   * Delete split transaction
   */
  async deleteSplitTransaction(transactionId: string, userId: string): Promise<void> {
    try {
      if (!userId) throw new Error('User not authenticated');

      const transactionDoc = query(
        collection(this.firestore, 'splitwise-transactions'),
        where('originalTransactionId', '==', transactionId)
      );



      const querySnapshot = await getDocs(transactionDoc);

      if (querySnapshot.empty) {
        throw new Error('Transaction not found');
      }

      const transactionData = querySnapshot.docs[0].data() as SplitTransaction;

      // Reverse member balances
      const reversedSplits = transactionData.splits.map(split => ({
        ...split,
        amount: -split.amount
      }));

      // Delete transaction
      await deleteDoc(querySnapshot.docs[0].ref);

      // Clean up related settlements
      await this.cleanupSettlementsForTransaction(transactionId);

      this.notificationService.success('Split transaction deleted successfully');
    } catch (error) {
      console.error('Error deleting split transaction:', error);
      this.notificationService.error('Failed to delete split transaction');
      throw error;
    }
  }

  /**
   * Clean up settlements related to a deleted transaction
   */
  private async cleanupSettlementsForTransaction(originalTransactionId: string): Promise<void> {
    try {
      const settlementsRef = collection(this.firestore, 'splitwise-settlements');
      const settlementsQuery = query(
        settlementsRef,
        where('originalTransactionId', '==', originalTransactionId)
      );

      const settlementsSnapshot = await getDocs(settlementsQuery);

      if (!settlementsSnapshot.empty) {
        const deletePromises = settlementsSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);

        console.log(`Cleaned up ${settlementsSnapshot.docs.length} settlements for transaction ${originalTransactionId}`);
      }
    } catch (error) {
      console.error('Error cleaning up settlements for transaction:', error);
      // Don't throw error here as the main transaction deletion should still succeed
    }
  }

  // ==================== SETTLEMENTS ====================

  /**
   * Create settlement
   */
  async createSettlement(request: CreateSettlementRequest): Promise<string> {
    try {
      const userId = this.userService.getCurrentUserId();
      if (!userId) throw new Error('User not authenticated');

      // Get group to get the currency
      const groupDoc = await getDoc(doc(this.firestore, 'splitwise-groups', request.groupId));
      if (!groupDoc.exists()) {
        throw new Error('Group not found');
      }
      const groupData = groupDoc.data() as SplitwiseGroup;

      const settlementData: Omit<SplitSettlement, 'id'> = {
        groupId: request.groupId,
        originalTransactionId: request.originalTransactionId,
        fromUserId: request.fromUserId,
        toUserId: request.toUserId,
        amount: request.amount,
        currency: groupData.currency || 'USD',
        status: SettlementStatus.PENDING,
        notes: request.notes || '',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const settlementRef = await addDoc(collection(this.firestore, 'splitwise-settlements'), settlementData);

      return settlementRef.id;
    } catch (error) {
      console.error('Error creating settlement:', error);
      throw error;
    }
  }

  /**
   * Complete settlement
   */
  async completeSettlement(settlementId: string): Promise<void> {
    try {
      const userId = this.userService.getCurrentUserId();
      if (!userId) throw new Error('User not authenticated');

      await updateDoc(doc(this.firestore, 'splitwise-settlements', settlementId), {
        status: SettlementStatus.COMPLETED,
        settledAt: new Date(),
        updatedAt: new Date()
      });

      // Log activity
      const settlementDoc = await getDoc(doc(this.firestore, 'splitwise-settlements', settlementId));
      const settlementData = settlementDoc.data() as SplitSettlement;


    } catch (error) {
      console.error('Error completing settlement:', error);
      throw error;
    }
  }

  // ==================== INVITATIONS ====================

  /**
   * Send group invitation
   */
  async sendGroupInvitation(groupId: string, email: string, inviterUserId: string): Promise<void> {
    try {
      const currentUser = this.auth.currentUser;
      if (!currentUser) throw new Error('User not authenticated');

      const groupDoc = await getDoc(doc(this.firestore, 'splitwise-groups', groupId));
      const groupData = groupDoc.data() as SplitwiseGroup;

      const invitationData: Omit<GroupInvitation, 'id'> = {
        groupId: groupId,
        groupName: groupData.name,
        invitedBy: inviterUserId,
        invitedByEmail: currentUser.email || '',
        invitedByDisplayName: currentUser.displayName || '',
        invitedEmail: email,
        status: InvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Always store invitations in the common collection
      await addDoc(collection(this.firestore, 'splitwise-invitations'), invitationData);

    } catch (error) {
      console.error('Error sending invitation:', error);
      throw error;
    }
  }



  // ==================== UTILITY METHODS ====================


  /**
   * Get group summary
   */
  async getGroupSummary(groupId: string): Promise<GroupSummary> {
    const userId = this.userService.getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    const [transactions, settlements] = await Promise.all([
      getDocs(query(
        collection(this.firestore, 'splitwise-transactions'),
        where('groupId', '==', groupId)
      )),
      getDocs(query(
        collection(this.firestore, 'splitwise-settlements'),
        where('groupId', '==', groupId),
        where('status', '==', SettlementStatus.PENDING)
      ))
    ]);

    const groupDoc = await getDoc(doc(this.firestore, 'splitwise-groups', groupId));
    const groupData = groupDoc.data() as SplitwiseGroup;

    const totalAmount = transactions.docs.reduce((sum, doc) => {
      const transaction = doc.data() as SplitTransaction;
      return sum + transaction.amount;
    }, 0);

    return {
      groupId: groupId,
      totalTransactions: transactions.docs.length,
      totalAmount: totalAmount,
      averageAmount: transactions.docs.length > 0 ? totalAmount / transactions.docs.length : 0,
      memberCount: groupData.members.length,
      activeMemberCount: groupData.members.filter(m => m.isActive).length,
      pendingSettlements: settlements.docs.length,
      lastActivity: new Date()
    };
  }

  /**
   * Get member balances for a group
   */
  async getMemberBalances(groupId: string): Promise<MemberBalance[]> {
    const userId = this.userService.getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    const groupDoc = await getDoc(doc(this.firestore, 'splitwise-groups', groupId));
    const groupData = groupDoc.data() as SplitwiseGroup;

    const transactions = await getDocs(query(
      collection(this.firestore, 'splitwise-transactions'),
      where('groupId', '==', groupId)
    ));

    const memberBalances = new Map<string, MemberBalance>();

    // Initialize member balances
    groupData.members.forEach(member => {
      memberBalances.set(member.userId, {
        userId: member.userId,
        email: member.email,
        displayName: member.displayName,
        totalPaid: 0,
        totalOwed: 0,
        netBalance: 0,
        transactionCount: 0
      });
    });

    // Calculate balances from transactions
    transactions.docs.forEach(doc => {
      const transaction = doc.data() as SplitTransaction;
      transaction.splits.forEach(split => {
        const balance = memberBalances.get(split.userId);
        if (balance) {
          balance.transactionCount++;
          if (split.amount > 0) {
            balance.totalPaid += split.amount;
          } else {
            balance.totalOwed += Math.abs(split.amount);
          }
          balance.netBalance = balance.totalPaid - balance.totalOwed;
        }
      });
    });

    return Array.from(memberBalances.values());
  }


  sharePWA() {
    this.hapticFeedback.buttonClick();

    const shareData = {
      title: 'Money Manager',
      text: 'Check out this amazing money management app!',
      url: `${environment.baseUrl}/#sign-in`
    };

    // Try to use Web Share API first
    if (navigator.share && navigator.canShare(shareData)) {
      navigator.share(shareData)
        .then(() => {
          console.log('Shared successfully');
        })
        .catch((error) => {
          console.log('Error sharing:', error);
          this.fallbackShare(shareData.url);
        });
    } else {
      // Fallback to clipboard copy
      this.fallbackShare(shareData.url);
    }
  }

  private fallbackShare(url: string) {
    // Copy to clipboard
    navigator.clipboard.writeText(url).then(() => {
      // Show success message (you might want to use a toast service here)
      alert('PWA link copied to clipboard!');
    }).catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        alert('PWA link copied to clipboard!');
      } catch (err) {
        alert('Failed to copy link. Please copy manually: ' + url);
      }
      document.body.removeChild(textArea);
    });
  }
} 