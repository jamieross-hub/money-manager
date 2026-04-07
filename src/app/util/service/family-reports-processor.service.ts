import { Injectable, signal, inject } from '@angular/core';
import { Transaction } from '../models/transaction.model';
import { FamilyMember, FamilyStats } from '../models/family.model';
import { MonthlySummary } from '../../worker/family-reports.worker';

export interface FamilyReportsProcessorInput {
  allTransactions: Transaction[];
  members: FamilyMember[];
  categories: any[];
  mode: 'common' | 'split';
  familyId: string;
  selectedPeriod: 'weekly' | 'monthly' | 'yearly';
  selectedYear: number;
  selectedMonth: number | null;
  selectedWeekOffset: number;
  categoryViewMode: 'single' | 'group';
  currentUserId?: string;
}

/**
 * Dedicated processor service for the Family Reports page.
 * Uses `family-reports.worker.ts` to compute monthly summaries
 * and period-filtered breakdowns off the main thread.
 */
@Injectable({ providedIn: 'root' })
export class FamilyReportsProcessorService {
  private worker: Worker | null = null;

  // ─── Output Signals ───────────────────────────────────────────────────────
  readonly stats                    = signal<FamilyStats | null>(null);
  readonly monthlySummaries         = signal<MonthlySummary[]>([]);
  readonly filteredMonthlySummaries = signal<MonthlySummary[]>([]);
  readonly isProcessing             = signal<boolean>(false);

  private debounceTimer: any;
  private lastFingerprint = '';
  private lastFamilyId    = '';

  constructor() {
    this.initWorker();
  }

  private initWorker(): void {
    if (typeof Worker === 'undefined') {
      console.warn('[FamilyReportsProcessor] Web Workers not supported.');
      return;
    }

    this.worker = new Worker(new URL('../../worker/family-reports.worker', import.meta.url));

    this.worker.onmessage = ({ data }) => {
      const { type, payload } = data;
      if (type === 'FAMILY_REPORTS_PROCESSED') {
        if (payload.stats) {
          this.stats.set(payload.stats);
        }
        if (payload.monthlySummaries) {
          this.monthlySummaries.set(payload.monthlySummaries);
        }
        if (payload.filteredMonthlySummaries) {
          this.filteredMonthlySummaries.set(payload.filteredMonthlySummaries);
        }
        this.isProcessing.set(false);
        console.log(
          `[FamilyReportsWorker] Processed ${payload.fid} in ${payload.durationMs?.toFixed(2)}ms`
        );
      }
    };

    this.worker.onerror = (err) => {
      console.error('[FamilyReportsWorker] Error:', err);
      this.isProcessing.set(false);
    };
  }

  process(input: FamilyReportsProcessorInput): void {
    if (!this.worker) return;

    const fingerprint = this.generateFingerprint(input);
    if (this.lastFingerprint === fingerprint) return;
    this.lastFingerprint = fingerprint;

    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    // If family ID has changed, clear the results immediately to avoid showing stale data from a different group.
    if (this.lastFamilyId !== input.familyId) {
      this.lastFamilyId = input.familyId;
      this.lastFingerprint = ''; // Force re-process
      this.stats.set(null);
      this.monthlySummaries.set([]);
      this.filteredMonthlySummaries.set([]);
    }

    this.debounceTimer = setTimeout(() => {
      this.isProcessing.set(true);
      this.worker!.postMessage({
        type:    'PROCESS_FAMILY_REPORTS',
        payload: {
          ...input,
          fingerprint,
          fid: input.familyId
        }
      });
      this.debounceTimer = null;
    }, 100);
  }

  /** Reset output state when leaving the reports page. */
  reset(): void {
    // Only clear the fingerprint so that a fresh check is forced when the component returns.
    // We DO NOT clear stats/summaries signals here, allowing them to provide "stale" data
    // while the worker finishes its new run.
    this.lastFingerprint = '';
    this.isProcessing.set(false);
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.reset();
  }

  private generateFingerprint(input: FamilyReportsProcessorInput): string {
    // Detect modified transactions even if length is the same
    const txUpdateTimeSum = input.allTransactions.reduce((sum, t) => {
        const updated = (t as any).updatedAt;
        const time = updated?.seconds || (updated instanceof Date ? updated.getTime() : 0);
        return sum + (time % 1000000); 
    }, 0);

    return JSON.stringify({
      fid:    input.familyId,
      mode:   input.mode,
      len:    input.allTransactions.length,
      updated: txUpdateTimeSum,
      period: input.selectedPeriod,
      year:   input.selectedYear,
      month:  input.selectedMonth,
      offset: input.selectedWeekOffset,
      view:   input.categoryViewMode,
      uid:    input.currentUserId,
      catLen: input.categories.length
    });
  }
}
