import { Component, Inject, inject, ViewChild, ElementRef, AfterViewInit, OnInit, OnDestroy, ChangeDetectionStrategy, signal, computed, effect, ChangeDetectorRef } from '@angular/core';
import dayjs from 'dayjs';
import { Timestamp } from '@angular/fire/firestore';
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
import { NotificationService } from 'src/app/util/service/notification.service';
import { ValidationService } from 'src/app/util/service/validation.service';
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
import { PwaNavigationService } from 'src/app/util/service/pwa-navigation.service';
import { RecurringInterval, SyncStatus, TransactionStatus, TransactionType, AccountType } from 'src/app/util/config/enums';
import { Category } from 'src/app/util/models';
import { BreakpointObserver } from '@angular/cdk/layout';

import { filter, map, Observable, take, combineLatest, merge } from 'rxjs';
import { selectLatestCompletedTransaction } from 'src/app/store/transactions/transactions.selectors';
import { Transaction, CategorySplit } from 'src/app/util/models/transaction.model';
import { RecurringTemplate } from 'src/app/util/models/recurring.model';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';
import { CategorySplitDialogComponent } from 'src/app/util/components/category-split-dialog/category-split-dialog.component';
import { FormControl } from '@angular/forms';
import { ReplaySubject, Subject } from 'rxjs';
import { takeUntil, startWith, debounceTime } from 'rxjs/operators';
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

