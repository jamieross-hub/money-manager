import { Injectable } from "@angular/core";
import { CHAT_CONSTANTS } from './models/chat-constants';
import { TransactionType } from 'src/app/util/config/enums';
import { Account } from "src/app/util/models";
import { ConversationStateMachine, ChatState, ChatEvent } from './state/conversation-state-machine.service';

@Injectable({ providedIn: 'root' })
export class ChatFlowService {

    constructor(private fsm: ConversationStateMachine) { }

    startAmountFlow(amount: number) {
        this.fsm.transition(ChatEvent.AMOUNT_PROVIDED, { amount });
        return CHAT_CONSTANTS.MSGS.ASK_TYPE(amount);
    }

    startCategoryFlow(type: TransactionType, amount: number) {
        this.fsm.transition(ChatEvent.AMOUNT_PROVIDED, { amount });
        return this.handleTypeReply(type === TransactionType.INCOME ? 'income' : 'expense');
    }

    handleTypeReply(userText: string) {
        const text = userText.toLowerCase();

        // Check for exit keywords
        if (this.isExitKeyword(text)) {
            this.reset();
            return CHAT_CONSTANTS.MSGS.FLOW_CANCELLED;
        }

        if (text.includes('income')) {
            const amount = this.fsm.getContext().amount;
            this.fsm.transition(ChatEvent.TYPE_PROVIDED, { type: TransactionType.INCOME });
            return {
                type: 'UI-ELEMENT',
                text: 'categoryDropdown',
                data: {
                    type: TransactionType.INCOME,
                    placeholder: CHAT_CONSTANTS.MSGS.ASK_CATEGORY_INCOME,
                    amount: amount,
                    txType: TransactionType.INCOME
                }
            };
        }

        if (text.includes('expense')) {
            const amount = this.fsm.getContext().amount;
            this.fsm.transition(ChatEvent.TYPE_PROVIDED, { type: TransactionType.EXPENSE });
            return {
                type: 'UI-ELEMENT',
                text: 'categoryDropdown',
                data: {
                    type: TransactionType.EXPENSE,
                    placeholder: CHAT_CONSTANTS.MSGS.ASK_CATEGORY_EXPENSE,
                    amount: amount,
                    txType: TransactionType.EXPENSE
                }
            };
        }

        return CHAT_CONSTANTS.MSGS.INVALID_TYPE;
    }

    handleCategoryReply(category: string, account: Account | null) {
        if (!category) return CHAT_CONSTANTS.MSGS.MISSING_CATEGORY;

        const context = this.fsm.getContext();
        const amount = context.amount || 0;
        const type = context.type;

        // This is usually a confirmation message after the facade adds the transaction
        let result = '';
        if (type === TransactionType.INCOME) {
            result = CHAT_CONSTANTS.MSGS.INCOME_ADDED(amount, account?.name || '', category);
        } else {
            result = CHAT_CONSTANTS.MSGS.EXPENSE_ADDED(amount, account?.name || '', category);
        }

        this.fsm.transition(ChatEvent.CATEGORY_PROVIDED, { category });
        this.reset();
        return result;
    }

    getStage(): string | null {
        const state = this.fsm.getState();
        if (state === ChatState.IDLE) return null;
        if (state === ChatState.AWAITING_TYPE) return 'askType';
        if (state === ChatState.AWAITING_CATEGORY) return 'askCategory';
        if (state === ChatState.AWAITING_AMOUNT) return 'askAmount';
        return null;
    }

    getAmount() { return this.fsm.getContext().amount; }
    getType() { return this.fsm.getContext().type; }

    isExitKeyword(text: string): boolean {
        const lowerText = text.toLowerCase().trim();
        return CHAT_CONSTANTS.EXIT_KEYWORDS.some(keyword => lowerText === keyword || lowerText.includes(keyword));
    }

    reset() {
        this.fsm.reset();
    }
}
