import { Injectable } from '@angular/core';
import { IValidationService } from './interfaces';
import { APP_CONFIG, ERROR_MESSAGES } from '../config/config';
import { Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { CurrencyService } from './currency.service';

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Password validation result interface
 */
export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong' | 'very_strong';
  score: number; // 0-100
  suggestions: string[];
}

/**
 * Validation constants for the entire application
 */
export const VALIDATION_CONSTANTS = {
  // Account validations
  ACCOUNT: {
    NAME: {
      MIN_LENGTH: 1,
      MAX_LENGTH: 50,
      PATTERN: /^[a-zA-Z0-9\s\-_]+$/
    },
    BALANCE: {
      MIN: -999999999999,
      MAX: 999999999999
    },
    LOAN: {
      AMOUNT: {
        MIN: 0,
        MAX: 999999999999
      },
      INTEREST_RATE: {
        MIN: 0,
        MAX: 100
      },
      DURATION_MONTHS: {
        MIN: 1,
        MAX: 600 // 50 years
      }
    }
  },

  // Transaction validations
  TRANSACTION: {
    PAYEE: {
      MAX_LENGTH: 45
    },
    AMOUNT: {
      MIN: 0.01
    },
    DESCRIPTION: {
      MAX_LENGTH: 500
    }
  },

  // Profile validations
  PROFILE: {
    NAME: {
      MIN_LENGTH: 2,
      MAX_LENGTH: 50
    },
    EMAIL: {
      PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    PHONE: {
      PATTERN: /^\+?[\d\s-()]+$/
    },
    OCCUPATION: {
      MAX_LENGTH: 100
    },
    INCOME: {
      MIN: 0
    }
  },

  // Category validations
  CATEGORY: {
    NAME: {
      MAX_LENGTH: 50
    }
  },

  // Budget validations
  BUDGET: {
    AMOUNT: {
      MIN: 0.01
    },
    ALERT_THRESHOLD: {
      MIN: 0,
      MAX: 100
    }
  },

  // Tax validations
  TAX: {
    INCOME: {
      MIN: 0
    },
    DEDUCTIONS: {
      MIN: 0
    }
  },

  // Authentication validations
  AUTH: {
    PASSWORD: {
      MIN_LENGTH: 8,
      MAX_LENGTH: 128
    },
    NAME: {
      MIN_LENGTH: 2
    }
  },

  // General validations
  GENERAL: {
    REQUIRED: true,
    EMAIL: true
  }
} as const;

/**
 * Validation service providing comprehensive validation logic
 */
@Injectable({
  providedIn: 'root'
})
export class ValidationService implements IValidationService {

  constructor(private currencyService: CurrencyService) { }

  /**
   * Get validation constants
   */
  get constants() {
    return VALIDATION_CONSTANTS;
  }

  /**
   * Account validation methods
   */
  getAccountNameValidators() {
    return [
      Validators.required,
      Validators.maxLength(VALIDATION_CONSTANTS.ACCOUNT.NAME.MAX_LENGTH)
    ];
  }

  getAccountBalanceValidators() {
    return [
      Validators.required,
      Validators.min(VALIDATION_CONSTANTS.ACCOUNT.BALANCE.MIN),
      Validators.max(VALIDATION_CONSTANTS.ACCOUNT.BALANCE.MAX)
    ];
  }

  getLoanAmountValidators() {
    return [
      Validators.min(VALIDATION_CONSTANTS.ACCOUNT.LOAN.AMOUNT.MIN),
      Validators.max(VALIDATION_CONSTANTS.ACCOUNT.LOAN.AMOUNT.MAX)
    ];
  }

  getInterestRateValidators() {
    return [
      Validators.min(VALIDATION_CONSTANTS.ACCOUNT.LOAN.INTEREST_RATE.MIN),
      Validators.max(VALIDATION_CONSTANTS.ACCOUNT.LOAN.INTEREST_RATE.MAX)
    ];
  }

  getDurationMonthsValidators() {
    return [
      Validators.min(VALIDATION_CONSTANTS.ACCOUNT.LOAN.DURATION_MONTHS.MIN),
      Validators.max(VALIDATION_CONSTANTS.ACCOUNT.LOAN.DURATION_MONTHS.MAX)
    ];
  }

  /**
   * Transaction validation methods
   */
  getTransactionPayeeValidators() {
    return [
      Validators.required,
      Validators.maxLength(VALIDATION_CONSTANTS.TRANSACTION.PAYEE.MAX_LENGTH)
    ];
  }

  getTransactionAmountValidators() {
    return [
      Validators.required,
      Validators.min(VALIDATION_CONSTANTS.TRANSACTION.AMOUNT.MIN)
    ];
  }

  /**
   * Profile validation methods
   */
  getProfileNameValidators() {
    return [
      Validators.required,
      Validators.minLength(VALIDATION_CONSTANTS.PROFILE.NAME.MIN_LENGTH),
      Validators.maxLength(VALIDATION_CONSTANTS.PROFILE.NAME.MAX_LENGTH)
    ];
  }

  getProfileEmailValidators() {
    return [
      Validators.required,
      Validators.email
    ];
  }

  getProfilePhoneValidators() {
    return [
      Validators.pattern(VALIDATION_CONSTANTS.PROFILE.PHONE.PATTERN)
    ];
  }

  getProfileOccupationValidators() {
    return [
      Validators.maxLength(VALIDATION_CONSTANTS.PROFILE.OCCUPATION.MAX_LENGTH)
    ];
  }

  getProfileIncomeValidators() {
    return [
      Validators.min(VALIDATION_CONSTANTS.PROFILE.INCOME.MIN)
    ];
  }

  /**
   * Category validation methods
   */
  getCategoryNameValidators() {
    return [
      Validators.required,
      Validators.maxLength(VALIDATION_CONSTANTS.CATEGORY.NAME.MAX_LENGTH)
    ];
  }

  /**
   * Budget validation methods
   */
  getBudgetAmountValidators() {
    return [
      Validators.required,
      Validators.min(VALIDATION_CONSTANTS.BUDGET.AMOUNT.MIN)
    ];
  }

  getBudgetThresholdValidators() {
    return [
      Validators.min(VALIDATION_CONSTANTS.BUDGET.ALERT_THRESHOLD.MIN),
      Validators.max(VALIDATION_CONSTANTS.BUDGET.ALERT_THRESHOLD.MAX)
    ];
  }

  /**
   * Tax validation methods
   */
  getTaxIncomeValidators() {
    return [
      Validators.required,
      Validators.min(VALIDATION_CONSTANTS.TAX.INCOME.MIN)
    ];
  }

  getTaxDeductionValidators() {
    return [
      Validators.min(VALIDATION_CONSTANTS.TAX.DEDUCTIONS.MIN),
      Validators.max(APP_CONFIG.VALIDATION.MAX_AMOUNT)
    ];
  }

  /**
   * Authentication validation methods
   */
  getAuthPasswordValidators() {
    return [
      Validators.required,
      Validators.minLength(VALIDATION_CONSTANTS.AUTH.PASSWORD.MIN_LENGTH)
    ];
  }

  getAuthNameValidators() {
    return [
      Validators.required,
      Validators.minLength(VALIDATION_CONSTANTS.AUTH.NAME.MIN_LENGTH)
    ];
  }



  /**
   * Error message getters
   */
  getAccountNameError(control: AbstractControl): string {
    if (control?.hasError('required')) {
      return 'Account name is required';
    }
    if (control?.hasError('maxlength')) {
      return `Account name must be no more than ${VALIDATION_CONSTANTS.ACCOUNT.NAME.MAX_LENGTH} characters`;
    }
    return '';
  }

  getAccountBalanceError(control: AbstractControl): string {
    if (control?.hasError('required')) {
      return 'Balance is required';
    }
    if (control?.hasError('min')) {
      return `Balance must be at least ${this.currencyService.formatAmount(VALIDATION_CONSTANTS.ACCOUNT.BALANCE.MIN)}`;
    }
    if (control?.hasError('max')) {
      return `Balance must be less than ${this.currencyService.formatAmount(VALIDATION_CONSTANTS.ACCOUNT.BALANCE.MAX)}`;
    }
    return '';
  }

  getLoanAmountError(control: AbstractControl): string {
    if (control?.hasError('min')) {
      return 'Loan amount must be positive';
    }
    if (control?.hasError('max')) {
      return `Loan amount must be less than ${this.currencyService.formatAmount(VALIDATION_CONSTANTS.ACCOUNT.LOAN.AMOUNT.MAX)}`;
    }
    return '';
  }

  getInterestRateError(control: AbstractControl): string {
    if (control?.hasError('min')) {
      return 'Interest rate must be positive';
    }
    if (control?.hasError('max')) {
      return 'Interest rate must be less than 100%';
    }
    return '';
  }

  getDurationError(control: AbstractControl): string {
    if (control?.hasError('min')) {
      return 'Duration must be at least 1 month';
    }
    if (control?.hasError('max')) {
      return 'Duration must be less than 50 years';
    }
    return '';
  }

  getTransactionAmountError(control: AbstractControl): string {
    if (control?.hasError('required')) {
      return 'Amount is required';
    }
    if (control?.hasError('min')) {
      return 'Amount must be greater than 0';
    }
    return '';
  }

  getTransactionPayeeError(control: AbstractControl): string {
    if (control?.hasError('required')) {
      return 'Description is required';
    }
    if (control?.hasError('maxlength')) {
      return `Description must be no more than ${VALIDATION_CONSTANTS.TRANSACTION.PAYEE.MAX_LENGTH} characters`;
    }
    return '';
  }

  getProfileNameError(control: AbstractControl): string {
    if (control?.hasError('required')) {
      return 'Name is required';
    }
    if (control?.hasError('minlength')) {
      return `Name must be at least ${VALIDATION_CONSTANTS.PROFILE.NAME.MIN_LENGTH} characters`;
    }
    if (control?.hasError('maxlength')) {
      return `Name must be no more than ${VALIDATION_CONSTANTS.PROFILE.NAME.MAX_LENGTH} characters`;
    }
    return '';
  }

  getBudgetAmountError(control: AbstractControl): string {
    if (control?.hasError('required')) {
      return 'Budget amount is required';
    }
    if (control?.hasError('min')) {
      return 'Budget amount must be greater than 0';
    }
    return '';
  }

  getBudgetThresholdError(control: AbstractControl): string {
    if (control?.hasError('min')) {
      return 'Threshold must be at least 0%';
    }
    if (control?.hasError('max')) {
      return 'Threshold cannot exceed 100%';
    }
    return '';
  }

  getProfileEmailError(control: AbstractControl): string {
    if (control?.hasError('required')) {
      return 'Email is required';
    }
    if (control?.hasError('email')) {
      return 'Please enter a valid email address';
    }
    return '';
  }

  getProfilePhoneError(control: AbstractControl): string {
    if (control?.hasError('required')) {
      return 'Phone number is required';
    }
    if (control?.hasError('pattern')) {
      return 'Please enter a valid phone number';
    }
    return '';
  }

  getProfileOccupationError(control: AbstractControl): string {
    if (control?.hasError('maxlength')) {
      return `Occupation must be no more than ${VALIDATION_CONSTANTS.PROFILE.OCCUPATION.MAX_LENGTH} characters`;
    }
    return '';
  }

  getProfileIncomeError(control: AbstractControl): string {
    if (control?.hasError('min')) {
      return 'Income must be positive';
    }
    return '';
  }

  getTaxIncomeError(control: AbstractControl): string {
    if (control?.hasError('required')) {
      return 'Income is required';
    }
    if (control?.hasError('min')) {
      return 'Income must be positive';
    }
    return '';
  }

  getTaxDeductionError(control: AbstractControl): string {
    if (control?.hasError('min')) {
      return 'Deduction amount must be positive';
    }
    return '';
  }

  getCategoryNameError(control: AbstractControl): string {
    if (control?.hasError('required')) {
      return 'Category name is required';
    }
    if (control?.hasError('maxlength')) {
      return `Category name must be no more than ${VALIDATION_CONSTANTS.CATEGORY.NAME.MAX_LENGTH} characters`;
    }
    return '';
  }

  /**
   * Validate email address
   */
  validateEmail(email: string): boolean {
    if (!email) return false;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  /**
   * Validate password with comprehensive checks
   */
  validatePassword(password: string): PasswordValidationResult {
    const errors: string[] = [];
    const suggestions: string[] = [];
    let score = 0;

    // Check minimum length
    if (password.length < APP_CONFIG.VALIDATION.MIN_PASSWORD_LENGTH) {
      errors.push(`Password must be at least ${APP_CONFIG.VALIDATION.MIN_PASSWORD_LENGTH} characters long`);
    } else {
      score += 20;
    }

    // Check maximum length
    if (password.length > APP_CONFIG.VALIDATION.MAX_PASSWORD_LENGTH) {
      errors.push(`Password must be no more than ${APP_CONFIG.VALIDATION.MAX_PASSWORD_LENGTH} characters long`);
    }

    // Check for uppercase letters
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
      suggestions.push('Add uppercase letters to increase security');
    } else {
      score += 20;
    }

    // Check for lowercase letters
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
      suggestions.push('Add lowercase letters to increase security');
    } else {
      score += 20;
    }

    // Check for numbers
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
      suggestions.push('Add numbers to increase security');
    } else {
      score += 20;
    }

    // Check for special characters
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
      suggestions.push('Add special characters to increase security');
    } else {
      score += 20;
    }

    // Determine strength
    let strength: 'weak' | 'medium' | 'strong' | 'very_strong';
    if (score < 40) strength = 'weak';
    else if (score < 60) strength = 'medium';
    else if (score < 80) strength = 'strong';
    else strength = 'very_strong';

    return {
      isValid: errors.length === 0,
      errors,
      strength,
      score,
      suggestions
    };
  }

  /**
   * Validate amount (currency)
   */
  validateAmount(amount: number): boolean {
    if (typeof amount !== 'number' || isNaN(amount)) {
      return false;
    }

    const isValid = amount >= APP_CONFIG.VALIDATION.MIN_AMOUNT &&
      amount <= APP_CONFIG.VALIDATION.MAX_AMOUNT;

    console.log('Amount validation result:', isValid);
    return isValid;
  }

  /**
   * Validate date
   */
  validateDate(date: Date): boolean {
    if (!date || !(date instanceof Date)) {
      return false;
    }

    return !isNaN(date.getTime());
  }

  /**
   * Validate required field
   */
  validateRequired(value: any): boolean {
    if (value === null || value === undefined) {
      return false;
    }

    if (typeof value === 'string') {
      return value.trim().length > 0;
    }

    if (Array.isArray(value)) {
      return value.length > 0;
    }

    return true;
  }

  /**
   * Validate string length
   */
  validateLength(value: string, min: number, max: number): boolean {
    if (!value || typeof value !== 'string') {
      return false;
    }

    const length = value.trim().length;
    return length >= min && length <= max;
  }

  /**
   * Validate name (first name, last name, etc.)
   */
  validateName(name: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!this.validateRequired(name)) {
      errors.push(ERROR_MESSAGES.VALIDATION.REQUIRED_FIELD);
      return { isValid: false, errors, warnings };
    }

    if (!this.validateLength(name, APP_CONFIG.VALIDATION.MIN_NAME_LENGTH, APP_CONFIG.VALIDATION.MAX_NAME_LENGTH)) {
      errors.push(`Name must be between ${APP_CONFIG.VALIDATION.MIN_NAME_LENGTH} and ${APP_CONFIG.VALIDATION.MAX_NAME_LENGTH} characters`);
    }

    // Check for valid characters (letters, spaces, hyphens, apostrophes)
    const nameRegex = /^[a-zA-Z\s\-']+$/;
    if (!nameRegex.test(name)) {
      errors.push('Name can only contain letters, spaces, hyphens, and apostrophes');
    }

    // Check for consecutive spaces
    if (/\s{2,}/.test(name)) {
      warnings.push('Name contains multiple consecutive spaces');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate phone number
   */
  validatePhoneNumber(phone: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!this.validateRequired(phone)) {
      errors.push(ERROR_MESSAGES.VALIDATION.REQUIRED_FIELD);
      return { isValid: false, errors, warnings };
    }

    // Remove all non-digit characters for validation
    const digitsOnly = phone.replace(/\D/g, '');

    if (digitsOnly.length < 10) {
      errors.push('Phone number must have at least 10 digits');
    }

    if (digitsOnly.length > 15) {
      errors.push('Phone number cannot exceed 15 digits');
    }

    // Check for valid phone number patterns
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    if (!phoneRegex.test(digitsOnly)) {
      errors.push('Invalid phone number format');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate account number
   */
  validateAccountNumber(accountNumber: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!this.validateRequired(accountNumber)) {
      errors.push(ERROR_MESSAGES.VALIDATION.REQUIRED_FIELD);
      return { isValid: false, errors, warnings };
    }

    // Remove spaces and dashes
    const cleanNumber = accountNumber.replace(/[\s\-]/g, '');

    if (cleanNumber.length < 8) {
      errors.push('Account number must be at least 8 digits');
    }

    if (cleanNumber.length > 20) {
      errors.push('Account number cannot exceed 20 digits');
    }

    // Check for valid characters (digits only)
    if (!/^\d+$/.test(cleanNumber)) {
      errors.push('Account number can only contain digits');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate currency code
   */
  validateCurrencyCode(currencyCode: string): boolean {
    if (!currencyCode || typeof currencyCode !== 'string') {
      return false;
    }

    const validCodes = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'CNY'];
    return validCodes.includes(currencyCode.toUpperCase());
  }

  /**
   * Validate date range
   */
  validateDateRange(startDate: Date, endDate: Date): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!this.validateDate(startDate)) {
      errors.push('Invalid start date');
    }

    if (!this.validateDate(endDate)) {
      errors.push('Invalid end date');
    }

    if (this.validateDate(startDate) && this.validateDate(endDate)) {
      if (startDate > endDate) {
        errors.push('Start date cannot be after end date');
      }

      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 365) {
        warnings.push('Date range exceeds one year');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate percentage
   */
  validatePercentage(percentage: number): boolean {
    if (typeof percentage !== 'number' || isNaN(percentage)) {
      return false;
    }

    return percentage >= 0 && percentage <= 100;
  }

  /**
   * Validate URL
   */
  validateUrl(url: string): boolean {
    if (!url || typeof url !== 'string') {
      return false;
    }

    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate credit card number (basic Luhn algorithm)
   */
  validateCreditCardNumber(cardNumber: string): boolean {
    if (!cardNumber || typeof cardNumber !== 'string') {
      return false;
    }

    // Remove spaces and dashes
    const cleanNumber = cardNumber.replace(/[\s\-]/g, '');

    // Check if it's all digits and has reasonable length
    if (!/^\d{13,19}$/.test(cleanNumber)) {
      return false;
    }

    // Luhn algorithm
    let sum = 0;
    let isEven = false;

    for (let i = cleanNumber.length - 1; i >= 0; i--) {
      let digit = parseInt(cleanNumber.charAt(i));

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  /**
   * Validate transaction data
   */
  validateTransactionData(data: any): ValidationResult {


    const errors: string[] = [];
    const warnings: string[] = [];

    if (Object.values(data).some(value => value === undefined)) {
      errors.push('Data contains undefined values');
    }

    // Validate required fields
    const requiredFields = ['payee', 'amount', 'type', 'date', 'accountId', 'categoryId'];
    for (const field of requiredFields) {
      if (!this.validateRequired(data[field])) {
        errors.push(`${field} is required`);
      }
    }

    // Validate amount
    if (data.amount && !this.validateAmount(data.amount)) {
      errors.push(ERROR_MESSAGES.VALIDATION.INVALID_AMOUNT);
    }

    // Validate date
    if (data.date && !this.validateDate(data.date)) {
      errors.push(ERROR_MESSAGES.VALIDATION.INVALID_DATE);
    }

    // Validate payee length
    if (data.payee && !this.validateLength(data.payee, 1, 100)) {
      errors.push('Payee name must be between 1 and 100 characters');
    }

    // Validate notes length
    if (data.notes && !this.validateLength(data.notes, 0, 500)) {
      warnings.push('Notes should not exceed 500 characters');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  validateCommonData(data: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (Object.values(data).some(value => value === undefined)) {
      errors.push('Data contains undefined values');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }


  /**
   * Sanitize input string
   */
  sanitizeString(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    return input
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/\s+/g, ' '); // Normalize whitespace
  }

  /**
   * Format validation error message
   */
  formatValidationError(field: string, error: string): string {
    return `${field}: ${error}`;
  }

  /**
   * Get validation summary
   */
  getValidationSummary(results: ValidationResult[]): ValidationResult {
    const allErrors: string[] = [];
    const allWarnings: string[] = [];
    let isValid = true;

    for (const result of results) {
      if (!result.isValid) {
        isValid = false;
      }
      allErrors.push(...result.errors);
      if (result.warnings) {
        allWarnings.push(...result.warnings);
      }
    }

    return {
      isValid,
      errors: allErrors,
      warnings: allWarnings
    };
  }
} 