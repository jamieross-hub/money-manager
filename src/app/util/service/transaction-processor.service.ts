import { Injectable, signal, computed } from '@angular/core';
import { Transaction } from '../models/transaction.model';
import { RecurringTemplate } from '../models/recurring.model';
import { Category, Account } from '../models';

export interface ProcessorOutput {
  filteredTransactions: Transaction[];
  flattenedTransactions: any[];
  totalIncome: number;
  totalExpenses: number;
  filteredCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class TransactionProcessorService {
  private worker: Worker | null = null;
  
  // Output Signals
  private _output = signal<ProcessorOutput>({
    filteredTransactions: [],
    flattenedTransactions: [],
    totalIncome: 0,
    totalExpenses: 0,
    filteredCount: 0
  });

  public filteredTransactions = computed(() => this._output().filteredTransactions);
  public flattenedTransactions = computed(() => this._output().flattenedTransactions);
  public totalIncome = computed(() => this._output().totalIncome);
  public totalExpenses = computed(() => this._output().totalExpenses);
  public filteredCount = computed(() => this._output().filteredCount);
  public isProcessing = signal<boolean>(false);

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    if (typeof Worker !== 'undefined') {
      // Initialize the worker
      this.worker = new Worker(new URL('../../worker/transaction-processor.worker', import.meta.url));
      
      this.worker.onmessage = ({ data }) => {
        this._output.set(data);
        this.isProcessing.set(false);
      };

      this.worker.onerror = (err) => {
        console.error('Transaction Processor Worker Error:', err);
        this.isProcessing.set(false);
      };
    } else {
      console.warn('Web Workers are not supported in this environment.');
    }
  }

  private lastInputFingerprint = '';
  private debounceTimer: any;

  /**
   * Generates a stable fingerprint for the input to avoid redundant processing.
   */
  private generateFingerprint(data: any): string {
    const lastTx = data.transactions?.[0];
    const filters = data.filters || {};
    
    return JSON.stringify({
      tCount: data.transactions?.length,
      lastTxId: lastTx?.id,
      lastTxUpdated: lastTx?.updatedAt || lastTx?.date,
      rtCount: data.recurringTemplates?.length,
      cCount: data.categories?.length,
      aCount: data.accounts?.length,
      search: filters.searchTerm,
      cat: filters.selectedCategory?.join(','),
      type: filters.selectedType,
      date: filters.selectedDate,
      range: filters.selectedDateRange,
      sort: data.sort,
      mode: data.range,
      view: data.appView,
      isRec: data.isRecurringMode,
      isFam: data.isFamilyMode,
      isDel: data.isDeletedMode,
      uid: data.currentUserId
    });
  }

  process(data: {
    transactions: Transaction[];
    recurringTemplates: RecurringTemplate[];
    categories: Category[];
    accounts: Account[];
    filters: any;
    sort: string;
    range: string | null;
    sessionStartTime: number;
    appView: string;
    isRecurringMode: boolean;
    isFamilyMode: boolean;
    isDeletedMode?: boolean;
    currentUserId?: string;
  }) {
    if (!this.worker) {
      console.warn('Worker not initialized, processing skipped.');
      return;
    }

    const fingerprint = this.generateFingerprint(data);
    if (this.lastInputFingerprint === fingerprint) {
      return; // Skip if input hasn't changed
    }
    this.lastInputFingerprint = fingerprint;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.isProcessing.set(true);
      this.worker?.postMessage(data);
      this.debounceTimer = null;
    }, 50); // 50ms debounce for rapid signal updates
  }

  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
