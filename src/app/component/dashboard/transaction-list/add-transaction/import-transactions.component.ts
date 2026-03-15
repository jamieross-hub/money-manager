import {
  Component,
  Inject,
  ElementRef,
  ViewChild,
  OnDestroy,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { NotificationService } from 'src/app/util/service/notification.service';
import { Auth } from '@angular/fire/auth';
import { UserService } from 'src/app/util/service/db/user.service';
import { BackupRestoreService } from 'src/app/util/service/backupRestore.service';
import { Account } from 'src/app/util/models/account.model';
import { Category } from 'src/app/util/models';
import { AppState } from 'src/app/store/app.state';
import { Store } from '@ngrx/store';
import { selectAllAccounts } from 'src/app/store/accounts/accounts.selectors';
import { selectAllCategories } from 'src/app/store/categories/categories.selectors';
import { APP_CONFIG } from 'src/app/util/config/config';
import { SsrService } from 'src/app/util/service/ssr.service';
import { Observable, of, take, ReplaySubject, Subject } from 'rxjs';
import { FormControl } from '@angular/forms';
import { takeUntil } from 'rxjs/operators';
import { NgxMatSelectSearchModule } from 'ngx-mat-select-search';

@Component({
  selector: 'import-transactions',
  templateUrl: './import-transactions.component.html',
  styleUrls: ['./import-transactions.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatOptionModule,
    MatChipsModule,
    MatProgressBarModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    TranslateModule,
    NgxMatSelectSearchModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImportTransactionsComponent implements OnDestroy {
  @ViewChild('fileUploadContainer') fileUploadContainer!: ElementRef;

  selectedFile: File | null = null;
  parsedTransactions: {
    type: string;
    category: string;
    categoryId?: string;
    accountId?: string;
    date: string;
    description: string;
    amount: number;
    notes?: string;
  }[] = [];
  selectedToImport: Set<number> = new Set();
  error: string = '';
  isLoading: boolean = false;
  isDragOver: boolean = false;
  fileType: string = '';

  // Dropdown data
  accounts: Account[] = [];
  categories$: Observable<Category[]> = of([]);
  categories: Category[] = [];

  // Default values
  defaultAccountId: string = '';

  // ngx-mat-select-search properties
  public categoryFilterCtrl: FormControl = new FormControl();
  public filteredCategories: ReplaySubject<Category[]> = new ReplaySubject<Category[]>(1);
  protected _onDestroy = new Subject<void>();

  // Category update functionality

  constructor(
    public dialogRef: MatDialogRef<ImportTransactionsComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { transactions: any[], categories: Category[] },
    private notificationService: NotificationService,
    private auth: Auth,
    private store: Store<AppState>,
    private ssrService: SsrService,
    private userService: UserService,
    private backupRestoreService: BackupRestoreService
  ) {
    this.categories = this.data.categories;
    this.setupDragAndDrop();
    this.loadAccountsAndCategories();

    // Initialize filtered categories for ngx-mat-select-search
    this.categories$.pipe(takeUntil(this._onDestroy)).subscribe(categories => {
      this.filteredCategories.next(categories.slice());
    });

    // Listen for search input changes
    this.categoryFilterCtrl.valueChanges
      .pipe(takeUntil(this._onDestroy))
      .subscribe(() => {
        this.filterCategories();
      });

    // Check if data was passed from Google Sheets (kept for compatibility if needed, though mostly unused now)
    if (data && data.transactions && Array.isArray(data.transactions)) {
      this.parsedTransactions = this.setCategory(data.transactions);
      this.selectedToImport = new Set(this.parsedTransactions.map((_, index) => index));
      this.notificationService.success(`Loaded ${this.parsedTransactions.length} transactions`);
    }

  }

  ngOnDestroy() {
    this._onDestroy.next();
    this._onDestroy.complete();
  }

  /**
   * Filter categories based on search input
   */
  protected filterCategories() {
    if (!this.categories$) {
      return;
    }

    this.categories$.pipe(take(1)).subscribe(categories => {
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

  private async loadAccountsAndCategories() {
    const userId = this.userService.getCurrentUserId();
    if (!userId) return;

    try {
      // Load accounts
      this.store.select(selectAllAccounts).pipe(takeUntil(this._onDestroy)).subscribe(accounts => {
        this.accounts = accounts;
        if (accounts.length > 0) {
          this.defaultAccountId = accounts[0].accountId;
        }
      });

      // Load categories
      this.categories$ = this.store.select(selectAllCategories);
    } catch (error) {
      console.error('Error loading accounts and categories:', error);
    }
  }

  updateCategory(idx: number, newCategory: string) {

    if (idx !== -1) {
      this.parsedTransactions[idx].categoryId = newCategory.split('-')[0];
      this.parsedTransactions[idx].category = newCategory.split('-')[1];
    }
  }

  private setupDragAndDrop() {
    const container = this.fileUploadContainer?.nativeElement;
    if (!container) return;

    container.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.isDragOver = true;
    });

    container.addEventListener('dragleave', (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.isDragOver = false;
    });

    container.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.isDragOver = false;

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        this.handleFile(files[0]);
      }
    });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.handleFile(file);
    }
  }

  private handleFile(file: File) {
    if (!file) {
      this.notificationService.warning('Please select a file');
      return;
    }

    this.selectedFile = file;
    // Extract extension for display purposes only, validation happens in service
    const fileExtension = file.name.split('.').pop() || '';
    this.fileType = `.${fileExtension.toUpperCase()}`;

    this.error = '';
    this.isLoading = true;
    this.notificationService.info(`Processing ${this.fileType} file...`);

    this.parseJsonFile(file);
  }

  async parseJsonFile(file: File) {
    try {
      const parsedData = await this.backupRestoreService.parseTransactionExport(file);

      if (!parsedData || parsedData.length === 0) {
        this.isLoading = false;
        this.error = 'No valid transactions found in the file.';
        this.notificationService.error('No valid transactions found');
        return;
      }

      this.isLoading = false;
      this.parsedTransactions = parsedData;

      // Select all transactions by default
      this.selectedToImport = new Set(this.parsedTransactions.map((_, index) => index));

      this.notificationService.success(
        `Successfully parsed ${this.parsedTransactions.length} transactions from JSON file`
      );

    } catch (error: any) {
      this.isLoading = false;
      this.error = error.message || 'Error parsing JSON file. Please check the format.';
      this.notificationService.error(this.error);
      console.error('JSON parsing error:', error);
    }
  }

  toggleSelect(idx: number) {
    if (this.selectedToImport.has(idx)) {
      this.selectedToImport.delete(idx);
    } else {
      this.selectedToImport.add(idx);
    }
  }

  toggleSelectAll() {
    if (this.selectedToImport.size === this.parsedTransactions.length) {
      this.selectedToImport.clear();
    } else {
      this.selectedToImport = new Set(
        this.parsedTransactions.map((_, index) => index)
      );
    }
  }

  downloadTemplate() {
    try {
      if (this.ssrService.isClientSide()) {
        this.backupRestoreService.downloadTransactionTemplate();
        this.notificationService.success('JSON template downloaded successfully');
      }
    } catch (error) {
      console.error('Error downloading template:', error);
      this.notificationService.error('Failed to download template');
    }
  }


  importSelected() {
    const selected = this.parsedTransactions.filter((_, index) =>
      this.selectedToImport.has(index)
    );
    if (selected.length === 0) {
      this.notificationService.warning(
        'Please select at least one transaction to import'
      );
      return;
    }

    // Validate selected transactions
    const validTransactions = selected.filter((tx, index) => {
      if (!tx.description || !tx.description.trim()) {
        this.notificationService.warning(
          `Transaction ${index + 1}: Description is required`
        );
        return false;
      }
      if (!tx.amount || tx.amount <= 0) {
        this.notificationService.warning(
          `Transaction ${index + 1}: Amount must be greater than 0`
        );
        return false;
      }
      if (!tx.type || !['income', 'expense'].includes(tx.type)) {
        this.notificationService.warning(
          `Transaction ${index + 1}: Invalid transaction type`
        );
        return false;
      }
      if (!tx.category || !tx.category.trim()) {
        this.notificationService.warning(
          `Transaction ${index + 1}: Category is required`
        );
        return false;
      }
      if (!tx.date) {
        this.notificationService.warning(
          `Transaction ${index + 1}: Date is required`
        );
        return false;
      }
      return true;
    });

    if (validTransactions.length === 0) {
      this.notificationService.error('No valid transactions to import');
      return;
    }

    if (validTransactions.length < selected.length) {
      this.notificationService.warning(
        `${selected.length - validTransactions.length
        } transactions were skipped due to validation errors`
      );
    }

    // Add account ID to each transaction
    const transactionsWithAccount = validTransactions.map(tx => ({
      ...tx,
      accountId: this.defaultAccountId || 'default',
      categoryId: tx.categoryId || 'default',
      category: tx.category || 'default'
    }));

    this.notificationService.success(
      `Importing ${validTransactions.length} transactions`
    );
    this.dialogRef.close(transactionsWithAccount);
  }

  close() {
    this.dialogRef.close();
  }


  setCategory(transactions: any[]) {
    // compair name of category in parsedTransactions and categories
    // if name is same, then update the categoryId

    return transactions.map((tx) => {
      const category = this.categories.find((category) => category.name.toLowerCase() === tx.category.toLowerCase());
      if (category) {
        tx['categoryId'] = category.id;
        tx['category'] = category.name;
      }
      return tx;
    });
  }
}
