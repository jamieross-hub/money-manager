import { Injectable, signal, computed } from '@angular/core';
import { Transaction } from '../models/transaction.model';
import { FamilyMember, FamilyStats, Settlement, BalanceEntry } from '../models/family.model';

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
  
  // Output Signals
  readonly stats = signal<FamilyStats | null>(null);
  readonly balances = signal<BalanceEntry[]>([]);
  readonly activities = signal<any[]>([]);
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

  process(input: FamilyProcessorInput) {
    if (!this.worker) {
      console.warn('Worker not initialized, cannot process family data.');
      return;
    }

    this.isProcessing.set(true);
    this.worker.postMessage({
      type: 'PROCESS_FAMILY_DATA',
      payload: input
    });
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
