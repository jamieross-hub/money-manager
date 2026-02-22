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
import dayjs from 'dayjs';

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

  // ── UI state ────────────────────────────────────────────────────────────────
  readonly isExpanded = signal(false);
  readonly selectedLoanIndex = signal(0);

  // ── Derived signals ─────────────────────────────────────────────────────────
  readonly loans = computed<Account[]>(() => 
    this._inputLoans() ?? this.storeLoans() ?? []
  );

  readonly userName = computed(() =>
    this.profile()?.firstName ||
    this.profile()?.displayName?.split(' ')[0] ||
    ''
  );

  readonly userCurrency = computed(() => this.currency() ?? 'USD');

  readonly greeting = computed(() => {
    const h = dayjs().hour();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  });

  readonly journeyTarget = computed(() =>
    this.loans().length === 1 ? this.loans()[0].name : 'Debt Freedom'
  );

  // ── Unified Summary ────────────────────────────────────────────────────────
  readonly summary = computed(() => {
    const loans = this.loans();
    const now = dayjs().startOf('day');

    let totalDebt = 0;
    let totalRemaining = 0;
    let totalPaid = 0;
    let totalMonthly = 0;
    let maxRemainingMonths = 0;
    let latestEndYear = now.year();

    const items = loans.map((loan, i) => {
      const details = loan.loanDetails || {} as LoanDetails;
      const loanAmount = details.loanAmount || 0;
      const remaining = details.remainingBalance ?? Math.abs(loan.balance || 0);
      const paid = details.totalPaid ?? (loanAmount - remaining);
      const monthly = details.monthlyPayment || this._calcMonthly(loan);
      
      const start = dayjs(this._toDate(details.startDate)).startOf('day');
      const duration = Number(details.durationMonths) || 0;
      const endDate = start.add(duration, 'month');
      
      const elapsed = Math.max(0, now.diff(start, 'month'));
      const moLeft = Math.max(0, duration - elapsed);

      // Aggregates
      totalDebt += loanAmount;
      totalRemaining += remaining;
      totalPaid += paid;
      totalMonthly += monthly;
      if (moLeft > maxRemainingMonths) maxRemainingMonths = moLeft;
      if (endDate.year() > latestEndYear) latestEndYear = endDate.year();

      return {
        index: i,
        name: loan.name,
        lender: details.lenderName || 'Unknown Lender',
        status: details.status || 'Unknown',
        loanAmount,
        remaining,
        paid,
        paidPct: loanAmount > 0 ? Math.round((paid / loanAmount) * 100) : 0,
        monthly,
        interestRate: details.interestRate ?? 0,
        moLeft,
        endYear: endDate.year(),
      };
    });

    const paidPercentage = totalDebt > 0 ? Math.round((totalPaid / totalDebt) * 100) : 0;

    return {
      items,
      totalDebt,
      totalRemaining,
      totalPaid,
      totalMonthly,
      paidPercentage,
      maxRemainingMonths,
      latestEndYear
    };
  });

  // ── Methods ─────────────────────────────────────────────────────────────────
  toggleExpand(): void {
    this.isExpanded.update((v) => !v);
  }

  selectLoan(index: number): void {
    this.selectedLoanIndex.set(index);
  }

  private _toDate(value: any): Date {
    if (!value) return new Date();
    if (typeof value.toDate === 'function') return value.toDate();
    if (value instanceof Date) return value;
    if (value?.seconds) return new Date(value.seconds * 1000);
    const d = new Date(value);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  private _calcMonthly(loan: Account): number {
    const d = loan.loanDetails;
    if (!d || d.durationMonths <= 0) return 0;
    
    const { loanAmount, interestRate, durationMonths } = d;
    if (interestRate <= 0) return loanAmount / durationMonths;
    
    const r = interestRate / (12 * 100);
    const pow = Math.pow(1 + r, durationMonths);
    const emi = (loanAmount * r * pow) / (pow - 1);
    
    return Math.round(emi * 100) / 100;
  }
}
