import {
  Component, Inject, OnDestroy, OnInit,
  ChangeDetectionStrategy, signal, computed
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { UserService } from 'src/app/util/service/db/user.service';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HapticFeedbackService } from 'src/app/util/service/haptic-feedback.service';
import { NotificationService } from 'src/app/util/service/notification.service';
import { ValidationService } from 'src/app/util/service/validation.service';
import { Account } from 'src/app/util/models/account.model';
import { AccountType } from 'src/app/util/config/enums';
import { TransactionsService } from 'src/app/util/service/db/transactions.service';
import { CategoryService } from 'src/app/util/service/db/category.service';
import { AccountsService } from 'src/app/util/service/db/accounts.service';
import { TransactionType, RecurringInterval, TransactionStatus, PaymentMethod } from 'src/app/util/config/enums';
import { Transaction } from 'src/app/util/models/transaction.model';
import { Observable, of, Subject, takeUntil } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import dayjs from 'dayjs';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { CommonHeaderComponent } from 'src/app/util/components/dialog/common-header/common-header.component';
import { CommonBodyContentComponent } from 'src/app/util/components/dialog/common-body-content/common-body-content.component';
import { CurrencyPipe } from 'src/app/util/pipes';

@Component({
  selector: 'app-add-account-dialog',
  templateUrl: './add-account-dialog.component.html',
  styleUrl: './add-account-dialog.component.scss',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSlideToggleModule,
    CommonHeaderComponent,
    CommonBodyContentComponent,
    CurrencyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddAccountDialogComponent implements OnInit, OnDestroy {
  accountForm!: FormGroup;
  private readonly destroy$ = new Subject<void>();

  // ─── State Signals ────────────────────────────────────────────────────────
  readonly currentUserId = signal<string>('');
  readonly submitting = signal(false);

  /**
   * Reactive snapshot of the entire form value.
   * Initialized in the constructor (after `accountForm` is built).
   * All computed signals derive from this single source of truth.
   */
  readonly formSnapshot!: ReturnType<typeof toSignal<any>>;

  // ─── Computed Flags ───────────────────────────────────────────────────────
  readonly isLoanAccount  = computed(() => this.formSnapshot()?.type === 'loan');
  readonly isCreditAccount = computed(() => this.formSnapshot()?.type === 'credit');

  // ─── Computed Loan Analytics ──────────────────────────────────────────────
  readonly loanDurationMonths = computed<number>(() => {
    const { startDate, endDate } = this.formSnapshot() ?? {};
    if (!startDate || !endDate) return 12;
    return Math.max(1, Math.round(dayjs(endDate).diff(dayjs(startDate), 'month', true)));
  });

  readonly loanMonthsRemaining = computed<number>(() => {
    const endDate = this.formSnapshot()?.endDate;
    if (!endDate) return 0;
    return Math.max(0, Math.ceil(dayjs(endDate).diff(dayjs(), 'month', true)));
  });

  readonly loanMonthlyPayment = computed<number>(() => this.formSnapshot()?.customMonthlyPayment || 0);

  readonly loanTotalRepayment = computed<number>(() => this.loanMonthlyPayment() * this.loanDurationMonths());

  readonly loanTotalInterest = computed<number>(() => {
    const { startDate, endDate, loanAmount } = this.formSnapshot() ?? {};
    if (!startDate || !endDate) return 0;
    const diffMonths = dayjs(endDate).diff(dayjs(startDate), 'month', true);
    return (this.loanMonthlyPayment() * diffMonths) - (loanAmount || 0);
  });

  readonly loanInterestPercentage = computed<number>(() => {
    const loanAmount = this.formSnapshot()?.loanAmount || 0;
    if (!loanAmount) return 0;
    return Math.round((this.loanTotalInterest() / loanAmount) * 100);
  });

  // ─── Computed Validation Errors ───────────────────────────────────────────
  readonly balanceValidationError = computed<string>(() => {
    this.formSnapshot(); // track form changes
    const control = this.accountForm?.get('balance');
    return control ? this.validationService.getAccountBalanceError(control) : '';
  });

  readonly loanAmountValidationError = computed<string>(() => {
    this.formSnapshot();
    const control = this.accountForm?.get('loanAmount');
    return control ? this.validationService.getLoanAmountError(control) : '';
  });

  // ─── Static Data ──────────────────────────────────────────────────────────
  readonly accountTypes: { value: AccountType; label: string }[] = [
    { value: AccountType.BANK,       label: 'Bank Account (Checking/Savings)' },
    { value: AccountType.CASH,       label: 'Cash' },
    { value: AccountType.CREDIT,     label: 'Credit Card' },
    { value: AccountType.LOAN,       label: 'Loan' },
    { value: AccountType.INVESTMENT, label: 'Investment' },
  ];

  constructor(
    @Inject(MAT_DIALOG_DATA) public dialogData: Account | null,
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<AddAccountDialogComponent>,
    private notificationService: NotificationService,
    private hapticFeedback: HapticFeedbackService,
    private validationService: ValidationService,
    private transactionsService: TransactionsService,
    private categoryService: CategoryService,
    private accountsService: AccountsService,
    private userService: UserService
  ) {
    this.accountForm = this.buildForm();

    // Initialize the reactive form snapshot AFTER the form is built.
    // Computed signals reference this lazily, so they'll see the correct value.
    (this as any).formSnapshot = toSignal(
      this.accountForm.valueChanges,
      { initialValue: this.accountForm.value }
    );

    if (this.dialogData) {
      this.patchFormWithExistingAccount(this.dialogData);
    }

    this.setupFormListeners();
  }

  ngOnInit(): void {
    this.currentUserId.set(this.userService.getCurrentUserId() || '');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Form Setup ───────────────────────────────────────────────────────────

  private buildForm(): FormGroup {
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);

    return this.fb.group({
      name:                    ['', this.validationService.getAccountNameValidators()],
      type:                    ['bank', Validators.required],
      balance:                 [0, this.validationService.getAccountBalanceValidators()],
      description:             [''],
      // Loan fields
      lenderName:              [''],
      loanAmount:              ['', this.validationService.getLoanAmountValidators()],
      interestRate:            [0, this.validationService.getInterestRateValidators()],
      startDate:               [new Date()],
      durationMonths:          [12],
      durationYears:           [1, [Validators.required, Validators.min(0.1)]],
      repaymentFrequency:      ['monthly'],
      status:                  ['active'],
      remainingBalance:        [0, [Validators.min(0)]],
      nextDueDate:             [new Date()],
      endDate:                 [nextYear],
      customMonthlyPayment:    ['', [Validators.min(0)]],
      showReminder:            [true],
      createRecurringTransaction: [true],
      // Credit card fields
      dueDate:                 [15, [Validators.required, Validators.min(1), Validators.max(31)]],
      billingCycleStart:       [1, [Validators.required, Validators.min(1), Validators.max(31)]],
      creditLimit:             [0, [Validators.min(0)]],
      minimumPayment:          [0, [Validators.min(0)]],
    });
  }

  private patchFormWithExistingAccount(account: Account): void {
    const toDate = (val: any) => {
      if (!val) return new Date();
      if (typeof val.toDate === 'function') return val.toDate(); // Firestore Timestamp obj
      if (val instanceof Date) return new Date(val.getTime());   // Native Date obj
      if (val && typeof val.seconds === 'number') return new Date(val.seconds * 1000); // NgRx serialized Timestamp
      return new Date(val); // string/number fallback
    };

    this.accountForm.patchValue({
      name:        account.name,
      type:        account.type,
      balance:     account.balance ?? 0,
      description: account.description,
      ...(account.loanDetails && {
        lenderName:              account.loanDetails.lenderName,
        loanAmount:              account.loanDetails.loanAmount,
        interestRate:            account.loanDetails.interestRate ?? 0,
        startDate:               toDate(account.loanDetails.startDate),
        durationMonths:          account.loanDetails.durationMonths,
        durationYears:           Math.max(0.1, Math.round(dayjs(toDate(account.loanDetails.endDate ?? new Date())).diff(dayjs(toDate(account.loanDetails.startDate)), 'year', true) * 10) / 10),
        repaymentFrequency:      account.loanDetails.repaymentFrequency,
        status:                  account.loanDetails.status,
        remainingBalance:        account.loanDetails.remainingBalance,
        nextDueDate:             toDate(account.loanDetails.nextDueDate),
        endDate:                 toDate(account.loanDetails.endDate ?? new Date()),
        showReminder:            account.loanDetails.showReminder,
        customMonthlyPayment:    account.loanDetails.monthlyPayment ?? 0,
        createRecurringTransaction: true,
      }),
      ...(account.creditCardDetails && {
        dueDate:                account.creditCardDetails.dueDate,
        billingCycleStart:      account.creditCardDetails.billingCycleStart,
        creditLimit:            account.creditCardDetails.creditLimit,
        minimumPayment:         account.creditCardDetails.minimumPayment,
      }),
    });
  }

  private setupFormListeners(): void {
    // Sync balance field to be negative of loan amount
    this.accountForm.get('loanAmount')!.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(value => {
        if (this.isLoanAccount()) {
          this.accountForm.patchValue({ balance: -value }, { emitEvent: false });
        }
      });

    // Toggle validators based on account type
    this.accountForm.get('type')!.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(type => this.updateValidatorsForAccountType(type));

    // Auto-fill account name from lender name for loans
    this.accountForm.get('lenderName')!.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(value => {
        if (this.isLoanAccount() && value) {
          this.accountForm.patchValue({ name: value }, { emitEvent: false });
        }
      });

    // Update endDate when durationYears changes
    this.accountForm.get('durationYears')!.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(years => {
        if (this.isLoanAccount() && this.accountForm.get('durationYears')?.dirty && years > 0) {
          const startDate = this.accountForm.get('startDate')?.value;
          if (startDate) {
            const endDate = dayjs(startDate).add(years, 'year').toDate();
            this.accountForm.patchValue({ endDate }, { emitEvent: false });
            this.recalculateRemainingBalance();
            this.autoDeriveLoanInterestRate();
          }
        }
      });

    // Recalculate remaining balance & auto-derive interest rate on loan field changes
    for (const field of ['loanAmount', 'startDate', 'endDate', 'customMonthlyPayment']) {
      this.accountForm.get(field)!.valueChanges
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          if (this.isLoanAccount()) {
            if ((field === 'startDate' || field === 'endDate') && this.accountForm.get(field)?.dirty) {
               const start = this.accountForm.get('startDate')?.value;
               const end = this.accountForm.get('endDate')?.value;
               if (start && end) {
                  const y = Math.max(0.1, Math.round(dayjs(end).diff(dayjs(start), 'year', true) * 10) / 10);
                  this.accountForm.patchValue({ durationYears: y }, { emitEvent: false });
               }
            }
            this.recalculateRemainingBalance();
            this.autoDeriveLoanInterestRate();
          }
        });
    }

    this.accountForm.get('repaymentFrequency')!.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.isLoanAccount()) this.recalculateRemainingBalance();
      });

    // Recalculate EMI when user manually edits the interest rate
    this.accountForm.get('interestRate')!.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.isLoanAccount() && this.accountForm.get('interestRate')?.dirty) {
          this.recalculateEMIFromInterestRate();
        }
      });
  }

  private updateValidatorsForAccountType(type: string): void {
    const loanFields   = ['lenderName', 'loanAmount', 'interestRate', 'durationMonths', 'durationYears', 'nextDueDate', 'endDate', 'customMonthlyPayment'];
    const creditFields = ['dueDate', 'billingCycleStart', 'creditLimit', 'minimumPayment'];
    const allFields    = [...loanFields, ...creditFields];

    allFields.forEach(name => this.accountForm.get(name)?.clearValidators());

    if (type === 'loan') {
      this.accountForm.get('lenderName')?.setValidators([Validators.required]);
      this.accountForm.get('loanAmount')?.setValidators([Validators.required, ...this.validationService.getLoanAmountValidators()]);
      this.accountForm.get('interestRate')?.setValidators([Validators.required, ...this.validationService.getInterestRateValidators()]);
      this.accountForm.get('durationYears')?.setValidators([Validators.required, Validators.min(0.1)]);
      this.accountForm.get('nextDueDate')?.setValidators([Validators.required]);
      this.accountForm.get('endDate')?.setValidators([Validators.required]);
      this.accountForm.get('customMonthlyPayment')?.setValidators([Validators.required, Validators.min(0)]);
    } else if (type === 'credit') {
      this.accountForm.get('dueDate')?.setValidators([Validators.required, Validators.min(1), Validators.max(31)]);
      this.accountForm.get('billingCycleStart')?.setValidators([Validators.required, Validators.min(1), Validators.max(31)]);
      this.accountForm.get('creditLimit')?.setValidators([Validators.min(0)]);
      this.accountForm.get('minimumPayment')?.setValidators([Validators.min(0)]);
    }

    allFields.forEach(name => this.accountForm.get(name)?.updateValueAndValidity());
  }

  // ─── Loan Calculations ────────────────────────────────────────────────────

  private autoDeriveLoanInterestRate(): void {
    const principal = this.accountForm.get('loanAmount')?.value || 0;
    const emi       = this.accountForm.get('customMonthlyPayment')?.value || 0;
    const months    = this.loanDurationMonths();

    if (principal > 0 && emi > 0 && months > 0) {
      const annualRate = this.solveInterestRateByBinarySearch(principal, emi, months);
      // Format to 2 decimal places to maintain precision but clean appearance
      this.accountForm.patchValue({ interestRate: Number(annualRate.toFixed(2)) }, { emitEvent: false });
    }
  }

  private recalculateEMIFromInterestRate(): void {
    const principal  = this.accountForm.get('loanAmount')?.value || 0;
    const annualRate = this.accountForm.get('interestRate')?.value || 0;
    const months     = this.loanDurationMonths();

    if (principal > 0 && months > 0) {
      const r   = annualRate / 12 / 100;
      const emi = r === 0
        ? principal / months
        : (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);

      this.accountForm.patchValue({ customMonthlyPayment: Math.round(emi * 100) / 100 }, { emitEvent: false });
      this.recalculateRemainingBalance();
    }
  }

  /** Binary search to find the annual interest rate (%) that matches the given EMI exactly according to standard amortization formula. */
  private solveInterestRateByBinarySearch(principal: number, emi: number, months: number): number {
    if (emi <= principal / months) return 0;
    let low = 0, high = 100; // Search between 0% and 100% annual interest
    
    // Perform binary search to find the exact rate
    for (let i = 0; i < 100; i++) {
      const mid = (low + high) / 2;
      const r = mid / 12 / 100; // Monthly interest rate as a decimal
      
      // Amortization formula: EMI = P * r * (1+r)^n / ((1+r)^n - 1)
      const factor = Math.pow(1 + r, months);
      const calcEmi = (principal * r * factor) / (factor - 1);
      
      if (Math.abs(calcEmi - emi) < 0.000001) return mid;
      calcEmi > emi ? (high = mid) : (low = mid);
    }
    return (low + high) / 2;
  }

  recalculateRemainingBalance(): void {
    if (!this.isLoanAccount()) return;

    const loanAmount     = this.accountForm.get('loanAmount')?.value || 0;
    const startDate      = this.accountForm.get('startDate')?.value;
    const endDate        = this.accountForm.get('endDate')?.value;
    const monthlyPayment = this.accountForm.get('customMonthlyPayment')?.value || 0;

    if (!startDate || !endDate || loanAmount <= 0) {
      this.accountForm.patchValue({ remainingBalance: loanAmount }, { emitEvent: false });
      return;
    }

    const monthsElapsed    = Math.max(0, Math.floor(dayjs().diff(dayjs(startDate), 'month', true)));
    const remainingBalance = Math.round(Math.max(0, loanAmount - monthsElapsed * monthlyPayment) * 100) / 100;
    this.accountForm.patchValue({ remainingBalance, balance: -remainingBalance }, { emitEvent: false });
  }

  updateEndDateFromDuration(): void {
    if (!this.isLoanAccount()) return;
    const years = this.accountForm.get('durationYears')?.value || 0;
    const startDate = this.accountForm.get('startDate')?.value;

    if (years > 0 && startDate) {
      const endDate = dayjs(startDate).add(years, 'year').toDate();
      this.accountForm.patchValue({ endDate }, { emitEvent: false });
      this.recalculateRemainingBalance();
      this.autoDeriveLoanInterestRate();
    }
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  async onSubmit(): Promise<void> {
    if (this.accountForm.invalid) {
      this.accountForm.markAllAsTouched();
      this.notificationService.error('Please fix the errors in the form before saving');
      return;
    }
    if (this.submitting()) return;
    this.submitting.set(true);

    try {
      const formData = this.accountForm.value;
      const isLoan   = this.isLoanAccount();
      const isCredit = this.isCreditAccount();
      const uid      = this.currentUserId();

      const accountData: any = {
        name:        formData.name.trim(),
        type:        formData.type,
        balance:     isCredit ? -(Math.abs(Number(formData.balance) || 0)) : (Number(formData.balance) || 0),
        description: formData.description || '',
      };

      if (isLoan) {
        accountData.loanDetails = {
          lenderName:          formData.lenderName.trim(),
          loanAmount:          Number(formData.loanAmount) || 0,
          interestRate:        Number(formData.interestRate) || 0,
          startDate:           formData.startDate,
          durationMonths:      this.loanDurationMonths(),
          repaymentFrequency:  formData.repaymentFrequency,
          status:              formData.status,
          remainingBalance:    Number(formData.remainingBalance) || 0,
          nextDueDate:         formData.nextDueDate,
          endDate:             formData.endDate,
          showReminder:        formData.showReminder,
          monthlyPayment:      formData.customMonthlyPayment,
        };
      }

      if (isCredit) {
        accountData.creditCardDetails = {
          dueDate:           Number(formData.dueDate) || 15,
          billingCycleStart: Number(formData.billingCycleStart) || 1,
          creditLimit:       Number(formData.creditLimit) || 0,
          minimumPayment:    Number(formData.minimumPayment) || 0,
          nextDueDate:       this.buildNextCreditCardDueDate(Number(formData.dueDate) || 15),
        };
      }

      if (this.dialogData?.accountId) {
        await this.accountsService.updateAccount(uid, this.dialogData.accountId, accountData).toPromise();
        this.notificationService.success('Account updated successfully');
      } else {
        const newAccountId = await this.accountsService.createAccount(uid, accountData).toPromise();

        if (isLoan && newAccountId) {
          // Count how many payment dates have already occurred by iterating
          // month by month on the start day. e.g. start=Nov 7 → counts Nov 7,
          // Dec 7, Jan 7, Feb 7 (all ≤ today Feb 21) = 4, NOT 3 from Math.floor.
          const startDayjs = dayjs(formData.startDate);
          const today = dayjs().startOf('day');
          let pastMonths = 0;
          let paymentDate = startDayjs.startOf('day');
          while (paymentDate.isBefore(today, 'day')) {
            pastMonths++;
            paymentDate = paymentDate.add(1, 'month');
          }

          if (pastMonths > 0) {
            // Backfill one COMPLETED transaction per month that has already passed
            this.backfillPastLoanPayments(accountData, newAccountId, pastMonths);
          }

          if (formData.createRecurringTransaction) {
            this.scheduleLoanPaymentRecurringTransaction(accountData, newAccountId);
            this.notificationService.success(
              pastMonths > 0
                ? `Loan account created! ${pastMonths} past payment(s) recorded and recurring payments scheduled.`
                : 'Loan account created! A recurring transaction for payments has been set up.'
            );
          } else {
            this.notificationService.success('Loan account created successfully!');
          }
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
      this.submitting.set(false);
    }
  }

  onClose(): void {
    this.dialogRef.close();
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private buildNextCreditCardDueDate(dayOfMonth: number): Date {
    const today = new Date();
    let next = new Date(today.getFullYear(), today.getMonth(), dayOfMonth);
    if (next < today) next = new Date(today.getFullYear(), today.getMonth() + 1, dayOfMonth);
    return next;
  }

  private findOrCreateLoanPaymentCategory(userId: string): Observable<string> {
    return this.categoryService.getCategories(userId).pipe(
      switchMap(categories => {
        // Try to find by flag first
        let existing = categories.find(c => c.isSystem && c.type === TransactionType.INCOME);
        
        if (existing?.id) return of(existing.id);

        // Fallback: search by name and type for backward compatibility
        const legacy = categories.find(c => 
          c.name.toLowerCase() === 'loan payment' && 
          c.type === TransactionType.INCOME
        );

        if (legacy) {
          // Migrate legacy category by setting isSystem to true
          return this.categoryService.updateCategory(
            userId, 
            legacy.id!, 
            legacy.name, 
            legacy.type, 
            legacy.icon, 
            legacy.color, 
            legacy.budget, 
            legacy.parentCategoryId, 
            legacy.isSubCategory, 
            legacy.group, 
            true // isSystem
          ).pipe(
            map(() => legacy.id!)
          );
        }

        // Neither found, create new
        return this.categoryService.createCategory(userId, 'Loan Payment', TransactionType.INCOME, 'account_balance', '#ef4444', undefined, true);
      })
    );
  }

  /**
   * Create one COMPLETED transaction for each month that has already elapsed
   * since the loan start date. This backfills the payment history so the
   * account's transaction list reflects reality when the loan is entered late.
   */
  private backfillPastLoanPayments(accountData: any, accountId: string, monthsElapsed: number): void {
    const { loanDetails } = accountData;
    const uid = this.currentUserId();
    const emi = this.loanMonthlyPayment();
    const startDate = dayjs(loanDetails.startDate);
    // Payment day is always the same day-of-month as the loan start date.
    // e.g. start = 07 Dec 2025 → every payment falls on the 7th of its month.
    const paymentDay = startDate.date();

    this.findOrCreateLoanPaymentCategory(uid).pipe(
      switchMap(categoryId => {
        if (!categoryId) throw new Error('Failed to find/create loan payment category');

        // Build one transaction per elapsed month
        const pastPayments = Array.from({ length: monthsElapsed }, (_, i) => {
          // Payment date = same day-of-month, in month (startMonth + i)
          const paymentDate = startDate.add(i, 'month').date(paymentDay).toDate();

          const tx: Omit<Transaction, 'id'> = {
            userId:            uid,
            accountId,
            categoryId,
            category:          'Loan Payment',
            payee:             loanDetails.lenderName,
            amount:            emi,
            type:              TransactionType.INCOME,
            date:              paymentDate,
            notes:             `EMI payment for ${loanDetails.lenderName} loan (month ${i + 1})`,
            status:            TransactionStatus.COMPLETED,
            paymentMethod:     PaymentMethod.BANK_TRANSFER,
            isRecurring:       true,
            recurringInterval: loanDetails.repaymentFrequency === 'weekly' ? RecurringInterval.WEEKLY : RecurringInterval.MONTHLY,
            createdAt:         new Date(),
            updatedAt:         new Date(),
            createdBy:         uid,
            updatedBy:         uid,
            syncStatus:        'synced' as any,
            isPending:         false,
            lastSyncedAt:      new Date(),
          };
          return this.transactionsService.createTransaction(uid, tx);
        });

        // Fire them in parallel
        return pastPayments.length > 0
          ? new Observable(observer => {
              Promise.all(pastPayments.map(obs => obs.toPromise()))
                .then(() => { observer.next(); observer.complete(); })
                .catch(err => observer.error(err));
            })
          : of(null);
      })
    ).subscribe({
      error: err => {
        console.error('Failed to backfill past loan payments:', err);
        this.notificationService.warning('Loan created but some past payments could not be recorded');
      }
    });
  }

  private scheduleLoanPaymentRecurringTransaction(accountData: any, accountId: string): void {
    const { loanDetails } = accountData;
    const uid = this.currentUserId();

    this.findOrCreateLoanPaymentCategory(uid).pipe(
      switchMap(categoryId => {
        if (!categoryId) throw new Error('Failed to find/create loan payment category');

        const recurringEndDate = new Date(loanDetails.startDate);
        recurringEndDate.setMonth(recurringEndDate.getMonth() + loanDetails.durationMonths);

        // Derive nextDueDate from the startDate's day-of-month.
        // e.g. start = 07/12/2025 → recurring fires on the 7th of each month.
        const startDay = dayjs(loanDetails.startDate).date();
        const today = dayjs();
        // Try this month's occurrence first; if it has already passed, use next month
        let nextDueDate = today.date(startDay).startOf('day');
        if (nextDueDate.isBefore(today, 'day')) {
          nextDueDate = nextDueDate.add(1, 'month');
        }
        const nextDueDateAsDate = nextDueDate.toDate();

        const transaction: Omit<Transaction, 'id'> = {
          userId:              uid,
          accountId,
          categoryId,
          category:            'Loan Payment',
          payee:               loanDetails.lenderName,
          amount:              this.loanMonthlyPayment(),
          type:                TransactionType.INCOME,
          date:                nextDueDateAsDate,          // first future payment, not today
          notes:               `Monthly payment for ${loanDetails.lenderName} loan`,
          status:              TransactionStatus.PENDING, // upcoming — not yet debited
          paymentMethod:       PaymentMethod.BANK_TRANSFER,
          isRecurring:         true,
          recurringInterval:   loanDetails.repaymentFrequency === 'weekly' ? RecurringInterval.WEEKLY : RecurringInterval.MONTHLY,
          recurringEndDate,
          nextOccurrence:      nextDueDateAsDate,
          createdAt:           new Date(),
          updatedAt:           new Date(),
          createdBy:           uid,
          updatedBy:           uid,
          syncStatus:          'synced' as any,
          isPending:           true,
          lastSyncedAt:        new Date(),
        };

        return this.transactionsService.createTransaction(uid, transaction);
      })
    ).subscribe({
      error: err => {
        console.error('Failed to schedule loan payment recurring transaction:', err);
        this.notificationService.warning('Account created but failed to set up recurring transaction');
      }
    });
  }
}
