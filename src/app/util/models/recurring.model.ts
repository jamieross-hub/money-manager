import { Timestamp } from '@angular/fire/firestore';
import { 
  TransactionType, 
  RecurringInterval, 

  SyncStatus
} from '../config/enums';
import { Auditable } from './transaction.model';

/**
 * Recurring Template model
 * Defines the blueprint for recurring transactions
 */
export interface RecurringTemplate extends Auditable {
  id?: string;
  userId: string;
  accountId?: string;
  categoryId: string;
  category: string;
  payee?: string;
  amount: number;
  type: TransactionType;
  categoryType: TransactionType;
  recurringInterval: RecurringInterval;
  recurringEndDate?: Date | Timestamp | null;
  nextOccurrence: Date | Timestamp;
  notes?: string;

  tags?: string[];
  isActive: boolean;
  isRecurring: boolean;
  syncStatus?: SyncStatus;
  
  // Last time a transaction was created from this template
  lastProcessedAt?: Date | Timestamp | null;
  
  // Optional family context if templates can be shared
  familyId?: string;
}
