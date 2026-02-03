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


export const defaultCategoriesForNewUser: Category[] = [
  // Income Categories
  {
    name: 'Salary',
    type: TransactionType.INCOME,
    color: '#46777f',
    icon: 'work',
    createdAt: Date.now(),
  },
  {
    name: 'Freelance',
    type: TransactionType.INCOME,
    color: '#46777f',
    icon: 'computer',
    createdAt: Date.now(),
  },
  {
    name: 'Investments',
    type: TransactionType.INCOME,
    color: '#46777f',
    icon: 'trending_up',
    createdAt: Date.now(),
  },
  {
    name: 'Gifts & Rewards',
    type: TransactionType.INCOME,
    color: '#46777f',
    icon: 'card_giftcard',
    createdAt: Date.now(),
  },
  {
    name: 'Other Income',
    type: TransactionType.INCOME,
    color: '#46777f',
    icon: 'attach_money',
    createdAt: Date.now(),
  },

  // Expense Categories
  {
    name: 'Food & Dining',
    type: TransactionType.EXPENSE,
    color: '#46777f',
    icon: 'restaurant',
    createdAt: Date.now(),
  },
  {
    name: 'Transport & Fuel',
    type: TransactionType.EXPENSE,
    color: '#46777f',
    icon: 'directions_car',
    createdAt: Date.now(),
  },
  {
    name: 'Shopping',
    type: TransactionType.EXPENSE,
    color: '#46777f',
    icon: 'shopping_cart',
    createdAt: Date.now(),
  },
  {
    name: 'Bills & Utilities',
    type: TransactionType.EXPENSE,
    color: '#46777f',
    icon: 'receipt_long',
    createdAt: Date.now(),
  },
  {
    name: 'Healthcare',
    type: TransactionType.EXPENSE,
    color: '#46777f',
    icon: 'local_hospital',
    createdAt: Date.now(),
  },
  {
    name: 'Entertainment',
    type: TransactionType.EXPENSE,
    color: '#46777f',
    icon: 'sports_esports',
    createdAt: Date.now(),
  },
  {
    name: 'Education',
    type: TransactionType.EXPENSE,
    color: '#46777f',
    icon: 'school',
    createdAt: Date.now(),
  },
  {
    name: 'Travel',
    type: TransactionType.EXPENSE,
    color: '#46777f',
    icon: 'flight',
    createdAt: Date.now(),
  },
  {
    name: 'Family & Kids',
    type: TransactionType.EXPENSE,
    color: '#46777f',
    icon: 'family_restroom',
    createdAt: Date.now(),
  },
  {
    name: 'Charity',
    type: TransactionType.EXPENSE,
    color: '#46777f',
    icon: 'volunteer_activism',
    createdAt: Date.now(),
  },
  {
    name: 'Other Expenses',
    type: TransactionType.EXPENSE,
    color: '#46777f',
    icon: 'category',
    createdAt: Date.now(),
  },
];
