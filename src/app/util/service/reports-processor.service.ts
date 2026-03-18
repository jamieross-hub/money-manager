import { Injectable, signal, computed } from '@angular/core';
import { Transaction } from '../models/transaction.model';

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
    nextMonthPrediction: Prediction | null;
    next3MonthsPrediction: Prediction | null;
    yearEndPrediction: Prediction | null;
}

@Injectable({
    providedIn: 'root'
})
export class ReportsProcessorService {
    private worker: Worker | null = null;

    private _output = signal<ReportsProcessorOutput>({
        monthlySummaries: [],
        availableYears: [],
        avgMonthlySpending: 0,
        highestSpendingCategory: null,
        overallSavingsRate: 0,
        currentPeriodSummary: null,
        previousPeriodSummary: null,
        filteredMonthlySummaries: [],
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
        selectedPeriod: 'weekly' | 'monthly' | 'yearly';
        selectedYear: number;
        selectedMonth: number | null;
        selectedWeekOffset: number;
        categoryIconMap: Record<string, string>;
        categoryColorMap: Record<string, string>;
    }): void {
        if (!this.worker) {
            console.warn('Worker not initialized, processing skipped.');
            return;
        }
        if (!data.transactions) return;

        const fingerprint = this.generateFingerprint(data);
        if (fingerprint === this.lastFingerprint) return;
        this.lastFingerprint = fingerprint;

        this.isProcessing.set(true);
        this.worker.postMessage(data);
    }

    private generateFingerprint(data: any): string {
        let sumTs = 0;
        for (const tx of data.transactions) {
            const u = tx.updatedAt;
            const ts = u ? (u instanceof Date ? u.getTime() : ((u as any).seconds || 0)) : 0;
            sumTs += ts;
        }
        return JSON.stringify({
            txCount: data.transactions.length,
            sumTs,
            period: data.selectedPeriod,
            year: data.selectedYear,
            month: data.selectedMonth,
            uid: data.currentUserId
        });
    }

    destroy() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }
}
