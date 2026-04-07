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


export interface CurrentUserStats {
  currentUserExpense: number;
  currentUserSharePercentage: number;
  myNetSettleBalance: number;
  currentUserPaid: number;
}

export interface FamilyProcessorInput {
  transactions: Transaction[];
  members: FamilyMember[];
  settlements: Settlement[];
  familyId: string;
  mode: 'common' | 'split';
  currentUserId?: string;
  sessionStartTime: number;
  selectedPeriod?: 'weekly' | 'monthly' | 'yearly';
  selectedYear?: number;
  selectedMonth?: number | null;
  selectedWeekOffset?: number;
  allTransactions?: Transaction[]; // Full set of transactions for history
}

export interface FamilyProcessorOutput {
  stats: FamilyStats | null;
  balances: BalanceEntry[];
  activities: any[];
  currentUserStats?: CurrentUserStats;
  fingerprint?: string;
  monthlySummaries?: any[];
  filteredMonthlySummaries?: any[];
}

@Injectable({ providedIn: 'root' })
export class FamilyProcessorService {
  private worker: Worker | null = null;

  // Output Signals
  readonly stats = signal<FamilyStats | null>(null);
  readonly balances = signal<BalanceEntry[]>([]);
  readonly activities = signal<any[]>([]);
  readonly currentUserStats = signal<CurrentUserStats>({
    currentUserExpense: 0,
    currentUserSharePercentage: 0,
    myNetSettleBalance: 0,
    currentUserPaid: 0
  });
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

  // [NEW] Allow manual override of transactions for scoped processing (e.g. reports)
  readonly transactionsOverride = signal<Transaction[] | null>(null);

  constructor() {
    this.initWorker();

    // ─── Self-Driving Connector ───
    // 1. Processing: Triggers when all dependencies are ready
    // We explicitly track the familyId to ensure group changes are handled cleanly.
    effect(() => {
      const input = this.connector();
      const familyId = input.familyId;
      const override = this.transactionsOverride();
      
      if (familyId) {
        // When group changes, we might want to clear or reset things before new processing finishes
        const isReady = input.ready;
        
        untracked(() => {
          if (isReady) {
            this.process({
              transactions: override ?? input.transactions,
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
    });
  }

  private initWorker() {
    if (typeof Worker !== 'undefined') {
      this.worker = new Worker(new URL('../../worker/family-dashboard.worker', import.meta.url));
      this.worker.onmessage = ({ data }) => {
        const { type, payload } = data;
        if (type === 'FAMILY_DASHBOARD_PROCESSED') {
          this.stats.set(payload.stats);
          this.balances.set(payload.balances);
          this.activities.set(payload.activities);
          if (payload.currentUserStats) {
            this.currentUserStats.set(payload.currentUserStats);
          }
          this.isProcessing.set(false);
          console.log(`[FamilyDashboardWorker] Processed ${payload.fid} in ${payload.durationMs?.toFixed(2)}ms`);
        }
      };
      this.worker.onerror = (err) => {
        console.error('[FamilyDashboardWorker] error:', err);
        this.isProcessing.set(false);
      };
    } else {
      console.warn('Web Workers are not supported in this environment.');
    }
  }

  private debounceTimer: any;

  private generateFingerprint(input: FamilyProcessorInput): string {
    let sumTs = 0;
    for (const tx of input.transactions) {
      const u = tx.updatedAt;
      const ts = u ? (u instanceof Date ? u.getTime() : ((u as any).seconds || 0)) : 0;
      sumTs += ts;
    }

    return JSON.stringify({
      fid: input.familyId,
      mode: input.mode,
      tFingerprint: `${input.transactions.length}_${sumTs}`,
      mCount: input.members.length,
      sCount: input.settlements.length,
      uid: input.currentUserId || 'guest'
    });
  }

  private lastInputStr = '';


  /**
   * Explicitly triggers a reload of family data by clearing internal trackers and forcing processing.
   */
  loadFamilyData(familyId: string) {
    if (!familyId) return;
    
    console.log(`[FamilyProcessor] Explicit load requested for family: ${familyId}.`);
    const cacheKey = `family_calc_${familyId}`;
    this.localStorageUtility.removeItem(cacheKey); // Optional cleanup of old cache
    this.lastInputStr = ''; // Force fingerprint re-evaluation
    
    // Check if we are ready to process immediately
    const input = untracked(() => this.connector());
    if (input.ready && input.familyId === familyId) {
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
  }

  process(input: FamilyProcessorInput) {
    if (!this.worker) {
      console.warn('Worker not initialized, cannot process family data.');
      return;
    }

    const currentFingerprint = this.generateFingerprint(input);

    // 2. Quick in-memory skip if pending or already processed in current session
    if (this.lastInputStr === currentFingerprint) return;
    this.lastInputStr = currentFingerprint;

    // 3. Debounce worker processing if no valid cache
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.isProcessing.set(true);
      this.worker?.postMessage({
        type: 'PROCESS_FAMILY_DASHBOARD',
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
