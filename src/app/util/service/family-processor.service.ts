import { Injectable, signal, computed, inject } from '@angular/core';
import { Transaction } from '../models/transaction.model';
import { FamilyMember, FamilyStats, Settlement, BalanceEntry } from '../models/family.model';
import { LocalIndexDBStorageService } from './indexdb-storage.service';

export interface FamilyProcessorInput {
  transactions: Transaction[];
  members: FamilyMember[];
  settlements: Settlement[];
  currentUserId?: string;
  sessionStartTime: number;
}

export interface FamilyProcessorOutput {
  stats: FamilyStats | null;
  balances: BalanceEntry[];
  activities: any[];
}

@Injectable({ providedIn: 'root' })
export class FamilyProcessorService {
  private worker: Worker | null = null;
  private storageService = inject(LocalIndexDBStorageService);
  private currentCacheKey: string | null = null;

  private getInitialData(): FamilyProcessorOutput | null {
    const keys = this.storageService.getAllKeys();
    const cacheKey = keys.find(k => k.startsWith('family_processed_data')) || 'family_processed_data';
    this.currentCacheKey = cacheKey;
    return this.storageService.getItem<FamilyProcessorOutput>(cacheKey);
  }

  private initialData = this.getInitialData();
  
  // Output Signals
  readonly stats = signal<FamilyStats | null>(this.initialData?.stats || null);
  readonly balances = signal<BalanceEntry[]>(this.initialData?.balances || []);
  readonly activities = signal<any[]>(this.initialData?.activities || []);
  readonly isProcessing = signal<boolean>(false);

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    if (typeof Worker !== 'undefined') {
      this.worker = new Worker(new URL('../../worker/family-processor.worker', import.meta.url));
      this.worker.onmessage = ({ data }) => {
        const { type, payload } = data;
        if (type === 'FAMILY_DATA_PROCESSED') {
          this.stats.set(payload.stats);
          this.balances.set(payload.balances);
          this.activities.set(payload.activities);
          this.isProcessing.set(false);
          
          if (this.currentCacheKey) {
            this.storageService.setItem(this.currentCacheKey, payload);
          }
        }
      };
      this.worker.onerror = (err) => {
        console.error('FamilyProcessorWorker error:', err);
        this.isProcessing.set(false);
      };
    } else {
      console.warn('Web Workers are not supported in this environment.');
    }
  }

  private debounceTimer: any;

  private lastInputStr = '';

  process(input: FamilyProcessorInput) {
    if (!this.worker) {
      console.warn('Worker not initialized, cannot process family data.');
      return;
    }

    const cacheKey = input.currentUserId ? `family_processed_data_${input.currentUserId}` : 'family_processed_data';
    
    // Seed from cache when user changes or first load
    if (this.currentCacheKey !== cacheKey) {
      this.currentCacheKey = cacheKey;
      const cached = this.storageService.getItem<FamilyProcessorOutput>(cacheKey);
      if (cached) {
        this.stats.set(cached.stats);
        this.balances.set(cached.balances);
        this.activities.set(cached.activities);
      }
    }

    // Quick check to skip if data is exactly same
    const currentInputStr = JSON.stringify({
      tCount: input.transactions.length,
      mCount: input.members.length,
      sCount: input.settlements.length,
      uid: input.currentUserId
    });
    
    if (this.lastInputStr === currentInputStr) return;
    this.lastInputStr = currentInputStr;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.isProcessing.set(true);
      this.worker?.postMessage({
        type: 'PROCESS_FAMILY_DATA',
        payload: input
      });
      this.debounceTimer = null;
    }, 100); // 100ms debounce
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
