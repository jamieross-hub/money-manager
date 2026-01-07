import { Injectable } from "@angular/core";
import { ChatIntentService } from "./chat-intent-service";
import { IncomeHandlerService } from "./handlers/income-handler.service";
import { ExpenseHandlerService } from "./handlers/expense-handler.service";
import { ReportHandlerService } from "./handlers/report-handler.service";
import { AiReplyHandlerService } from "./handlers/ai-reply-handler.service";
import { ChatFlowService } from "./handlers/chat-flow.service";
import { AmountExtractor } from "./utils/amount-extractor.util";
import { Category, Account } from "../../models";
import { BreakpointService } from "../breakpoint.service";
import { AccountType, TransactionType } from "../../config/enums";
import { CategoryService } from "../db/category.service";
import { AccountsService } from "../db/accounts.service";
import { Auth } from "@angular/fire/auth";

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
        private extract: AmountExtractor,
        private breakpointService: BreakpointService,
        private categoryService: CategoryService,
        private accountsService: AccountsService,
        private auth: Auth
    ) {
        if (this.breakpointService.device.isMobile || this.breakpointService.device.isLaptop) {
            this.messages.push({ sender: 'bot', type: 'UI-ELEMENT', text: 'ACCOUNT_SUMMARY_CARD' });
        } else {
            this.messages.push({ sender: 'bot', type: 'UI-ELEMENT', text: 'ACCOUNT_SUMMARY_CARD' });
            this.messages.push({ sender: 'bot', type: 'UI-ELEMENT', text: 'RECENT_ACTIVITY_CARD' });
            this.messages.push({ sender: 'bot', type: 'html', text: '🙂 Hello! I am your financial assistant. How can I help you today?' });
        }
    }

    startBotReply(userText: string) {
        this.isTyping = true;

        // 0. Pre-process text detection for direct transaction matching
        const userId = this.auth.currentUser?.uid;
        if (userId) {
            // Fetch necessary data (ideally cached or from store, but here we fetch to check)
            // Using a simple check pattern for now. In a real scenario, we might want to ensure data is loaded.
            const categories = this.categoryService.getCachedCategories();
            // We assume categories are cached since service is singleton and loaded. 
            // Note: CategoryService loads from store in constructor, so getCachedCategories should work if store is populated.

            this.accountsService.getAccounts(userId).subscribe(accounts => {
                this.processUserText(userText, categories, accounts);
            });
            return;
        }

        // Fallback for non-authenticated or if we want to skip to normal flow immediately (though we need async above)
        // Since we moved logic to processUserText, we can call it with empty data if userId missing, 
        // effectively falling back to existing logic.
        this.processUserText(userText, [], []);
    }

    private processUserText(userText: string, categories: Category[], accounts: Account[]) {
        const detected = this.intent.detectIntent(userText);
        const amount = this.extract.extractAmount(userText);
        const lowerText = userText.toLowerCase();

        // --- 0. NLP Transaction Matching Logic ---
        // Verify if we have a valid amount and it looks like a transaction intent
        // We look for category matches first.

        if (amount > 0 && categories.length > 0) {

            // Find category match
            let foundCategory = categories.find(c => lowerText.includes(c.name.toLowerCase()));

            // Check for Account match
            let foundAccount = accounts.find(a => lowerText.includes(a.name.toLowerCase()));

            const isBank = lowerText.includes('bank');
            const isCash = lowerText.includes('cash');

            if (!foundAccount) {
                if (isBank) foundAccount = accounts.find(a => a.type.toLowerCase().includes(AccountType.BANK));
                if (isCash) foundAccount = accounts.find(a => a.type.toLowerCase().includes(AccountType.CASH));
                if (!foundAccount && accounts.length > 0) foundAccount = accounts[0];
            }


            if (foundCategory && (detected === 'ADD_INCOME' || detected === 'ADD_EXPENSE')) {
                if (detected === 'ADD_INCOME') {
                    this.income.addIncome(foundCategory, foundAccount!, amount);
                    const reply = `Income of ₹${amount} credited to ${foundAccount?.name || 'account'} for ${foundCategory.name}.`;
                    this.pushBot({ sender: 'bot', type: 'html', text: reply });
                    return;
                } else if (detected === 'ADD_EXPENSE') {
                    this.expense.addExpense(foundCategory, foundAccount!, amount);
                    const reply = `Spent ₹${amount} on ${foundCategory.name} from ${foundAccount?.name || 'account'}.`;
                    this.pushBot({ sender: 'bot', type: 'html', text: reply });
                    return;
                }
            }
        }


        // 1. Start follow-up flow if user entered only amount and no flow is active
        if (!this.flow.getStage() && detected === 'AI_REPLY' && amount > 0) {
            const reply = this.flow.startAmountFlow(amount);
            this.pushBot(typeof reply === 'string' ? { sender: 'bot', type: 'html', text: reply } : { sender: 'bot', type: 'html', ...(reply as Record<string, any>) });
            return;
        }

        // 2. Handle type confirmation stage
        if (this.flow.getStage() === 'askType') {
            const reply = this.flow.handleTypeReply(lowerText);
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

            const reply = !this.flow.getStage() ? this.flow.startAmountFlow(amount) : this.flow.handleTypeReply(detected);
            this.pushBot(typeof reply === 'string' ? { sender: 'bot', type: 'html', text: reply } : { sender: 'bot', type: 'html', ...(reply as Record<string, any>) });
            return;
        }

        if (detected === 'ADD_EXPENSE') {
            const reply = !this.flow.getStage() ? this.flow.startAmountFlow(amount) : this.flow.handleTypeReply(detected);
            this.pushBot(typeof reply === 'string' ? { sender: 'bot', type: 'html', text: reply } : { sender: 'bot', type: 'html', ...(reply as Record<string, any>) });
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
    handleCategorySelection(selectedCategory: Category, account: any, amount: number, txType: TransactionType) {
        if (!selectedCategory) return;
        if (txType === TransactionType.INCOME) {
            this.income.addIncome(selectedCategory, account, amount);
            const reply = this.flow.handleCategoryReply(selectedCategory.name);
            this.pushBot({ sender: 'bot', type: 'html', text: reply });
            return;
        }
        if (txType === TransactionType.EXPENSE) {
            this.expense.addExpense(selectedCategory, account, amount);
            const reply = this.flow.handleCategoryReply(selectedCategory.name);
            this.pushBot({ sender: 'bot', type: 'html', text: reply });
            return;
        }
    }
}
