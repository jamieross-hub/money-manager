import { Component, Inject, inject, ViewChild, ElementRef, AfterViewInit, OnInit, OnDestroy, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule, MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatBottomSheetModule, MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatExpansionModule } from '@angular/material/expansion';
import { TranslateModule } from '@ngx-translate/core';
import { CurrencyPipe } from 'src/app/util/pipes/currency.pipe';
import { Router } from '@angular/router';
import { HapticFeedbackService } from 'src/app/util/service/haptic-feedback.service';
import { NotificationService } from 'src/app/util/service/notification.service';
import { ValidationService } from 'src/app/util/service/validation.service';
import { IncludesPipe } from 'src/app/util/pipes/includes.pipe';
import { AddAccountDialogComponent } from 'src/app/component/dashboard/accounts/add-account-dialog/add-account-dialog.component';
import { MobileCategoryAddEditPopupComponent } from 'src/app/component/dashboard/category/mobile-category-add-edit-popup/mobile-category-add-edit-popup.component';

import { LoaderService } from 'src/app/util/service/loader.service';
import { DateService } from 'src/app/util/service/date.service';
import { AppState } from 'src/app/store/app.state';
import { Store } from '@ngrx/store';
import * as fromProfile from 'src/app/store/profile/profile.selectors';
import * as TransactionsActions from '../../../../../store/transactions/transactions.actions';
import { loadAccounts } from 'src/app/store/accounts/accounts.actions';
import { selectAllAccounts } from 'src/app/store/accounts/accounts.selectors';
import { selectAllCategories } from 'src/app/store/categories/categories.selectors';
import { RecurringInterval, SyncStatus, TransactionStatus, TransactionType, PaymentMethod, AccountType } from 'src/app/util/config/enums';
import { Category } from 'src/app/util/models';
import { BreakpointObserver } from '@angular/cdk/layout';

import { filter, map, Observable, take, combineLatest } from 'rxjs';
import { selectLatestCompletedTransaction } from 'src/app/store/transactions/transactions.selectors';
import { Transaction, CategorySplit } from 'src/app/util/models/transaction.model';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';
import { CategorySplitDialogComponent } from 'src/app/util/components/category-split-dialog/category-split-dialog.component';
import { FormControl } from '@angular/forms';
import { ReplaySubject, Subject } from 'rxjs';
import { takeUntil, startWith } from 'rxjs/operators';
import { CurrencyService } from 'src/app/util/service/currency.service';
import { CategorySelectionSheetComponent } from './category-selection-sheet/category-selection-sheet.component';
import { UserService } from 'src/app/util/service/db/user.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonHeaderComponent } from 'src/app/util/components/dialog/common-header/common-header.component';
import { CommonBodyContentComponent } from 'src/app/util/components/dialog/common-body-content/common-body-content.component';
import { FamilyService } from 'src/app/modules/family/services/family.service';
import { FamilyMember, SplitBetweenMember, PaidByMember } from 'src/app/util/models/family.model';
import { MultiplePaidBySheetComponent } from './multiple-paid-by-sheet/multiple-paid-by-sheet.component';
import { SplitConfigSheetComponent, SplitConfigSheetData, SplitMode } from './split-config-sheet/split-config-sheet.component';



