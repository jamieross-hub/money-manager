import { Component, OnInit, OnDestroy } from '@angular/core';
import { Auth } from '@angular/fire/auth';
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
  styleUrls: ['./tax.component.scss']
})
export class TaxComponent implements OnInit, OnDestroy {

  // Tax calculation data
  taxCalculation: TaxCalculation | null = null;

  // Transaction data
  transactions: Transaction[] = [];
  totalIncome: number = 0;
  currentYear: number = new Date().getFullYear();

  // Form data
  taxForm: FormGroup;
  useManualIncome: boolean = false;

  // UI states
  isLoading: boolean = false;

  private subscriptions: Subscription[] = [];

  constructor(
    private userService: UserService,
    private taxService: TaxService,
    private notificationService: NotificationService,
    private store: Store<AppState>,
    private fb: FormBuilder,
    private currencyService: CurrencyService
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

  /**
   * Load transactions from the service
   */
  private loadTransactions(): void {
    const userId = this.userService.getCurrentUserId();
    if (userId) {
      const sub = this.store.select(TransactionsSelectors.selectAllTransactions).pipe(take(1)).subscribe({
        next: (transactions) => {
          this.transactions = transactions;
          this.calculateTaxFromTransactions();
        },
        error: (error) => {
          console.error('Error loading transactions:', error);
          this.notificationService.error('Failed to load transaction data');
        }
      });
      this.subscriptions.push(sub);
    }
  }

  /**
   * Calculate tax based on transactions
   */
  private calculateTaxFromTransactions(): void {
    this.isLoading = true;

    try {
      // Calculate total income from current year transactions
      this.totalIncome = this.taxService.calculateTotalIncome(this.transactions, this.currentYear);

      // Calculate new regime tax
      this.calculateTax();

      if (this.totalIncome > 0) {
        this.notificationService.success('Tax calculation completed successfully!');
      }

    } catch (error) {
      console.error('Error calculating tax:', error);
      this.notificationService.error('Failed to calculate tax.');
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Calculate tax based on current income source
   */
  private calculateTax(): void {
    const incomeToUse = this.getCurrentIncome();
    this.taxCalculation = this.taxService.calculateNewRegimeTax(incomeToUse);
  }

  /**
   * Toggle between manual and automatic income
   */
  toggleIncomeSource(): void {
    this.useManualIncome = !this.useManualIncome;

    if (this.useManualIncome) {
      // Set manual income to current total income if available, otherwise 0
      const initialValue = this.totalIncome > 0 ? this.totalIncome : 0;
      this.taxForm.patchValue({ manualIncome: initialValue });
      // Trigger calculation with the new value
      setTimeout(() => this.calculateTax(), 0);
    } else {
      // Switch back to auto mode
      this.calculateTax();
    }
  }

  /**
   * Handle manual income input change
   */
  onManualIncomeChange(): void {
    if (this.useManualIncome) {
      const manualIncome = this.taxForm.value.manualIncome;
      // Calculate tax if we have a valid number (not null, undefined, or negative)
      if (manualIncome !== null && manualIncome !== undefined && manualIncome >= 0) {
        this.calculateTax();
      }
    }
  }

  /**
   * Handle input event for real-time calculation
   */
  onInputChange(event: any): void {
    const value = event.target.value;
    if (this.useManualIncome && value !== '') {
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && numValue >= 0) {
        this.taxForm.patchValue({ manualIncome: numValue });
        this.calculateTax();
      }
    }
  }

  /**
   * Get current income being used for calculation
   */
  getCurrentIncome(): number {
    if (this.useManualIncome) {
      const manualIncome = this.taxForm.value.manualIncome;
      return manualIncome !== null && manualIncome !== undefined && manualIncome >= 0 ? manualIncome : 0;
    }
    return this.totalIncome;
  }

  /**
   * Format currency for display
   */
  formatCurrency(amount: number): string {
    return this.currencyService.formatAmount(amount);
  }

  /**
   * Get tax slab for current income
   */
  getCurrentTaxSlab(): string {
    if (!this.taxCalculation) return 'N/A';

    const slabs = this.taxService.getTaxSlabs('new');
    const taxableIncome = this.taxCalculation.taxableIncome;

    for (const slab of slabs) {
      if (taxableIncome <= slab.maxIncome) {
        return `${slab.description} (${slab.rate}%)`;
      }
    }

    return 'Above ₹15,00,000 (30%)';
  }

  /**
   * Check if manual income form is valid
   */
  isManualIncomeValid(): boolean {
    return this.taxForm.get('manualIncome')?.valid || false;
  }
} 