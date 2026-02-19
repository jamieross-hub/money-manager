import { Injectable } from '@angular/core';
import { DateService } from './date.service';
import { Transaction } from '../models/transaction.model';
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

export interface SurchargeInfo {
  rate: number;
  amount: number;
  marginalRelief: boolean;
}

export interface TaxCalculation {
  totalIncome: number;
  standardDeduction: number;
  deductions: TaxDeduction[];
  totalDeductions: number;
  taxableIncome: number;
  slabWiseTax: { slab: TaxSlab; taxOnSlab: number; incomeInSlab: number }[];
  incomeTax: number;
  rebate87A: number;
  taxAfterRebate: number;
  surcharge: SurchargeInfo;
  cess: number;
  totalTaxLiability: number;
  monthlyTax: number;
  netIncomeAfterTax: number;
  effectiveTaxRate: number;
  regime: 'old' | 'new';
}

export interface GSTCalculation {
  baseAmount: number;
  cgst: number;
  sgst: number;
  totalGST: number;
}

@Injectable()
export class TaxService {

  // ── FY 2025-26 New Regime Tax Slabs (Section 115BAC) ──
  private newRegimeSlabs: TaxSlab[] = [
    { minIncome: 0, maxIncome: 400000, rate: 0, description: 'Up to ₹4,00,000' },
    { minIncome: 400001, maxIncome: 800000, rate: 5, description: '₹4,00,001 – ₹8,00,000' },
    { minIncome: 800001, maxIncome: 1200000, rate: 10, description: '₹8,00,001 – ₹12,00,000' },
    { minIncome: 1200001, maxIncome: 1600000, rate: 15, description: '₹12,00,001 – ₹16,00,000' },
    { minIncome: 1600001, maxIncome: 2000000, rate: 20, description: '₹16,00,001 – ₹20,00,000' },
    { minIncome: 2000001, maxIncome: 2400000, rate: 25, description: '₹20,00,001 – ₹24,00,000' },
    { minIncome: 2400001, maxIncome: Infinity, rate: 30, description: 'Above ₹24,00,000' }
  ];

  // Old Regime Tax Slabs (kept for comparison)
  private oldRegimeSlabs: TaxSlab[] = [
    { minIncome: 0, maxIncome: 250000, rate: 0, description: 'Up to ₹2,50,000' },
    { minIncome: 250001, maxIncome: 500000, rate: 5, description: '₹2,50,001 – ₹5,00,000' },
    { minIncome: 500001, maxIncome: 1000000, rate: 20, description: '₹5,00,001 – ₹10,00,000' },
    { minIncome: 1000001, maxIncome: Infinity, rate: 30, description: 'Above ₹10,00,000' }
  ];

  // ── Constants ──
  readonly STANDARD_DEDUCTION = 75000;         // ₹75,000 for salaried/pension
  readonly REBATE_87A_LIMIT = 1200000;        // Taxable income ≤ ₹12,00,000 → zero tax
  readonly REBATE_87A_MAX = 60000;          // Max rebate amount under new regime
  readonly CESS_RATE = 0.04;            // 4% Health & Education Cess

  // Surcharge tiers for new regime
  private surchargeSlabs = [
    { minIncome: 0, maxIncome: 5000000, rate: 0 },
    { minIncome: 5000001, maxIncome: 10000000, rate: 0.10 },  // 10%
    { minIncome: 10000001, maxIncome: 20000000, rate: 0.15 },  // 15%
    { minIncome: 20000001, maxIncome: 50000000, rate: 0.25 },  // 25% (capped at 15% for new regime incomes ≤ ₹2Cr effectively, but we keep standard rates)
    { minIncome: 50000001, maxIncome: Infinity, rate: 0.25 },  // 25% max for new regime
  ];

  constructor(
    private dateService: DateService,
    private currencyService: CurrencyService
  ) { }

  // ──────────────────────────────────────────
  // Income from Transactions
  // ──────────────────────────────────────────

  calculateTotalIncome(transactions: Transaction[], financialYear: number = 2025): number {
    const startDate = new Date(financialYear - 1, 3, 1);  // April 1
    const endDate = new Date(financialYear, 2, 31);      // March 31

    return transactions
      .filter(t => {
        const d = this.dateService.toDate(t.date) || new Date();
        return t.type === 'income' && d >= startDate && d <= endDate;
      })
      .reduce((sum, t) => sum + t.amount, 0);
  }

