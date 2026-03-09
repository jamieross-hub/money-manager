import { Injectable, signal, computed, inject } from '@angular/core';
import { Transaction } from '../models/transaction.model';
import { FamilyMember, FamilyStats, Settlement, BalanceEntry } from '../models/family.model';


export interface FamilyProcessorInput {
  transactions: Transaction[];
  members: FamilyMember[];
  settlements: Settlement[];
  familyId: string;
  currentUserId?: string;
  sessionStartTime: number;
}

export interface FamilyProcessorOutput {
  stats: FamilyStats | null;
  balances: BalanceEntry[];
  activities: any[];
  fingerprint?: string;
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

  private debounceTimer: any;

  private generateFingerprint(input: FamilyProcessorInput): string {
    const lastTx = input.transactions[0];
    return JSON.stringify({
      fid: input.familyId,
      tFingerprint: input.transactions.length > 0 ? `${input.transactions.length}_${lastTx?.id}_${lastTx?.updatedAt}` : 'empty',
      mCount: input.members.length,
      sCount: input.settlements.length,
      uid: input.currentUserId
    });
  }

  private lastInputStr = '';

  process(input: FamilyProcessorInput) {
    if (!this.worker) {
      console.warn('Worker not initialized, cannot process family data.');
      return;
    }

    const currentFingerprint = this.generateFingerprint(input);

    // Quick check to skip if data is exactly same as what's already active or pending
    if (this.lastInputStr === currentFingerprint) return;
    this.lastInputStr = currentFingerprint;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.isProcessing.set(true);
      this.worker?.postMessage({
        type: 'PROCESS_FAMILY_DATA',
        payload: { ...input, fingerprint: currentFingerprint }
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
