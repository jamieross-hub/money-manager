import { Timestamp } from "@angular/fire/firestore";


/**
 * User interface representing a user in the system
 */
export interface User {
	uid: string;
	email: string;
	role: UserRole;
	createdAt: Date | Timestamp;
	firstName?: string;
	lastName?: string;
	phone?: string;
	dateOfBirth?: Date | Timestamp;
	occupation?: string;
	monthlyIncome?: number;
	preferences?: UserPreferences;
	updatedAt?: Date | Timestamp;
	lastLoginAt?: Date | Timestamp;
	loginCount?: number;
	photoURL?: string;
	emailVerified?: boolean;
	phoneNumber?: string;
	providerId?: string;
	displayName?: string;
	profilePicture?: string;
	fcmToken?: string;
}


/**
 * User role types
 */
export type UserRole = "free" | "premium" | "admin";

/**
 * User preferences interface
 */
export interface UserPreferences {
	defaultCurrency: string;
	timezone: string;
	language?: string;
	country?: string;
	notifications: boolean;
	emailUpdates: boolean;
	openaiApiKey?: string;
	geminiApiKey?: string;
	categoryListViewMode?: boolean;
	appView?: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
	theme?: string;
	pinEnabled?: boolean;
	pinHash?: string;
	isFamilyMode?: boolean;
	activeFamilyId?: string | null;
	hapticFeedback?: boolean;
}


/**
 * Firebase Auth error interface for better error handling
 */
export interface FirebaseAuthError {
	code: string;
	message: string;
} 