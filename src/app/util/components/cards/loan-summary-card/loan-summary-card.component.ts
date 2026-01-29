import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule, NgIf, NgClass, NgStyle } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Store } from '@ngrx/store';
import { Observable, Subject, takeUntil } from 'rxjs';
import { AppState } from 'src/app/store/app.state';
import * as AccountsSelectors from 'src/app/store/accounts/accounts.selectors';
import { Account, LoanDetails } from 'src/app/util/models/account.model';
import { AccountType } from 'src/app/util/config/enums';
import { CurrencyPipe } from 'src/app/util/pipes/currency.pipe';
import * as ProfileSelectors from 'src/app/store/profile/profile.selectors';
import { User } from 'src/app/util/models/index';

@Component({
    selector: 'app-loan-summary-card',
    standalone: true,
    imports: [NgIf, NgClass, NgStyle, MatIconModule, CurrencyPipe],
    templateUrl: './loan-summary-card.component.html',
    styleUrls: ['./loan-summary-card.component.scss']
})
export class LoanSummaryCardComponent implements OnInit, OnDestroy {
    @Input() set loansInput(value: Account[] | null) {
        this.loans = value || [];
    }
    public loanAccounts$: Observable<Account[]>;
    public profile$: Observable<User | null>;
    public userCurrency$: Observable<string | undefined>;
    public loans: Account[] = [];
    public userName: string = '';
    public userCurrency: string = 'USD';
    public isExpanded = false;
    private destroy$ = new Subject<void>();

    constructor(private store: Store<AppState>) {
        this.loanAccounts$ = this.store.select(AccountsSelectors.selectAccountsByType('loan'));
        this.profile$ = this.store.select(ProfileSelectors.selectProfile);
        this.userCurrency$ = this.store.select(ProfileSelectors.selectUserCurrency);
    }

    ngOnInit(): void {
        // If loans are not passed as input, fallback to store selector
        if (this.loans.length === 0) {
            this.loanAccounts$
                .pipe(takeUntil(this.destroy$))
                .subscribe(accounts => {
                    this.loans = accounts;
                });
        }

        this.profile$
            .pipe(takeUntil(this.destroy$))
            .subscribe(profile => {
                this.userName = profile?.firstName || profile?.displayName?.split(' ')[0] || '';
            });

        this.userCurrency$
            .pipe(takeUntil(this.destroy$))
            .subscribe(currency => {
                if (currency) {
                    this.userCurrency = currency;
                }
            });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    get totalDebt(): number {
        return this.loans.reduce((total, loan) => {
            return total + (loan.loanDetails?.loanAmount || 0);
        }, 0);
    }

    get totalRemaining(): number {
        return this.loans.reduce((total, loan) => {
            return total + (loan.loanDetails?.remainingBalance || 0);
        }, 0);
    }

    get totalPaid(): number {
        return this.loans.reduce((total, loan) => {
            const loanAmount = loan.loanDetails?.loanAmount || 0;
            const remainingBalance = loan.loanDetails?.remainingBalance || 0;
            return total + (loanAmount - remainingBalance);
        }, 0);
    }

    get monthlyPayment(): number {
        return this.loans.reduce((total, loan) => {
            const storedPayment = loan.loanDetails?.monthlyPayment;
            if (storedPayment && storedPayment > 0) {
                return total + storedPayment;
            }
            // Fallback calculation if field is missing or 0
            return total + this.calculateMonthlyPayment(loan);
        }, 0);
    }

    private calculateMonthlyPayment(loan: Account): number {
        const details = loan.loanDetails;
        if (!details) return 0;

        const { loanAmount, interestRate, durationMonths } = details;
        if (durationMonths <= 0) return 0;
        if (interestRate <= 0) return loanAmount / durationMonths;

        // Monthly interest rate (annual rate / 12)
        const monthlyRate = interestRate / (12 * 100);

        // Amortization formula: P = L[c(1 + c)^n]/[(1 + c)^n - 1]
        const numerator = monthlyRate * Math.pow(1 + monthlyRate, durationMonths);
        const denominator = Math.pow(1 + monthlyRate, durationMonths) - 1;

        if (denominator === 0) return loanAmount / durationMonths;

        const monthlyPayment = loanAmount * (numerator / denominator);
        return Math.round(monthlyPayment * 100) / 100;
    }

    get paidPercentage(): number {
        if (this.totalDebt === 0) return 0;
        return Math.round((this.totalPaid / this.totalDebt) * 100);
    }
    get debtFreeYear(): number {
        if (this.loans.length === 0) return new Date().getFullYear();

        // Find the latest end date among all loans
        const dates = this.loans.map(loan => {
            const start = new Date(loan.loanDetails?.startDate || new Date());
            const duration = loan.loanDetails?.durationMonths || 0;
            return new Date(start.setMonth(start.getMonth() + duration));
        });

        return Math.max(...dates.map(d => d.getFullYear()));
    }

    get remainingMonths(): number {
        if (this.loans.length === 0) return 0;

        const now = new Date();
        const dates = this.loans.map(loan => {
            const start = new Date(loan.loanDetails?.startDate || new Date());
            const duration = loan.loanDetails?.durationMonths || 0;
            return new Date(start.setMonth(start.getMonth() + duration));
        });

        const latestDate = new Date(Math.max(...dates.map(d => d.getTime())));

        // Calculate months between now and latestDate
        const diffInMonths = (latestDate.getFullYear() - now.getFullYear()) * 12 + (latestDate.getMonth() - now.getMonth());

        return Math.max(0, diffInMonths);
    }

    get greeting(): string {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        return 'Good evening';
    }

    get journeyTarget(): string {
        if (this.loans.length === 1) {
            return this.loans[0].name;
        }
        return 'Debt Freedom';
    }

    public toggleExpand(): void {
        this.isExpanded = !this.isExpanded;
    }
}
