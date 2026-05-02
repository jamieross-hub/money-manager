import { Injectable, signal, computed, inject, OnDestroy } from '@angular/core';
import { Transaction } from '../models/transaction.model';
import { LocalIndexDBStorageService } from './indexdb-storage.service';

export interface CategoryBreakdownItem {
    categoryId: string;
    categoryName: string;
    categoryIcon: string;
    categoryColor: string;
    amount: number;
    percentage: number;
    transactionCount: number;
}

export interface MonthlySummary {
    month: number;
    year: number;
    label: string;
    income: number;
    expense: number;
    savings: number;
    savingsRate: number;
    categoryBreakdown: CategoryBreakdownItem[];
    incomeCategoryBreakdown: CategoryBreakdownItem[];
}

export interface PeriodSummary {
    label: string;
    income: number;
    expense: number;
    savings: number;
    savingsRate: number;
    avgMonthlySpending: number;
    avgMonthlyIncome: number;
    topCategory: CategoryBreakdownItem | null;
    categoryBreakdown: CategoryBreakdownItem[];
    incomeCategoryBreakdown: CategoryBreakdownItem[];
    expenseGrowth: number | null;
}

export interface Prediction {
    label: string;
    predictedExpense: number;
    predictedIncome: number;
    predictedSavings: number;
    confidence: 'low' | 'medium' | 'high';
    trend: 'increasing' | 'decreasing' | 'stable';
    overspendCategories: CategoryBreakdownItem[];
    expectedCategories: CategoryBreakdownItem[];
}

