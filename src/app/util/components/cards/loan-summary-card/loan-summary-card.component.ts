import {
  Component,
  OnInit,
  Input,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { NgFor, NgIf, NgClass } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Store } from '@ngrx/store';
import { toSignal } from '@angular/core/rxjs-interop';
import { AppState } from 'src/app/store/app.state';
import * as AccountsSelectors from 'src/app/store/accounts/accounts.selectors';
import { Account, LoanDetails } from 'src/app/util/models/account.model';
import { CurrencyPipe } from 'src/app/util/pipes/currency.pipe';
import * as ProfileSelectors from 'src/app/store/profile/profile.selectors';

@Component({
  selector: 'app-loan-summary-card',
  standalone: true,
  imports: [NgIf, NgFor, NgClass, MatIconModule, CurrencyPipe],
  templateUrl: './loan-summary-card.component.html',
  styleUrls: ['./loan-summary-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoanSummaryCardComponent {
  private readonly store = inject(Store<AppState>);

  // ── Signals from store ──────────────────────────────────────────────────────
  private readonly storeLoans = toSignal(
    this.store.select(AccountsSelectors.selectAccountsByType('loan')),
    { initialValue: [] as Account[] }
  );

  private readonly profile = toSignal(
    this.store.select(ProfileSelectors.selectProfile),
    { initialValue: null }
  );

  private readonly currency = toSignal(
    this.store.select(ProfileSelectors.selectUserCurrency),
    { initialValue: 'USD' }
  );

  // ── Input override ──────────────────────────────────────────────────────────
  private readonly _inputLoans = signal<Account[] | null>(null);

  @Input() set loansInput(value: Account[] | null) {
    this._inputLoans.set(value);
  }

  // ── Derived signals ─────────────────────────────────────────────────────────
  readonly loans = computed<Account[]>(() => {
    const input = this._inputLoans();
    return input !== null ? input : (this.storeLoans() ?? []);
  });

  readonly userName = computed(
    () =>
      this.profile()?.firstName ||
      this.profile()?.displayName?.split(' ')[0] ||
      ''
  );

  readonly userCurrency = computed(() => this.currency() ?? 'USD');

  // ── UI state ────────────────────────────────────────────────────────────────
  readonly isExpanded = signal(false);
  readonly selectedLoanIndex = signal(0);

  // ── Aggregate computed values ───────────────────────────────────────────────
  readonly totalDebt = computed(() =>
    this.loans().reduce((sum, l) => sum + (l.loanDetails?.loanAmount ?? 0), 0)
  );

  readonly totalRemaining = computed(() =>
    this.loans().reduce(
      (sum, l) => sum + (l.loanDetails?.remainingBalance ?? 0),
      0
    )
  );

  readonly totalPaid = computed(() =>
    this.loans().reduce((sum, l) => {
      const amount = l.loanDetails?.loanAmount ?? 0;
      const remaining = l.loanDetails?.remainingBalance ?? 0;
      return sum + (amount - remaining);
    }, 0)
  );

  readonly monthlyPayment = computed(() =>
    this.loans().reduce((sum, l) => {
      const stored = l.loanDetails?.monthlyPayment;
      return sum + (stored && stored > 0 ? stored : this._calcMonthly(l));
    }, 0)
  );

  readonly paidPercentage = computed(() => {
    const debt = this.totalDebt();
    return debt === 0 ? 0 : Math.round((this.totalPaid() / debt) * 100);
  });

  readonly debtFreeYear = computed(() => {
    const list = this.loans();
    if (!list.length) return new Date().getFullYear();
    const endYears = list.map((l) => {
      const start = this._toDate(l.loanDetails?.startDate);
      const months = Number(l.loanDetails?.durationMonths) || 0;
      const yr = new Date(new Date(start).setMonth(start.getMonth() + months)).getFullYear();
      return isNaN(yr) ? new Date().getFullYear() : yr;
    });
    const maxYr = Math.max(...endYears);
    return isNaN(maxYr) ? new Date().getFullYear() : maxYr;
  });

  readonly remainingMonths = computed(() => {
    const list = this.loans();
    if (!list.length) return 0;
    const now = new Date();
    const endDates = list.map((l) => {
      const start = this._toDate(l.loanDetails?.startDate);
      const months = Number(l.loanDetails?.durationMonths) || 0;
      return new Date(new Date(start).setMonth(start.getMonth() + months));
    });
    const validTimes = endDates.map((d) => d.getTime()).filter((t) => !isNaN(t));
    if (!validTimes.length) return 0;
    const latest = new Date(Math.max(...validTimes));
    const result = Math.max(
      0,
      (latest.getFullYear() - now.getFullYear()) * 12 +
        (latest.getMonth() - now.getMonth())
    );
    return isNaN(result) ? 0 : result;
  });

  readonly greeting = computed(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  });

  readonly journeyTarget = computed(() =>
    this.loans().length === 1 ? this.loans()[0].name : 'Debt Freedom'
  );

  // ── Per-loan computed list ──────────────────────────────────────────────────
  readonly loanItems = computed(() =>
    this.loans().map((loan, i) => {
      const details = loan.loanDetails || {} as Partial<LoanDetails>;
      const loanAmount = details.loanAmount ?? 0;
      const remainingBalance = details.remainingBalance ?? 0;
      const paid = loanAmount - remainingBalance;
      const paidPct =
        loanAmount > 0
          ? Math.round((paid / loanAmount) * 100)
          : 0;
      const monthlyPmt = details.monthlyPayment ?? 0;
      const monthly =
        monthlyPmt > 0
          ? monthlyPmt
          : this._calcMonthly(loan);
      const start = this._toDate(details.startDate);
      const months = Number(details.durationMonths) || 0;
      const endDate = new Date(
        new Date(start).setMonth(start.getMonth() + months)
      );
      const now = new Date();
      let moLeft = Math.max(
        0,
        (endDate.getFullYear() - now.getFullYear()) * 12 +
          (endDate.getMonth() - now.getMonth())
      );
      if (isNaN(moLeft)) moLeft = 0;
      const endYear = isNaN(endDate.getFullYear()) ? now.getFullYear() : endDate.getFullYear();

      return {
        index: i,
        name: loan.name,
        lender: details.lenderName || 'Unknown Lender',
        status: details.status || 'Unknown',
        loanAmount: loanAmount,
        remaining: remainingBalance,
        paid,
        paidPct,
        monthly,
        interestRate: details.interestRate ?? 0,
        moLeft,
        endYear,
      };
    })
  );

  // ── Methods ─────────────────────────────────────────────────────────────────
  toggleExpand(): void {
    this.isExpanded.update((v) => !v);
  }

  selectLoan(index: number): void {
    this.selectedLoanIndex.set(index);
  }

  /** Safely converts a Firestore Timestamp or Date value to a JS Date. */
  private _toDate(value: any): Date {
    if (!value) return new Date();
    if (typeof value.toDate === 'function') return value.toDate();
    if (value instanceof Date) return new Date(value.getTime());
    if (typeof value === 'object' && 'seconds' in value) {
      return new Date(value.seconds * 1000);
    }
    const d = new Date(value);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  private _calcMonthly(loan: Account): number {
    const d = loan.loanDetails;
    if (!d) return 0;
    const { loanAmount, interestRate, durationMonths } = d;
    if (durationMonths <= 0) return 0;
    if (interestRate <= 0) return loanAmount / durationMonths;
    const r = interestRate / (12 * 100);
    const num = r * Math.pow(1 + r, durationMonths);
    const den = Math.pow(1 + r, durationMonths) - 1;
    if (den === 0) return loanAmount / durationMonths;
    return Math.round((loanAmount * (num / den)) * 100) / 100;
  }
}
