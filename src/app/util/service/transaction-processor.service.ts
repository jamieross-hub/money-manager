import { Injectable, signal, computed, inject } from '@angular/core';
import { Transaction } from '../models/transaction.model';
import { RecurringTemplate } from '../models/recurring.model';
import { Category, Account } from '../models';
import { LocalIndexDBStorageService } from './indexdb-storage.service';
import { UserService } from './db/user.service';

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
  private readonly localStorageUtility = inject(LocalIndexDBStorageService);
  private readonly userService = inject(UserService);
  
  // Output Signals
  private _output = signal<ProcessorOutput>({
    filteredTransactions: [],
    flattenedTransactions: [],
    totalIncome: 0,
    totalExpenses: 0,
    filteredCount: 0
  });

  private readonly _isProcessing = signal<boolean>(false);

  public filteredTransactions = computed(() => this._output().filteredTransactions);
  public flattenedTransactions = computed(() => this._output().flattenedTransactions);
  public totalIncome = computed(() => this._output().totalIncome);
  public totalExpenses = computed(() => this._output().totalExpenses);
  public filteredCount = computed(() => this._output().filteredCount);
  public isProcessing = computed(() => this._isProcessing());

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    if (typeof Worker !== 'undefined') {
      // Initialize the worker
      this.worker = new Worker(new URL('../../worker/transaction-processor.worker', import.meta.url));
      
      this.worker.onmessage = ({ data }) => {
        const { fingerprint, currentUserId, isFamilyMode, familyId, ...output } = data;
        const uid = currentUserId || this.userService.getCurrentUserId() || 'guest';
        
        console.log(`[TransactionProcessor] Worker finished for UID: ${uid}, FP: ${fingerprint?.substring(0, 15)}...`);
        this._output.set(output);
        this._isProcessing.set(false);

        // Save to IndexDB for persistence
        if (fingerprint) {
          const cacheKey = `tx_proc_cache_${uid}_${isFamilyMode ? 'fam_' + familyId : 'personal'}`;
          console.log(`[TransactionProcessor] SETTING cache to key: ${cacheKey}`);
          this.localStorageUtility.setItem(cacheKey, {
            ...output,
            fingerprint,
            updatedAt: Date.now()
          });
          
          // Verify it was set immediately (sync test)
          const verify = this.localStorageUtility.getItem(cacheKey);
          if (!verify) {
            console.warn(`[TransactionProcessor] ⚠️ Sync verification FAILED for key: ${cacheKey}. It was set but couldn't be retrieved immediately.`);
          } else {
            console.log(`[TransactionProcessor] ✅ Sync verification SUCCESS for key: ${cacheKey}`);
          }
        }
      };

      this.worker.onerror = (err) => {
        console.error('Transaction Processor Worker Error:', err);
        this._isProcessing.set(false);
      };
    } else {
      console.warn('Web Workers are not supported in this environment.');
    }
  }

  private lastInputFingerprint = '';
  private debounceTimer: any;
  private lastFamilyMode: boolean | null = null;
  private lastFamilyId: string | undefined = undefined;

  /**
   * Generates a stable fingerprint for the input to avoid redundant processing.
   */
  private generateFingerprint(data: any): string {
    const lastTx = data.transactions?.[0];
    const filters = data.filters || {};
    
    // 💡 REMOVE dynamic fields like sessionStartTime to allow cross-session hits
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
      fid: data.familyId,
      isDel: data.isDeletedMode,
      uid: data.currentUserId || this.userService.getCurrentUserId() || 'guest'
    });
  }

  /**
   * Attempts to load filtered results from IndexedDB cache
   */
  private loadFromCache(userId: string | undefined, fingerprint: string, isFamilyMode: boolean, familyId?: string): boolean {
    const isReady = this.localStorageUtility.isReady;
    const uid = userId || this.userService.getCurrentUserId() || 'guest';
    const cacheKey = `tx_proc_cache_${uid}_${isFamilyMode ? 'fam_' + familyId : 'personal'}`;
    
    console.log(`[TransactionProcessor] Attempting CACHE LOAD (Storage Ready: ${isReady}) for key: ${cacheKey}`);
    
    if (!isReady) {
      console.warn(`[TransactionProcessor] ⏳ Cache lookup skipped: Storage is not yet ready.`);
      return false;
    }

    const cached = this.localStorageUtility.getItem<any>(cacheKey);

    if (cached) {
      if (cached.fingerprint === fingerprint) {
        console.log(`[TransactionProcessor] ✅ Cache HIT for key: ${cacheKey}`);
        this._output.set({
          filteredTransactions: cached.filteredTransactions,
          flattenedTransactions: cached.flattenedTransactions,
          totalIncome: cached.totalIncome,
          totalExpenses: cached.totalExpenses,
          filteredCount: cached.filteredCount
        });
        this._isProcessing.set(false);
        return true;
      } else {
        console.log(`[TransactionProcessor] ❌ Cache Fingerprint MISMATCH for key: ${cacheKey}`);
      }
    } else {
      console.log(`[TransactionProcessor] ❓ Cache MISS (null) for key: ${cacheKey}`);
    }
    return false;
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
    familyId?: string;
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

    // Ensure we have a valid UID for the worker and cache
    const effectiveUserId = data.currentUserId || this.userService.getCurrentUserId() || 'guest';

    // Clear stale output if major context drastically changed
    const contextChanged = this.lastFamilyMode !== data.isFamilyMode || this.lastFamilyId !== data.familyId;
    this.lastFamilyMode = data.isFamilyMode;
    this.lastFamilyId = data.familyId;

    if (contextChanged) {
      this._output.set({
        filteredTransactions: [],
        flattenedTransactions: [],
        totalIncome: 0,
        totalExpenses: 0,
        filteredCount: 0
      });
    }

    // Attempt to load from cache immediately to skip worker
    if (this.loadFromCache(effectiveUserId, fingerprint, data.isFamilyMode, data.familyId)) {
      return;
    }

    this.debounceTimer = setTimeout(() => {
      this._isProcessing.set(true);
      this.worker?.postMessage({ ...data, fingerprint, currentUserId: effectiveUserId });
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
