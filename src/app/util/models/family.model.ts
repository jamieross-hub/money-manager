import { Timestamp } from '@angular/fire/firestore';

// ─── Family ────────────────────────────────────────────────────────────────

export interface Family {
  id?: string;
  name: string;
  ownerUserId: string;
  inviteCode: string; // e.g. FAM-8K2Q
  currency: string;
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
  currency: string;
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
