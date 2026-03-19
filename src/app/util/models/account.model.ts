import { Timestamp } from "@angular/fire/firestore";
import { AccountType, SyncStatus } from "../config/enums";

/**
 * Loan Account interface for loan-specific properties
 */
export interface LoanAccount {
  id: string;
  userId: string;
  lenderName: string;
  loanAmount: number;
  interestRate: number; // Annual Interest (%)
  startDate: Date;
  durationMonths: number; // Loan term
  repaymentFrequency: 'monthly' | 'weekly';
  status: 'active' | 'closed' | 'defaulted';
  totalPaid?: number;
  remainingBalance?: number;
  nextDueDate: Date;
  showReminder: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Credit Card Account interface for credit card-specific properties
 */
export interface CreditCardDetails {
  dueDate: number; // Day of month when payment is due (1-31)
  billingCycleStart: number; // Day of month when billing cycle starts (1-31)
  creditLimit: number;
  minimumPayment: number;
  showReminder: boolean;
  nextDueDate?: Date; // Calculated next due date
  nextBillingDate?: Date; // Calculated next billing date
}

/**
 * Account interface representing a financial account in the system
 */
export interface Account {
	accountId: string;
	userId: string;
	name: string;
	type: AccountType;
	balance: number;
	createdAt: Timestamp | Date;
	updatedAt?: Timestamp | Date;
	description?: string;
	accountNumber?: string;
	institution?: string;
	currency?: string;
	isActive?: boolean;
	icon?: string;
	color?: string;
	lastSyncAt?: Timestamp | Date;
	syncStatus?: SyncStatus;
	familyId: string;
	// Loan-specific properties (only used when type is 'loan')
	loanDetails?: LoanDetails;
	// Credit card-specific properties (only used when type is 'credit')
	creditCardDetails?: CreditCardDetails;
}
export interface LoanDetails {
	lenderName: string;
	loanAmount: number;
	interestRate: number;
	startDate: Date;
	durationMonths: number;
	repaymentFrequency: 'monthly' | 'weekly';
	status: 'active' | 'closed' | 'defaulted';
	totalPaid?: number;
	remainingBalance?: number;
	nextDueDate: Date;
	showReminder: boolean;
	monthlyPayment: number;
	endDate: Date;
}

/**
 * Account creation interface for creating new accounts
 */
export interface CreateAccountRequest {
	name: string;
	type: AccountType;
	balance: number;
	description?: string;
	accountNumber?: string;
	institution?: string;
	currency?: string;
}

/**
 * Account update interface for updating existing accounts
 */
export interface UpdateAccountRequest {
	name?: string;
	type?: AccountType;
	balance?: number;
	description?: string;
	accountNumber?: string;
	institution?: string;
	currency?: string;
	isActive?: boolean;
} 