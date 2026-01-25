import { Component, Inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { UserService } from 'src/app/util/service/db/user.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { HapticFeedbackService } from 'src/app/util/service/haptic-feedback.service';
import { NotificationService } from 'src/app/util/service/notification.service';
import { ValidationService } from 'src/app/util/service/validation.service';
import { Account } from 'src/app/util/models/account.model';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { AccountType } from 'src/app/util/config/enums';
import { TransactionsService } from 'src/app/util/service/db/transactions.service';
import { CategoryService } from 'src/app/util/service/db/category.service';
import { AccountsService } from 'src/app/util/service/db/accounts.service';
import { TransactionType, RecurringInterval, TransactionStatus, PaymentMethod } from 'src/app/util/config/enums';
import { Transaction } from 'src/app/util/models/transaction.model';
import { Observable, of } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import moment from 'moment';

@Component({
  selector: 'app-add-account-dialog',
  templateUrl: './add-account-dialog.component.html',
  styleUrl: './add-account-dialog.component.scss',
})
export class AddAccountDialogComponent {
  accountForm: FormGroup;
  public userId: any;
  public isSubmitting = false;
  public accountTypes: { value: AccountType, label: string }[] = [
    { value: AccountType.BANK, label: 'Bank Account (Checking/Savings)' },
    { value: AccountType.CASH, label: 'Cash' },
    { value: AccountType.CREDIT, label: 'Credit Card' },
    { value: AccountType.LOAN, label: 'Loan' },
    { value: AccountType.INVESTMENT, label: 'Investment' },
  ];

  public repaymentFrequencies = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'weekly', label: 'Weekly' },
  ];

  public loanStatuses = [
    { value: 'active', label: 'Active' },
    { value: 'closed', label: 'Closed' },
    { value: 'defaulted', label: 'Defaulted' },
  ];

  constructor(
    @Inject(MAT_DIALOG_DATA) public dialogData: Account | null,
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<AddAccountDialogComponent>,
    private auth: Auth,
    private notificationService: NotificationService,
    private hapticFeedback: HapticFeedbackService,
    private validationService: ValidationService,
    private store: Store<AppState>,
    private transactionsService: TransactionsService,
    private categoryService: CategoryService,
    private accountsService: AccountsService,
    private userService: UserService
  ) {
    this.accountForm = this.fb.group({
      name: ['', this.validationService.getAccountNameValidators()],
      type: ['bank', Validators.required],
      balance: [0, this.validationService.getAccountBalanceValidators()],
      description: [''],
      // Loan-specific fields
      lenderName: [''],
      loanAmount: [0, this.validationService.getLoanAmountValidators()],
      interestRate: [0, this.validationService.getInterestRateValidators()],
      startDate: [new Date()],
      durationMonths: [12, this.validationService.getDurationMonthsValidators()],
      repaymentFrequency: ['monthly'],
      status: ['active'],
      remainingBalance: [0, [Validators.min(0)]],
      nextDueDate: [new Date()],
      showReminder: [true],
      // Additional loan fields
      useCalculatedPayment: [true],
      customMonthlyPayment: [0, [Validators.min(0)]],
      createRecurringTransaction: [true],
      // Credit card-specific fields
      dueDate: [15, [Validators.required, Validators.min(1), Validators.max(31)]],
      billingCycleStart: [1, [Validators.required, Validators.min(1), Validators.max(31)]],
      creditLimit: [0, [Validators.min(0)]],
      minimumPayment: [0, [Validators.min(0)]],
      creditCardShowReminder: [true],
    });

    // If editing, populate form with existing data
    if (this.dialogData) {
      this.accountForm.patchValue({
        name: this.dialogData.name,
        type: this.dialogData.type,
        balance: this.dialogData.balance || 0,
        description: this.dialogData.description,
        // Populate loan details if they exist
        ...(this.dialogData.loanDetails && {
          lenderName: this.dialogData.loanDetails.lenderName,
          loanAmount: this.dialogData.loanDetails.loanAmount,
          interestRate: this.dialogData.loanDetails.interestRate,
          startDate: this.dialogData.loanDetails.startDate,
          durationMonths: this.dialogData.loanDetails.durationMonths,
          repaymentFrequency: this.dialogData.loanDetails.repaymentFrequency,
          status: this.dialogData.loanDetails.status,
          remainingBalance: this.dialogData.loanDetails.remainingBalance,
          nextDueDate: this.dialogData.loanDetails.nextDueDate,
          showReminder: this.dialogData.loanDetails.showReminder,
          // Set default values for new fields
          useCalculatedPayment: true,
          customMonthlyPayment: this.dialogData.loanDetails.monthlyPayment || 0,
          createRecurringTransaction: true,
        }),
        // Populate credit card details if they exist
        ...(this.dialogData.creditCardDetails && {
          dueDate: this.dialogData.creditCardDetails.dueDate,
          billingCycleStart: this.dialogData.creditCardDetails.billingCycleStart,
          creditLimit: this.dialogData.creditCardDetails.creditLimit,
          minimumPayment: this.dialogData.creditCardDetails.minimumPayment,
          creditCardShowReminder: this.dialogData.creditCardDetails.showReminder,
        })

      })

      setTimeout(() => {
        this.updateRemainingBalance();
      }, 100);

      // Update balance when loan amount changes
      this.accountForm.get('loanAmount')?.valueChanges.subscribe(value => {
        if (this.accountForm.get('type')?.value === 'loan') {
          this.accountForm.patchValue({ balance: -value }, { emitEvent: false });
        }
      });

      // Add/remove validation for loan and credit card fields based on account type
      this.accountForm.get('type')?.valueChanges.subscribe(type => {
        const lenderNameControl = this.accountForm.get('lenderName');
        const loanAmountControl = this.accountForm.get('loanAmount');
        const interestRateControl = this.accountForm.get('interestRate');
        const durationMonthsControl = this.accountForm.get('durationMonths');
        const nextDueDateControl = this.accountForm.get('nextDueDate');

        // Credit card controls
        const dueDateControl = this.accountForm.get('dueDate');
        const billingCycleStartControl = this.accountForm.get('billingCycleStart');
        const creditLimitControl = this.accountForm.get('creditLimit');
        const minimumPaymentControl = this.accountForm.get('minimumPayment');

        if (type === 'loan') {
          lenderNameControl?.setValidators([Validators.required]);
          loanAmountControl?.setValidators([Validators.required, ...this.validationService.getLoanAmountValidators()]);
          interestRateControl?.setValidators([Validators.required, ...this.validationService.getInterestRateValidators()]);
          durationMonthsControl?.setValidators([Validators.required, ...this.validationService.getDurationMonthsValidators()]);
          nextDueDateControl?.setValidators([Validators.required]);

          // Clear credit card validators
          dueDateControl?.clearValidators();
          billingCycleStartControl?.clearValidators();
          creditLimitControl?.clearValidators();
          minimumPaymentControl?.clearValidators();
        } else if (type === 'credit') {
          // Clear loan validators
          lenderNameControl?.clearValidators();
          loanAmountControl?.clearValidators();
          interestRateControl?.clearValidators();
          durationMonthsControl?.clearValidators();
          nextDueDateControl?.clearValidators();

          // Set credit card validators
          dueDateControl?.setValidators([Validators.required, Validators.min(1), Validators.max(31)]);
          billingCycleStartControl?.setValidators([Validators.required, Validators.min(1), Validators.max(31)]);
          creditLimitControl?.setValidators([Validators.min(0)]);
          minimumPaymentControl?.setValidators([Validators.min(0)]);
        } else {
          // Clear all specific validators for other account types
          lenderNameControl?.clearValidators();
          loanAmountControl?.clearValidators();
          interestRateControl?.clearValidators();
          durationMonthsControl?.clearValidators();
          nextDueDateControl?.clearValidators();
          dueDateControl?.clearValidators();
          billingCycleStartControl?.clearValidators();
          creditLimitControl?.clearValidators();
          minimumPaymentControl?.clearValidators();
        }

        lenderNameControl?.updateValueAndValidity();
        loanAmountControl?.updateValueAndValidity();
        interestRateControl?.updateValueAndValidity();
        durationMonthsControl?.updateValueAndValidity();
        nextDueDateControl?.updateValueAndValidity();
        dueDateControl?.updateValueAndValidity();
        billingCycleStartControl?.updateValueAndValidity();
        creditLimitControl?.updateValueAndValidity();
        minimumPaymentControl?.updateValueAndValidity();
      });

      // Update remaining balance based on time elapsed since loan start
      this.accountForm.get('loanAmount')?.valueChanges.subscribe(() => {
        this.updateRemainingBalance();
      });

      this.accountForm.get('startDate')?.valueChanges.subscribe(() => {
        this.updateRemainingBalance();
      });

      this.accountForm.get('interestRate')?.valueChanges.subscribe(() => {
        this.updateRemainingBalance();
      });

      this.accountForm.get('durationMonths')?.valueChanges.subscribe(() => {
        this.updateRemainingBalance();
      });

      this.accountForm.get('repaymentFrequency')?.valueChanges.subscribe(() => {
        this.updateRemainingBalance();
      });

      // Update custom payment when calculated payment changes
      this.accountForm.get('useCalculatedPayment')?.valueChanges.subscribe(useCalculated => {
        if (useCalculated) {
          const calculatedPayment = this.getCalculatedMonthlyPayment();
          this.accountForm.patchValue({
            customMonthlyPayment: calculatedPayment
          }, { emitEvent: false });
        }
      });

      // Update custom payment when loan details change
      this.accountForm.get('loanAmount')?.valueChanges.subscribe(() => {
        if (this.accountForm.get('useCalculatedPayment')?.value) {
          const calculatedPayment = this.getCalculatedMonthlyPayment();
          this.accountForm.patchValue({
            customMonthlyPayment: calculatedPayment
          }, { emitEvent: false });
        }
      });

      this.accountForm.get('interestRate')?.valueChanges.subscribe(() => {
        if (this.accountForm.get('useCalculatedPayment')?.value) {
          const calculatedPayment = this.getCalculatedMonthlyPayment();
          this.accountForm.patchValue({
            customMonthlyPayment: calculatedPayment
          }, { emitEvent: false });
        }
      });

      this.accountForm.get('durationMonths')?.valueChanges.subscribe(() => {
        if (this.accountForm.get('useCalculatedPayment')?.value) {
          const calculatedPayment = this.getCalculatedMonthlyPayment();
          this.accountForm.patchValue({
            customMonthlyPayment: calculatedPayment
          }, { emitEvent: false });
        }
      });
    }
  }

  ngOnInit(): void {
    this.userId = this.userService.getCurrentUserId();

    // Initialize remaining balance for new loan accounts
    if (!this.dialogData && this.accountForm.get('type')?.value === 'loan') {
      this.updateRemainingBalance();
    }
  }

  async onSubmit(): Promise<void> {
    if (this.accountForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;

      try {
        const formData = this.accountForm.value;
        const isLoanAccount = formData.type === 'loan';

        // Prepare account data
        const accountData: any = {
          name: formData.name.trim(),
          type: formData.type,
          balance: Number(formData.balance) || 0,
          description: formData.description || '',
        };

        // Add loan details if it's a loan account
        if (isLoanAccount) {
          accountData.loanDetails = {
            lenderName: formData.lenderName.trim(),
            loanAmount: Number(formData.loanAmount) || 0,
            interestRate: Number(formData.interestRate) || 0,
            startDate: formData.startDate,
            durationMonths: Number(formData.durationMonths) || 12,
            repaymentFrequency: formData.repaymentFrequency,
            status: formData.status,
            remainingBalance: Number(formData.remainingBalance) + this.getCalculatedMonthlyPayment() || 0,
            nextDueDate: formData.nextDueDate,
            showReminder: formData.showReminder,
            monthlyPayment: this.getCalculatedMonthlyPayment(),
          };
        }

        // Add credit card details if it's a credit card account
        if (formData.type === 'credit') {
          accountData.creditCardDetails = {
            dueDate: Number(formData.dueDate) || 15,
            billingCycleStart: Number(formData.billingCycleStart) || 1,
            creditLimit: Number(formData.creditLimit) || 0,
            minimumPayment: Number(formData.minimumPayment) || 0,
            showReminder: formData.creditCardShowReminder,
          };
        }

        if (this.dialogData?.accountId) {
          // Update existing account using service
          await this.accountsService.updateAccount(
            this.userId,
            this.dialogData.accountId,
            accountData
          ).toPromise();
          this.notificationService.success('Account updated successfully');
        } else {
          // Create new account using service directly
          const accountId = await this.accountsService.createAccount(
            this.userId,
            accountData
          ).toPromise();

          // For loan accounts, create recurring transaction after account is created
          if (isLoanAccount && accountData.loanDetails && this.accountForm.get('createRecurringTransaction')?.value && accountId) {
            // Create the recurring transaction immediately since we have the accountId
            this.createLoanPaymentRecurringTransactionAfterAccountCreation(accountData, accountId);
          }

          if (isLoanAccount && this.accountForm.get('createRecurringTransaction')?.value) {
            this.notificationService.success('Loan account created successfully! A recurring transaction for loan payments has been set up.');
          } else if (isLoanAccount) {
            this.notificationService.success('Loan account created successfully!');
          } else {
            this.notificationService.success('Account added successfully');
          }
          this.hapticFeedback.successVibration();
        }

        this.dialogRef.close(true);
      } catch (error) {
        this.notificationService.error('Failed to save account');
        console.error('Error saving account:', error);
      } finally {
        this.isSubmitting = false;
      }
    }
  }

  onClose(): void {
    this.dialogRef.close();
  }

  getNameError(): string {
    const control = this.accountForm.get('name');
    return control ? this.validationService.getAccountNameError(control) : '';
  }

  getBalanceError(): string {
    const control = this.accountForm.get('balance');
    return control ? this.validationService.getAccountBalanceError(control) : '';
  }

  /**
   * Check if current account type is loan
   */
  isLoanAccount(): boolean {
    return this.accountForm.get('type')?.value === 'loan';
  }

  isCreditCardAccount(): boolean {
    return this.accountForm.get('type')?.value === 'credit';
  }

  /**
   * Get error message for loan amount
   */
  getLoanAmountError(): string {
    const control = this.accountForm.get('loanAmount');
    return control ? this.validationService.getLoanAmountError(control) : '';
  }

  /**
   * Get error message for interest rate
   */
  getInterestRateError(): string {
    const control = this.accountForm.get('interestRate');
    return control ? this.validationService.getInterestRateError(control) : '';
  }

  /**
   * Get error message for duration
   */
  getDurationError(): string {
    const control = this.accountForm.get('durationMonths');
    return control ? this.validationService.getDurationError(control) : '';
  }

  /**
 * Get calculated monthly payment for display
 */
  getCalculatedMonthlyPayment(): number {
    if (!this.isLoanAccount()) {
      return 0;
    }

    const useCalculated = this.accountForm.get('useCalculatedPayment')?.value;

    if (!useCalculated) {
      return this.accountForm.get('customMonthlyPayment')?.value || 0;
    }

    const loanAmount = this.accountForm.get('loanAmount')?.value || 0;
    const interestRate = this.accountForm.get('interestRate')?.value || 0;
    const durationMonths = this.accountForm.get('durationMonths')?.value || 12;

    return this.calculateMonthlyPayment(loanAmount, interestRate, durationMonths);
  }

  /**
   * Get current remaining balance (for testing/debugging)
   */
  getCurrentRemainingBalance(): number {
    return this.accountForm.get('remainingBalance')?.value || 0;
  }

  /**
   * Update remaining balance based on time elapsed since loan start
   */
  updateRemainingBalance(): void {
    if (!this.isLoanAccount()) {
      return;
    }

    const loanAmount = this.accountForm.get('loanAmount')?.value || 0;
    const startDate = this.accountForm.get('startDate')?.value;
    const durationMonths = this.accountForm.get('durationMonths')?.value || 12;
    const repaymentFrequency = this.accountForm.get('repaymentFrequency')?.value || 'monthly';

    console.log('Updating remaining balance:', {
      loanAmount,
      startDate,
      durationMonths,
      repaymentFrequency
    });

    if (!startDate || loanAmount <= 0) {
      this.accountForm.patchValue({ remainingBalance: loanAmount }, { emitEvent: false });
      console.log('Setting remaining balance to loan amount:', loanAmount);
      return;
    }

    const remainingBalance = this.calculateRemainingBalance(
      loanAmount,
      startDate,
      durationMonths,
      repaymentFrequency
    );

    console.log('Calculated remaining balance:', remainingBalance);
    this.accountForm.patchValue({
      remainingBalance,
      balance: -remainingBalance
    }, { emitEvent: false });
  }

  /**
   * Calculate remaining balance based on time elapsed
   */
  private calculateRemainingBalance(
    loanAmount: number,
    startDate: Date,
    durationMonths: number,
    repaymentFrequency: string
  ): number {
    const today = new Date();
    const start = new Date(startDate);

    // Calculate months elapsed since loan start
    const monthsElapsed = Math.round(moment(today).diff(moment(start), 'months', true));

    // Calculate total payments made based on frequency
    let paymentsMade = 0;
    if (repaymentFrequency === 'weekly') {
      // For weekly payments, calculate weeks elapsed
      const weeksElapsed = Math.floor((today.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
      paymentsMade = Math.max(0, weeksElapsed);
    } else {
      // For monthly payments
      paymentsMade = Math.max(0, monthsElapsed);
    }

    // Calculate total amount paid using the calculated payment amount
    const interestRate = this.accountForm.get('interestRate')?.value || 0;
    const monthlyPayment = this.calculateMonthlyPayment(loanAmount, interestRate, durationMonths);
    const totalPaid = paymentsMade * monthlyPayment;

    // Calculate remaining balance
    const remainingBalance = Math.max(0, loanAmount - totalPaid);

    console.log('Remaining balance calculation details:', {
      today: today.toISOString(),
      start: start.toISOString(),
      monthsElapsed,
      paymentsMade,
      interestRate,
      monthlyPayment,
      totalPaid,
      remainingBalance
    });

    return Math.round(remainingBalance * 100) / 100; // Round to 2 decimal places
  }


  /**
   * Find or create a loan payment category
   */
  private findOrCreateLoanPaymentCategory(userId: string): Observable<string> {
    return this.categoryService.getCategories(userId).pipe(
      switchMap(categories => {
        // Look for existing loan payment category
        const loanPaymentCategory = categories.find(cat =>
          cat.name.toLowerCase().includes('loan') &&
          cat.type === TransactionType.EXPENSE
        );

        if (loanPaymentCategory?.id) {
          return of(loanPaymentCategory.id);
        }

        // Create new loan payment category if not found
        return this.categoryService.createCategory(
          userId,
          'Loan Payment',
          TransactionType.EXPENSE,
          'account_balance',
          '#ef4444' // Red color for loan payments
        );
      })
    );
  }

  /**
   * Calculate monthly payment for loan using amortization formula
   */
  private calculateMonthlyPayment(loanAmount: number, interestRate: number, durationMonths: number): number {
    if (durationMonths <= 0 || interestRate <= 0) return loanAmount / durationMonths;

    // Monthly interest rate (annual rate / 12)
    const monthlyRate = interestRate / (12 * 100);

    // Amortization formula: P = L[c(1 + c)^n]/[(1 + c)^n - 1]
    // Where: P = monthly payment, L = loan amount, c = monthly interest rate, n = number of payments
    const numerator = monthlyRate * Math.pow(1 + monthlyRate, durationMonths);
    const denominator = Math.pow(1 + monthlyRate, durationMonths) - 1;

    if (denominator === 0) return loanAmount / durationMonths;

    const monthlyPayment = loanAmount * (numerator / denominator);

    return Math.round(monthlyPayment * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Create recurring transaction for loan payment
   */
  private createLoanPaymentRecurringTransaction(
    userId: string,
    accountId: string,
    loanDetails: any
  ): Observable<void> {
    return this.findOrCreateLoanPaymentCategory(userId).pipe(
      switchMap(categoryId => {
        if (!categoryId) {
          throw new Error('Failed to create loan payment category');
        }

        const monthlyPayment = this.getCalculatedMonthlyPayment();

        const recurringTransaction: Omit<Transaction, 'id'> = {
          userId: userId,
          accountId: accountId,
          categoryId: categoryId,
          category: 'Loan Payment',
          payee: loanDetails.lenderName,
          amount: monthlyPayment,
          type: TransactionType.EXPENSE,
          date: new Date(),
          notes: `Monthly payment for ${loanDetails.lenderName} loan`,
          status: TransactionStatus.COMPLETED,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          isRecurring: true,
          recurringInterval: loanDetails.repaymentFrequency === 'weekly' ?
            RecurringInterval.WEEKLY : RecurringInterval.MONTHLY,
          recurringEndDate: this.calculateLoanEndDate(loanDetails.startDate, loanDetails.durationMonths),
          nextOccurrence: loanDetails.nextDueDate,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: userId,
          updatedBy: userId,
          syncStatus: 'synced' as any,
          isPending: false,
          lastSyncedAt: new Date()
        };

        return this.transactionsService.createTransaction(userId, recurringTransaction);
      })
    );
  }

  /**
   * Calculate loan end date based on start date and duration
   */
  private calculateLoanEndDate(startDate: Date, durationMonths: number): Date {
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + durationMonths);
    return endDate;
  }

  /**
   * Create loan payment recurring transaction after account creation
   */
  private createLoanPaymentRecurringTransactionAfterAccountCreation(accountData: any, accountId: string): void {
    // Create the recurring transaction immediately since we have the accountId
    this.createLoanPaymentRecurringTransaction(
      this.userId,
      accountId,
      accountData.loanDetails
    ).subscribe({
      next: () => {
        this.notificationService.success('Loan payment recurring transaction created successfully');
      },
      error: (error) => {
        console.error('Failed to create loan payment recurring transaction:', error);
        this.notificationService.warning('Account created but failed to create loan payment recurring transaction');
      }
    });
  }

}
