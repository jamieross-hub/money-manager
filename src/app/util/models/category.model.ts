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
    color: '#10B981', // Emerald 500
    icon: 'work',
    createdAt: Date.now(),
  },
  {
    name: 'Freelance',
    type: TransactionType.INCOME,
    color: '#14B8A6', // Teal 500
    icon: 'computer',
    createdAt: Date.now(),
  },
  {
    name: 'Investments',
    type: TransactionType.INCOME,
    color: '#06B6D4', // Cyan 500
    icon: 'trending_up',
    createdAt: Date.now(),
  },
  {
    name: 'Gifts & Rewards',
    type: TransactionType.INCOME,
    color: '#D946EF', // Fuchsia 500
    icon: 'card_giftcard',
    createdAt: Date.now(),
  },
  {
    name: 'Other Income',
    type: TransactionType.INCOME,
    color: '#64748B', // Slate 500
    icon: 'attach_money',
    createdAt: Date.now(),
  },

  // Expense Categories
  {
    name: 'Food & Dining',
    type: TransactionType.EXPENSE,
    color: '#F59E0B', // Amber 500
    icon: 'restaurant',
    createdAt: Date.now(),
  },
  {
    name: 'Transport & Fuel',
    type: TransactionType.EXPENSE,
    color: '#F97316', // Orange 500
    icon: 'directions_car',
    createdAt: Date.now(),
  },
  {
    name: 'Shopping',
    type: TransactionType.EXPENSE,
    color: '#EC4899', // Pink 500
    icon: 'shopping_cart',
    createdAt: Date.now(),
  },
  {
    name: 'Bills & Utilities',
    type: TransactionType.EXPENSE,
    color: '#EF4444', // Red 500
    icon: 'receipt_long',
    createdAt: Date.now(),
  },
  {
    name: 'Healthcare',
    type: TransactionType.EXPENSE,
    color: '#0EA5E9', // Sky 500
    icon: 'local_hospital',
    createdAt: Date.now(),
  },
  {
    name: 'Entertainment',
    type: TransactionType.EXPENSE,
    color: '#8B5CF6', // Violet 500
    icon: 'sports_esports',
    createdAt: Date.now(),
  },
  {
    name: 'Education',
    type: TransactionType.EXPENSE,
    color: '#6366F1', // Indigo 500
    icon: 'school',
    createdAt: Date.now(),
  },
  {
    name: 'Travel',
    type: TransactionType.EXPENSE,
    color: '#3B82F6', // Blue 500
    icon: 'flight',
    createdAt: Date.now(),
  },
  {
    name: 'Family & Kids',
    type: TransactionType.EXPENSE,
    color: '#84CC16', // Lime 500
    icon: 'family_restroom',
    createdAt: Date.now(),
  },
  {
    name: 'Charity',
    type: TransactionType.EXPENSE,
    color: '#EAB308', // Yellow 500
    icon: 'volunteer_activism',
    createdAt: Date.now(),
  },
  {
    name: 'Other Expenses',
    type: TransactionType.EXPENSE,
    color: '#94A3B8', // Slate 400
    icon: 'category',
    createdAt: Date.now(),
  },
];
