import { Timestamp } from '@angular/fire/firestore';

// ─── Family ────────────────────────────────────────────────────────────────

export interface Family {
  id?: string;
  name: string;
  ownerUserId: string;
  inviteCode: string; // e.g. FAM-8K2Q
  // currency: string;
  mode?: 'common' | 'split';
  icon?: string; // emoji character or Data URL
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

// ─── Family Transaction ────────────────────────────────────────────────────

export type FamilyTransactionType = 'income' | 'expense';

/** Represents a single member's share in a split transaction */
export interface SplitBetweenMember {
  userId: string;
  displayName: string;
  photoURL?: string;
  /** Percentage (0-100) of the transaction this member owes */
  percentage: number;
  /** Computed amount this member owes */
  amount: number;
}

/** Represents a single member who paid part of the bill */
export interface PaidByMember {
  userId: string;
  displayName: string;
  photoURL?: string;
  amount: number;
}

/** Extra data stored on a transaction when the group mode is 'split' */
export interface SplitTransactionData {
  /** The userId of the member who paid the bill. If multiple people paid, this can be 'multiple' */
  paidByUserId: string;
  paidByDisplayName: string;
  paidByPhotoURL?: string;
  /** If multiple people paid, this contains the breakdown */
  paidBy?: PaidByMember[];
  /** Members sharing the expense */
  splitBetween: SplitBetweenMember[];
}

export interface FamilyTransaction {
  id?: string;
  familyId: string;
  userId: string;
  userDisplayName: string;
  userPhotoURL?: string;
  amount: number;
  type: FamilyTransactionType;
  category: string;
  date: Date | Timestamp;
  note?: string;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
  /** Present only when the group mode is 'split' */
  splitData?: SplitTransactionData;
}

// ─── Computed Stats ────────────────────────────────────────────────────────

export interface FamilyMemberStats {
  userId: string;
  displayName: string;
  photoURL?: string;
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  transactionCount: number;
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

export interface AddFamilyTransactionRequest {
  familyId: string;
  amount: number;
  type: FamilyTransactionType;
  category: string;
  date: Date;
  note?: string;
}

export interface UpdateFamilyTransactionRequest {
  amount?: number;
  type?: FamilyTransactionType;
  category?: string;
  date?: Date;
  note?: string;
}

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
