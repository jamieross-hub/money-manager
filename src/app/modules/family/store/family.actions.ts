import { createAction, props } from '@ngrx/store';
import {
  Family,
  FamilyMember,
  FamilyTransaction,
  CreateFamilyRequest,
  AddFamilyTransactionRequest,
  UpdateFamilyTransactionRequest,
} from 'src/app/util/models/family.model';

// ─── Load My Family ────────────────────────────────────────────────────────
export const loadMyFamily = createAction('[Family] Load My Family');
export const loadMyFamilySuccess = createAction('[Family] Load My Family Success', props<{ family: Family | null }>());
export const loadMyFamilyFailure = createAction('[Family] Load My Family Failure', props<{ error: string }>());

// ─── Load User Families ────────────────────────────────────────────────────
export const loadUserFamilies = createAction('[Family] Load User Families');
export const loadUserFamiliesSuccess = createAction('[Family] Load User Families Success', props<{ families: Family[] }>());
export const loadUserFamiliesFailure = createAction('[Family] Load User Families Failure', props<{ error: string }>());

// ─── Create Family ─────────────────────────────────────────────────────────
export const createFamily = createAction('[Family] Create Family', props<{ request: CreateFamilyRequest }>());
export const createFamilySuccess = createAction('[Family] Create Family Success', props<{ family: Family }>());
export const createFamilyFailure = createAction('[Family] Create Family Failure', props<{ error: string }>());

// ─── Join Family ───────────────────────────────────────────────────────────
export const joinFamily = createAction('[Family] Join Family', props<{ inviteCode: string }>());
export const joinFamilySuccess = createAction('[Family] Join Family Success', props<{ family: Family }>());
export const joinFamilyFailure = createAction('[Family] Join Family Failure', props<{ error: string }>());

// ─── Members ───────────────────────────────────────────────────────────────
export const loadMembers = createAction('[Family] Load Members', props<{ familyId: string }>());
export const loadMembersSuccess = createAction('[Family] Load Members Success', props<{ members: FamilyMember[] }>());
export const removeMember = createAction('[Family] Remove Member', props<{ familyId: string; memberId: string }>());
export const removeMemberSuccess = createAction('[Family] Remove Member Success', props<{ memberId: string }>());
export const updateMemberRole = createAction('[Family] Update Member Role', props<{ familyId: string; memberId: string; role: 'admin' | 'member' }>());
export const updateMemberRoleSuccess = createAction('[Family] Update Member Role Success', props<{ memberId: string; role: 'admin' | 'member' }>());

// ─── Transactions ──────────────────────────────────────────────────────────
export const loadTransactions = createAction('[Family] Load Transactions', props<{ familyId: string }>());
export const loadTransactionsSuccess = createAction('[Family] Load Transactions Success', props<{ transactions: FamilyTransaction[] }>());
export const addTransaction = createAction('[Family] Add Transaction', props<{ request: AddFamilyTransactionRequest }>());
export const addTransactionSuccess = createAction('[Family] Add Transaction Success', props<{ transaction: FamilyTransaction }>());
export const updateTransaction = createAction('[Family] Update Transaction', props<{ familyId: string; txId: string; request: UpdateFamilyTransactionRequest }>());
export const updateTransactionSuccess = createAction('[Family] Update Transaction Success', props<{ txId: string; request: UpdateFamilyTransactionRequest }>());
export const deleteTransaction = createAction('[Family] Delete Transaction', props<{ familyId: string; txId: string }>());
export const deleteTransactionSuccess = createAction('[Family] Delete Transaction Success', props<{ txId: string }>());

// ─── Error ─────────────────────────────────────────────────────────────────
export const clearError = createAction('[Family] Clear Error');
