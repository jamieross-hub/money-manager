import { Injectable } from '@angular/core';
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
import { EntityExtractorService } from '../../extractors/entity-extractor.service';
import { INTENTS } from '../../models/intent-config';

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
        private hapticFeedback: HapticFeedbackService,
        private extractor: EntityExtractorService
    ) { }

    /**
     * Public methods to allow the facade to trigger transactions from UI selection
     */
    addIncome(category: Category, account: Account, amount: number) {
        return this.executeTransaction(TransactionType.INCOME, category, account, amount);
    }

    addExpense(category: Category, account: Account, amount: number) {
        return this.executeTransaction(TransactionType.EXPENSE, category, account, amount);
    }

    /**
     * Shared logic for adding a transaction
     */
    private async executeTransaction(type: TransactionType, category: Category, account: Account, amount: number) {
        const userId = this.auth.currentUser?.uid;

        if (!userId) {
            console.warn(`No authenticated user - cannot create ${type}`);
            return `${type === TransactionType.INCOME ? 'Income' : 'Expense'} added locally: ₹${amount}`;
        }

        const transactionData = {
            userId,
            accountId: account?.accountId || '',
            categoryId: category?.id || '',
            category: category?.name,
            payee: type === TransactionType.INCOME ? 'Income' : 'Expense',
            amount,
            type,
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
            await this.store.dispatch(TransactionsActions.createTransaction({ userId, transaction: transactionData }));
            this.notificationService.success('Transaction added successfully');
            this.hapticFeedback.successVibration();
            return `${type === TransactionType.INCOME ? 'Income' : 'Expense'} added: ₹${amount}`;
        } catch (error) {
            console.error(`Failed to add ${type} transaction`, error);
            this.notificationService.error('Failed to add transaction');
            return `Failed to add ${type === TransactionType.INCOME ? 'income' : 'expense'}: ₹${amount}`;
        }
    }

    handle(context: IntentContext): HandlerResult {
        const { intent, amount, userText, categories, accounts } = context;

        // 1. Try Direct Transaction first
        const directResult = this.tryHandleDirectTransaction(intent, userText, amount, categories || [], accounts || []);
        if (directResult) return directResult;

        // 2. If not a direct transaction, start or continue flow
        if (!this.flowService.getStage()) {
            const type = intent === INTENTS.ADD_INCOME ? TransactionType.INCOME : TransactionType.EXPENSE;
            const reply = this.flowService.startCategoryFlow(type, amount);
            return this.convertFlowReply(reply);
        }

        return this.convertFlowReply(this.flowService.handleTypeReply(intent));
    }

    private tryHandleDirectTransaction(intent: string, text: string, amount: number, categories: Category[], accounts: Account[]): HandlerResult | null {
        if (amount <= 0 || categories.length === 0) return null;

        const { category, account } = this.extractor.extractAll(text, categories, accounts);

        if (!category || !account) return null;

        const isIncome = intent === INTENTS.ADD_INCOME;
        const msgFunc = isIncome ? CHAT_CONSTANTS.MSGS.INCOME_ADDED : CHAT_CONSTANTS.MSGS.EXPENSE_ADDED;

        return from(isIncome ? this.addIncome(category, account, amount) : this.addExpense(category, account, amount)).pipe(
            map(() => ResponseBuilder.create()
                .html(msgFunc(amount, account.name, category.name))
                .build())
        );
    }

    /**
     * Convert flow service reply to Message type
     */
    private convertFlowReply(reply: any): Message {
        if (reply?.type === 'UI-ELEMENT') {
            return ResponseBuilder.create().uiElement(reply.text, reply.data).build();
        }
        return ResponseBuilder.create().html(typeof reply === 'string' ? reply : reply.text || '').build();
    }
}
