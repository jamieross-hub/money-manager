import { Injectable } from '@angular/core';
import { IntentHandler } from './base-intent-handler';
import { IntentContext, HandlerResult } from '../../models/intent-context.types';
import { ResponseBuilder } from '../../response-builder';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { selectAllAccounts } from 'src/app/store/accounts/accounts.selectors';
import { CurrencyService } from '../../../currency.service';
import { map, take } from 'rxjs/operators';
import { AccountType } from 'src/app/util/config/enums';

/**
 * Handles GET_LOAN_REPORT intent - generates detailed loan reports
 */
@Injectable()
export class LoanReportIntentHandler implements IntentHandler {
    constructor(
        private store: Store<AppState>,
        private currencyService: CurrencyService
    ) {}

    handle(context: IntentContext): HandlerResult {
        return this.store.select(selectAllAccounts).pipe(
            take(1),
            map(accounts => {
                const loans = accounts.filter(a => a.type === AccountType.LOAN);

                if (!loans || loans.length === 0) {
                    return ResponseBuilder.create()
                        .html('<i>You have no active loans to generate a report.</i>')
                        .build();
                }

                let reportHtml = '<b>Loan Details Report</b><br><br>';

                loans.forEach((loan, index) => {
                    const details = loan.loanDetails;
                    if (details) {
                        reportHtml += `
                            <b>Loan #${index + 1}: ${details.lenderName || 'Unknown Lender'}</b><br>
                            Total Amount: <b>${this.currencyService.formatAmount(details.loanAmount)}</b><br>
                            Remaining: <b style="color: #ff4444">${this.currencyService.formatAmount(details.remainingBalance)}</b><br>
                            Total Paid: <b style="color: #00C851">${this.currencyService.formatAmount(details.totalPaid)}</b><br>
                            Interest Rate: <b>${details.interestRate}%</b><br>
                            Next Due: <b>${new Date(details.nextDueDate).toLocaleDateString()}</b><br>
                            Monthly EMI: <b>${this.currencyService.formatAmount(details.monthlyPayment)}</b><br><br>
                        `;
                    } else {
                        reportHtml += `
                            <b>Account: ${loan.name}</b><br>
                            Balance: <b>${this.currencyService.formatAmount(loan.balance)}</b><br><br>
                        `;
                    }
                });

                return ResponseBuilder.create()
                    .html(reportHtml.trim())
                    .build();
            })
        );
    }
}
