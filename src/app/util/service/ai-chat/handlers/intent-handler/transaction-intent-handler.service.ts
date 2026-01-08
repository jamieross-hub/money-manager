import { Injectable, Injector } from '@angular/core';
import { IntentHandler } from './base-intent-handler';
import { IntentContext, HandlerResult } from '../../models/intent-context.types';
import { ChatFlowService } from '../../chat-flow.service';
import { CHAT_CONSTANTS } from '../../chat-constants';
import { Message } from '../../models/message.types';
import { ResponseBuilder } from '../../response-builder';
import { AccountType, SyncStatus, TransactionStatus, TransactionType } from 'src/app/util/config/enums';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { AppState } from 'src/app/store/app.state';
import { Store } from '@ngrx/store';
import { Auth } from '@angular/fire/auth';
import { NotificationService } from '../../../notification.service';
import { HapticFeedbackService } from '../../../haptic-feedback.service';
import { Account, Category } from "src/app/util/models";
import * as TransactionsActions from 'src/app/store/transactions/transactions.actions';

/**
 * Handles ADD_INCOME and ADD_EXPENSE intents
 * Manages both direct transactions (when category/account are present)
 * and multi-step transaction flows.
 */
@Injectable({ providedIn: 'root' })
export class TransactionIntentHandler implements IntentHandler {
    constructor(
        private flowService: ChatFlowService,
        private store: Store<AppState>,
        private auth: Auth,
        private notificationService: NotificationService,
        private hapticFeedback: HapticFeedbackService
    ) { }

    /**
     * Public methods to allow the facade to trigger transactions from UI selection
     */
    async addIncome(category: any, account: any, amount: number) {
        const userId = this.auth.currentUser?.uid;

        // Fallback if user not available
        if (!userId) {
            console.warn('No authenticated user - cannot create transaction');
            return `Income added locally: ₹${amount}`;
        }

        const transactionData = {
            userId: userId,
            accountId: account?.accountId || '',
            categoryId: category?.id || '',
            category: category?.name,
            payee: 'Income',
            amount: amount,
            type: TransactionType.INCOME,
            date: new Date(),
            notes: '',
            status: TransactionStatus.COMPLETED,
            tags: [],
            isSplitTransaction: false,
            isCategorySplit: false,
            syncStatus: SyncStatus.PENDING,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: userId,
            updatedBy: userId,
        };

        try {
            await this.store.dispatch(
                TransactionsActions.createTransaction({
                    userId: userId,
                    transaction: transactionData,
                })
            );

            this.notificationService.success('Transaction added successfully');
            this.hapticFeedback.successVibration();
            return `Income added: ₹${amount}`;
        } catch (error) {
            console.error('Failed to add income transaction', error);
            this.notificationService.error('Failed to add transaction');
            return `Failed to add income: ₹${amount}`;
        }
    }

    async addExpense(category: any, account: any, amount: number) {
        const userId = this.auth.currentUser?.uid;

        // Fallback if user not available
        if (!userId) {
            console.warn('No authenticated user - cannot create transaction');
            return `Expense added locally: ₹${amount}`;
        }

        const transactionData = {
            userId: userId,
            accountId: account?.accountId || '',
            categoryId: category?.id || '',
            category: category?.name,
            payee: 'Expense',
            amount: amount,
            type: TransactionType.EXPENSE,
            date: new Date(),
            notes: '',
            status: TransactionStatus.COMPLETED,
            tags: [],
            isSplitTransaction: false,
            isCategorySplit: false,
            syncStatus: SyncStatus.PENDING,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: userId,
            updatedBy: userId,
        };

        try {
            await this.store.dispatch(
                TransactionsActions.createTransaction({
                    userId: userId,
                    transaction: transactionData,
                })
            );

            this.notificationService.success('Transaction added successfully');
            this.hapticFeedback.successVibration();
            return `Expense added: ₹${amount}`;
        } catch (error) {
            console.error('Failed to add expense transaction', error);
            this.notificationService.error('Failed to add transaction');
            return `Failed to add expense: ₹${amount}`;
        }
    }

    handle(context: IntentContext): HandlerResult {
        const { intent, amount, userText, categories, accounts } = context;

        // 1. Try Direct Transaction first
        const directResult = this.tryHandleDirectTransaction(intent, userText, amount, categories || [], accounts || []);
        if (directResult) {
            return directResult;
        }

        // 2. If not a direct transaction, handle via Flow

        // If we're not in a flow, start one
        if (!this.flowService.getStage()) {
            const reply = this.flowService.startCategoryFlow(
                intent === CHAT_CONSTANTS.INTENTS.ADD_INCOME ? TransactionType.INCOME : TransactionType.EXPENSE,
                amount
            );
            return this.convertFlowReply(reply);
        }

        // If in flow (though handleNewIntent shouldn't call this if stage exists in old logic, 
        // but we'll keep it robust)
        const reply = this.flowService.handleTypeReply(intent);
        return this.convertFlowReply(reply);
    }

    private tryHandleDirectTransaction(intent: string, text: string, amount: number, categories: any[], accounts: any[]): HandlerResult | null {
        if (amount <= 0 || categories.length === 0) {
            return null;
        }

        const lowerText = text.toLowerCase();

        // Find Category
        const foundCategory = categories.find(c => lowerText.includes(c.name.toLowerCase()));

        // Find Account
        let foundAccount = accounts.find(a => lowerText.includes(a.name.toLowerCase()));
        if (!foundAccount) {
            if (lowerText.includes('bank')) foundAccount = accounts.find(a => a.type.toLowerCase().includes(AccountType.BANK));
            else if (lowerText.includes('cash')) foundAccount = accounts.find(a => a.type.toLowerCase().includes(AccountType.CASH));

            // Fallback to first account if still not found
            if (!foundAccount && accounts.length > 0) foundAccount = accounts[0];
        }

        if (foundCategory && foundAccount) {
            if (intent === CHAT_CONSTANTS.INTENTS.ADD_INCOME) {
                return from(this.addIncome(foundCategory, foundAccount, amount)).pipe(
                    map(() => ResponseBuilder.create()
                        .html(CHAT_CONSTANTS.MSGS.INCOME_ADDED(amount, foundAccount.name, foundCategory.name))
                        .build())
                );
            }
            if (intent === CHAT_CONSTANTS.INTENTS.ADD_EXPENSE) {
                return from(this.addExpense(foundCategory, foundAccount, amount)).pipe(
                    map(() => ResponseBuilder.create()
                        .html(CHAT_CONSTANTS.MSGS.EXPENSE_ADDED(amount, foundAccount.name, foundCategory.name))
                        .build())
                );
            }
        }
        return null;
    }

    /**
     * Convert flow service reply to Message type
     */
    private convertFlowReply(reply: any): Message {
        if (typeof reply === 'string') {
            return ResponseBuilder.create().html(reply).build();
        } else if (reply.type === 'UI-ELEMENT') {
            return ResponseBuilder.create()
                .uiElement(reply.text, reply.data)
                .build();
        } else {
            return ResponseBuilder.create().html(reply).build();
        }
    }
}
