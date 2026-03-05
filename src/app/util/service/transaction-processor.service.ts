import { Injectable, signal, computed } from '@angular/core';
import { Transaction } from '../models/transaction.model';
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

  /**
   * Post a processing task to the worker
   */
  process(data: {
    transactions: Transaction[];
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
  }) {
    if (!this.worker) {
      console.warn('Worker not initialized, processing skipped.');
      return;
    }

    this.isProcessing.set(true);
    this.worker.postMessage(data);
  }

  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