export interface ReportsProcessorOutput {
    monthlySummaries: MonthlySummary[];
    availableYears: number[];
    avgMonthlySpending: number;
    highestSpendingCategory: CategoryBreakdownItem | null;
    overallSavingsRate: number;
    currentPeriodSummary: PeriodSummary | null;
    previousPeriodSummary: PeriodSummary | null;
    filteredMonthlySummaries: MonthlySummary[];
    currentPeriodTransactions: any[];
    nextMonthPrediction: Prediction | null;
    next3MonthsPrediction: Prediction | null;
    yearEndPrediction: Prediction | null;
    isIncomeCollapsed?: boolean;
    isAccountsCollapsed?: boolean;
    isExpenseCollapsed?: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class ReportsProcessorService implements OnDestroy {
    private worker: Worker | null = null;
    private storageService = inject(LocalIndexDBStorageService);

    private _output = signal<ReportsProcessorOutput>({
        monthlySummaries: [],
        availableYears: [],
        avgMonthlySpending: 0,
        highestSpendingCategory: null,
        overallSavingsRate: 0,
        currentPeriodSummary: null,
        previousPeriodSummary: null,
        filteredMonthlySummaries: [],
        currentPeriodTransactions: [],
        nextMonthPrediction: null,
        next3MonthsPrediction: null,
        yearEndPrediction: null
    });

    public monthlySummaries = computed(() => this._output().monthlySummaries);
    public availableYears = computed(() => this._output().availableYears);
    public avgMonthlySpending = computed(() => this._output().avgMonthlySpending);
    public highestSpendingCategory = computed(() => this._output().highestSpendingCategory);
    public overallSavingsRate = computed(() => this._output().overallSavingsRate);
    public currentPeriodSummary = computed(() => this._output().currentPeriodSummary);
    public previousPeriodSummary = computed(() => this._output().previousPeriodSummary);
    public filteredMonthlySummaries = computed(() => this._output().filteredMonthlySummaries);
    public currentPeriodTransactions = computed(() => this._output().currentPeriodTransactions);
    public nextMonthPrediction = computed(() => this._output().nextMonthPrediction);
    public next3MonthsPrediction = computed(() => this._output().next3MonthsPrediction);
    public yearEndPrediction = computed(() => this._output().yearEndPrediction);
    
    public isProcessing = signal<boolean>(false);
    private lastFingerprint = '';

    constructor() {
        this.initWorker();
    }

    private initWorker() {
        if (typeof Worker !== 'undefined') {
            this.worker = new Worker(new URL('../../worker/reports-processor.worker', import.meta.url));

            this.worker.onmessage = ({ data }) => {
                this._output.set(data);
                this.isProcessing.set(false);
                if (data.durationMs) {
                    console.log(`[ReportsProcessorWorker] Processed in ${data.durationMs.toFixed(2)}ms`);
                }

                // Cache base calculations in IndexedDB
                if (data.baseRecalculated && data.baseFingerprint) {
                    this.storageService.setItem('reports_base_cache', {
                        fingerprint: data.baseFingerprint,
                        data: {
                            monthlySummaries: data.monthlySummaries,
                            availableYears: data.availableYears,
                            avgMonthlySpending: data.avgMonthlySpending,
                            highestSpendingCategory: data.highestSpendingCategory,
                            overallSavingsRate: data.overallSavingsRate,
                            nextMonthPrediction: data.nextMonthPrediction,
                            next3MonthsPrediction: data.next3MonthsPrediction,
                            yearEndPrediction: data.yearEndPrediction,
                            isIncomeCollapsed: data.isIncomeCollapsed,
                            isAccountsCollapsed: data.isAccountsCollapsed,
                            isExpenseCollapsed: data.isExpenseCollapsed
                        }
                    });
                }
            };

            this.worker.onerror = (err) => {
                console.error('Reports Processor Worker Error:', err);
                this.isProcessing.set(false);
            };
        } else {
            console.warn('Web Workers are not supported in this environment.');
        }
    }

    process(data: {
        transactions: Transaction[];
        currentUserId: string | null;
        selectedPeriod: 'weekly' | 'monthly' | 'yearly' | 'all';
        selectedYear: number;
        selectedMonth: number | null;
        selectedWeekOffset: number;
        categoryIconMap: Record<string, string>;
        categoryColorMap: Record<string, string>;
        categoryGroupMap: Record<string, string>;
        ignoredCategoryIds?: string[];
        isIncomeCollapsed?: boolean;
        isAccountsCollapsed?: boolean;
        isExpenseCollapsed?: boolean;
    }): void {
        if (!this.worker) {
            console.warn('Worker not initialized, processing skipped.');
            return;
        }
        if (!data.transactions) return;

        // Include transfers in reports so we can track credit card payments
        const reportTransactions = data.transactions;

        const fingerprint = this.generateFingerprint({ ...data, transactions: reportTransactions });
        if (fingerprint === this.lastFingerprint) return;
        this.lastFingerprint = fingerprint;

        this.isProcessing.set(true);

        // ── Optimized Fingerprinting & Caching ──
        const baseFingerprint = this.generateBaseFingerprint(reportTransactions, data.currentUserId);
        
        // Only fetch from storage if we don't have a hot worker/cache
        const cached = this.storageService.getItem<{ fingerprint: string, data: any }>('reports_base_cache');
        const isCacheValid = cached && cached.fingerprint === baseFingerprint;
        const cachedBase = isCacheValid ? cached.data : null;

        // Optimization: Only send transactions if the worker needs them (base changed or current period is weekly)
        // However, if the base changed, we SEND the transactions.
        const baseChanged = baseFingerprint !== this.workerBaseFingerprint;
        if (baseChanged) {
            this.workerBaseFingerprint = baseFingerprint;
        }

        const workerData = {
            ...data,
            transactions: baseChanged ? reportTransactions : [],
            cachedBase,
            baseFingerprint
        };

        this.worker.postMessage(workerData);
    }

    private workerBaseFingerprint = '';

    private generateBaseFingerprint(transactions: Transaction[], uid: string | null): string {
        // Fast fingerprinting: O(1) or small constant (depending on how many recent txs we check)
        // Here we just use count and sum of updatedAt for all. 
        // If performance is still an issue, we could check only the last 10 transactions.
        let sumTs = 0;
        for (let i = 0; i < transactions.length; i++) {
            const tx = transactions[i];
            const u = tx.updatedAt;
            sumTs += u ? (u instanceof Date ? u.getTime() : ((u as any).seconds || 0)) : 0;
        }
        return `${transactions.length}_${sumTs}_${uid}`;
    }

    private generateFingerprint(data: any): string {
        // Includes filters
        const base = this.generateBaseFingerprint(data.transactions, data.currentUserId);
        const ignored = (data.ignoredCategoryIds || []).join(',');
        return `${base}_${data.selectedPeriod}_${data.selectedYear}_${data.selectedMonth}_${data.selectedWeekOffset}_${ignored}`;
    }

    ngOnDestroy(): void {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        this.lastFingerprint = '';
        this.workerBaseFingerprint = '';
    }

    /** @deprecated use ngOnDestroy — kept for manual call sites if any */
    destroy(): void {
        this.ngOnDestroy();
    }
}
