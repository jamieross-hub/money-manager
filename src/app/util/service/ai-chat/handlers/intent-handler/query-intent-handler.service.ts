import { Injectable } from '@angular/core';
import { combineLatest } from 'rxjs';
import { IntentHandler } from './base-intent-handler';
import { IntentContext, HandlerResult } from '../../models/intent-context.types';
import { ResponseBuilder } from '../../response-builder';
import { CHAT_CONSTANTS } from '../../models/chat-constants';
import { INTENTS } from '../../models/intent-config';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { selectAllTransactions } from 'src/app/store/transactions/transactions.selectors';
import { selectAccountsState } from 'src/app/store/accounts/accounts.selectors';
import { take, map } from 'rxjs/operators';
import { TransactionType, AccountType } from 'src/app/util/config/enums';
import { CurrencyService } from '../../../currency.service';

@Injectable({
    providedIn: 'root'
})
export class QueryIntentHandler implements IntentHandler {

    constructor(
        private store: Store<AppState>,
        private currencyService: CurrencyService
    ) { }

    handle(context: IntentContext): HandlerResult {
        return combineLatest([
            this.store.select(selectAllTransactions),
            this.store.select(selectAccountsState)
        ]).pipe(
            take(1),
            map(([transactions, accountsState]) => {
                const lowerText = context.lowerText || '';

                if (context.intent === INTENTS.CHECK_BALANCE) {
                    const accounts = accountsState.ids.map(id => accountsState.entities[id]).filter(Boolean);
                    if (!accounts || accounts.length === 0) {
                         return ResponseBuilder.create().html('You have no accounts setup yet.').build();
                    }

                    if (lowerText.includes('cash')) {
                        const cashAccounts = accounts.filter(a => a?.type === AccountType.CASH);
                        const cashBalance = cashAccounts.reduce((sum, a) => sum + ((a as any).balance || 0), 0);
                        return ResponseBuilder.create()
                            .html(`Your total cash balance is **${this.currencyService.formatAmount(cashBalance)}**.`)
                            .build();
                    }

                    const totalBalance = accounts.reduce((sum, account: any) => {
                        if (account.type === AccountType.LOAN) {
                            return sum - (account.loanDetails?.remainingBalance || 0);
                        }
                        return sum + (account.balance || 0);
                    }, 0);

                    return ResponseBuilder.create()
                        .html(`Your current total balance across all accounts is **${this.currencyService.formatAmount(totalBalance)}**.`)
                        .build();
                }

                if (!transactions || transactions.length === 0) {
                    return ResponseBuilder.create().html('You have no recorded transactions yet.').build();
                }

                const now = new Date();
                
                const getDatePart = (d: any) => {
                    return d instanceof Date ? d : new Date(d.seconds * 1000);
                };

                const isToday = (d: Date) => d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                
                const getYesterday = () => {
                    const y = new Date(now);
                    y.setDate(now.getDate() - 1);
                    return y;
                };
                const yesterday = getYesterday();
                const isYesterday = (d: Date) => d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth() && d.getFullYear() === yesterday.getFullYear();

                const getLastMonth = () => {
                    const lm = new Date(now);
                    lm.setMonth(now.getMonth() - 1);
                    return lm;
                };

                let periodLabel = 'all time';
                let filterFn = (d: Date) => true;

                if (lowerText.includes('today')) {
                    periodLabel = 'today';
                    filterFn = isToday;
                } else if (lowerText.includes('yesterday')) {
                    periodLabel = 'yesterday';
                    filterFn = isYesterday;
                } else if (lowerText.includes('this week') || lowerText.includes('the week')) {
                    periodLabel = 'this week';
                    filterFn = (d) => {
                        const msInDay = 24 * 60 * 60 * 1000;
                        const diffDays = Math.round((now.getTime() - d.getTime()) / msInDay);
                        return diffDays >= 0 && diffDays <= 7;
                    };
                } else if (lowerText.includes('last month')) {
                    periodLabel = 'last month';
                    const lm = getLastMonth();
                    filterFn = (d) => d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
                } else if (lowerText.includes('this month') || lowerText.includes('the month')) {
                    periodLabel = 'this month';
                    filterFn = (d) => d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                }

                if (context.intent === INTENTS.QUERY_SPENDING) {
                    // Default to this month if no time specific label provided
                    if (periodLabel === 'all time') {
                         periodLabel = 'this month';
                         filterFn = (d) => d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                    }

                    const expenses = transactions.filter(t => {
                        if (t.type !== TransactionType.EXPENSE) return false;
                        if (!t.date) return false;
                        return filterFn(getDatePart(t.date));
                    });

                    const totalSpent = expenses.reduce((sum, t) => sum + t.amount, 0);

                    return ResponseBuilder.create()
                        .html(`You have spent **${this.currencyService.formatAmount(totalSpent)}** ${periodLabel}.`)
                        .build();
                }

                if (context.intent === INTENTS.QUERY_CATEGORY_SPENDING) {
                    const categoriesMatch = context.categories?.filter(c => lowerText.includes(c.name.toLowerCase()));
                    if (!categoriesMatch || categoriesMatch.length === 0) {
                         return ResponseBuilder.create().html(`Please specify a category to check spending.`).build();
                    }
                    
                    const catNames = categoriesMatch.map(c => c.name);
                    const expenses = transactions.filter(t => 
                        t.type === TransactionType.EXPENSE && t.date &&
                        catNames.includes(t.category as any) &&
                        filterFn(getDatePart(t.date))
                    );

                    const totalSpent = expenses.reduce((s, t) => s + t.amount, 0);

                    return ResponseBuilder.create()
                        .html(`You spent **${this.currencyService.formatAmount(totalSpent)}** on ${catNames.join(', ')} ${periodLabel !== 'all time' ? periodLabel : ''}.`)
                        .build();
                }

                if (context.intent === INTENTS.HIGHEST_CATEGORY) {
                     const expenses = transactions.filter(t => 
                        t.type === TransactionType.EXPENSE && 
                        t.date && t.category &&
                        filterFn(getDatePart(t.date))
                    );

                    if (expenses.length === 0) {
                        return ResponseBuilder.create().html(`You have no recorded expenses ${periodLabel !== 'all time' ? periodLabel : 'yet'}.`).build();
                    }

                    const categoryTotals: { [key: string]: number } = {};
                    expenses.forEach(e => {
                        categoryTotals[e.category as string] = (categoryTotals[e.category as string] || 0) + e.amount;
                    });

                    const topCategory = Object.keys(categoryTotals).reduce((a, b) => categoryTotals[a] > categoryTotals[b] ? a : b);

                    return ResponseBuilder.create()
                        .html(`Your highest spending category ${periodLabel !== 'all time' ? periodLabel : 'overall'} is **${topCategory}** with **${this.currencyService.formatAmount(categoryTotals[topCategory])}**.`)
                        .build();
                }

                if (context.intent === INTENTS.COMPARE_CATEGORY) {
                    const categoriesMatch = context.categories?.filter(c => lowerText.includes(c.name.toLowerCase()));
                    if (!categoriesMatch || categoriesMatch.length < 2) {
                         return ResponseBuilder.create().html(`Please provide at least two categories to compare (e.g. Compare Food vs Travel).`).build();
                    }

                    const expenses = transactions.filter(t => t.type === TransactionType.EXPENSE && t.date && filterFn(getDatePart(t.date)));

                    let htmlResponse = `Comparison ${periodLabel !== 'all time' ? periodLabel : ''}:<br>`;
                    categoriesMatch.forEach(cat => {
                         const catSpent = expenses.filter(e => e.category === cat.name).reduce((s, t) => s + t.amount, 0);
                         htmlResponse += `- **${cat.name}**: ${this.currencyService.formatAmount(catSpent)}<br>`;
                    });

                    return ResponseBuilder.create().html(htmlResponse).build();
                }

                if (context.intent === INTENTS.HIGHEST_EXPENSE) {
                    const expenses = transactions.filter(t => t.type === TransactionType.EXPENSE && t.date && filterFn(getDatePart(t.date)));
                    if (expenses.length === 0) {
                        return ResponseBuilder.create().html(`You have no recorded expenses ${periodLabel !== 'all time' ? periodLabel : 'yet'}.`).build();
                    }
                    const highest = expenses.reduce((prev, current) => (prev.amount > current.amount) ? prev : current);
                    return ResponseBuilder.create()
                        .html(`Your highest expense ${periodLabel !== 'all time' ? periodLabel : 'overall'} is **${this.currencyService.formatAmount(highest.amount)}** for ${highest.category || 'an unspecified category'}.`)
                        .build();
                }

                if (context.intent === INTENTS.LAST_EXPENSE) {
                    const expenses = transactions.filter(t => t.type === TransactionType.EXPENSE && t.date)
                        .sort((a, b) => getDatePart(b.date).getTime() - getDatePart(a.date).getTime());
                    
                    if (expenses.length === 0) {
                        return ResponseBuilder.create().html('You have no recorded expenses yet.').build();
                    }
                    
                    const last = expenses[0];
                    return ResponseBuilder.create()
                        .html(`Your last expense was **${this.currencyService.formatAmount(last.amount)}** for ${last.category || 'an unspecified category'} on ${getDatePart(last.date).toLocaleDateString()}.`)
                        .build();
                }

                if (context.intent === INTENTS.QUERY_TRANSACTIONS) {
                    // Default to today if no period
                    if (periodLabel === 'all time') {
                        periodLabel = 'today';
                        filterFn = isToday;
                    }

                    const matches = transactions.filter(t => t.date && filterFn(getDatePart(t.date)));
                    
                    if (matches.length === 0) {
                        return ResponseBuilder.create().html(`You do not have any transactions for ${periodLabel}.`).build();
                    }

                    const expenseSum = matches.filter(t => t.type === TransactionType.EXPENSE).reduce((s, t) => s + t.amount, 0);
                    const incomeSum = matches.filter(t => t.type === TransactionType.INCOME).reduce((s, t) => s + t.amount, 0);

                    return ResponseBuilder.create()
                        .html(`For ${periodLabel}, you had ${matches.length} transaction(s).<br>Total Expenses: **${this.currencyService.formatAmount(expenseSum)}**<br>Total Income: **${this.currencyService.formatAmount(incomeSum)}**`)
                        .build();
                }

                return ResponseBuilder.create().html(CHAT_CONSTANTS.MSGS.INTERNAL_ERROR).build();
            })
        );
    }
}
