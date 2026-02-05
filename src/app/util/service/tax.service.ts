import { Injectable } from '@angular/core';
import { DateService } from './date.service';
import { Transaction } from '../models/transaction.model';
import { APP_CONFIG } from '../config/config';
import { CurrencyService } from './currency.service';

export interface TaxSlab {
  minIncome: number;
  maxIncome: number;
  rate: number;
  description: string;
}

export interface TaxDeduction {
  section: string;
  description: string;
  maxAmount: number;
  currentAmount: number;
}

export interface TaxCalculation {
  totalIncome: number;
  deductions: TaxDeduction[];
  totalDeductions: number;
  taxableIncome: number;
  incomeTax: number;
  cess: number;
  totalTaxLiability: number;
  regime: 'old' | 'new';
}

export interface GSTCalculation {
  baseAmount: number;
  cgst: number;
  sgst: number;
  totalGST: number;
}

@Injectable({
  providedIn: 'root'
})
export class TaxService {

  // Old Regime Tax Slabs (FY 2024-25)
  private oldRegimeSlabs: TaxSlab[] = [
    { minIncome: 0, maxIncome: 250000, rate: 0, description: 'Up to ₹2,50,000' },
    { minIncome: 250001, maxIncome: 500000, rate: 5, description: '₹2,50,001 - ₹5,00,000' },
    { minIncome: 500001, maxIncome: 1000000, rate: 20, description: '₹5,00,001 - ₹10,00,000' },
    { minIncome: 1000001, maxIncome: Infinity, rate: 30, description: 'Above ₹10,00,000' }
  ];

  // New Regime Tax Slabs (FY 2024-25)
  private newRegimeSlabs: TaxSlab[] = [
    { minIncome: 0, maxIncome: 300000, rate: 0, description: 'Up to ₹3,00,000' },
    { minIncome: 300001, maxIncome: 600000, rate: 5, description: '₹3,00,001 - ₹6,00,000' },
    { minIncome: 600001, maxIncome: 900000, rate: 10, description: '₹6,00,001 - ₹9,00,000' },
    { minIncome: 900001, maxIncome: 1200000, rate: 15, description: '₹9,00,001 - ₹12,00,000' },
    { minIncome: 1200001, maxIncome: 1500000, rate: 20, description: '₹12,00,001 - ₹15,00,000' },
    { minIncome: 1500001, maxIncome: Infinity, rate: 30, description: 'Above ₹15,00,000' }
  ];

  // Standard deductions for new regime
  private readonly NEW_REGIME_STANDARD_DEDUCTION = APP_CONFIG.VALIDATION.MAX_AMOUNT * 0.05; // 5% of max amount as standard deduction

  constructor(
    private dateService: DateService,
    private currencyService: CurrencyService
  ) { }

  /**
   * Calculate total income from transactions for a specific year
   */
  calculateTotalIncome(transactions: Transaction[], financialYear: number = 2025): number {
    const startDate = new Date(financialYear - 1, 3, 1); // April 1st of previous year
    const endDate = new Date(financialYear, 2, 31); // March 31st of current year

    return transactions
      .filter(t => {
        const transactionDate = this.dateService.toDate(t.date) || new Date();
        return t.type === 'income' &&
          transactionDate >= startDate &&
          transactionDate <= endDate;
      })
      .reduce((sum, t) => sum + t.amount, 0);
  }

  /**
   * Get default deductions for old regime
   */
  getDefaultDeductions(): TaxDeduction[] {
    return [
      { section: '80C', description: 'ELSS, PPF, EPF, Life Insurance, etc.', maxAmount: 150000, currentAmount: 0 },
      { section: '80D', description: 'Health Insurance Premium', maxAmount: 25000, currentAmount: 0 },
      { section: '80G', description: 'Donations to Charitable Institutions', maxAmount: 100000, currentAmount: 0 },
      { section: '80TTA', description: 'Interest on Savings Account', maxAmount: 10000, currentAmount: 0 },
      { section: 'HRA', description: 'House Rent Allowance Exemption', maxAmount: 0, currentAmount: 0 },
      { section: 'LTA', description: 'Leave Travel Allowance', maxAmount: 0, currentAmount: 0 }
    ];
  }

  /**
   * Calculate tax for old regime
   */
  calculateOldRegimeTax(totalIncome: number, deductions: TaxDeduction[]): TaxCalculation {
    const totalDeductions = deductions.reduce((sum, d) => sum + d.currentAmount, 0);
    const taxableIncome = Math.max(0, totalIncome - totalDeductions);

    const incomeTax = this.calculateTaxBySlabs(taxableIncome, this.oldRegimeSlabs);
    const cess = incomeTax * 0.04; // 4% cess
    const totalTaxLiability = incomeTax + cess;

    return {
      totalIncome,
      deductions,
      totalDeductions,
      taxableIncome,
      incomeTax,
      cess,
      totalTaxLiability,
      regime: 'old'
    };
  }

