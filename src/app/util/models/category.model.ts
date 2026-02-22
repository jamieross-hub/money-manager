import { Timestamp } from '@angular/fire/firestore';
import { TransactionType } from '../config/enums';

export interface Category {
  id?: string;
  name: string;
  type: TransactionType;
  icon: string;
  color: string;
  createdAt: number;
  budget?: Budget;
  parentCategoryId?: string;
  isSubCategory?: boolean;
  subCategories?: Array<string>;
  group?: string;
  isSystem?: boolean;
}

export interface Budget {
  hasBudget?: boolean;
  budgetAmount?: number;
  budgetPeriod?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  budgetStartDate?: Date | Timestamp; // timestamp
  budgetEndDate?: Date | Timestamp; // timestamp
  budgetAlertThreshold?: number; // percentage (e.g., 80 for 80%)
  budgetAlertEnabled?: boolean;
}


