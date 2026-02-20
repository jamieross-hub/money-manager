import { Injectable } from '@angular/core';
import { IntentHandler } from './base-intent-handler';
import { IntentContext, HandlerResult } from '../../models/intent-context.types';
import { ResponseBuilder } from '../../response-builder';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { selectAllTransactions } from 'src/app/store/transactions/transactions.selectors';
import { CurrencyService } from '../../../currency.service';
import { AppViewService } from '../../../app-view.service';
import { TransactionType } from 'src/app/util/config/enums';
import { map, take } from 'rxjs/operators';

/**
 * Handles GET_REPORT intent - generates financial reports
 */
@Injectable()
export class ReportIntentHandler implements IntentHandler {
    constructor(
        private store: Store<AppState>,
        private currencyService: CurrencyService,
        private appViewService: AppViewService
    ) {}

    handle(context: IntentContext): HandlerResult {
        return this.store.select(selectAllTransactions).pipe(
            take(1),
            map(transactions => {
                if (!transactions || transactions.length === 0) {
                    return ResponseBuilder.create()
                        .html('<i>You have no transactions to generate a report.</i>')
                        .build();
                }

                const { periodLabel, filterFn } = this.determinePeriod(context);
                const periodTransactions = transactions.filter(t => {
                    if (!t.date) return false;
                    const date = t.date instanceof Date ? t.date : new Date((t.date as any).seconds * 1000);
                    return filterFn(date);
                });

                if (periodTransactions.length === 0) {
                    return ResponseBuilder.create()
                        .html(`<i>No transactions found for <b>${periodLabel}</b>.</i>`)
                        .build();
                }

                const income = periodTransactions
                    .filter(t => t.type === TransactionType.INCOME)
                    .reduce((sum, t) => sum + t.amount, 0);
                
                const expenses = periodTransactions
                    .filter(t => t.type === TransactionType.EXPENSE)
                    .reduce((sum, t) => sum + t.amount, 0);

                const savings = income - expenses;

                // Category breakdown for expenses
                const categoryTotals: { [key: string]: number } = {};
                periodTransactions
                    .filter(t => t.type === TransactionType.EXPENSE && t.category)
                    .forEach(t => {
                        const cat = t.category as string;
                        categoryTotals[cat] = (categoryTotals[cat] || 0) + t.amount;
                    });

                let topCategoryInfo = '';
                const categories = Object.keys(categoryTotals);
                if (categories.length > 0) {
                    const topCategory = categories.reduce((a, b) => categoryTotals[a] > categoryTotals[b] ? a : b);
                    topCategoryInfo = `<br>Your top expense was on <b>${topCategory}</b> (<i>${this.currencyService.formatAmount(categoryTotals[topCategory])}</i>).`;
                }

                const reportHtml = `
                    <b>Financial Report for ${periodLabel}</b><br><br>
                    Total Income: <b>${this.currencyService.formatAmount(income)}</b><br>
                    Total Expenses: <b style="color: #ff4444">${this.currencyService.formatAmount(expenses)}</b><br>
                    Net Savings: <b style="color: ${savings >= 0 ? '#00C851' : '#ff4444'}">${this.currencyService.formatAmount(savings)}</b><br>
                    ${topCategoryInfo}
                `.trim();

                return ResponseBuilder.create()
                    .html(reportHtml)
                    .build();
            })
        );
    }

    private determinePeriod(context: IntentContext): { periodLabel: string; filterFn: (d: Date) => boolean } {
        const lowerText = context.lowerText || '';
        const now = new Date();
        now.setHours(23, 59, 59, 999); // Set to end of day for easier comparison

        // 1. Check for specific keywords in user text
        if (lowerText.includes('yesterday')) {
            const yesterday = new Date(now);
            yesterday.setDate(now.getDate() - 1);
            return {
                periodLabel: 'Yesterday',
                filterFn: (d) => d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth() && d.getFullYear() === yesterday.getFullYear()
            };
        }

        if (lowerText.includes('today') || lowerText.includes(' day')) {
            return {
                periodLabel: 'Today',
                filterFn: (d) => d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
            };
        }

        if (lowerText.includes('week')) {
            return {
                periodLabel: 'This Week',
                filterFn: (d) => {
                    const msInDay = 24 * 60 * 60 * 1000;
                    const diffDays = Math.round((now.getTime() - d.getTime()) / msInDay);
                    return diffDays >= 0 && diffDays <= 7;
                }
            };
        }

        if (lowerText.includes('month')) {
            // Check for 'last month' specifically
            if (lowerText.includes('last month')) {
                const lastMonth = new Date(now);
                lastMonth.setMonth(now.getMonth() - 1);
                return {
                    periodLabel: 'Last Month',
                    filterFn: (d) => d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear()
                };
            }
            return {
                periodLabel: 'This Month',
                filterFn: (d) => d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
            };
        }

        if (lowerText.includes('year')) {
            return {
                periodLabel: 'This Year',
                filterFn: (d) => d.getFullYear() === now.getFullYear()
            };
        }

        // 2. Fallback to AppViewService
        return {
            periodLabel: `This ${this.appViewService.getViewLabel()}`,
            filterFn: (d) => this.appViewService.isDateInView(d)
        };
    }
}
