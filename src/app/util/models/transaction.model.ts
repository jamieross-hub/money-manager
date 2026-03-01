import { Timestamp } from '@angular/fire/firestore';
import {
  TransactionType,
  RecurringInterval,
  SyncStatus,
  TransactionStatus,
  PaymentMethod,
} from '../config/enums';

/**
 * Common audit metadata
 */
export interface Auditable {
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
  createdBy: string;
  updatedBy: string;
}

export interface Timestamped {
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Common recurrence fields
 */
export interface RecurrenceInfo {
  isRecurring?: boolean;
  recurringInterval?: RecurringInterval | null;
  recurringEndDate?: Date | Timestamp | null;
  nextOccurrence?: Date | Timestamp | null;
}

/**
 * Optional breakdown of multiple tax components (e.g., CGST, SGST)
 */
export interface TaxComponent {
  name: string;     // e.g., "CGST"
  rate: number;     // e.g., 9
  amount: number;   // e.g., 45
}

/**
 * Represents a single member's share in a split transaction
 */
export interface SplitBetweenMember {
  userId: string;
  displayName: string;
  photoURL?: string;
  /** Percentage (0-100) of the transaction this member owes */
  percentage: number;
  /** Computed amount this member owes */
  amount: number;
}

/**
 * Represents a single member who paid part of the bill
 */
export interface PaidByMember {
  userId: string;
  displayName: string;
  photoURL?: string;
  amount: number;
}

/**
 * Extra data stored on a transaction when the group mode is 'split'
 */
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

/**
 * Base transaction interface
 */
export interface Transaction extends Auditable, RecurrenceInfo {
  id?: string;
  userId: string;
  accountId?: string; // Optional for family transactions
  categoryId: string;
  category: string;
  payee?: string;
  amount: number;
  type: TransactionType;
  date: Date | Timestamp;
  notes?: string;
  status: TransactionStatus;
  paymentMethod?: PaymentMethod;
  tags?: string[];
  isSplitTransaction?: boolean;
  splitGroupId?: string;
  fromAccountId?: string;
  toAccountId?: string;

  // Family related fields
  familyId?: string;
  userDisplayName?: string;
  userPhotoURL?: string;
  /** Present only when the group mode is 'split' */
  splitData?: SplitTransactionData;

  // Category split support
  isCategorySplit?: boolean;
  categorySplits?: CategorySplit[];
  totalSplitAmount?: number;

  // Tax support
  taxAmount?: number;       // total tax amount (optional)
  taxPercentage?: number;   // tax percent (optional)
  taxes?: TaxComponent[];   // detailed breakdown (optional)

  // Offline sync properties
  syncStatus: SyncStatus;
  isPending?: boolean;
  lastSyncedAt?: Date | Timestamp;

  // Settlement link (set when this transaction was auto-created from a settlement)
  settlementId?: string;
  settlementFamilyId?: string;
  /** userId of the person who PAID in the settlement link */
  settlementFromUserId?: string;
  /** userId of the person who RECEIVED in the settlement link */
  settlementToUserId?: string;

  // view properties
  _isUpcoming?: boolean;
  note?: string; // Compatibility with family 'note' field
  _categoryColor?: string;
  _categoryIcon?: string;
  _categoryName?: string;
  _categoryBgColor?: string;
  _accountName?: string;
  _accountType?: string;
  _dateDisplay?: string;
  _timeDisplay?: string;
  _fullTransactionDateDisplay?: string;
  _syncStatusColor?: string;
  _syncStatusIcon?: string;
  _syncStatusInfo?: string;
  _recurringInfo?: string;
  _isIncome?: boolean;
  _createdAtDisplay?: string;
  _updatedAtDisplay?: string;
  _dueStatus?: string;
  _isOverdue?: boolean;
}

/**
 * Base transaction input interface
 */
export interface TransactionBaseRequest {
  accountId?: string; // Optional for family transactions
  familyId?: string;  // Optional for personal transactions
  categoryId: string;
  category?: string;  // Sometimes we send name instead of ID or both
  payee?: string;
  amount: number;
  type: TransactionType;
  date: Date;
  notes?: string;
  note?: string;      // Compatibility with family 'note' field
  paymentMethod?: PaymentMethod;
  tags?: string[];
  isRecurring?: boolean;
  recurringInterval?: RecurringInterval;
  recurringEndDate?: Date;

