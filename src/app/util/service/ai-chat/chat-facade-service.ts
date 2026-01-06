import { Injectable } from "@angular/core";
import { ChatIntentService } from "./chat-intent-service";
import { IncomeHandlerService } from "./handlers/income-handler.service";
import { ExpenseHandlerService } from "./handlers/expense-handler.service";
import { ReportHandlerService } from "./handlers/report-handler.service";
import { AiReplyHandlerService } from "./handlers/ai-reply-handler.service";
import { ChatFlowService } from "./handlers/chat-flow.service";
import { AmountExtractor } from "./utils/amount-extractor.util";
import { Category } from "../../models";

export interface Message {
    sender: 'bot' | 'user' | string;
    type: 'html' | 'text' | 'UI-ELEMENT'
    text?: string | any;
    data?: any;
}

@Injectable({ providedIn: 'root' })
export class ChatFacadeService {
    messages: Message[] = [];
    isTyping = false;

    constructor(
        private intent: ChatIntentService,
        private flow: ChatFlowService,
        private income: IncomeHandlerService,
        private expense: ExpenseHandlerService,
        private report: ReportHandlerService,
        private aiReply: AiReplyHandlerService,
        private extract: AmountExtractor
    ) {
        // Initial greeting message
        this.messages.push({ sender: 'bot', type: 'UI-ELEMENT', text: 'ACCOUNT_SUMMARY_CARD' });
        this.messages.push({ sender: 'bot', type: 'UI-ELEMENT', text: 'RECENT_ACTIVITY_CARD' });
        this.messages.push({ sender: 'bot', type: 'html', text: '🙂 Hello! I am your financial assistant. How can I help you today?' });

    }

    startBotReply(userText: string) {
        this.isTyping = true;
        const detected = this.intent.detectIntent(userText);
        const amount = this.extract.extractAmount(userText);

        // 1. Start follow-up flow if user entered only amount and no flow is active
        if (!this.flow.getStage() && detected === 'AI_REPLY' && amount > 0) {
            const reply = this.flow.startAmountFlow(amount);
            this.pushBot(typeof reply === 'string' ? { sender: 'bot', type: 'html', text: reply } : { sender: 'bot', type: 'html', ...(reply as Record<string, any>) });
            return;
        }

        // 2. Handle type confirmation stage
        if (this.flow.getStage() === 'askType') {
            const reply = this.flow.handleTypeReply(userText, detected);
            this.pushBot(typeof reply === 'string' ? { sender: 'bot', type: 'html', text: reply } : { sender: 'bot', type: 'html', ...(reply as Record<string, any>) });
            return;
        }

        // 3. Handle category asking stage
        if (this.flow.getStage() === 'askCategory') {
            const reply = this.flow.handleCategoryReply(userText.trim());
            this.pushBot({ sender: 'bot', type: 'html', text: reply });
            return;
        }

        // 4. Normal intent handlers
        if (detected === 'ADD_INCOME') {
            //this.pushBot(this.income.addIncome({}, amount));
            return;
        }

        if (detected === 'ADD_EXPENSE') {
            //this.pushBot(this.expense.addExpense(userText, amount));
            return;
        }

        if (detected === 'GET_REPORT') {
            this.pushBot(this.report.generateReport());
            return;
        }

        if (detected === 'ACCOUNT_SUMMARY_CARD') {
            this.pushBot({ sender: 'bot', type: 'UI-ELEMENT', text: 'ACCOUNT_SUMMARY_CARD' });
            return;
        }

        if (detected === 'RECENT_ACTIVITY_CARD') {
            this.pushBot({ sender: 'bot', type: 'UI-ELEMENT', text: 'RECENT_ACTIVITY_CARD' });
            return;
        }

        if (detected === 'CLEAR_DATA') {
            this.messages = [];
            this.pushBot({ sender: 'bot', type: 'html', text: 'All your data has been cleared successfully.' });
            return;
        }

        // 5. AI reply fallback
        this.aiReply.handleAI(userText).subscribe({
            next: (reply) => this.pushBot({ sender: 'bot', type: 'html', text: reply }),
            error: () => this.pushBot({ sender: 'bot', type: 'html', text: 'Internal error, please try again!' })
        });
    }

    private pushBot(message: Message) {
        this.messages.push(message);
        this.isTyping = false;
    }

    // Called by UI when a category is selected from the Angular dropdown component
    handleCategorySelection(selectedCategory: Category, account: any, amount: number, txType: string) {
        if (!selectedCategory) return;
        if (txType === 'INCOME') {
            this.income.addIncome(selectedCategory, account, amount);
            const reply = this.flow.handleCategoryReply(selectedCategory.name);
            this.pushBot({ sender: 'bot', type: 'html', text: reply });
            return;
        }
        if (txType === 'EXPENSE') {
            this.expense.addExpense(selectedCategory, amount);
            const reply = this.flow.handleCategoryReply(selectedCategory.name);
            this.pushBot({ sender: 'bot', type: 'html', text: reply });
            return;
        }
    }
}
