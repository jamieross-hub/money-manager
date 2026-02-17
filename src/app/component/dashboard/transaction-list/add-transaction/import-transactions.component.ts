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
import * as XLSX from 'xlsx';
import { Auth } from '@angular/fire/auth';
import { UserService } from 'src/app/util/service/db/user.service';
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
    TranslateModule
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
    private userService: UserService
  ) {
    this.categories = this.data.categories;
    this.setupDragAndDrop();
    this.loadAccountsAndCategories();

    // Initialize filtered categories for ngx-mat-select-search
    this.categories$.subscribe(categories => {
      this.filteredCategories.next(categories.slice());
    });

    // Listen for search input changes
    this.categoryFilterCtrl.valueChanges
      .pipe(takeUntil(this._onDestroy))
      .subscribe(() => {
        this.filterCategories();
      });

    // Check if data was passed from Google Sheets
    if (data && data.transactions && Array.isArray(data.transactions)) {
      this.parsedTransactions = this.setCategory(data.transactions);
      this.selectedToImport = new Set(this.parsedTransactions.map((_, index) => index));
      this.notificationService.success(`Loaded ${this.parsedTransactions.length} transactions from Google Sheets`);
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
      this.store.select(selectAllAccounts).subscribe(accounts => {
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

    const validExtensions = ['.xlsx', '.xls'];
    const fileExtension = file.name
      .toLowerCase()
      .substring(file.name.lastIndexOf('.'));

    if (!validExtensions.includes(fileExtension)) {
      this.notificationService.error('Please select an Excel file (XLSX or XLS)');
      return;
    }

    this.selectedFile = file;
    this.fileType = fileExtension.toUpperCase();
    this.error = '';
    this.isLoading = true;
    this.notificationService.info(`Processing ${this.fileType} file...`);

    this.parseExcelFile(file);
  }

  parseExcelFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        if (workbook.SheetNames.length === 0) {
          this.isLoading = false;
          this.error = 'Excel file contains no sheets.';
          this.notificationService.error('No sheets found in Excel file');
          return;
        }

        // Get the first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Convert to JSON with header row
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length < 2) {
          this.isLoading = false;
          this.error = 'Excel file is empty or has no data rows.';
          this.notificationService.error('No data found in Excel file');
          return;
        }

        // Convert to array of objects with headers
        const headers = jsonData[0] as string[];
        const rows = jsonData.slice(1) as any[][];

        // Validate headers
        if (!headers || headers.length === 0) {
          this.isLoading = false;
          this.error = 'Excel file must have a header row.';
          this.notificationService.error(
            'Invalid Excel format - missing headers'
          );
          return;
        }

        const excelData = XLSX.utils.sheet_to_json(worksheet, {
          defval: '',
          raw: true,
        });

        if (excelData.length === 0) {
          this.isLoading = false;
          this.error = 'No valid data rows found in Excel file.';
          this.notificationService.error('No valid data in Excel file');
          return;
        }

        this.isLoading = false;
        this.processParsedData(excelData);
        this.notificationService.success(
          `Successfully parsed ${this.parsedTransactions.length} transactions from Excel file`
        );

      } catch (error) {
        this.isLoading = false;
        this.error = 'Error parsing Excel file. Please check the format.';
        this.notificationService.error('Failed to parse Excel file');
        console.error('Excel parsing error:', error);
      }
    };

    reader.onerror = () => {
      this.isLoading = false;
      this.error = 'Error reading Excel file.';
      this.notificationService.error('Failed to read Excel file');
    };

    reader.readAsArrayBuffer(file);
  }

  processParsedData(data: any[]) {
    if (!data || data.length === 0) {
      this.error = 'No valid data found in the file.';
      this.notificationService.error('No transactions found in the file');
      return;
    }

    this.parseStandardFormat(data);

    if (this.parsedTransactions.length === 0) {
      this.error = 'No valid transactions found in the file.';
      this.notificationService.error('No valid transactions found');
      return;
    }

    // Select all transactions by default
    this.selectedToImport = new Set(this.parsedTransactions.map((_, index) => index));
  }

  parseStandardFormat(data: any[]) {
    this.parsedTransactions = data.map((row) => {
      return {
        type: (
          row['type'] ||
          row['Type'] ||
          row['TYPE'] ||
          'expense'
        ).toLowerCase(),
        category:
          row['category'] || row['Category'] || row['CATEGORY'] || 'Other',
        date:
          row['date'] ||
          row['Date'] ||
          row['DATE'] ||
          new Date().toISOString().split('T')[0],
        description: row['description'] || row['Description'] || row['DESCRIPTION'] || row['payee'] || row['Payee'] || row['PAYEE'] || '',
        amount: parseFloat(
          row['amount'] || row['Amount'] || row['AMOUNT'] || '0'
        ),
      };
    });
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
        const excelData = [
          ['Payee', 'Amount', 'Type', 'Category', 'Date', 'Notes'],
          ['Salary Payment', 50000, 'income', 'Salary', '2024-01-15', 'Monthly salary'],
        ];

        const ws = XLSX.utils.aoa_to_sheet(excelData);
        ws['!cols'] = [
          { width: 20 }, { width: 12 }, { width: 10 },
          { width: 18 }, { width: 12 }, { width: 25 },
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

        // Simple instructions sheet
        const instructionsData = [
          ['Transaction Import Template - Instructions'],
          [''],
          ['Column Descriptions:'],
          ['Payee', 'Name of the person, merchant, or company'],
          ['Amount', 'Transaction amount (positive number)'],
          ['Type', 'Must be either "income" or "expense"'],
          ['Category', 'Transaction category (e.g., Salary, Food & Dining, etc.)'],
          ['Date', 'Transaction date in YYYY-MM-DD format'],
          ['Notes', 'Optional description or notes'],
          [''],
          ['Important Notes:'],
          ['- Keep the header row as is (Row 1)'],
          ['- Use YYYY-MM-DD format for dates'],
          ['- Delete sample row (Row 2) before adding your data'],
        ];

        const instructionsWs = XLSX.utils.aoa_to_sheet(instructionsData);
        instructionsWs['!cols'] = [{ width: 60 }];
        XLSX.utils.book_append_sheet(wb, instructionsWs, 'Instructions');

        // Generate Excel file
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const excelBlob = new Blob([excelBuffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const excelUrl = window.URL.createObjectURL(excelBlob);
        const excelLink = document.createElement('a');
        excelLink.href = excelUrl;
        excelLink.download = 'transaction_import_template.xlsx';
        excelLink.click();
        window.URL.revokeObjectURL(excelUrl);

        this.notificationService.success('Excel template downloaded successfully');
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
