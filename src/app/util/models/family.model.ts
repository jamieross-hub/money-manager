import { Timestamp } from '@angular/fire/firestore';
import { TransactionStatus } from '../config/enums';
import { Transaction, SplitTransactionData, TransactionBaseRequest, UpdateTransactionRequest, SplitBetweenMember, PaidByMember } from './transaction.model';
export { SplitBetweenMember, PaidByMember };

// ─── Family ────────────────────────────────────────────────────────────────

export interface Family {
  id?: string;
  name: string;
  ownerUserId: string;
  inviteCode: string; // e.g. FAM-8K2Q
  // currency: string;
  mode?: 'common' | 'split';
  icon?: string; // emoji character or Data URL
  banner?: string; // Data URL or storage URL for header background
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
  isActive: boolean;
  memberIds?: string[]; // Array of user IDs for efficient membership querying
}

// ─── Family Member ─────────────────────────────────────────────────────────

export type FamilyMemberRole = 'admin' | 'member';

export interface FamilyMember {
  id?: string;
  familyId: string;
  userId: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: FamilyMemberRole;
  joinedAt: Date | Timestamp;
  isActive: boolean;
}

// ─── Family Transaction (Legacy/Compatibility) ──────────────────────────────

/** @deprecated Use Transaction from transaction.model instead */
export type FamilyTransaction = Transaction;

/** @deprecated Use TransactionType from enums instead */
export type FamilyTransactionType = 'income' | 'expense';

// ─── Computed Stats ────────────────────────────────────────────────────────

export interface FamilyMemberStats {
  userId: string;
  displayName: string;
  photoURL?: string;
  totalIncome: number;
  totalExpense: number;
  totalPaid: number;
  netBalance: number;
  transactionCount: number;
  isActive: boolean;
}

export interface FamilyStats {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  transactionCount: number;
  memberBreakdown: FamilyMemberStats[];
}

// ─── Requests ──────────────────────────────────────────────────────────────

export type FamilyMode = 'common' | 'split';

export interface CreateFamilyRequest {
  name: string;
  // currency: string;
  mode: FamilyMode;
  icon?: string; // emoji or Data URL from uploaded image
}

/** @deprecated Use CreateTransactionRequest from transaction.model instead */
export interface AddFamilyTransactionRequest extends TransactionBaseRequest {
  familyId: string;
}

/** @deprecated Use UpdateTransactionRequest from transaction.model instead */
export interface UpdateFamilyTransactionRequest extends UpdateTransactionRequest {}

// ─── Settlements ────────────────────────────────────────────────────────────

export type SettlementMethod = 'cash' | 'upi' | 'bank_transfer';

/** A payment made to settle a debt between two family members. */
export interface Settlement {
  id?: string;
  familyId: string;
  /** userId of the person who PAID (cleared their debt) */
  fromUserId: string;
  fromDisplayName: string;
  fromPhotoURL?: string;
  /** userId of the person who RECEIVED the money */
  toUserId: string;
  toDisplayName: string;
  toPhotoURL?: string;
  amount: number;
  method: SettlementMethod;
  note?: string;
  settledAt: Date | Timestamp;
  createdAt: Date | Timestamp;
  /** ID of the personal transfer transaction linked to this settlement */
  linkedTransactionId?: string;
}

export interface AddSettlementRequest {
  familyId: string;
  fromUserId: string;
  fromDisplayName: string;
  fromPhotoURL?: string;
  toUserId: string;
  toDisplayName: string;
  toPhotoURL?: string;
  amount: number;
  method: SettlementMethod;
  note?: string;
  /** ID of the personal transfer transaction linked to this settlement */
  linkedTransactionId?: string;
}

/**
 * Computed balance after netting split-expense shares against settlements.
 * Positive `amount` means `fromUserId` owes `toUserId` that amount.
 */
export interface BalanceEntry {
  fromUserId: string;
  fromDisplayName: string;
  fromPhotoURL?: string;
  toUserId: string;
  toDisplayName: string;
  toPhotoURL?: string;
  amount: number; // always > 0 after netting
}
