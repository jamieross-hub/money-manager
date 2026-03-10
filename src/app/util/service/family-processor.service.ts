import { Injectable, signal, computed, inject, effect, untracked } from '@angular/core';
import { Transaction } from '../models/transaction.model';
import { FamilyMember, FamilyStats, Settlement, BalanceEntry } from '../models/family.model';
import { LocalIndexDBStorageService } from './indexdb-storage.service';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import * as FamilySelectors from '../../modules/family/store/family.selectors';
import * as TransactionsSelectors from 'src/app/store/transactions/transactions.selectors';
import * as ProfileSelectors from 'src/app/store/profile/profile.selectors';
import { toSignal } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, debounceTime } from 'rxjs/operators';


export interface FamilyProcessorInput {
  transactions: Transaction[];
  members: FamilyMember[];
  settlements: Settlement[];
  familyId: string;
  mode: 'common' | 'split';
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

  private readonly store = inject(Store<AppState>);
  private readonly localStorageUtility = inject(LocalIndexDBStorageService);
  private readonly sessionStartTime = Date.now();

  // ─── Input Selectors ─────────────────────────────────────────────────────────
  private readonly family = toSignal(this.store.select(FamilySelectors.selectFamily).pipe(distinctUntilChanged()), { initialValue: null as any });
  private readonly members = toSignal(this.store.select(FamilySelectors.selectFamilyMembers).pipe(distinctUntilChanged((a, b) => a.length === b.length && a[0] === b[0])), { initialValue: [] as FamilyMember[] });
  private readonly transactions = toSignal(
    this.store.select(TransactionsSelectors.selectAllTransactions).pipe(
      distinctUntilChanged((a, b) => {
        if (a.length !== b.length) return false;
        if (a.length === 0) return true;
        
        // Include familyId check to ensure we trigger on group change 
        // even if transaction counts/first IDs happen to match.
        return a[0]?.id === b[0]?.id && 
               (a[0] as any)?.updatedAt === (b[0] as any)?.updatedAt &&
               a[0]?.familyId === b[0]?.familyId;
      })
    ), 
    { initialValue: [] as Transaction[] }
  );
  private readonly settlements = toSignal(this.store.select(FamilySelectors.selectSettlements).pipe(distinctUntilChanged((a, b) => a.length === b.length && a[0] === b[0])), { initialValue: [] as Settlement[] });
  private readonly loading = toSignal(this.store.select(TransactionsSelectors.selectTransactionsLoading).pipe(distinctUntilChanged()), { initialValue: true });
  private readonly settlementsLoading = toSignal(this.store.select(FamilySelectors.selectSettlementsLoading).pipe(distinctUntilChanged()), { initialValue: false });
  private readonly profile = this.store.selectSignal(ProfileSelectors.selectProfile);
  private readonly isFamilyMode = toSignal(this.store.select(ProfileSelectors.selectIsFamilyMode), { initialValue: false });
  private readonly currentUserId = computed(() => this.profile()?.uid ?? '');

  /**
   * Combined Processor Input
   */
  readonly connector = computed(() => {
    const txs = this.transactions();
    const mem = this.members();
    const set = this.settlements();
    const fam = this.family();
    const sLdg = this.settlementsLoading();
    const ldg = this.loading();
    const uid = this.currentUserId();

    const isReady = !!fam?.id && !sLdg && !ldg && mem.length > 0 && this.isFamilyMode();

    return { 
      transactions: txs, 
      members: mem, 
      settlements: set, 
      familyId: fam?.id, 
      mode: (fam?.mode || 'common') as 'common' | 'split',
      ready: isReady,
      currentUserId: uid
    };
  });

  constructor() {
    this.initWorker();

    // ─── Self-Driving Connector ───
    // 1. Immediate Cache Load: Show last known data as soon as Family ID is available
    effect(() => {
      const famId = this.family()?.id;
      const isFamily = this.isFamilyMode();
      if (famId && isFamily) {
        untracked(() => this.loadFromCache(famId));
      }
    }, { allowSignalWrites: true });

    // 2. Cleanup & Processing: Triggers when all dependencies are ready
    // We explicitly track the familyId to ensure group changes are handled cleanly.
    effect(() => {
      const input = this.connector();
      const familyId = input.familyId;
      
      if (familyId) {
        // When group changes, we might want to clear or reset things before new processing finishes
        const isReady = input.ready;
        
        untracked(() => {
          if (isReady) {
            this.process({
              transactions: input.transactions,
              members: input.members,
              settlements: input.settlements,
              familyId: familyId,
              mode: input.mode,
              currentUserId: input.currentUserId || undefined,
              sessionStartTime: this.sessionStartTime
            });
          }
        });
      }
    }, { allowSignalWrites: true });
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

          // ── Save to IndexDB for persistence
          const result = payload as any;
          if (result.fingerprint && result.fid) {
            const cacheKey = `family_calc_${result.fid}`;
            this.localStorageUtility.setItem(cacheKey, {
              stats: result.stats,
              balances: result.balances,
              activities: result.activities,
              fingerprint: result.fingerprint,
              updatedAt: Date.now()
            });
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

  private generateFingerprint(input: FamilyProcessorInput): string {
    const lastTx = input.transactions[0];
    return JSON.stringify({
      fid: input.familyId,
      mode: input.mode,
      tFingerprint: input.transactions.length > 0 ? `${input.transactions.length}_${lastTx?.id}_${lastTx?.updatedAt}` : 'empty',
      mCount: input.members.length,
      sCount: input.settlements.length,
      uid: input.currentUserId || 'guest'
    });
  }

  private lastInputStr = '';

  /**
   * Attempts to load pre-calculated data from IndexedDB
   */
  private loadFromCache(familyId: string, fingerprint?: string): boolean {
    if (fingerprint === 'undefined') return false; // Prevent logic errors with stringified undefined
    const cacheKey = `family_calc_${familyId}`;
    const cached = this.localStorageUtility.getItem<{
      stats: FamilyStats,
      balances: BalanceEntry[],
      activities: any[],
      fingerprint: string
    }>(cacheKey);

    if (cached) {
      // If a fingerprint is provided, it MUST match for the cache to be considered valid for a "process" skip
      if (fingerprint && cached.fingerprint !== fingerprint) {
        return false;
      }

      // Update signals with cached values
      this.stats.set(cached.stats);
      this.balances.set(cached.balances);
      this.activities.set(cached.activities);
      
      if (fingerprint) {
        console.log(`[FamilyProcessor] Using verified cache for family: ${familyId}`);
        this.isProcessing.set(false);
      } else {
        console.log(`[FamilyProcessor] Initial cache preview for family: ${familyId}`);
      }
      return true;
    }
    return false;
  }

  process(input: FamilyProcessorInput) {
    if (!this.worker) {
      console.warn('Worker not initialized, cannot process family data.');
      return;
    }

    const currentFingerprint = this.generateFingerprint(input);

    // 1. Quick in-memory skip if pending or already processed in current session
    if (this.lastInputStr === currentFingerprint) return;
    this.lastInputStr = currentFingerprint;

    // 2. Check IndexedDB Cache first for immediate display and skip worker if valid
    const isCacheValid = this.loadFromCache(input.familyId, currentFingerprint);
    if (isCacheValid) return; 

    // 3. Debounce worker processing if no valid cache
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.isProcessing.set(true);
      this.worker?.postMessage({
        type: 'PROCESS_FAMILY_DATA',
        payload: { ...input, fingerprint: currentFingerprint, fid: input.familyId }
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
