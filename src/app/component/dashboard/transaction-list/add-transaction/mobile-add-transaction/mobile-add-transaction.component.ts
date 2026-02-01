import {
  Component,
  Inject,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnInit,
  OnDestroy,
} from '@angular/core';

import { Auth } from '@angular/fire/auth';
import { UserService } from 'src/app/util/service/db/user.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
  MatDialog,
} from '@angular/material/dialog';
import { Router } from '@angular/router';
import { HapticFeedbackService } from 'src/app/util/service/haptic-feedback.service';
import { NotificationService } from 'src/app/util/service/notification.service';
import { ValidationService } from 'src/app/util/service/validation.service';
import { AddAccountDialogComponent } from 'src/app/component/dashboard/accounts/add-account-dialog/add-account-dialog.component';
import { MobileCategoryAddEditPopupComponent } from 'src/app/component/dashboard/category/mobile-category-add-edit-popup/mobile-category-add-edit-popup.component';
import moment from 'moment';
import { LoaderService } from 'src/app/util/service/loader.service';
import { DateService } from 'src/app/util/service/date.service';
import { AppState } from 'src/app/store/app.state';
import { Store } from '@ngrx/store';
import * as TransactionsActions from '../../../../../store/transactions/transactions.actions';
import { selectAllAccounts } from 'src/app/store/accounts/accounts.selectors';
import { selectAllCategories } from 'src/app/store/categories/categories.selectors';
import {
  RecurringInterval,
  SyncStatus,
  TransactionStatus,
  TransactionType,
  PaymentMethod,
} from 'src/app/util/config/enums';
import { Category } from 'src/app/util/models';
import { BreakpointObserver } from '@angular/cdk/layout';
import { SplitwiseGroup } from 'src/app/util/models/splitwise.model';
import { selectGroups } from 'src/app/modules/splitwise/store/splitwise.selectors';
import { loadGroups } from 'src/app/modules/splitwise/store/splitwise.actions';
import { filter, map, Observable, take } from 'rxjs';
import { selectLatestTransaction } from 'src/app/store/transactions/transactions.selectors';
import { Transaction, CategorySplit } from 'src/app/util/models/transaction.model';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';
import { CategorySplitDialogComponent } from 'src/app/util/components/category-split-dialog/category-split-dialog.component';
import { FormControl } from '@angular/forms';
import { ReplaySubject, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-mobile-add-transaction',
  templateUrl: './mobile-add-transaction.component.html',
  styleUrl: './mobile-add-transaction.component.scss'
})
export class MobileAddTransactionComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('amountInput', { static: false }) amountInput!: ElementRef;

  transactionForm: FormGroup;
  public categoryList$: Observable<Category[]>;
  public accountList$: Observable<any[]>;
  public userId: any;
  public isSubmitting = false;
  public isMobile: boolean = false;
  public paymentMethods = [
    { value: PaymentMethod.CREDIT_CARD, label: 'Credit Card', icon: 'credit_card' },
    { value: PaymentMethod.DEBIT_CARD, label: 'Debit Card', icon: 'credit_card' },
    { value: PaymentMethod.BANK_TRANSFER, label: 'Bank Transfer', icon: 'account_balance' },
    { value: PaymentMethod.CASH, label: 'Cash', icon: 'money' },
    { value: PaymentMethod.DIGITAL_WALLET, label: 'Digital Wallet', icon: 'account_balance_wallet' },
  ];
  public editMode: boolean = false;
  public viewMode: boolean = false;
  public TransactionType = TransactionType;
  public groups$: Observable<SplitwiseGroup[]>;
  public recurringMinDate: string;
  public recurringMaxDate: string;
  public categorySplits: CategorySplit[] = [];
  public isCategorySplit: boolean = false;
  public formattedAmount: string = '';

  // ngx-mat-select-search properties
  public categoryFilterCtrl: FormControl = new FormControl();
  public filteredCategories: ReplaySubject<Category[]> = new ReplaySubject<Category[]>(1);
  protected _onDestroy = new Subject<void>();

  constructor(
    @Inject(MAT_DIALOG_DATA) public dialogData: any,
    private store: Store<AppState>,
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<MobileAddTransactionComponent>,
    private auth: Auth,
    private notificationService: NotificationService,
    private router: Router,
    private hapticFeedback: HapticFeedbackService,
    private dialog: MatDialog,
    private loaderService: LoaderService,
    private dateService: DateService,
    private validationService: ValidationService,
    private breakpointObserver: BreakpointObserver,
    public breakpointService: BreakpointService,
    private userService: UserService
  ) {
    this.recurringMinDate = moment().add(1, 'day').format('YYYY-MM-DD');
    this.recurringMaxDate = moment().add(1, 'year').format('YYYY-MM-DD');
    this.store.dispatch(loadGroups());// Load groups
    this.groups$ = this.store.select(selectGroups);
    this.categoryList$ = this.store.select(selectAllCategories);
    this.accountList$ = this.store.select(selectAllAccounts);

    // Initialize filtered categories for ngx-mat-select-search
    this.categoryList$.subscribe(categories => {
      this.filteredCategories.next(categories.slice());
    });

    // Listen for search input changes
    this.categoryFilterCtrl.valueChanges
      .pipe(takeUntil(this._onDestroy))
      .subscribe(() => {
        this.filterCategories();
      });

    this.transactionForm = this.fb.group({
      payee: ['', this.validationService.getTransactionPayeeValidators()],
      amount: ['', this.validationService.getTransactionAmountValidators()],
      date: [moment().format('YYYY-MM-DD'), Validators.required],
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
      recurringStartDate: [moment().format('YYYY-MM-DD')],
      recurringEndDate: [moment().add(1, 'year').format('YYYY-MM-DD')],
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
    });

    this.isMobile = this.breakpointObserver.isMatched('(max-width: 640px)');
  }

  ngOnInit(): void {
    this.userId = this.userService.getCurrentUserId();
    this.initializeFormData();

    window.addEventListener('popstate', (event) => {
      this.dialogRef.close();
      event.preventDefault();
    });
  }


  private patchTransactionForm(transaction: any): void {
    this.transactionForm.patchValue({
      payee: transaction.payee || '',
      amount: transaction.amount || '',
      date: transaction.date ?
        moment(this.dateService.toDate(transaction.date)).format('YYYY-MM-DD') :
        moment().format('YYYY-MM-DD'),
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
      recurringStartDate: transaction.nextOccurrence ?
        moment(this.dateService.toDate(transaction.nextOccurrence)).format('YYYY-MM-DD') :
        moment().format('YYYY-MM-DD'),
      recurringEndDate: transaction.recurringEndDate ?
        moment(this.dateService.toDate(transaction.recurringEndDate)).format('YYYY-MM-DD') :
        moment().add(1, 'year').format('YYYY-MM-DD'),
    });

    this.transactionForm.get('isSplitTransaction')?.setValue(transaction.isSplitTransaction || false);
    this.transactionForm.get('splitGroupId')?.setValue(transaction.splitGroupId || '');
    this.transactionForm.get('splitAmount')?.setValue(transaction.splitAmount || 0);

    this.onCategoryChange(transaction.categoryId);
  }

  private initializeFormData(): void {
    // Check if we're in view mode
    if (this.dialogData?.mode === 'view' && this.dialogData?.transaction) {
      this.viewMode = true;
      this.editMode = false;
      this.patchTransactionForm(this.dialogData.transaction);
      // Disable all form controls in view mode
      this.transactionForm.disable();
    } else if (this.dialogData?.id) {
      this.editMode = true;
      this.patchTransactionForm(this.dialogData);
    } else {
      this.transactionForm.patchValue({
        payee: '',
        amount: '',
        date: moment().format('YYYY-MM-DD'),
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
      this.getRecentTransaction();
    }

    // Subscribe to amount changes to keep formattedAmount in sync
    this.transactionForm.get('amount')?.valueChanges.subscribe(value => {
      if (value !== null && value !== undefined && value !== '') {
        const numericValue = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
        if (!isNaN(numericValue) && this.formattedAmount !== this.formatCurrency(numericValue)) {
          this.formattedAmount = this.formatCurrency(numericValue);
        }
      } else {
        this.formattedAmount = '';
      }
    });
  }

  private formatCurrency(value: number): string {
    if (value === null || value === undefined || isNaN(value)) return '';
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
        // Don't format while typing to avoid cursor jumps, but we could if we handle selection
        // However, user specifically asked for visibility. Let's format on blur or smartly.
      }
    } else {
      this.transactionForm.get('amount')?.setValue('', { emitEvent: false });
    }
  }

  onAmountBlur(): void {
    const amount = this.transactionForm.get('amount')?.value;
    if (amount !== null && amount !== undefined && amount !== '') {
      this.formattedAmount = this.formatCurrency(parseFloat(amount));
    }
  }

  private getRecentTransaction(): void {
    this.store.select(selectLatestTransaction).pipe(take(1)).subscribe((transaction: Transaction | null) => {
      if (transaction) {
        this.transactionForm.patchValue({
          categoryName: transaction.category,
          categoryType: transaction.type,
          categoryId: transaction.categoryId,
          payee: transaction.payee,
          accountId: transaction.accountId,
          isSplitTransaction: transaction.isSplitTransaction,
          splitGroupId: transaction.splitGroupId,
        });
      }
    });
  }

  ngAfterViewInit(): void {
    // Focus on amount field after view is initialized (only if not in view mode)
    if (!this.viewMode) {
      setTimeout(() => {
        if (this.amountInput) {
          this.amountInput.nativeElement.focus();
        }
      }, 200);
    }
  }

  async onSubmit(): Promise<void> {
    // Don't submit if in view mode
    if (this.viewMode) {
      return;
    }

    this.transactionForm.markAllAsTouched();

    // Additional validation for split transactions
    if (this.transactionForm.get('isSplitTransaction')?.value && !this.transactionForm.get('splitGroupId')?.value) {
      this.notificationService.error('Please select a group for split transaction');
      return;
    }

    if (this.transactionForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;

      try {
        this.loaderService.show();

        const formData = this.transactionForm.value;

        const transactionData = {
          payee: formData.payee,
          accountId: formData.accountId,
          amount: parseFloat(formData.amount),
          category: formData.categoryName,
          categoryId: formData.categoryId,
          type: formData.categoryType as TransactionType,
          date: new Date(formData.date + ' ' + this.dateService.now().toDate().toLocaleTimeString()),
          notes: formData.description,
          taxAmount: formData.taxAmount || 0,
          taxPercentage: formData.taxPercentage || 0,
          taxes: formData.taxes || [],
          paymentMethod: formData.paymentMethod || '',
          isRecurring: formData.isRecurring || false,
          recurringInterval: formData.recurringInterval || RecurringInterval.MONTHLY,
          recurringEndDate: formData.recurringEndDate ? new Date(formData.recurringEndDate) : null,
          nextOccurrence: formData.isRecurring ? new Date(formData.recurringStartDate || formData.date) : null,
          status: TransactionStatus.COMPLETED,
          isSplitTransaction: formData.isSplitTransaction || false,
          splitGroupId: formData.splitGroupId || '',
          // Category split fields
          isCategorySplit: this.isCategorySplit,
          categorySplits: this.categorySplits,
          totalSplitAmount: this.categorySplits.reduce((sum, split) => sum + split.amount, 0),
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

        if (formData.isSplitTransaction) {
          this.router.navigate(['/dashboard/splitwise/group', formData.splitGroupId]);
        }

        this.dialogRef.close(true);
      } catch (error) {
        console.error('Error saving transaction:', error);
        this.notificationService.error('Failed to save transaction');
      } finally {
        this.isSubmitting = false;
        this.loaderService.hide();
      }
    } else {

      // Show specific validation errors
      if (this.transactionForm.get('payee')?.errors) {
      }
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
    this.dialog.open(MobileCategoryAddEditPopupComponent, {
      data: null, // null for new category
      disableClose: true,
      panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : 'desktop-dialog',
    });
  }

  onCategoryChange(categoryId: any): void {
    if (!categoryId) return;

    this.categoryList$.pipe(
      take(1),
      map((categories: Category[]) => categories.find(c => c.id === categoryId)),
      filter((category): category is Category => !!category)
    ).subscribe((category: Category) => {

      this.transactionForm.patchValue({
        categoryId: category.id,
        categoryName: category.name,
        categoryType: category.type,
        payee: this.editMode ? this.dialogData.payee : category.name,
      });

    });
  }

  /**
   * Calculate tax amount when percentage changes
   */
  onTaxPercentageChange(): void {
    const amount = this.transactionForm.get('amount')?.value || 0;
    const percentage = this.transactionForm.get('taxPercentage')?.value || 0;

    if (amount > 0 && percentage > 0) {
      const calculatedTaxAmount = (amount * percentage) / 100;
      this.transactionForm.patchValue({
        taxAmount: parseFloat(calculatedTaxAmount.toFixed(2))
      }, { emitEvent: false });
    }
  }

  /**
   * Calculate tax percentage when amount changes
   */
  onTaxAmountChange(): void {
    const amount = this.transactionForm.get('amount')?.value || 0;
    const taxAmount = this.transactionForm.get('taxAmount')?.value || 0;

    if (amount > 0 && taxAmount > 0) {
      const calculatedPercentage = (taxAmount / amount) * 100;
      this.transactionForm.patchValue({
        taxPercentage: parseFloat(calculatedPercentage.toFixed(2))
      }, { emitEvent: false });
    }
  }

  /**
   * Handle amount field changes and recalculate tax percentage if needed
   */
  onAmountChange(): void {
    const amount = this.transactionForm.get('amount')?.value || 0;
    const taxAmount = this.transactionForm.get('taxAmount')?.value || 0;

    // If there's a tax amount but no percentage, calculate the percentage
    if (amount > 0 && taxAmount > 0) {
      const calculatedPercentage = (taxAmount / amount) * 100;
      this.transactionForm.patchValue({
        taxPercentage: parseFloat(calculatedPercentage.toFixed(2))
      }, { emitEvent: false });
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


  /**
   * Open Splitwise component for split transactions
   */
  openSplitwise(): void {
    // Navigate to Splitwise component
    this.router.navigate(['/dashboard/splitwise']);
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
        this.isCategorySplit = true;
        this.transactionForm.patchValue({ isCategorySplit: true });
        this.notificationService.success('Category splits configured successfully');
      }
    });
  }

  clearCategorySplits(): void {
    this.categorySplits = [];
    this.isCategorySplit = false;
    this.transactionForm.patchValue({ isCategorySplit: false });
  }

  getTotalSplitAmount(): number {
    return this.categorySplits.reduce((sum, split) => sum + split.amount, 0);
  }

  /**
   * Filter categories based on search input
   */
  protected filterCategories() {
    if (!this.categoryList$) {
      return;
    }

    this.categoryList$.pipe(take(1)).subscribe(categories => {
      // get the search keyword
      let search = this.categoryFilterCtrl.value;
      if (!search) {
        this.filteredCategories.next(categories.slice());
        return;
      } else {
        search = search.toLowerCase();
      }

      // filter the categories
      const filtered = categories.filter(category =>
        category.name.toLowerCase().indexOf(search) > -1
      );

      this.filteredCategories.next(filtered);
    });
  }

  ngOnDestroy() {
    this._onDestroy.next();
    this._onDestroy.complete();
  }

}