  // Family split support
  splitData?: SplitTransactionData;
  userDisplayName?: string;
  userPhotoURL?: string;

  // Optional tax fields
  taxAmount?: number;
  taxPercentage?: number;
  taxes?: TaxComponent[];

  // Settlement link fields
  settlementId?: string;
  settlementFamilyId?: string;
  settlementFromUserId?: string;
  settlementToUserId?: string;
}

/**
 * Transaction creation request
 */
export interface CreateTransactionRequest extends TransactionBaseRequest {}

/**
 * Transaction update request
 */
export interface UpdateTransactionRequest extends Partial<TransactionBaseRequest> {
  status?: TransactionStatus;
}

/**
 * Transaction filter interface
 */
export interface TransactionFilter {
  accountIds?: string[];
  categoryIds?: string[];
  types?: TransactionType[];
  dateFrom?: Date;
  dateTo?: Date;
  amountMin?: number;
  amountMax?: number;
  payee?: string;
  tags?: string[];
  status?: TransactionStatus[];
  paymentMethods?: PaymentMethod[];
  isRecurring?: boolean;
}

/**
 * Transaction sort options
 */
export interface TransactionSort {
  field: keyof Transaction;
  direction: 'asc' | 'desc';
}

/**
 * Transaction query parameters
 */
export interface TransactionQueryParams {
  filter?: TransactionFilter;
  sort?: TransactionSort;
  page?: number;
  pageSize?: number;
  includeDeleted?: boolean;
}

/**
 * Transaction summary statistics
 */
export interface TransactionSummary {
  totalIncome: number;
  totalExpense: number;
  netAmount: number;
  transactionCount: number;
  averageAmount: number;
  largestTransaction: number;
  smallestTransaction: number;

  totalTax?: number; // NEW
}

/**
 * Transaction category summary
 */
export interface CategorySummary {
  categoryId: string;
  categoryName: string;
  totalAmount: number;
  transactionCount: number;
  percentage: number;
}

/**
 * Transaction trend data
 */
export interface TransactionTrend {
  period: string;
  income: number;
  expense: number;
  netAmount: number;
  transactionCount: number;
}

/**
 * Recurring transaction template
 */
export interface RecurringTransactionTemplate extends Timestamped {
  id: string;
  userId: string;
  accountId: string;
  categoryId: string;
  payee?: string;
  amount: number;
  type: TransactionType;
  interval: RecurringInterval;
  startDate: Timestamp;
  endDate?: Timestamp;
  isActive: boolean;
  lastProcessed?: Timestamp;
  nextOccurrence: Timestamp;
  notes?: string;
  paymentMethod?: PaymentMethod;
  tags?: string[];
}

/**
 * Bulk transaction import result
 */
export interface BulkImportResult {
  success: number;
  failed: number;
  errors: Array<{
    row: number;
    error: string;
    data: any;
  }>;
  importedTransactions: Transaction[];
}

/**
 * Transaction export options
 */
export interface TransactionExportOptions {
  format: 'csv' | 'pdf' | 'excel' | 'json';
  filter?: TransactionFilter;
  sort?: TransactionSort;
  includeMetadata?: boolean;
  dateFormat?: string;
  currencyFormat?: string;
}

/**
 * Transaction reconciliation data
 */
export interface TransactionReconciliation {
  transactionId: string;
  reconciledAt: Timestamp;
  reconciledBy: string;
  reconciliationNotes?: string;
  bankStatementReference?: string;
}

/**
 * Transaction attachment
 */
export interface TransactionAttachment {
  id: string;
  transactionId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  url: string;
  uploadedAt: Timestamp;
  uploadedBy: string;
}

/**
 * Transaction audit log entry
 */
export interface TransactionAuditLog {
  id: string;
  transactionId: string;
  action: 'created' | 'updated' | 'deleted' | 'reconciled';
  userId: string;
  timestamp: Timestamp;
  changes?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  metadata?: Record<string, any>;
}

/**
 * Individual category split within a transaction
 */
export interface CategorySplit {
  categoryId: string;
  categoryName: string;
  amount: number;
  percentage: number;
  notes?: string;
}

/**
 * Category split transaction interface
 */
export interface CategorySplitTransaction extends Transaction {
  isCategorySplit: boolean;
  categorySplits: CategorySplit[];
  totalSplitAmount: number;
}