  /**
   * Calculate tax for new regime
   */
  calculateNewRegimeTax(totalIncome: number): TaxCalculation {
    const taxableIncome = Math.max(0, totalIncome - this.NEW_REGIME_STANDARD_DEDUCTION);

    const incomeTax = this.calculateTaxBySlabs(taxableIncome, this.newRegimeSlabs);
    const cess = incomeTax * 0.04; // 4% cess
    const totalTaxLiability = incomeTax + cess;

    return {
      totalIncome,
      deductions: [{ section: 'Standard', description: 'Standard Deduction', maxAmount: this.NEW_REGIME_STANDARD_DEDUCTION, currentAmount: this.NEW_REGIME_STANDARD_DEDUCTION }],
      totalDeductions: this.NEW_REGIME_STANDARD_DEDUCTION,
      taxableIncome,
      incomeTax,
      cess,
      totalTaxLiability,
      regime: 'new'
    };
  }

  /**
   * Calculate tax based on tax slabs
   */
  private calculateTaxBySlabs(taxableIncome: number, slabs: TaxSlab[]): number {
    let totalTax = 0;
    let remainingIncome = taxableIncome;

    for (const slab of slabs) {
      if (remainingIncome <= 0) break;

      const slabIncome = Math.min(
        remainingIncome,
        slab.maxIncome === Infinity ? remainingIncome : slab.maxIncome - slab.minIncome + 1
      );

      totalTax += (slabIncome * slab.rate) / 100;
      remainingIncome -= slabIncome;
    }

    return totalTax;
  }

  /**
   * Calculate GST
   */
  calculateGST(baseAmount: number, gstRate: number = 18): GSTCalculation {
    const totalGST = (baseAmount * gstRate) / 100;
    const cgst = totalGST / 2; // CGST is half of total GST
    const sgst = totalGST / 2; // SGST is half of total GST

    return {
      baseAmount,
      cgst,
      sgst,
      totalGST
    };
  }

  /**
   * Get tax slabs for display
   */
  getTaxSlabs(regime: 'old' | 'new'): TaxSlab[] {
    return regime === 'old' ? this.oldRegimeSlabs : this.newRegimeSlabs;
  }

  /**
   * Compare old vs new regime
   */
  compareRegimes(totalIncome: number, deductions: TaxDeduction[]): {
    oldRegime: TaxCalculation;
    newRegime: TaxCalculation;
    recommendation: string;
    savings: number;
  } {
    const oldRegime = this.calculateOldRegimeTax(totalIncome, deductions);
    const newRegime = this.calculateNewRegimeTax(totalIncome);

    const savings = oldRegime.totalTaxLiability - newRegime.totalTaxLiability;
    const recommendation = savings > 0 ? 'new' : 'old';

    return {
      oldRegime,
      newRegime,
      recommendation,
      savings: Math.abs(savings)
    };
  }

  /**
   * Generate tax report
   */
  generateTaxReport(calculations: TaxCalculation, gstCalculation?: GSTCalculation): string {
    const report = `
INDIAN TAX ANALYSIS REPORT
Financial Year: 2024-25
Tax Regime: ${calculations.regime === 'old' ? 'Old Regime (With Deductions)' : 'New Regime (Simplified)'}

INCOME DETAILS:
Total Income: ${this.currencyService.formatAmount(calculations.totalIncome)}

${calculations.regime === 'old' ? `
DEDUCTIONS:
${calculations.deductions.map(d => `${d.section}: ${this.currencyService.formatAmount(d.currentAmount)}`).join('\n')}
Total Deductions: ${this.currencyService.formatAmount(calculations.totalDeductions)}
` : `
STANDARD DEDUCTION:
Standard Deduction: ${this.currencyService.formatAmount(calculations.totalDeductions)}
`}

TAXABLE INCOME: ${this.currencyService.formatAmount(calculations.taxableIncome)}

TAX CALCULATION:
Income Tax: ${this.currencyService.formatAmount(calculations.incomeTax)}
Cess (4%): ${this.currencyService.formatAmount(calculations.cess)}
TOTAL TAX LIABILITY: ${this.currencyService.formatAmount(calculations.totalTaxLiability)}

${gstCalculation ? `
GST ANALYSIS:
Base Amount: ${this.currencyService.formatAmount(gstCalculation.baseAmount)}
CGST (9%): ${this.currencyService.formatAmount(gstCalculation.cgst)}
SGST (9%): ${this.currencyService.formatAmount(gstCalculation.sgst)}
Total GST (18%): ${this.currencyService.formatAmount(gstCalculation.totalGST)}
` : ''}

Generated on: ${new Date().toLocaleDateString('en-IN')}
    `;

    return report;
  }
} 