  // ──────────────────────────────────────────
  // New Regime Calculation (Section 115BAC)
  // ──────────────────────────────────────────

  calculateNewRegimeTax(grossIncome: number, isSalaried: boolean = true): TaxCalculation {
    // Step 1 – Standard Deduction
    const standardDeduction = isSalaried ? Math.min(this.STANDARD_DEDUCTION, grossIncome) : 0;
    const taxableIncome = Math.max(0, grossIncome - standardDeduction);

    // Step 2 – Slab-wise tax
    const { totalTax, slabWise } = this.calculateSlabWiseTax(taxableIncome, this.newRegimeSlabs);
    let incomeTax = totalTax;

    // Step 3 – Section 87A Rebate
    let rebate87A = 0;
    if (taxableIncome <= this.REBATE_87A_LIMIT) {
      rebate87A = Math.min(incomeTax, this.REBATE_87A_MAX);
    }
    const taxAfterRebate = Math.max(0, incomeTax - rebate87A);

    // Step 4 – Surcharge
    const surcharge = this.calculateSurcharge(taxableIncome, taxAfterRebate);

    // Step 5 – Cess (4% on tax + surcharge)
    const taxPlusSurcharge = taxAfterRebate + surcharge.amount;
    const cess = Math.round(taxPlusSurcharge * this.CESS_RATE);

    // Final
    const totalTaxLiability = Math.round(taxPlusSurcharge + cess);
    const monthlyTax = Math.round(totalTaxLiability / 12);
    const netIncomeAfterTax = grossIncome - totalTaxLiability;
    const effectiveTaxRate = grossIncome > 0 ? (totalTaxLiability / grossIncome) * 100 : 0;

    return {
      totalIncome: grossIncome,
      standardDeduction,
      deductions: isSalaried
        ? [{ section: 'Standard', description: 'Standard Deduction (Salaried / Pension)', maxAmount: this.STANDARD_DEDUCTION, currentAmount: standardDeduction }]
        : [],
      totalDeductions: standardDeduction,
      taxableIncome,
      slabWiseTax: slabWise,
      incomeTax,
      rebate87A,
      taxAfterRebate,
      surcharge,
      cess,
      totalTaxLiability,
      monthlyTax,
      netIncomeAfterTax,
      effectiveTaxRate,
      regime: 'new'
    };
  }

  // ──────────────────────────────────────────
  // Old Regime Calculation (kept for compare)
  // ──────────────────────────────────────────

  calculateOldRegimeTax(totalIncome: number, deductions: TaxDeduction[]): TaxCalculation {
    const totalDeductions = deductions.reduce((sum, d) => sum + d.currentAmount, 0);
    const taxableIncome = Math.max(0, totalIncome - totalDeductions);

    const { totalTax, slabWise } = this.calculateSlabWiseTax(taxableIncome, this.oldRegimeSlabs);
    const cess = Math.round(totalTax * this.CESS_RATE);
    const totalTaxLiability = Math.round(totalTax + cess);

    return {
      totalIncome,
      standardDeduction: 0,
      deductions,
      totalDeductions,
      taxableIncome,
      slabWiseTax: slabWise,
      incomeTax: totalTax,
      rebate87A: 0,
      taxAfterRebate: totalTax,
      surcharge: { rate: 0, amount: 0, marginalRelief: false },
      cess,
      totalTaxLiability,
      monthlyTax: Math.round(totalTaxLiability / 12),
      netIncomeAfterTax: totalIncome - totalTaxLiability,
      effectiveTaxRate: totalIncome > 0 ? (totalTaxLiability / totalIncome) * 100 : 0,
      regime: 'old'
    };
  }

  // ──────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────

