
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { CurrencyPipe } from 'src/app/util/pipes/currency.pipe';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import * as CategoriesSelectors from 'src/app/store/categories/categories.selectors';
import * as TransactionsSelectors from 'src/app/store/transactions/transactions.selectors';
import { AppViewService } from 'src/app/util/service/app-view.service';
import { DateService } from 'src/app/util/service/date.service';
import { TransactionType } from 'src/app/util/config/enums';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';
import { toSignal } from '@angular/core/rxjs-interop';

dayjs.extend(isBetween);

export interface CategorySummary {
    totalExpense: number;
    totalIncome: number;
    expenseCount: number;
    incomeCount: number;
    expenseChange: number;
    incomeChange: number;
}

@Component({
    selector: 'app-category-summary-card',
    templateUrl: './category-summary-card.component.html',
    styleUrls: ['./category-summary-card.component.scss'],
    standalone: true,
    imports: [
        CommonModule,
        MatCardModule,
        MatIconModule,
        CurrencyPipe
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CategorySummaryCardComponent {
    public readonly Math = Math;
    private readonly store = inject(Store<AppState>);
    public readonly appViewService = inject(AppViewService);
    private readonly dateService = inject(DateService);
    public readonly breakpointService = inject(BreakpointService);

    private readonly categories = toSignal(this.store.select(CategoriesSelectors.selectAllCategories), { initialValue: [] });
    private readonly transactions = toSignal(this.store.select(TransactionsSelectors.selectAllTransactions), { initialValue: [] });
    private readonly appView = toSignal(this.appViewService.appView$, { initialValue: 'MONTHLY' });

    public readonly summary = computed<CategorySummary>(() => {
        const categories = this.categories();
        const transactions = this.transactions();
        const appView = this.appView();

        const viewTransactions = transactions.filter(t => this.appViewService.isDateInView(t.date));
        const totalExpense = viewTransactions.filter(t => t.type === TransactionType.EXPENSE).reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const totalIncome = viewTransactions.filter(t => t.type === TransactionType.INCOME).reduce((sum, t) => sum + Math.abs(t.amount), 0);

        // Previous Period Calculation
        let prevExpense = 0;
        let prevIncome = 0;
        let prevStart: dayjs.Dayjs;
        let prevEnd: dayjs.Dayjs;

        if (appView === 'WEEKLY') {
            prevStart = dayjs().subtract(1, 'week').startOf('week');
            prevEnd = dayjs().subtract(1, 'week').endOf('week');
        } else if (appView === 'YEARLY') {
            prevStart = dayjs().subtract(1, 'year').startOf('year');
            prevEnd = dayjs().subtract(1, 'year').endOf('year');
        } else {
            prevStart = dayjs().subtract(1, 'month').startOf('month');
            prevEnd = dayjs().subtract(1, 'month').endOf('month');
        }

        const prevTransactions = transactions.filter(t => {
            const tDate = dayjs(this.dateService.toDate(t.date));
            return tDate.isBetween(prevStart, prevEnd, undefined, '[]');
        });

        prevExpense = prevTransactions.filter(t => t.type === TransactionType.EXPENSE).reduce((sum, t) => sum + Math.abs(t.amount), 0);
        prevIncome = prevTransactions.filter(t => t.type === TransactionType.INCOME).reduce((sum, t) => sum + Math.abs(t.amount), 0);

        const calculateChange = (current: number, previous: number) => {
            if (previous === 0) return current > 0 ? 100 : 0;
            return ((current - previous) / previous) * 100;
        };

        const expenseChange = calculateChange(totalExpense, prevExpense);
        const incomeChange = calculateChange(totalIncome, prevIncome);

        const expenseCount = categories.filter(c => c.type === 'expense').length;
        const incomeCount = categories.filter(c => c.type === 'income').length;

        return {
            totalExpense,
            totalIncome,
            expenseCount,
            incomeCount,
            expenseChange,
            incomeChange
        };
    });
}