@Component({
  selector: 'app-mobile-add-transaction',
  templateUrl: './mobile-add-transaction.component.html',
  styleUrl: './mobile-add-transaction.component.scss',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatOptionModule,
    MatIconModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatTooltipModule,
    MatSlideToggleModule,
    MatChipsModule,
    MatBottomSheetModule,
    TranslateModule,
    CurrencyPipe,
    IncludesPipe,
    CategorySelectionSheetComponent,
    MatExpansionModule,
    CommonHeaderComponent,
    CommonBodyContentComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MobileAddTransactionComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('amountInput', { static: false }) amountInput!: ElementRef;

  transactionForm: FormGroup;
  public categoryList$: Observable<Category[]>;
  public accountList$: Observable<any[]>;
  public userId: any;
  public isSubmitting = signal(false);
  public isMobile: boolean = false;
  public currentCategoryIcon = signal('');
  public currentCategoryColor = signal('');
  public paymentMethods = [
    { value: PaymentMethod.CREDIT_CARD, label: 'Credit Card', icon: 'credit_card' },
    { value: PaymentMethod.DEBIT_CARD, label: 'Debit Card', icon: 'credit_card' },
    { value: PaymentMethod.BANK_TRANSFER, label: 'Bank Transfer', icon: 'account_balance' },
    { value: PaymentMethod.CASH, label: 'Cash', icon: 'money' },
    { value: PaymentMethod.DIGITAL_WALLET, label: 'Digital Wallet', icon: 'account_balance_wallet' },
  ];
  public editMode = signal(false);
  public viewMode = signal(false);
  public TransactionType = TransactionType;

  public recurringMinDate: string;
  public recurringMaxDate: string;
  public categorySplits: CategorySplit[] = [];
  public isCategorySplit = signal(false);
  private readonly _store = inject(Store<AppState>);
  private readonly familyService = inject(FamilyService);
  public isFamilyMode = toSignal(
    this._store.select(fromProfile.selectUserPreferences).pipe(
      map(prefs => prefs?.isFamilyMode ?? false)
    ),
    { initialValue: false }
  );

  // ─── Family / Split Mode ───────────────────────────────────────────────────
  /** All members of the active family group. Loaded after ngOnInit. */
  public familyMembers = signal<FamilyMember[]>([]);
  /** The mode of the active family group ('common' | 'split' | null) */
  public activeGroupMode = signal<'common' | 'split' | null>(null);
  /** True only when family mode is on AND the active group is in split mode */
  public isSplitGroupMode = computed(
    () => this.isFamilyMode() && this.activeGroupMode() === 'split'
  );

  splitConfigMode = signal<SplitMode>('equally');
  // ─────────────────────────────────────────────────────────────────────────

  public formattedAmount = signal('');

  // ngx-mat-select-search properties
  public categoryFilterCtrl: FormControl = new FormControl();
  public filteredCategories: ReplaySubject<Category[]> = new ReplaySubject<Category[]>(1);
  protected _onDestroy = new Subject<void>();
  public isGuestUser: boolean = false;
  private popstateListener = (event: PopStateEvent) => {
    if (this.isMobile) {
      // Prevent other popstate listeners (like the router) from seeing this event
      event.stopImmediatePropagation();
    }
    this.dialogRef.close();
  };

  constructor(
    @Inject(MAT_DIALOG_DATA) public dialogData: any,
    private store: Store<AppState>,
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<MobileAddTransactionComponent>,
    private notificationService: NotificationService,
    private router: Router,
    private hapticFeedback: HapticFeedbackService,
    private dialog: MatDialog,
    private loaderService: LoaderService,
    private dateService: DateService,
    private validationService: ValidationService,
    private breakpointObserver: BreakpointObserver,
    public breakpointService: BreakpointService,
    private userService: UserService,
    private currencyService: CurrencyService,
    private bottomSheet: MatBottomSheet
  ) {
    this.isGuestUser = this.userService.isGuestUser();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    this.recurringMinDate = this.dateService.toLocalISOString(tomorrow);
    
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    this.recurringMaxDate = this.dateService.toLocalISOString(nextYear);

    this.categoryList$ = this.store.select(selectAllCategories);
    this.accountList$ = this.store.select(selectAllAccounts);

    // Reactive category filtering
    combineLatest([
      this.categoryList$,
      this.categoryFilterCtrl.valueChanges.pipe(startWith(''))
    ]).pipe(
      takeUntil(this._onDestroy),
      map(([categories, search]) => {
        // Filter out system categories and the specific 'Loan Payment' income category
        let filtered = categories.filter((c: Category) => 
          !c.isSystem && 
          !(c.name.toLowerCase() === 'loan payment' && c.type === TransactionType.INCOME)
        );

        if (!search) return filtered;
        const searchLower = search.toLowerCase();
        return filtered.filter((c: Category) => c.name.toLowerCase().includes(searchLower));
      })
    ).subscribe((filtered: Category[]) => this.filteredCategories.next(filtered));

    this.transactionForm = this.fb.group({

      amount: ['', this.validationService.getTransactionAmountValidators()],
      date: [this.dateService.toLocalISOString(new Date()), Validators.required],
      description: [''],
      categoryId: ['', Validators.required],
      categoryName: ['', Validators.required],
      categoryType: ['', Validators.required],
      accountId: ['', Validators.required],
      taxAmount: [0, [Validators.min(0)]],
      taxPercentage: [0, [Validators.min(0), Validators.max(100)]],
      taxes: [[]],
      paymentMethod: [''],
      // Recurring fields
      isRecurring: [false],
      recurringInterval: [RecurringInterval.MONTHLY],
      recurringStartDate: [this.dateService.toLocalISOString(new Date())],
      recurringEndDate: [this.dateService.toLocalISOString(nextYear)],
      recurringAmount: [0],
      recurringNotes: [''],
      recurringCategoryId: [''],
      recurringCategoryName: [''],
      // Split transaction fields
      isSplitTransaction: [false],
      splitGroupId: [''],
      splitAmount: [0],
      // Category split fields
      isCategorySplit: [false],
      // Family split fields (only active when group mode = 'split')
      paidByUserId: [''],
      paidBy: [[] as PaidByMember[]],
      splitBetween: [[] as string[]], // array of selected member userIds
    });

    this.isMobile = this.breakpointObserver.isMatched('(max-width: 640px)');

    // Intercept hardware back button on mobile
    if (this.isMobile) {
      window.history.pushState({ modal: 'add-transaction' }, '');
    }
  }

  ngOnInit(): void {
    this.userId = this.userService.getCurrentUserId();
    this.initializeFormData();
    this.loadFamilyGroupInfo();

    window.addEventListener('popstate', this.popstateListener, { capture: true });
  }

  /** Loads the active family group's mode and member list */
  private loadFamilyGroupInfo(): void {
    const familyId = this.familyService.activeFamilyId();
    if (!familyId) return;

    // Fetch group metadata to determine mode
    this.familyService.getFamily(familyId).then(family => {
      if (family) {
        this.activeGroupMode.set(family.mode ?? null);
      }
    });

    // Fetch members
    this.familyService.getMembers(familyId)
      .pipe(takeUntil(this._onDestroy))
      .subscribe(members => {
        this.familyMembers.set(members);
        // Default "Paid By" to current user
        if (members.length && !this.transactionForm.get('paidByUserId')?.value) {
          this.transactionForm.patchValue({ paidByUserId: this.userId });
        }

        // If amount was typed before members loaded, calculate initial splits
        const amountVal = this.transactionForm.get('amount')?.value;
        if (amountVal && members.length > 0 && !this.editMode() && !this.viewMode()) {
          const numericVal = typeof amountVal === 'string' ? parseFloat(amountVal.replace(/,/g, '')) : amountVal;
          if (!isNaN(numericVal) && numericVal > 0) {
            this.updateEqualSplitAmounts(numericVal);
          }
        }
      });
  }

  /** Toggles a member in/out of the splitBetween list */
  toggleSplitBetweenMember(userId: string): void {
    const control = this.transactionForm.get('splitBetween');
    const current: string[] = [...(control?.value || [])];
    const idx = current.indexOf(userId);
    if (idx === -1) {
      current.push(userId);
    } else {
      current.splice(idx, 1);
    }
    control?.setValue(current);
  }

  /** Checks if a member is currently selected as paying (either singly or as part of multiple) */
  isMemberPaidBy(userId: string): boolean {
    const paidByUserId = this.transactionForm.get('paidByUserId')?.value;
    if (paidByUserId === 'multiple') {
      const paidBy = this.transactionForm.get('paidBy')?.value || [];
      return paidBy.some((p: any) => p.userId === userId);
    }
    return paidByUserId === userId;
  }

  /** Builds the splitData payload from form values */
  private buildSplitData() {
    const paidByUserId: string = this.transactionForm.get('paidByUserId')?.value || '';
    const paidBy: PaidByMember[] = this.transactionForm.get('paidBy')?.value || [];
    let splitBetween: SplitBetweenMember[] = this.transactionForm.get('splitBetween')?.value || [];
    const members = this.familyMembers();
    const paidByMember = members.find(m => m.userId === paidByUserId);

    // If it's a simple selection (just user IDs stored as strings - backward compatibility or edge case)
    // convert it to SplitBetweenMember objects
    if (splitBetween.length > 0 && typeof splitBetween[0] === 'string') {
      const amount = parseFloat(this.transactionForm.get('amount')?.value || 0);
      const splitBetweenIds = splitBetween as unknown as string[];
      splitBetween = splitBetweenIds.map(uid => {
        const m = members.find(mem => mem.userId === uid);
        const percentage = splitBetweenIds.length > 0 ? 100 / splitBetweenIds.length : 0;
        const shareAmount = amount * percentage / 100;
        return {
          userId: uid,
          displayName: m?.displayName || uid,
          photoURL: m?.photoURL || '',
          percentage: parseFloat(percentage.toFixed(2)),
          amount: parseFloat(shareAmount.toFixed(2)),
        };
      });
    }

    const data: any = {
      paidByUserId,
      paidByDisplayName: paidByUserId === 'multiple' ? 'Multiple People' : (paidByMember?.displayName || ''),
      splitBetween
    };

    if (paidByUserId === 'multiple') {
      data.paidBy = paidBy;
    } else {
      data.paidByPhotoURL = paidByMember?.photoURL || '';
    }

    return data;
  }


  private patchTransactionForm(transaction: any): void {
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);

    this.transactionForm.patchValue({
      amount: transaction.amount || '',
      date: this.dateService.toLocalISOString(transaction.date || new Date()),
      description: transaction.notes || '',
      categoryId: transaction.categoryId || '',
      categoryName: transaction.categoryName || '',
      categoryType: transaction.categoryType || transaction.type || '',
      accountId: transaction.accountId || '',
      taxAmount: transaction.taxAmount || 0,
      taxPercentage: transaction.taxPercentage || 0,
      taxes: transaction.taxes || [],
      paymentMethod: transaction.paymentMethod || '',
      isRecurring: transaction.isRecurring || false,
      recurringInterval: transaction.recurringInterval || RecurringInterval.MONTHLY,
      recurringStartDate: this.dateService.toLocalISOString(transaction.nextOccurrence || new Date()),
      recurringEndDate: this.dateService.toLocalISOString(transaction.recurringEndDate || nextYear),
      paidByUserId: transaction.splitData?.paidByUserId || '',
      paidBy: transaction.splitData?.paidBy || [],
      splitBetween: transaction.splitData?.splitBetween || [],
    });

    if (transaction.isCategorySplit) {
      this.transactionForm.patchValue({ isCategorySplit: true });
      this.isCategorySplit.set(true);
      this.categorySplits = transaction.categorySplits || [];
    }

    this.transactionForm.get('isSplitTransaction')?.setValue(transaction.isSplitTransaction || false);
    this.transactionForm.get('splitGroupId')?.setValue(transaction.splitGroupId || '');
    this.transactionForm.get('splitAmount')?.setValue(transaction.splitAmount || 0);

    this.onCategoryChange(transaction.categoryId);
  }

  private initializeFormData(): void {
    // Subscribe to amount changes to keep formattedAmount in sync
    this.transactionForm.get('amount')?.valueChanges.pipe(takeUntil(this._onDestroy)).subscribe(value => {
      if (value !== null && value !== undefined && value !== '') {
        const numericValue = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
        if (!isNaN(numericValue) && this.formattedAmount() !== this.formatCurrency(numericValue)) {
          this.formattedAmount.set(this.formatCurrency(numericValue));
        }
        this.updateEqualSplitAmounts(isNaN(numericValue) ? 0 : numericValue);
      } else {
        this.formattedAmount.set('');
        this.updateEqualSplitAmounts(0);
      }
    });

    // Check if we're in view mode
    if (this.dialogData?.mode === 'view' && this.dialogData?.transaction) {
      this.viewMode.set(true);
      this.editMode.set(false);
      this.patchTransactionForm(this.dialogData.transaction);
      // Disable all form controls in view mode
      this.transactionForm.disable();
    } else if (this.dialogData?.id) {
      this.editMode.set(true);
      this.patchTransactionForm(this.dialogData);
    } else {
      this.transactionForm.patchValue({
        amount: '',
        date: this.dateService.toLocalISOString(new Date()),
        description: '',
        categoryId: '',
        categoryName: '',
        categoryType: '',
        accountId: '',
        taxAmount: 0,
        taxPercentage: 0,
        taxes: [],
        paymentMethod: '',
      });

      combineLatest([
        this.store.select(selectLatestCompletedTransaction).pipe(take(1)),
        this.accountList$.pipe(take(1))
      ]).pipe(takeUntil(this._onDestroy)).subscribe(([transaction, accounts]) => {
        if (!accounts || accounts.length === 0) return;

        let defaultAccountId = '';

        // Priority 1: Last used account (if valid and exists in current accounts)
        if (transaction?.accountId && accounts.some(a => a.accountId === transaction.accountId)) {
          defaultAccountId = transaction.accountId;
        }

        // Priority 2: BANK type account
        if (!defaultAccountId) {
          const bankAccount = accounts.find(a => a.type === AccountType.BANK);
          if (bankAccount) {
            defaultAccountId = bankAccount.accountId;
          }
        }

        // Priority 3: Single available account
        if (!defaultAccountId && accounts.length === 1) {
          defaultAccountId = accounts[0].accountId;
        }

        // Apply defaults from transaction and accounts
        this.transactionForm.patchValue({
          accountId: defaultAccountId,
          isSplitTransaction: transaction?.isSplitTransaction || false,
          splitGroupId: transaction?.splitGroupId || '',
        });

        // Determine the default category (excluding system categories)
        this.categoryList$.pipe(take(1)).subscribe(categories => {
          const nonSystemCategories = categories.filter(c => !c.isSystem);
          
          let categoryIdToSet = '';
          if (transaction?.categoryId) {
            const isSystem = categories.find(c => c.id === transaction.categoryId)?.isSystem;
            if (!isSystem) {
              categoryIdToSet = transaction.categoryId;
            }
          }

          if (categoryIdToSet) {
            this.onCategoryChange(categoryIdToSet);
          } else {
            // If no valid previous category, select the first non-system category (preferably Expense)
            const defaultCat = nonSystemCategories.find(c => c.type === TransactionType.EXPENSE) || nonSystemCategories[0];
            if (defaultCat?.id) {
              this.onCategoryChange(defaultCat.id);
            }
          }
        });
      });
    }
  }

  private formatCurrency(value: number): string {
    if (value === null || value === undefined || isNaN(value)) return '';
    // Format without currency symbol for input display
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(value);
  }

  onFormattedAmountInput(event: any): void {
    const input = event.target.value;
    // Remove all non-numeric characters except decimal point
    const numericString = input.replace(/[^0-9.]/g, '');

    if (numericString || numericString === '0') {
      const numericValue = parseFloat(numericString);
      if (!isNaN(numericValue)) {
        this.transactionForm.get('amount')?.setValue(numericValue, { emitEvent: false });
        //this.updateTaxCalculations('amount');
        this.updateEqualSplitAmounts(numericValue);
        // Don't format while typing to avoid cursor jumps, but we could if we handle selection
        // However, user specifically asked for visibility. Let's format on blur or smartly.
      }
    } else {
      this.transactionForm.get('amount')?.setValue('', { emitEvent: false });
      this.updateEqualSplitAmounts(0);
    }
  }

  onAmountBlur(): void {
    const amount = this.transactionForm.get('amount')?.value;
    if (amount !== null && amount !== undefined && amount !== '') {
      this.formattedAmount.set(this.formatCurrency(parseFloat(amount)));
    }
  }

  ngAfterViewInit(): void {
    // Focus on amount field after view is initialized (only if not in view mode)
    if (!this.viewMode()) {
      setTimeout(() => {
        if (this.amountInput) {
          this.amountInput.nativeElement.focus();
        }
      }, 200);
    }
  }

  async onSubmit(): Promise<void> {
    // Don't submit if in view mode
    if (this.viewMode()) {
      return;
    }

    this.transactionForm.markAllAsTouched();

    // Additional validation for split transactions
    if (this.transactionForm.get('isSplitTransaction')?.value && !this.transactionForm.get('splitGroupId')?.value) {
      this.notificationService.error('Please select a group for split transaction');
      return;
    }

    if (this.transactionForm.valid && !this.isSubmitting()) {
      this.isSubmitting.set(true);

      try {
        this.loaderService.show();

        const formData = this.transactionForm.value;

        const transactionData = {

          accountId: formData.accountId,
          amount: parseFloat(formData.amount),
          category: formData.categoryName,
          categoryId: formData.categoryId,
          type: formData.categoryType as TransactionType,
          date: this.dateService.getLocalDateTimeFromForm(formData.date, true),
          notes: formData.description,
          taxAmount: formData.taxAmount || 0,
          taxPercentage: formData.taxPercentage || 0,
          taxes: formData.taxes || [],
          paymentMethod: formData.paymentMethod || '',
          isRecurring: formData.isRecurring || false,
          recurringInterval: formData.recurringInterval || RecurringInterval.MONTHLY,
          recurringEndDate: formData.recurringEndDate ? this.dateService.getLocalDateTimeFromForm(formData.recurringEndDate) : null,
          nextOccurrence: formData.isRecurring ? (() => {
            const startStr = formData.recurringStartDate || formData.date;
            const startDate = this.dateService.getLocalDateTimeFromForm(startStr);
            const transactionDate = this.dateService.getLocalDateTimeFromForm(formData.date);

            // If start date is same or before transaction date, we need to calculate the NEXT occurrence
            // because the current transaction IS the first occurrence
            if (startDate.getTime() <= transactionDate.getTime()) {
              const interval = formData.recurringInterval as RecurringInterval;
              const nextDate = new Date(startDate);
              switch (interval) {
                case RecurringInterval.DAILY: nextDate.setDate(nextDate.getDate() + 1); break;
                case RecurringInterval.WEEKLY: nextDate.setDate(nextDate.getDate() + 7); break;
                case RecurringInterval.MONTHLY: nextDate.setMonth(nextDate.getMonth() + 1); break;
                case RecurringInterval.YEARLY: nextDate.setFullYear(nextDate.getFullYear() + 1); break;
                default: break;
              }
              return nextDate;
            }

            // If start date is in the future, that IS the next occurrence
            return startDate;
          })() : null,
          status: TransactionStatus.COMPLETED,
          isSplitTransaction: formData.isSplitTransaction || false,
          splitGroupId: formData.splitGroupId || '',
          // Category split fields
          isCategorySplit: this.isCategorySplit(),
          categorySplits: this.categorySplits,
          totalSplitAmount: this.categorySplits.reduce((sum, split) => sum + split.amount, 0),
          // Family split data (applies when group mode = 'split')
          splitData: this.isSplitGroupMode() ? this.buildSplitData() : null,
          updatedBy: this.userId,
          updatedAt: new Date(),
        };

        if (this.dialogData?.id) {
          await this.store.dispatch(
            TransactionsActions.updateTransaction({
              userId: this.userId,
              transactionId: this.dialogData.id,
              transaction: transactionData,
            })
          );
          this.notificationService.success('Transaction updated successfully');
        } else {
          // Always create a regular transaction first
          const regularTransaction = await this.store.dispatch(
            TransactionsActions.createTransaction({
              userId: this.userId,
              transaction: {
                userId: this.userId,
                ...transactionData,
                syncStatus: SyncStatus.PENDING,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdBy: this.userId,
                updatedBy: this.userId,
              },
            })
          );

          this.notificationService.success('Transaction added successfully');
          this.hapticFeedback.successVibration();
        }

        this.router.navigate(['/dashboard/transactions']);

        this.dialogRef.close(true);
      } catch (error) {
        console.error('Error saving transaction:', error);
        this.notificationService.error('Failed to save transaction');
      } finally {
        this.isSubmitting.set(false);
        this.loaderService.hide();
      }
    } else {

      // Show specific validation errors

      if (this.transactionForm.get('amount')?.errors) {
      }
      if (this.transactionForm.get('categoryId')?.errors) {
      }
      if (this.transactionForm.get('categoryType')?.errors) {
      }
      if (this.transactionForm.get('accountId')?.errors) {
      }
    }
  }

  enableEditing(): void {
    this.viewMode.set(false);
    this.editMode.set(true);
    this.transactionForm.enable();
    this.hapticFeedback.lightVibration();
  }

  onClose(): void {
    this.dialogRef.close();
  }

  getAmountError(): string {
    const control = this.transactionForm.get('amount');
    return control ? this.validationService.getTransactionAmountError(control) : '';
  }

  getDateError(): string {
    const dateControl = this.transactionForm.get('date');
    if (dateControl?.hasError('required')) {
      return 'Date is required';
    }
    return '';
  }

  openNewAccountDialog(): void {
    this.dialog.open(AddAccountDialogComponent, {
      data: null, // null for new account
      disableClose: true,
      panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : 'desktop-dialog',
    }).afterClosed().subscribe((account: any) => {
      if (account) {
        this.store.dispatch(loadAccounts({ userId: this.userId }));
      }
    });
  }

  openEditAccountDialog(account: any): void {
    this.dialog.open(AddAccountDialogComponent, {
      data: account, // existing account data
      disableClose: true,
      panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : 'desktop-dialog',
    });
  }

  openNewCategoryDialog(): void {
    const dialogRef = this.dialog.open(MobileCategoryAddEditPopupComponent, {
      data: null, // null for new category
      disableClose: true,
      panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : 'desktop-dialog',
    });

    dialogRef.afterClosed().subscribe((result: any) => {
      if (result && typeof result === 'object' && result.name) {
        // Wait for the store to update the categories list, then select it
        this.categoryList$.pipe(
          filter(categories => categories.some(c => c.name === result.name && c.type === result.type)),
          take(1)
        ).subscribe(categories => {
          const newCat = categories.find(c => c.name === result.name && c.type === result.type);
          if (newCat) {
            this.onCategoryChange(newCat.id);
          }
        });
      }
    });
  }

  onCategoryChange(categoryId: any): void {
    if (!categoryId) return;

    this.categoryList$.pipe(
      take(1),
      map((categories: Category[]) => categories.find(c => c.id === categoryId)),
      filter((category): category is Category => !!category)
    ).subscribe((category: Category) => {

      this.currentCategoryIcon.set(category.icon);
      this.currentCategoryColor.set(category.color);

      this.transactionForm.patchValue({
        categoryId: category.id,
        categoryName: category.name,
        categoryType: category.type,
      });

    });
  }

  openCategorySheet(): void {
    if (this.viewMode()) return;

    // Determine default transaction type. If not set, maybe Expense or based on logic?
    // Using current form value or defaulting to Expense
    const currentType = this.transactionForm.get('categoryType')?.value || TransactionType.EXPENSE;

    const sheetRef = this.bottomSheet.open(CategorySelectionSheetComponent, {
      data: {
        selectedCategoryId: this.transactionForm.get('categoryId')?.value,
        transactionType: currentType // We might want to pass this to filter list
      },
      panelClass: 'bg-transparent' // For rounded corners if needed
    });

    sheetRef.afterDismissed().subscribe((category: Category | undefined) => {
      if (category) {
        this.onCategoryChange(category.id);
      }
    });
  }

  openMultiplePaidBySheet(): void {
    if (this.viewMode()) return;

    const amountStr = this.transactionForm.get('amount')?.value;
    const totalAmount = amountStr ? parseFloat(amountStr) : 0;

    if (totalAmount <= 0) {
      this.notificationService.error('Please enter transaction amount first');
      return;
    }

    const sheetRef = this.bottomSheet.open(MultiplePaidBySheetComponent, {
      data: {
        members: this.familyMembers(),
        totalAmount: totalAmount,
        initialPaidBy: this.transactionForm.get('paidBy')?.value || [],
        currencySymbol: '₹'
      },
      panelClass: 'bg-transparent'
    });

    sheetRef.afterDismissed().subscribe((result: PaidByMember[] | undefined) => {
      if (result) {
        if (result.length === 0) {
          // Fallback to current user if they saved an empty list somehow
          if (this.familyMembers().length > 0) {
             this.transactionForm.patchValue({ paidByUserId: this.userId, paidBy: [] });
          }
        } else if (result.length === 1) {
          // Just one person paid
          this.transactionForm.patchValue({ paidByUserId: result[0].userId, paidBy: [] });
        } else {
          // Multiple paid
          this.transactionForm.patchValue({ paidByUserId: 'multiple', paidBy: result });
        }
      }
    });
  }

  private updateEqualSplitAmounts(totalAmount: number): void {
    if (this.splitConfigMode() === 'equally') {
      const currentSplits = this.transactionForm.get('splitBetween')?.value || [];
      const members = this.familyMembers();
      
      if (currentSplits.length > 0) {
        const splitAmount = +(totalAmount / currentSplits.length).toFixed(2);
        const updatedSplits = currentSplits.map((s: any) => ({ ...s, amount: splitAmount }));
        this.transactionForm.get('splitBetween')?.setValue(updatedSplits, { emitEvent: false });
      } else if (totalAmount > 0 && members.length > 0 && !this.editMode() && !this.viewMode()) {
        const splitAmount = +(totalAmount / members.length).toFixed(2);
        const percentage = +(100 / members.length).toFixed(2);
        
        const initialSplits: SplitBetweenMember[] = members.map(m => ({
          userId: m.userId,
          displayName: m.displayName,
          photoURL: m.photoURL || '',
          amount: splitAmount,
          percentage: percentage
        }));
        
        this.transactionForm.patchValue({ splitBetween: initialSplits });
      }
    }
  }

  // ============== SPLIT CONFIGURATION BOTTOM SHEET ==============
  openSplitConfigSheet() {
    if (this.viewMode()) return;

    const amountStr = this.transactionForm.get('amount')?.value;
    const totalAmount = amountStr ? parseFloat(amountStr) : 0;

    if (totalAmount <= 0) {
      this.notificationService.error('Please enter transaction amount first');
      return;
    }

    const currentSplits = this.transactionForm.get('splitBetween')?.value || [];
    
    // Provide members, the amount, currency, and current selection
    const data: SplitConfigSheetData = {
      members: this.familyMembers(),
      totalAmount: totalAmount,
      initialMode: this.splitConfigMode(),
      initialSplits: currentSplits
    };

    const bottomSheetRef = this.bottomSheet.open(SplitConfigSheetComponent, {
       data: data,
       panelClass: 'bg-transparent'
    });

    bottomSheetRef.afterDismissed().pipe(
       takeUntil(this._onDestroy)
    ).subscribe((result?: { mode: SplitMode, splits: SplitBetweenMember[] }) => {
       if (result) {
          this.splitConfigMode.set(result.mode);
          this.transactionForm.patchValue({ splitBetween: result.splits });
          this.transactionForm.get('splitBetween')?.markAsDirty();
       }
    });
  }

  /**
   * Consolidate tax calculations
   */
  updateTaxCalculations(trigger: 'amount' | 'percentage' | 'taxAmount'): void {
    const amount = this.transactionForm.get('amount')?.value || 0;
    const percentage = this.transactionForm.get('taxPercentage')?.value || 0;
    const taxAmount = this.transactionForm.get('taxAmount')?.value || 0;

    if (amount <= 0) return;

    let update = {};
    if (trigger === 'percentage' || (trigger === 'amount' && percentage > 0)) {
      const calculatedTaxAmount = (amount * percentage) / 100;
      update = { taxAmount: parseFloat(calculatedTaxAmount.toFixed(2)) };
    } else if (trigger === 'taxAmount') {
      const calculatedPercentage = (taxAmount / amount) * 100;
      update = { taxPercentage: parseFloat(calculatedPercentage.toFixed(2)) };
    } else if (trigger === 'amount' && taxAmount > 0) {
      const calculatedPercentage = (taxAmount / amount) * 100;
      update = { taxPercentage: parseFloat(calculatedPercentage.toFixed(2)) };
    }

    if (Object.keys(update).length > 0) {
      this.transactionForm.patchValue(update, { emitEvent: false });
    }
  }

  /**
   * Clear all tax fields
   */
  clearTaxFields(): void {
    this.transactionForm.patchValue({
      taxAmount: 0,
      taxPercentage: 0,
      taxes: []
    });
  }

  /**
   * Toggle split transaction mode
   */
  toggleSplitTransaction(): void {

    // this.transactionForm.patchValue({
    //   isSplitTransaction: !this.transactionForm.get('isSplitTransaction')?.value
    // });

    // Update validation for splitGroupId
    const splitGroupIdControl = this.transactionForm.get('splitGroupId');
    if (this.transactionForm.get('isSplitTransaction')?.value) {
      splitGroupIdControl?.setValidators([Validators.required]);
    } else {
      splitGroupIdControl?.clearValidators();
      splitGroupIdControl?.setValue('');
    }
    splitGroupIdControl?.updateValueAndValidity();
  }


  openCategorySplitDialog(): void {
    const dialogRef = this.dialog.open(CategorySplitDialogComponent, {
      width: '600px',
      maxWidth: '90vw',
      data: {
        totalAmount: this.transactionForm.get('amount')?.value || 0,
        existingSplits: this.categorySplits,
        transactionType: this.transactionForm.get('categoryType')?.value || 'expense'
      }
    });

    dialogRef.afterClosed().subscribe((result: CategorySplit[] | undefined) => {
      if (result) {
        this.categorySplits = result;
        this.isCategorySplit.set(true);
        this.transactionForm.patchValue({ isCategorySplit: true });
        this.notificationService.success('Category splits configured successfully');
      }
    });
  }

  clearCategorySplits(): void {
    this.categorySplits = [];
    this.isCategorySplit.set(false);
    this.transactionForm.patchValue({ isCategorySplit: false });
  }

  getTotalSplitAmount(): number {
    return this.categorySplits.reduce((sum, split) => sum + split.amount, 0);
  }


  getPaymentMethodIcon(value: string): string {
    const method = this.paymentMethods.find(m => m.value === value);
    return method ? method.icon : 'payment';
  }

  getPaymentMethodLabel(value: string): string {
    const method = this.paymentMethods.find(m => m.value === value);
    return method ? method.label : 'None';
  }

  ngOnDestroy() {
    window.removeEventListener('popstate', this.popstateListener, { capture: true });

    // If dialog is closed via UI (Save/Cancel), clean up the history entry we pushed
    if (this.isMobile && window.history.state?.modal === 'add-transaction') {
      window.history.back();
    }

    this._onDestroy.next();
    this._onDestroy.complete();
  }

}