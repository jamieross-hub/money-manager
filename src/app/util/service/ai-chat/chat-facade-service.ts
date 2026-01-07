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
import { CHAT_CONSTANTS } from "./chat-constants";
import { AppState } from "src/app/store/app.state";
import { Store } from "@ngrx/store";
import { selectAllAccounts } from "src/app/store/accounts/accounts.selectors";
import { Subscription } from "rxjs";

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
    subscription: Subscription;
    defualtBankAccount: Account | null = null;

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
        private auth: Auth,
        private store: Store<AppState>
    ) {
        this.initWelcomeMessage();
        this.subscription = this.store.select(selectAllAccounts).subscribe(accounts => {
            this.defualtBankAccount = accounts.filter(account => account.type.toLowerCase().includes(AccountType.BANK))[0]; //Bank account as default
        });
    }

    private initWelcomeMessage() {
        if (this.breakpointService.device.isMobile || this.breakpointService.device.isLaptop) {
            this.pushBot({ sender: 'bot', type: 'UI-ELEMENT', text: CHAT_CONSTANTS.INTENTS.ACCOUNT_SUMMARY_CARD });
        } else {
            this.pushBot({ sender: 'bot', type: 'UI-ELEMENT', text: CHAT_CONSTANTS.INTENTS.ACCOUNT_SUMMARY_CARD });
            this.pushBot({ sender: 'bot', type: 'UI-ELEMENT', text: CHAT_CONSTANTS.INTENTS.RECENT_ACTIVITY_CARD });
            this.pushBot({ sender: 'bot', type: 'html', text: CHAT_CONSTANTS.MSGS.GREETING });
        }
    }

    startBotReply(userText: string) {
        this.isTyping = true;
        const userId = this.auth.currentUser?.uid;

        if (userId) {
            const categories = this.categoryService.getCachedCategories();
            this.accountsService.getAccounts(userId).subscribe(accounts => {
                this.processUserText(userText, categories, accounts);
            });
        } else {
            this.processUserText(userText, [], []);
        }
    }

    private processUserText(userText: string, categories: Category[], accounts: Account[]) {
        const detectedIntent = this.intent.detectIntent(userText);
        const amount = this.extract.extractAmount(userText);
        const lowerText = userText.toLowerCase();

        // 1. Try Direct Transaction (e.g. "Values" provided in one go)
        if (this.tryHandleDirectTransaction(detectedIntent, userText, amount, categories, accounts)) {
            return;
        }

        // 2. Active Flow (e.g. Answering "How much?")
        if (this.handleActiveFlow(detectedIntent, amount, lowerText, userText)) {
            return;
        }

        // 3. New Intent / Command
        this.handleNewIntent(detectedIntent, userText, amount);
    }

    private tryHandleDirectTransaction(intent: string, text: string, amount: number, categories: Category[], accounts: Account[]): boolean {
        if (amount <= 0 || categories.length === 0 || (intent !== CHAT_CONSTANTS.INTENTS.ADD_INCOME && intent !== CHAT_CONSTANTS.INTENTS.ADD_EXPENSE)) {
            return false;
        }

        const lowerText = text.toLowerCase();

        // Find Category
        const foundCategory = categories.find(c => lowerText.includes(c.name.toLowerCase()));

        // Find Account
        let foundAccount = accounts.find(a => lowerText.includes(a.name.toLowerCase()));
        if (!foundAccount) {
            if (lowerText.includes('bank')) foundAccount = accounts.find(a => a.type.toLowerCase().includes(AccountType.BANK));
            else if (lowerText.includes('cash')) foundAccount = accounts.find(a => a.type.toLowerCase().includes(AccountType.CASH));

            // Fallback to first account if still not found (optional, maybe unsafe? keeping original logic behavior)
            if (!foundAccount && accounts.length > 0) foundAccount = accounts[0];
        }

        if (foundCategory && foundAccount) {
            if (intent === CHAT_CONSTANTS.INTENTS.ADD_INCOME) {
                this.income.addIncome(foundCategory, foundAccount, amount);
                this.pushBot({ sender: 'bot', type: 'html', text: CHAT_CONSTANTS.MSGS.INCOME_ADDED(amount, foundAccount.name, foundCategory.name) });
                return true;
            }
            if (intent === CHAT_CONSTANTS.INTENTS.ADD_EXPENSE) {
                this.expense.addExpense(foundCategory, foundAccount, amount);
                this.pushBot({ sender: 'bot', type: 'html', text: CHAT_CONSTANTS.MSGS.EXPENSE_ADDED(amount, foundAccount.name, foundCategory.name) });
                return true;
            }
        }
        return false;
    }

    private handleActiveFlow(intent: string, amount: number, lowerText: string, rawText: string): boolean {
        // If flow stage is active, or if it's a raw number input which might start a flow
        const stage = this.flow.getStage();

        // Implicit start of flow if user just sends a number and no other intent detected (default to AI_REPLY but has amount)
        if (!stage && intent === CHAT_CONSTANTS.INTENTS.AI_REPLY && amount > 0) {
            this.dispatchFlowReply(this.flow.startAmountFlow(amount));
            return true;
        }

        if (!stage && intent == CHAT_CONSTANTS.INTENTS.ADD_INCOME || intent == CHAT_CONSTANTS.INTENTS.ADD_EXPENSE) {
            this.dispatchFlowReply(this.flow.startCategoryFlow(intent == CHAT_CONSTANTS.INTENTS.ADD_INCOME ? TransactionType.INCOME : TransactionType.EXPENSE, amount));
            return true;
        }

        if (stage === 'askType') {
            this.dispatchFlowReply(this.flow.handleTypeReply(lowerText));
            return true;
        }

        if (stage === 'askCategory') {
            // using rawText to allow proper casing if needed? usually lowerText matches better but let's stick to simple
            this.pushBot({ sender: 'bot', type: 'html', text: this.flow.handleCategoryReply(rawText.trim(), this.defualtBankAccount) });
            return true;
        }

        return false;
    }

    private handleNewIntent(intent: string, userText: string, amount: number) {
        switch (intent) {
            case CHAT_CONSTANTS.INTENTS.ADD_INCOME:
            case CHAT_CONSTANTS.INTENTS.ADD_EXPENSE:
                // Start flow since direct transaction failed (missing cat/account)
                const reply = !this.flow.getStage() ? this.flow.startAmountFlow(amount) : this.flow.handleTypeReply(intent);
                this.dispatchFlowReply(reply);
                break;

            case CHAT_CONSTANTS.INTENTS.GET_REPORT:
                this.pushBot(this.report.generateReport());
                break;

            case CHAT_CONSTANTS.INTENTS.ACCOUNT_SUMMARY_CARD:
                this.pushBot({ sender: 'bot', type: 'UI-ELEMENT', text: CHAT_CONSTANTS.INTENTS.ACCOUNT_SUMMARY_CARD });
                break;

            case CHAT_CONSTANTS.INTENTS.RECENT_ACTIVITY_CARD:
                this.pushBot({ sender: 'bot', type: 'UI-ELEMENT', text: CHAT_CONSTANTS.INTENTS.RECENT_ACTIVITY_CARD });
                break;

            case CHAT_CONSTANTS.INTENTS.CLEAR_DATA:
                this.messages = [];
                this.pushBot({ sender: 'bot', type: 'html', text: CHAT_CONSTANTS.MSGS.DATA_CLEARED });
                break;

            case CHAT_CONSTANTS.INTENTS.GET_INSIGHTS:
                // Future implementation or AI fallback
                this.handleAiFallback(userText);
                break;

            default:
                this.handleAiFallback(userText);
                break;
        }
    }

    private handleAiFallback(text: string) {
        this.aiReply.handleAI(text).subscribe({
            next: (reply) => this.pushBot({ sender: 'bot', type: 'html', text: reply }),
            error: () => this.pushBot({ sender: 'bot', type: 'html', text: CHAT_CONSTANTS.MSGS.INTERNAL_ERROR })
        });
    }

    // Helper to standardise flow reply pushing
    private dispatchFlowReply(reply: any) {
        if (typeof reply === 'string') {
            this.pushBot({ sender: 'bot', type: 'html', text: reply });
        } else {
            this.pushBot({ sender: 'bot', type: 'html', ...reply });
        }
    }

    private pushBot(message: Message) {
        this.messages.push(message);
        this.isTyping = false;
    }

    // Called by UI dropdown
    handleCategorySelection(selectedCategory: Category, account: any, amount: number, txType: TransactionType) {
        if (!selectedCategory) return;

        if (txType === TransactionType.INCOME) {
            this.income.addIncome(selectedCategory, account, amount);
        } else if (txType === TransactionType.EXPENSE) {
            this.expense.addExpense(selectedCategory, account, amount);
        }

        const reply = this.flow.handleCategoryReply(selectedCategory.name, account);
        this.pushBot({ sender: 'bot', type: 'html', text: reply });
    }
}
