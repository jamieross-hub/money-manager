import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription, take } from 'rxjs';
import { Transaction } from '../../../../util/models/transaction.model';
import { TaxService, TaxCalculation } from '../../../../util/service/tax.service';
import { NotificationService } from '../../../../util/service/notification.service';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import * as TransactionsSelectors from '../../../../store/transactions/transactions.selectors';
import { UserService } from 'src/app/util/service/db/user.service';
import { CurrencyService } from '../../../../util/service/currency.service';

@Component({
  selector: 'app-tax',
  templateUrl: './tax.component.html',
  styleUrls: ['./tax.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaxComponent implements OnInit, OnDestroy {

  // Tax calculation
  taxCalculation: TaxCalculation | null = null;

  // Transaction data
  transactions: Transaction[] = [];
  totalIncome = 0;
  currentYear = new Date().getFullYear();

  // Form
  taxForm: FormGroup;
  useManualIncome = false;
  isSalaried = true;

  // UI
  isLoading = false;
  showInfo = false;
  showDeductions = false;

  private subscriptions: Subscription[] = [];

  // Example incomes for quick-fill
  readonly exampleIncomes = [800000, 1200000, 1500000, 2500000];

  constructor(
    private userService: UserService,
    private taxService: TaxService,
    private notificationService: NotificationService,
    private store: Store<AppState>,
    private fb: FormBuilder,
    private currencyService: CurrencyService,
    private cdr: ChangeDetectorRef
  ) {
    this.taxForm = this.fb.group({
      manualIncome: [0, [Validators.required, Validators.min(0)]]
    });
  }

  ngOnInit(): void {
    this.loadTransactions();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // ──────────────────────────────────────────
  // Data Loading
  // ──────────────────────────────────────────

  private loadTransactions(): void {
    const userId = this.userService.getCurrentUserId();
    if (!userId) return;

    this.isLoading = true;
    this.cdr.markForCheck();

    const sub = this.store.select(TransactionsSelectors.selectAllTransactions)
      .pipe(take(1))
      .subscribe({
        next: (transactions) => {
          this.transactions = transactions;
          this.calculateTaxFromTransactions();
        },
        error: (err) => {
          console.error('Error loading transactions:', err);
          this.notificationService.error('Failed to load transaction data');
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
    this.subscriptions.push(sub);
  }

  private calculateTaxFromTransactions(): void {
    try {
      this.totalIncome = this.taxService.calculateTotalIncome(this.transactions, this.currentYear);
      this.calculateTax();

      if (this.totalIncome > 0) {
        this.notificationService.success('Tax calculation completed!');
      }
    } catch (error) {
      console.error('Error calculating tax:', error);
      this.notificationService.error('Failed to calculate tax.');
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  // ──────────────────────────────────────────
  // Calculation
  // ──────────────────────────────────────────

  private calculateTax(): void {
    const income = this.getCurrentIncome();
    this.taxCalculation = this.taxService.calculateNewRegimeTax(income, this.isSalaried);
    this.cdr.markForCheck();
  }

  // ──────────────────────────────────────────
  // User Actions
  // ──────────────────────────────────────────

  toggleIncomeSource(): void {
    this.useManualIncome = !this.useManualIncome;

    if (this.useManualIncome) {
      const initial = this.totalIncome > 0 ? this.totalIncome : 0;
      this.taxForm.patchValue({ manualIncome: initial });
    }
    this.calculateTax();
  }

  toggleSalaried(): void {
    this.isSalaried = !this.isSalaried;
    this.calculateTax();
  }

  onManualIncomeChange(): void {
    if (this.useManualIncome) {
      const val = this.taxForm.value.manualIncome;
      if (val !== null && val !== undefined && val >= 0) {
        this.calculateTax();
      }
    }
  }

  onInputChange(event: any): void {
    const value = event.target.value;
    if (this.useManualIncome && value !== '') {
      const num = parseFloat(value);
      if (!isNaN(num) && num >= 0) {
        this.taxForm.patchValue({ manualIncome: num });
        this.calculateTax();
      }
    }
  }

  setExampleIncome(amount: number): void {
    this.useManualIncome = true;
    this.taxForm.patchValue({ manualIncome: amount });
    this.calculateTax();
  }

  // ──────────────────────────────────────────
  // Getters
  // ──────────────────────────────────────────

  getCurrentIncome(): number {
    if (this.useManualIncome) {
      const val = this.taxForm.value.manualIncome;
      return val !== null && val !== undefined && val >= 0 ? val : 0;
    }
    return this.totalIncome;
  }

  formatCurrency(amount: number): string {
    return this.currencyService.formatAmount(amount);
  }

  formatLakhs(amount: number): string {
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(1)}Cr`;
    }
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(1)}L`;
    }
    return `₹${amount.toLocaleString('en-IN')}`;
  }

  getCurrentTaxSlab(): string {
    if (!this.taxCalculation) return 'N/A';

    const slabs = this.taxService.getTaxSlabs('new');
    const taxableIncome = this.taxCalculation.taxableIncome;

    for (const slab of slabs) {
      if (taxableIncome <= slab.maxIncome) {
        return `${slab.description} (${slab.rate}%)`;
      }
    }
    return 'Above ₹24,00,000 (30%)';
  }

  isManualIncomeValid(): boolean {
    return this.taxForm.get('manualIncome')?.valid || false;
  }

  get standardDeduction(): number {
    return this.taxService.STANDARD_DEDUCTION;
  }

  get rebateLimit(): number {
    return this.taxService.REBATE_87A_LIMIT;
  }

  get effectiveRebateLimit(): number {
    return this.taxService.REBATE_87A_LIMIT + this.taxService.STANDARD_DEDUCTION;
  }

  get slabs() {
    return this.taxService.getTaxSlabs('new');
  }
}