  private calculateSlabWiseTax(taxableIncome: number, slabs: TaxSlab[]): {
    totalTax: number;
    slabWise: { slab: TaxSlab; taxOnSlab: number; incomeInSlab: number }[];
  } {
    let totalTax = 0;
    let remaining = taxableIncome;
    const slabWise: { slab: TaxSlab; taxOnSlab: number; incomeInSlab: number }[] = [];

    for (const slab of slabs) {
      if (remaining <= 0) {
        slabWise.push({ slab, taxOnSlab: 0, incomeInSlab: 0 });
        continue;
      }

      const slabWidth = slab.maxIncome === Infinity
        ? remaining
        : slab.maxIncome - slab.minIncome + 1;

      const incomeInSlab = Math.min(remaining, slabWidth);
      const taxOnSlab = Math.round((incomeInSlab * slab.rate) / 100);

      slabWise.push({ slab, taxOnSlab, incomeInSlab });
      totalTax += taxOnSlab;
      remaining -= incomeInSlab;
    }

    return { totalTax, slabWise };
  }

  private calculateSurcharge(taxableIncome: number, taxAmount: number): SurchargeInfo {
    if (taxableIncome <= 5000000 || taxAmount <= 0) {
      return { rate: 0, amount: 0, marginalRelief: false };
    }

    let applicableRate = 0;
    for (const tier of this.surchargeSlabs) {
      if (taxableIncome >= tier.minIncome && taxableIncome <= tier.maxIncome) {
        applicableRate = tier.rate;
        break;
      }
    }

    // New regime caps surcharge at 25%
    applicableRate = Math.min(applicableRate, 0.25);

    let surchargeAmount = Math.round(taxAmount * applicableRate);

    // Marginal relief: surcharge shouldn't make total tax exceed the
    // additional income above the threshold
    let marginalRelief = false;
    if (taxableIncome > 5000000 && taxableIncome <= 5100000) {
      const excess = taxableIncome - 5000000;
      if (surchargeAmount > excess) {
        surchargeAmount = excess;
        marginalRelief = true;
      }
    }

    return { rate: applicableRate * 100, amount: surchargeAmount, marginalRelief };
  }

  calculateGST(baseAmount: number, gstRate: number = 18): GSTCalculation {
    const totalGST = (baseAmount * gstRate) / 100;
    return { baseAmount, cgst: totalGST / 2, sgst: totalGST / 2, totalGST };
  }

  getTaxSlabs(regime: 'old' | 'new'): TaxSlab[] {
    return regime === 'old' ? this.oldRegimeSlabs : this.newRegimeSlabs;
  }

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

  compareRegimes(totalIncome: number, deductions: TaxDeduction[]): {
    oldRegime: TaxCalculation;
    newRegime: TaxCalculation;
    recommendation: string;
    savings: number;
  } {
    const oldRegime = this.calculateOldRegimeTax(totalIncome, deductions);
    const newRegime = this.calculateNewRegimeTax(totalIncome);
    const savings = oldRegime.totalTaxLiability - newRegime.totalTaxLiability;

    return {
      oldRegime,
      newRegime,
      recommendation: savings > 0 ? 'new' : 'old',
      savings: Math.abs(savings)
    };
  }

  generateTaxReport(calc: TaxCalculation): string {
    return `
INDIAN TAX ANALYSIS REPORT
Financial Year: 2025-26
Tax Regime: ${calc.regime === 'old' ? 'Old Regime' : 'New Regime (Section 115BAC)'}

INCOME DETAILS:
Total Income: ${this.currencyService.formatAmount(calc.totalIncome)}
Standard Deduction: ${this.currencyService.formatAmount(calc.standardDeduction)}
Taxable Income: ${this.currencyService.formatAmount(calc.taxableIncome)}

TAX CALCULATION:
Income Tax: ${this.currencyService.formatAmount(calc.incomeTax)}
Section 87A Rebate: -${this.currencyService.formatAmount(calc.rebate87A)}
Tax After Rebate: ${this.currencyService.formatAmount(calc.taxAfterRebate)}
Surcharge: ${this.currencyService.formatAmount(calc.surcharge.amount)}
Cess (4%): ${this.currencyService.formatAmount(calc.cess)}
TOTAL TAX LIABILITY: ${this.currencyService.formatAmount(calc.totalTaxLiability)}

Monthly Tax: ${this.currencyService.formatAmount(calc.monthlyTax)}
Net Income After Tax: ${this.currencyService.formatAmount(calc.netIncomeAfterTax)}
Effective Tax Rate: ${calc.effectiveTaxRate.toFixed(2)}%

Generated on: ${new Date().toLocaleDateString('en-IN')}
    `;
  }
}