import { ImageFallbackDirective } from 'src/app/util/directives';
import { APP_CONFIG } from 'src/app/util/config/config';
import { NgxMatSelectSearchModule } from 'ngx-mat-select-search';
import { RecurringService } from 'src/app/util/service/db/recurring.service';
import { CategoryService } from 'src/app/util/service/db/category.service';
import { firstValueFrom } from 'rxjs';



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
    MatExpansionModule,
    CommonHeaderComponent,
    CommonBodyContentComponent,
    ImageFallbackDirective,
    NgxMatSelectSearchModule
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

  public editMode = signal(false);
  public viewMode = signal(false);
  public TransactionType = TransactionType;
  public adjustmentMode = signal(false);
  public originalTransaction: Transaction | null = null;

  public recurringMinDate: string;
  public recurringMaxDate: string;
  public categorySplits: CategorySplit[] = [];
  public isCategorySplit = signal(false);
  private categoryDialogRef: MatDialogRef<MobileCategoryAddEditPopupComponent> | null = null;
  private accountDialogRef: MatDialogRef<AddAccountDialogComponent> | null = null;
  private categorySplitDialogRef: MatDialogRef<CategorySplitDialogComponent> | null = null;
  private readonly _store = inject(Store<AppState>);
  private readonly familyService = inject(FamilyService);
  public isFamilyMode = toSignal(
    this._store.select(fromProfile.selectUserPreferences).pipe(
      map(prefs => prefs?.isFamilyMode ?? false)
    ),
    { initialValue: false }
  );
  public categories = toSignal(this._store.select(selectAllCategories), { initialValue: [] as Category[] });
  public userProfile = this._store.selectSignal(fromProfile.selectProfile);

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
  
  public isReservedCategory = computed(() => {
    const name = this.transactionForm?.get('categoryName')?.value?.toLowerCase();
    const reservedNames = Object.keys(APP_CONFIG.VALIDATION.RESERVED_CATEGORY_NAMES);
    return reservedNames.includes(name);
  });

  public formattedAmount = signal('');

  onAmountKeyDown(event: KeyboardEvent) {
    const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End', '.'];
    if (allowedKeys.includes(event.key) || (event.key >= '0' && event.key <= '9')) {
      // Allow the key
      if (event.key === '.' && this.formattedAmount().includes('.')) {
        event.preventDefault(); // Prevent second decimal point
      }
      return;
    }
    event.preventDefault(); // Block everything else
  }

  // ngx-mat-select-search properties
  public categoryFilterCtrl: FormControl = new FormControl();
  public filteredCategories: ReplaySubject<Category[]> = new ReplaySubject<Category[]>(1);
  protected _onDestroy = new Subject<void>();
  public isGuestUser: boolean = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public dialogData: any,
    private store: Store<AppState>,
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<MobileAddTransactionComponent>,
    private notificationService: NotificationService,
    private router: Router,
    private dialog: MatDialog,
    private loaderService: LoaderService,
    private dateService: DateService,
    private validationService: ValidationService,
    private breakpointObserver: BreakpointObserver,
    public breakpointService: BreakpointService,
    private userService: UserService,
    private currencyService: CurrencyService,
    private bottomSheet: MatBottomSheet,
    private pwaNavigation: PwaNavigationService,
    private cdr: ChangeDetectorRef,
    private recurringService: RecurringService,
    private categoryService: CategoryService
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
        // Filter out system categories, reserved categories, and the specific 'Loan Payment' income category
        const reservedNames = Object.keys(APP_CONFIG.VALIDATION.RESERVED_CATEGORY_NAMES);
        let filtered = categories.filter((c: Category) => 
          !c.isSystem && 
          !reservedNames.includes(c.name.toLowerCase()) &&
          !(c.name.toLowerCase() === 'loan payment' && c.type === TransactionType.INCOME)
        );

        if (!search) return filtered;
        const searchLower = search.toLowerCase();
        return filtered.filter((c: Category) => c.name.toLowerCase().includes(searchLower));
      })
    ).subscribe((filtered: Category[]) => this.filteredCategories.next(filtered));

    this.transactionForm = this.fb.group({

      amount: ['', this.validationService.getTransactionAmountValidators()],
      date: [this.dateService.toLocalISOString(new Date()), this.validationService.getTransactionDateValidators()],
      description: [''],
      categoryId: ['', Validators.required],
      categoryName: ['', Validators.required],
      categoryType: ['', Validators.required],
      accountId: ['', Validators.required],
      taxAmount: [0, [Validators.min(0)]],
      taxPercentage: [0, [Validators.min(0), Validators.max(100)]],
      taxes: [[]],

      // Recurring fields
      isRecurring: [false],
      recurringInterval: [RecurringInterval.MONTHLY],
      recurringStartDate: [this.dateService.toLocalISOString(new Date()), this.validationService.getTransactionDateValidators()],
      recurringEndDate: [this.dateService.toLocalISOString(nextYear), this.validationService.getTransactionDateValidators()],
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
      
      // Transfer fields
      isTransferMode: [false],
      toAccountId: [''],
    });

    this.isMobile = this.breakpointObserver.isMatched('(max-width: 640px)');


    
    // Handle disabled state for reserved categories or view mode
    effect(() => {
      const isReserved = this.isReservedCategory();
      const isView = this.viewMode();
      const categoryIdControl = this.transactionForm.get('categoryId');
      
      if (isReserved || isView) {
        categoryIdControl?.disable({ emitEvent: false });
      } else {
        categoryIdControl?.enable({ emitEvent: false });
      }
    });

    // Handle Transfer Mode
    this.transactionForm.get('isTransferMode')?.valueChanges.pipe(takeUntil(this._onDestroy)).subscribe(isTransfer => {
      const categoryIdCtrl = this.transactionForm.get('categoryId');
      const categoryNameCtrl = this.transactionForm.get('categoryName');
      const categoryTypeCtrl = this.transactionForm.get('categoryType');
      const toAccountIdCtrl = this.transactionForm.get('toAccountId');

      if (isTransfer) {
        categoryIdCtrl?.clearValidators();
        categoryNameCtrl?.clearValidators();
        categoryTypeCtrl?.clearValidators();
        toAccountIdCtrl?.setValidators([Validators.required]);
        
        // Temporarily set valid values for category so form is valid
        categoryIdCtrl?.setValue('transfer_temp', { emitEvent: false });
        categoryNameCtrl?.setValue('Transfer', { emitEvent: false });
        categoryTypeCtrl?.setValue(TransactionType.TRANSFER, { emitEvent: false });
      } else {
        categoryIdCtrl?.setValidators([Validators.required]);
        categoryNameCtrl?.setValidators([Validators.required]);
        categoryTypeCtrl?.setValidators([Validators.required]);
        toAccountIdCtrl?.clearValidators();
        
        if (categoryIdCtrl?.value === 'transfer_temp') {
          categoryIdCtrl?.setValue('', { emitEvent: false });
          categoryNameCtrl?.setValue('', { emitEvent: false });
          categoryTypeCtrl?.setValue('', { emitEvent: false });
        }
      }

      categoryIdCtrl?.updateValueAndValidity({ emitEvent: false });
      categoryNameCtrl?.updateValueAndValidity({ emitEvent: false });
      categoryTypeCtrl?.updateValueAndValidity({ emitEvent: false });
      toAccountIdCtrl?.updateValueAndValidity({ emitEvent: false });
      this.cdr.markForCheck();
    });

    // Ensure toAccountId doesn't match accountId when accountId changes
    this.transactionForm.get('accountId')?.valueChanges.pipe(takeUntil(this._onDestroy)).subscribe(accountId => {
      const isTransfer = this.transactionForm.get('isTransferMode')?.value;
      const toAccountIdCtrl = this.transactionForm.get('toAccountId');
      if (isTransfer && accountId && toAccountIdCtrl?.value === accountId) {
        toAccountIdCtrl?.setValue('');
        toAccountIdCtrl?.markAsTouched();
        this.cdr.markForCheck();
      }
    });
  }

  ngOnInit(): void {
    this.userId = this.userService.getCurrentUserId();
    
    if (this.dialogData && this.dialogData.mode === 'adjustment') {
      this.adjustmentMode.set(true);
      this.originalTransaction = this.dialogData.transaction;
    } else if (this.dialogData && this.dialogData.id) {
       this.editMode.set(true);
    }

    this.initializeFormData();
    this.loadFamilyGroupInfo();
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
    // convert it to SplitBetweenMember objects with accurate remainder distribution
    if (splitBetween.length > 0 && typeof splitBetween[0] === 'string') {
      const amount = parseFloat(this.transactionForm.get('amount')?.value || 0);
      const splitBetweenIds = splitBetween as unknown as string[];
      const count = splitBetweenIds.length;
      
      const chunkSize = Math.floor((amount / count) * 100) / 100;
      let remainder = Math.round((amount - (chunkSize * count)) * 100);
      
      const percentSize = Math.round((100 / count) * 100) / 100;
      let percentRemainder = Math.round((100 - (percentSize * count)) * 100);

      splitBetween = splitBetweenIds.map((uid, idx) => {
        const m = members.find(mem => mem.userId === uid);
        let finalAmt = chunkSize;
        let finalPercent = percentSize;

        if (remainder > 0) {
          finalAmt = Math.round((finalAmt + 0.01) * 100) / 100;
          remainder--;
        }
        if (percentRemainder > 0) {
          finalPercent = Math.round((finalPercent + 0.01) * 100) / 100;
          percentRemainder--;
        }

        return {
          userId: uid,
          displayName: m?.displayName || uid,
          photoURL: m?.photoURL || '',
          percentage: finalPercent,
          amount: finalAmt,
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
      data.paidBy = [{
        userId: paidByUserId,
        displayName: paidByMember?.displayName || paidByUserId,
        photoURL: paidByMember?.photoURL || '',
        amount: parseFloat(this.transactionForm.get('amount')?.value || 0)
      }];
    }

    return data;
  }

  private calculateAdjustmentSplitData(newSplitData: any, multiplier: number = 1) {
    // If neither had split data, nothing to adjust in splitting
    if (!this.originalTransaction?.splitData && !newSplitData) return null;

    const originalSplitBetween = this.originalTransaction?.splitData?.splitBetween || [];
    const newSplitBetween = newSplitData?.splitBetween || [];

    const adjustedSplitBetween: any[] = [];
    const allMemberIds = new Set([
      ...originalSplitBetween.map((m: any) => m.userId),
      ...newSplitBetween.map((m: any) => m.userId)
    ]);

    allMemberIds.forEach(userId => {
      const oldM = originalSplitBetween.find((m: any) => m.userId === userId);
      const newM = newSplitBetween.find((m: any) => m.userId === userId);
      const diffAmount = ((newM?.amount || 0) - (oldM?.amount || 0)) * multiplier;

      if (Math.abs(diffAmount) > 0.001) {
        adjustedSplitBetween.push({
          userId,
          displayName: newM?.displayName || oldM?.displayName || '',
          photoURL: newM?.photoURL || oldM?.photoURL || '',
          amount: parseFloat(diffAmount.toFixed(2)),
          percentage: 0
        });
      }
    });

    if (adjustedSplitBetween.length === 0 && !newSplitData) return null;

    return {
      ...(newSplitData || {}),
      splitBetween: adjustedSplitBetween,
    };
  }

  private calculateAdjustmentPaidByData(newPaidByUserId: string, newPaidBy: PaidByMember[], multiplier: number = 1) {
    if (!this.originalTransaction) return { paidByUserId: newPaidByUserId, paidBy: newPaidBy };

    const originalPaidByUserId = this.originalTransaction.splitData?.paidByUserId || '';
    const originalPaidBy = this.originalTransaction.splitData?.paidBy || [];
    const originalAmount = this.originalTransaction.amount || 0;

    const members = this.familyMembers();

    // Helper to get normalized original paidBy list
    const getNormalizedPaidBy = (userId: string, list: PaidByMember[], total: number): PaidByMember[] => {
      if (userId === 'multiple') return list;
      const m = members.find(mem => mem.userId === userId);
      return [{ userId, amount: total, displayName: m?.displayName || userId }];
    };

    const oldPayments = getNormalizedPaidBy(originalPaidByUserId, originalPaidBy, originalAmount);
    const newPayments = getNormalizedPaidBy(newPaidByUserId, newPaidBy, parseFloat(this.transactionForm.get('amount')?.value || 0));

    const adjustedPaidBy: PaidByMember[] = [];
    const allMemberIds = new Set([
      ...oldPayments.map(p => p.userId),
      ...newPayments.map(p => p.userId)
    ]);

    allMemberIds.forEach(userId => {
      const oldP = oldPayments.find(p => p.userId === userId);
      const newP = newPayments.find(p => p.userId === userId);
      const diffAmount = ((newP?.amount || 0) - (oldP?.amount || 0)) * multiplier;

      if (Math.abs(diffAmount) > 0.001) {
        const m = members.find(mem => mem.userId === userId);
        adjustedPaidBy.push({
          userId,
          amount: parseFloat(diffAmount.toFixed(2)),
          displayName: m?.displayName || userId
        });
      }
    });

    return {
      paidByUserId: adjustedPaidBy.length === 1 && adjustedPaidBy[0].amount > 0 ? adjustedPaidBy[0].userId : 'multiple',
      paidByDisplayName: adjustedPaidBy.length === 1 && adjustedPaidBy[0].amount > 0 ? adjustedPaidBy[0].displayName : 'Multiple People',
      paidBy: adjustedPaidBy
    };
  }


  private patchTransactionForm(transaction: any): void {
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);

    this.transactionForm.patchValue({
      amount: transaction.amount || '',
      date: this.dateService.toLocalISOString(transaction.date || new Date()),
      description: transaction.notes || '',
      categoryId: transaction.categoryId || (transaction.category?.toLowerCase() === 'adjustment' ? 'adjustment' : ''),
      categoryName: transaction.categoryName || transaction.category || '',
      categoryType: transaction.categoryType || transaction.type || '',
      accountId: transaction.accountId || '',
      taxAmount: transaction.taxAmount || 0,
      taxPercentage: transaction.taxPercentage || 0,
      taxes: transaction.taxes || [],

      isRecurring: transaction.isRecurring || false,
      recurringInterval: transaction.recurringInterval || RecurringInterval.MONTHLY,
      recurringStartDate: this.dateService.toLocalISOString(transaction.nextOccurrence || new Date()),
      recurringEndDate: this.dateService.toLocalISOString(transaction.recurringEndDate || nextYear),
      paidByUserId: transaction.splitData?.paidByUserId || '',
      paidBy: transaction.splitData?.paidBy || [],
      splitBetween: transaction.splitData?.splitBetween || [],
      isTransferMode: transaction.type === TransactionType.TRANSFER,
      toAccountId: transaction.toAccountId || '',
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

    // Check if we're in adjustment mode
    if (this.adjustmentMode()) {
       this.patchTransactionForm(this.originalTransaction);
       // Relax amount validator to allow 0 for adjustments
       this.transactionForm.get('amount')?.setValidators([Validators.required, Validators.min(0)]);
       this.transactionForm.get('amount')?.updateValueAndValidity();
    } else if (this.dialogData?.mode === 'view' && this.dialogData?.transaction) {
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

        isTransferMode: false,
        toAccountId: '',
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

        // Determine the default category (excluding system/reserved categories)
        this.categoryList$.pipe(
          filter(cats => cats && cats.length > 0),
          take(1)
        ).subscribe(categories => {
          const reservedNames = Object.keys(APP_CONFIG.VALIDATION.RESERVED_CATEGORY_NAMES).map(n => n.toLowerCase());
          const nonSystemCategories = categories.filter(c => !c.isSystem && !reservedNames.includes(c.name.trim().toLowerCase()));
          
          let categoryIdToSet = '';
          if (transaction?.categoryId) {
            const cat = categories.find(c => c.id === transaction.categoryId);
            if (cat && !cat.isSystem && !reservedNames.includes(cat.name.trim().toLowerCase())) {
              categoryIdToSet = transaction.categoryId;
            }
          }

          if (categoryIdToSet) {
            this.onCategoryChange(categoryIdToSet);
          } else {
            // If no valid previous category, select the first non-system category (preferably Expense)
            const defaultCat = nonSystemCategories.find(c => c.type === TransactionType.EXPENSE) || nonSystemCategories[0];
            if (defaultCat) {
              this.onCategoryChange(defaultCat);
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

    // Additional validation for transfer transactions
    if (this.transactionForm.get('isTransferMode')?.value && 
        this.transactionForm.get('accountId')?.value === this.transactionForm.get('toAccountId')?.value) {
      this.notificationService.error('Source and destination accounts cannot be the same');
      return;
    }

    if (this.transactionForm.valid && !this.isSubmitting()) {
      this.isSubmitting.set(true);

      try {
        this.loaderService.show();

        const formData = this.transactionForm.value;

        let finalCategoryId = formData.categoryId;
        let finalCategoryName = formData.categoryName;
        let finalCategoryType = formData.categoryType as TransactionType;
        
        if (formData.isTransferMode) {
          finalCategoryType = TransactionType.TRANSFER;
          finalCategoryName = 'Transfer';
          try {
            finalCategoryId = await firstValueFrom(this.categoryService.findOrCreateSystemCategory(
              this.userId,
              'Transfer',
              TransactionType.TRANSFER,
              'swap_horiz',
              '#8b5cf6'
            ));
          } catch (e) {
            console.error('Error creating transfer category', e);
            finalCategoryId = 'transfer_system';
          }
        }

        const transactionData = {

          accountId: formData.accountId,
          toAccountId: formData.isTransferMode ? formData.toAccountId : undefined,
          amount: parseFloat(formData.amount),
          category: finalCategoryName,
          categoryId: finalCategoryId,
          categoryType: finalCategoryType,
          type: finalCategoryType,
          date: this.dateService.getLocalDateTimeFromForm(formData.date, true, this.dialogData?.date),
          notes: formData.description,
          taxAmount: formData.taxAmount || 0,
          taxPercentage: formData.taxPercentage || 0,
          taxes: formData.taxes || [],
          isRecurring: formData.isRecurring || false,
          payee: formData.description || this.dialogData?.payee || '', // Carry over payee if available
          recurringInterval: formData.recurringInterval || RecurringInterval.MONTHLY,
          recurringEndDate: formData.recurringEndDate ? this.dateService.getLocalDateTimeFromForm(formData.recurringEndDate, false, this.dialogData?.recurringEndDate) : null,
          nextOccurrence: formData.isRecurring ? (() => {
            const startStr = formData.recurringStartDate || formData.date;
            const startDate = this.dateService.getLocalDateTimeFromForm(startStr, false, this.dialogData?.recurringStartDate || this.dialogData?.date);
            const transactionDate = this.dateService.getLocalDateTimeFromForm(formData.date, false, this.dialogData?.date);
            
            // For existing transactions being converted to recurring
            const referenceDate = (this.dialogData?.id && this.dialogData.date) 
              ? this.dateService.toDate(this.dialogData.date) 
              : transactionDate;

            const interval = formData.recurringInterval as RecurringInterval;
            
            // If the start date is on or before the reference (source) transaction date, 
            // and they are in the same period, the NEXT one is truly the next one.
            const nextDate = new Date(startDate);
            
            const isSamePeriod = (d1: Date, d2: Date, inv: RecurringInterval): boolean => {
              const m1 = dayjs(d1);
              const m2 = dayjs(d2);
              if (inv === RecurringInterval.DAILY) return m1.isSame(m2, 'day');
              if (inv === RecurringInterval.WEEKLY) return m1.isSame(m2, 'week');
              if (inv === RecurringInterval.MONTHLY) return m1.isSame(m2, 'month');
              if (inv === RecurringInterval.YEARLY) return m1.isSame(m2, 'year');
              return false;
            };

            if (!referenceDate || startDate.getTime() <= referenceDate.getTime() || isSamePeriod(startDate, referenceDate, interval)) {
              switch (interval) {
                case RecurringInterval.DAILY: nextDate.setDate(nextDate.getDate() + 1); break;
                case RecurringInterval.WEEKLY: nextDate.setDate(nextDate.getDate() + 7); break;
                case RecurringInterval.MONTHLY: nextDate.setMonth(nextDate.getMonth() + 1); break;
                case RecurringInterval.YEARLY: nextDate.setFullYear(nextDate.getFullYear() + 1); break;
                default: break;
              }
              return nextDate;
            }

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
          userDisplayName: this.userProfile()?.displayName || '',
          userPhotoURL: this.userProfile()?.photoURL || '',
          createdAt: this.dialogData?.createdAt,
          createdBy: this.dialogData?.createdBy,
          updatedBy: this.userId,
          updatedAt: Timestamp.now(),
          familyId: this.isFamilyMode() ? (this.familyService.activeFamilyId() || '') : '',
        };

        if (this.adjustmentMode() && this.originalTransaction) {
          const originalAmount = this.originalTransaction.amount || 0;
          const newAmount = parseFloat(formData.amount);
          const adjustmentDiff = newAmount - originalAmount;

          // Resolve adjustment type correctly
          let adjType: TransactionType = this.originalTransaction.type;
          if (this.originalTransaction.type === TransactionType.EXPENSE) {
            adjType = adjustmentDiff >= 0 ? TransactionType.EXPENSE : TransactionType.INCOME;
          } else {
            adjType = adjustmentDiff >= 0 ? TransactionType.INCOME : TransactionType.EXPENSE;
          }

          // Sign multiplier: If we switched type (e.g. refunding an expense), we must flip the delta signs
          const multiplier = (adjType === this.originalTransaction.type) ? 1 : -1;

          // Calculate splitting deltas
          const baseSplitData = this.isSplitGroupMode() ? this.buildSplitData() : null;
          const finalAdjustmentSplitData = this.calculateAdjustmentSplitData(baseSplitData, multiplier);

          // Calculate Paid By deltas
          const paidByDeltas = this.calculateAdjustmentPaidByData(formData.paidByUserId, formData.paidBy, multiplier);
          
          if (finalAdjustmentSplitData) {
            finalAdjustmentSplitData.paidByUserId = paidByDeltas.paidByUserId;
            finalAdjustmentSplitData.paidByDisplayName = paidByDeltas.paidByDisplayName;
            finalAdjustmentSplitData.paidBy = paidByDeltas.paidBy;
          }

          // Find Adjustment Category
          const categories = this.categories();
          const adjCategory = categories.find((c: any) => c.name.toLowerCase() === 'adjustment');
          
          const adjustmentData = {
            ...transactionData,
            amount: Math.abs(adjustmentDiff),
            type: adjType,
            category: adjCategory?.name || 'Adjustment',
            categoryId: adjCategory?.id || 'adjustment',
            notes: `Adjustment for: ${this.originalTransaction.category} on ${this.dateService.formatDate(this.originalTransaction.date)}.Original notes: ${formData.description}`,
            splitData: finalAdjustmentSplitData,
            userId: this.userId,
            syncStatus: SyncStatus.PENDING,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: this.userId,
            updatedBy: this.userId,
          };

          await this.store.dispatch(
            TransactionsActions.createTransaction({
              userId: this.userId,
              transaction: adjustmentData,
            })
          );
          this.notificationService.info('Adjustment recorded successfully');
        } else if (this.dialogData?.id) {
          // 1. Update the transaction instance
          await this.store.dispatch(
            TransactionsActions.updateTransaction({
              userId: this.userId,
              transactionId: this.dialogData.id,
              transaction: transactionData,
            })
          );

          // 2. Handle recurring template (create or update)
          if (formData.isRecurring) {
            const templateUpdate: Partial<RecurringTemplate> = {
              ...transactionData,
              isActive: true,
              isRecurring: true,
              nextOccurrence: transactionData.nextOccurrence || new Date()
            };
            this.store.dispatch(
              TransactionsActions.updateRecurringTemplate({
                userId: this.userId,
                templateId: this.dialogData.id,
                template: templateUpdate,
              })
            );
            this.notificationService.info('Transaction and recurring template updated');
          } else {
            // If it WAS recurring but now it's NOT, delete the template
            if (this.dialogData.isRecurring) {
              this.store.dispatch(
                TransactionsActions.deleteRecurringTemplate({
                  userId: this.userId,
                  templateId: this.dialogData.id
                })
              );
              this.notificationService.info('Transaction updated and recurring deleted');
            } else {
              this.notificationService.info('Transaction updated successfully');
            }
          }
        } else {
          // 1. Create the regular transaction instance
          const transactionId = this.recurringService.generateId();
          const transactionToCreate = {
            id: transactionId,
            userId: this.userId,
            ...transactionData,
            isRecurring: false, // This specific record is an instance, not a template
            nextOccurrence: null,
            recurringInterval: null,
            recurringEndDate: null,
            syncStatus: SyncStatus.PENDING,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: this.userId,
            updatedBy: this.userId,
          };

          await this.store.dispatch(
            TransactionsActions.createTransaction({
              userId: this.userId,
              transaction: transactionToCreate,
            })
          );

          // 2. If it's recurring, ALSO create the template in the recurring collection
          if (formData.isRecurring) {
            const templateData: Omit<RecurringTemplate, 'id'> = {
              ...transactionData,
              userId: this.userId,
              isActive: true,
              isRecurring: true,
              nextOccurrence: transactionData.nextOccurrence || new Date(),
              syncStatus: SyncStatus.SYNCED,
              createdAt: new Date(),
              updatedAt: new Date(),
              createdBy: this.userId,
              updatedBy: this.userId,
            };
            this.store.dispatch(
              TransactionsActions.createRecurringTemplate({
                userId: this.userId,
                template: templateData,
                id: transactionId
              })
            );
          }

          this.notificationService.info('Transaction added successfully');
          this.notificationService.successVibration();
        }

        this.router.navigate(['/dashboard/transactions']).catch(() => {
          // Ignore navigation errors such as AbortError
        });

        this.dialogRef.close(true);
      } catch (error) {
        console.error('Error saving transaction:', error);
        this.notificationService.error('Failed to save transaction');
      } finally {
        this.isSubmitting.set(false);
        this.loaderService.hide();
      }
    } else {
      this.notificationService.error('Please fill in all required fields');

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
    this.notificationService.lightVibration();
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
    return dateControl ? this.validationService.getTransactionDateError(dateControl) : '';
  }

  getRecurringStartDateError(): string {
    const control = this.transactionForm.get('recurringStartDate');
    return control ? this.validationService.getTransactionDateError(control) : '';
  }

  getRecurringEndDateError(): string {
    const control = this.transactionForm.get('recurringEndDate');
    return control ? this.validationService.getTransactionDateError(control) : '';
  }

  openNewAccountDialog(): void {
    this.accountDialogRef = this.dialog.open(AddAccountDialogComponent, {
      data: null, // null for new account
      disableClose: true,
      closeOnNavigation: false,
      panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : 'desktop-dialog',
    });
    
    this.accountDialogRef.afterClosed().subscribe((account: any) => {
      if (account) {
        this.store.dispatch(loadAccounts({ userId: this.userId }));
      }
    });
  }

  openEditAccountDialog(account: any): void {
    this.accountDialogRef = this.dialog.open(AddAccountDialogComponent, {
      data: account, // existing account data
      disableClose: true,
      closeOnNavigation: false,
      panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : 'desktop-dialog',
    });
  }

  openNewCategoryDialog(): void {
    this.categoryDialogRef = this.dialog.open(MobileCategoryAddEditPopupComponent, {
      data: null, // null for new category
      disableClose: true,
      closeOnNavigation: false,
      panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : 'desktop-dialog',
    });

    this.categoryDialogRef.afterClosed().subscribe((result: any) => {
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

  onCategoryChange(categoryOrId: any): void {
    if (!categoryOrId) return;

    const reservedNames = Object.keys(APP_CONFIG.VALIDATION.RESERVED_CATEGORY_NAMES).map(n => n.toLowerCase());
    const isReserved = (cat: Category) => {
       return cat.isSystem || reservedNames.includes(cat.name?.trim()?.toLowerCase());
    };

    // Direct object handling (from sheet or initialization)
    if (typeof categoryOrId === 'object' && categoryOrId.id) {
      if (isReserved(categoryOrId)) return;
      this._applyCategoryData(categoryOrId);
      return;
    }

    // ID lookup handling
    const categoryId = categoryOrId;
    this.categoryList$.pipe(
      filter(categories => categories && categories.length > 0),
      map((categories: Category[]) => categories.find(c => c.id === categoryId)),
      take(1)
    ).subscribe((category: Category | undefined) => {
      if (category && !isReserved(category)) {
        this._applyCategoryData(category);
      } else {
        // Fallback for reserved categories or manual input if ID not in store
        const currentName = this.transactionForm.get('categoryName')?.value;
        const currentType = this.transactionForm.get('categoryType')?.value;
        if (currentName && currentType) {
           this.cdr.markForCheck();
        }
      }
    });
  }


  private _applyCategoryData(category: Category): void {
    this.currentCategoryIcon.set(category.icon);
    this.currentCategoryColor.set(category.color);

    this.transactionForm.patchValue({
      categoryId: category.id,
      categoryName: category.name,
      categoryType: category.type,
    });
    
    this.cdr.markForCheck();
  }

  openCategorySheet(): void {
    if (this.viewMode()) return;

    // Determine default transaction type. If not set, maybe Expense or based on logic?
    // Using current form value or defaulting to Expense
    const currentType = this.transactionForm.get('categoryType')?.value || TransactionType.EXPENSE;

    const ref = this.bottomSheet.open(CategorySelectionSheetComponent, {
      data: {
        categories: this.categories(),
        selectedCategory: this.transactionForm.get('categoryId')?.value
      },
      closeOnNavigation: false
    });
    this.pwaNavigation.registerBottomSheet(ref);
    
    ref.afterDismissed().subscribe(category => {
      if (category) {
        this.onCategoryChange(category);
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

    const ref = this.bottomSheet.open(MultiplePaidBySheetComponent, {
      data: {
        members: this.familyMembers(),
        paidBy: this.transactionForm.get('paidBy')?.value || [],
        totalAmount: parseFloat(this.transactionForm.get('amount')?.value || '0')
      },
      closeOnNavigation: false
    });
    this.pwaNavigation.registerBottomSheet(ref);
    
    ref.afterDismissed().subscribe((result: PaidByMember[] | undefined) => {
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
        this.cdr.markForCheck();
      }
    });
  }

  private updateEqualSplitAmounts(totalAmount: number): void {
    if (this.splitConfigMode() === 'equally') {
      const currentSplits: SplitBetweenMember[] = this.transactionForm.get('splitBetween')?.value || [];
      const members = this.familyMembers();
      
      const targetList = currentSplits.length > 0 
        ? currentSplits 
        : members.map(m => ({ userId: m.userId, displayName: m.displayName, photoURL: m.photoURL || '', amount: 0, percentage: 0 }));

      if (targetList.length > 0 && totalAmount > 0) {
        const count = targetList.length;
        const chunkSize = Math.floor((totalAmount / count) * 100) / 100;
        let remainder = Math.round((totalAmount - (chunkSize * count)) * 100);
        
        const percentSize = Math.round((100 / count) * 100) / 100;
        let percentRemainder = Math.round((100 - (percentSize * count)) * 100);

        const updatedSplits = targetList.map((s, idx) => {
          let finalAmt = chunkSize;
          let finalPercent = percentSize;

          if (remainder > 0) {
            finalAmt = Math.round((finalAmt + 0.01) * 100) / 100;
            remainder--;
          }
          if (percentRemainder > 0) {
            finalPercent = Math.round((finalPercent + 0.01) * 100) / 100;
            percentRemainder--;
          }

          return { ...s, amount: finalAmt, percentage: finalPercent };
        });

        this.transactionForm.get('splitBetween')?.setValue(updatedSplits, { emitEvent: false });
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

    const ref = this.bottomSheet.open(SplitConfigSheetComponent, {
       data: data,
       panelClass: 'bg-transparent',
       closeOnNavigation: false,
       disableClose: true
    });
    this.pwaNavigation.registerBottomSheet(ref);

    ref.afterDismissed().pipe(
       takeUntil(this._onDestroy)
    ).subscribe((result?: { mode: SplitMode, splits: SplitBetweenMember[] }) => {
       if (result) {
          this.splitConfigMode.set(result.mode);
          this.transactionForm.patchValue({ splitBetween: result.splits });
          this.transactionForm.get('splitBetween')?.markAsDirty();
          this.cdr.markForCheck();
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
    this.categorySplitDialogRef = this.dialog.open(CategorySplitDialogComponent, {
      width: '600px',
      maxWidth: '90vw',
      closeOnNavigation: false,
      data: {
        totalAmount: this.transactionForm.get('amount')?.value || 0,
        existingSplits: this.categorySplits,
        transactionType: this.transactionForm.get('categoryType')?.value || 'expense'
      }
    });

    this.categorySplitDialogRef.afterClosed().subscribe((result: CategorySplit[] | undefined) => {
      if (result) {
        this.categorySplits = result;
        this.isCategorySplit.set(true);
        this.transactionForm.patchValue({ isCategorySplit: true });
        this.notificationService.success('Category splits configured successfully');
        this.cdr.markForCheck();
      }
    });
  }

  clearCategorySplits(): void {
    this.categorySplits = [];
    this.isCategorySplit.set(false);
    this.transactionForm.patchValue({ isCategorySplit: false });
    this.cdr.markForCheck();
  }

  getTotalSplitAmount(): number {
    return this.categorySplits.reduce((sum, split) => sum + split.amount, 0);
  }




  ngOnDestroy() {
    this._onDestroy.next();
    this._onDestroy.complete();
  }

}