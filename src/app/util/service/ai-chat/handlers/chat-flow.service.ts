import { Injectable } from "@angular/core";
import { CategoryService } from 'src/app/util/service/db/category.service';
import { CHAT_CONSTANTS } from '../chat-constants';
import { TransactionType } from 'src/app/util/config/enums';
import { Account } from "src/app/util/models";

@Injectable({ providedIn: 'root' })
export class ChatFlowService {
    private stage: 'askType' | 'askCategory' | null = null;
    private amount: number | null = null;
    private type: TransactionType | null = null;

    constructor() { }

    startAmountFlow(amount: number) {
        this.amount = amount;
        this.stage = 'askType';
        return CHAT_CONSTANTS.MSGS.ASK_TYPE(amount);
    }

    startCategoryFlow(type: TransactionType, amount: number) {
        this.amount = amount;
        this.stage = 'askCategory';
        return this.handleTypeReply(type);
    }

    handleTypeReply(userText: string) {
        const text = userText.toLowerCase();

        if (text.includes('income')) {
            this.type = TransactionType.INCOME;
            this.stage = 'askCategory';
            return {
                type: 'UI-ELEMENT',
                text: 'categoryDropdown',
                data: {
                    type: TransactionType.INCOME,
                    placeholder: CHAT_CONSTANTS.MSGS.ASK_CATEGORY_INCOME,
                    amount: this.amount,
                    txType: TransactionType.INCOME
                }
            };
        }

        if (text.includes('expense')) {
            this.type = TransactionType.EXPENSE;
            this.stage = 'askCategory';
            return {
                type: 'UI-ELEMENT',
                text: 'categoryDropdown',
                data: {
                    type: TransactionType.EXPENSE,
                    placeholder: CHAT_CONSTANTS.MSGS.ASK_CATEGORY_EXPENSE,
                    amount: this.amount,
                    txType: TransactionType.EXPENSE
                }
            };
        }

        return CHAT_CONSTANTS.MSGS.INVALID_TYPE;
    }

    handleCategoryReply(category: string, account: Account | null) {
        if (!category) return CHAT_CONSTANTS.MSGS.MISSING_CATEGORY;

        // This is usually a confirmation message after the facade adds the transaction
        let result = '';
        if (this.type === TransactionType.INCOME) {
            result = CHAT_CONSTANTS.MSGS.INCOME_ADDED(this.amount || 0, account?.name || '', category);
        } else {
            result = CHAT_CONSTANTS.MSGS.EXPENSE_ADDED(this.amount || 0, account?.name || '', category);
        }

        this.reset();
        return result;
    }

    getStage() { return this.stage; }
    getAmount() { return this.amount; }
    getType() { return this.type; }

    private reset() {
        this.stage = null;
        this.amount = null;
        this.type = null;
    }
}
