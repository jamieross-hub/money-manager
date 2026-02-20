import { Injectable, OnDestroy } from "@angular/core";
import { ChatIntentService } from "./chat-intent-service";
import { ChatFlowService } from "./chat-flow.service";
import { EntityExtractorService } from "./extractors/entity-extractor.service";
import { Category, Account } from "../../models";
import { BreakpointService } from "../breakpoint.service";
import { AccountType, TransactionType } from "../../config/enums";
import { CategoryService } from "../db/category.service";
import { AccountsService } from "../db/accounts.service";
import { Auth } from "@angular/fire/auth";
import { CHAT_CONSTANTS } from "./models/chat-constants";
import { AppState } from "src/app/store/app.state";
import { Store } from "@ngrx/store";
import { selectAllAccounts } from "src/app/store/accounts/accounts.selectors";
import { Subscription, Observable, isObservable, take, filter, Subject, map, distinctUntilChanged, takeUntil } from "rxjs";
import { Message } from './models/message.types';
import { IntentContext } from './models/intent-context.types';
import { ResponseBuilder } from './response-builder';
import { IntentHandlerRegistry } from './handlers/intent-handler/registry/intent-handler-registry.service';
import { HelpIntentHandler } from './handlers/intent-handler/help-intent-handler.service';
import { AccountSummaryIntentHandler } from './handlers/intent-handler/account-summary-intent-handler.service';
import { RecentActivityIntentHandler } from './handlers/intent-handler/recent-activity-intent-handler.service';
import { ClearDataIntentHandler } from './handlers/intent-handler/clear-data-intent-handler.service';
import { ReportIntentHandler } from './handlers/intent-handler/report-intent-handler.service';
import { TransactionIntentHandler } from './handlers/intent-handler/transaction-intent-handler.service';
import { QueryIntentHandler } from './handlers/intent-handler/query-intent-handler.service';
import { OpenAiIntentHandler } from './handlers/intent-handler/openai-intent-handler.service';
import { LoanSummaryIntentHandler } from './handlers/intent-handler/loan-summary-intent-handler.service';
import { MonthlyExpenditureIntentHandler } from './handlers/intent-handler/monthly-expenditure-intent-handler.service';
import { BudgetCardIntentHandler } from './handlers/intent-handler/budget-card-intent-handler.service';
import { LoanReportIntentHandler } from './handlers/intent-handler/loan-report-intent-handler.service';
import { GeminiIntentHandler } from './handlers/intent-handler/gemini-intent-handler.service';
import { INTENTS } from "./models/intent-config";
import { UserService } from "../db/user.service";

// Message type now imported from models/message.types.ts

@Injectable()
export class ChatFacadeService implements OnDestroy {
    messages: Message[] = [];
    isTyping = false;
    private destroy$ = new Subject<void>();
    defaultBankAccount: Account | null = null;

    constructor(
        private intent: ChatIntentService,
        private flow: ChatFlowService,
        private extractor: EntityExtractorService,
        private breakpointService: BreakpointService,
        private categoryService: CategoryService,
        private accountsService: AccountsService,
        private auth: Auth,
        private store: Store<AppState>,
        private registry: IntentHandlerRegistry,
        private helpHandler: HelpIntentHandler,
        private accountSummaryHandler: AccountSummaryIntentHandler,
        private recentActivityHandler: RecentActivityIntentHandler,
        private clearDataHandler: ClearDataIntentHandler,
        private reportIntentHandler: ReportIntentHandler,
        private transactionHandler: TransactionIntentHandler,
        private queryIntentHandler: QueryIntentHandler,
        private openAiHandler: OpenAiIntentHandler,
        private loanSummaryHandler: LoanSummaryIntentHandler,
        private monthlyExpenditureHandler: MonthlyExpenditureIntentHandler,
        private budgetCardHandler: BudgetCardIntentHandler,
        private loanReportHandler: LoanReportIntentHandler,
        private geminiHandler: GeminiIntentHandler,
        private userService: UserService
    ) {
        this.store.select(selectAllAccounts).pipe(
            takeUntil(this.destroy$),
            filter((accounts) => accounts?.length > 0),
            map(accounts => accounts.some(account => account.type === 'loan')),
            distinctUntilChanged(),
            filter(hasLoans => hasLoans)
        ).subscribe(() => {
            this.pushBot(ResponseBuilder.create().uiElement(INTENTS.LOAN_SUMMARY_CARD).build(), true); // 'true' argument as per user original
        });

        this.registerHandlers();
        this.initWelcomeMessage();
        this.store.select(selectAllAccounts)
            .pipe(takeUntil(this.destroy$))
            .subscribe(accounts => {
                this.defaultBankAccount = accounts.filter(account => account.type.toLowerCase().includes(AccountType.BANK))[0]; //Bank account as default
            });
    }

    /**
     * Register all intent handlers in the registry
     */
    private registerHandlers(): void {
        this.registry.register(INTENTS.HELP, this.helpHandler);
        this.registry.register(INTENTS.ACCOUNT_SUMMARY_CARD, this.accountSummaryHandler);
        this.registry.register(INTENTS.RECENT_ACTIVITY_CARD, this.recentActivityHandler);
        this.registry.register(INTENTS.CLEAR_DATA, this.clearDataHandler);
        this.registry.register(INTENTS.GET_REPORT, this.reportIntentHandler);
        this.registry.register(INTENTS.ADD_INCOME, this.transactionHandler);
        this.registry.register(INTENTS.ADD_EXPENSE, this.transactionHandler);
        this.registry.register(INTENTS.LOAN_SUMMARY_CARD, this.loanSummaryHandler);
        this.registry.register(INTENTS.MONTHLY_EXPENDITURE_CARD, this.monthlyExpenditureHandler);
        this.registry.register(INTENTS.BUDGET_CARD, this.budgetCardHandler);
        this.registry.register(INTENTS.QUERY_SPENDING, this.queryIntentHandler);
        this.registry.register(INTENTS.CHECK_BALANCE, this.queryIntentHandler);
        this.registry.register(INTENTS.HIGHEST_EXPENSE, this.queryIntentHandler);
        this.registry.register(INTENTS.LAST_EXPENSE, this.queryIntentHandler);
        this.registry.register(INTENTS.QUERY_TRANSACTIONS, this.queryIntentHandler);
        this.registry.register(INTENTS.QUERY_CATEGORY_SPENDING, this.queryIntentHandler);
        this.registry.register(INTENTS.HIGHEST_CATEGORY, this.queryIntentHandler);
        this.registry.register(INTENTS.COMPARE_CATEGORY, this.queryIntentHandler);
        this.registry.register(INTENTS.AI_REPLY, this.openAiHandler);
        // We could also register Gemini for a specific intent if needed, 
        // or toggle based on user preference. For now, we'll just have it available.
        this.registry.register(INTENTS.GET_LOAN_REPORT, this.loanReportHandler);
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    public scrollToTop = new Subject<void>();

    private initWelcomeMessage() {
        if (this.breakpointService.device.isLaptop) {

            this.pushBot(ResponseBuilder.create().uiElement(INTENTS.ACCOUNT_SUMMARY_CARD).build());


        } else if (this.breakpointService.device.isMobile) {
            this.pushBot(ResponseBuilder.create().html(CHAT_CONSTANTS.MSGS.GREETING).build());

        } else {
            this.pushBot(ResponseBuilder.create().uiElement(INTENTS.ACCOUNT_SUMMARY_CARD).build());
            // this.pushBot(ResponseBuilder.create().uiElement(INTENTS.RECENT_ACTIVITY_CARD).build());
            this.pushBot(ResponseBuilder.create().html(CHAT_CONSTANTS.MSGS.GREETING).build());
        }
    }

    startBotReply(userText: string) {
        this.scrollToBottom();
        this.isTyping = true;
        const userId = this.userService.getCurrentUserId();

        if (userId) {
            const categories = this.categoryService.getCachedCategories();
            this.accountsService.getAccounts(userId).pipe(take(1)).subscribe(accounts => {
                this.processUserText(userText, categories, accounts);
            });
        } else {
            this.processUserText(userText, [], []);
        }
    }

    private processUserText(userText: string, categories: Category[], accounts: Account[]) {
        const detectedIntent = this.intent.detectIntent(userText);
        const amount = this.extractor.extractAmount(userText);
        const lowerText = userText.toLowerCase();

        // 1. Active Flow (e.g. Answering "How much?")
        if (this.handleActiveFlow(detectedIntent, amount, lowerText, userText)) {
            return;
        }

        // 2. New Intent / Command
        this.handleNewIntent(detectedIntent, userText, amount, accounts);
    }


    private handleActiveFlow(intent: string, amount: number, lowerText: string, rawText: string): boolean {
        // If flow stage is active, or if it's a raw number input which might start a flow
        const stage = this.flow.getStage();

        // Check for exit keywords during active flow
        if (stage && this.flow.isExitKeyword(lowerText)) {
            this.flow.reset();
            this.pushBot(ResponseBuilder.create().html(CHAT_CONSTANTS.MSGS.FLOW_CANCELLED).build());
            return true;
        }

        // Implicit start of flow if user just sends a number and no other intent detected (default to AI_REPLY but has amount)
        if (!stage && intent === INTENTS.AI_REPLY && amount > 0) {
            this.dispatchFlowReply(this.flow.startAmountFlow(amount));
            return true;
        }

        if (stage === 'askType') {
            this.dispatchFlowReply(this.flow.handleTypeReply(lowerText));
            return true;
        }

        if (stage === 'askCategory') {
            const categories = this.categoryService.getCachedCategories();
            const categoryMatch = categories.find(c => c.name.toLowerCase() === lowerText.trim());
            
            if (categoryMatch) {
                this.handleCategorySelection(categoryMatch, this.defaultBankAccount, amount, categoryMatch.type);
            } else {
                this.pushBot(ResponseBuilder.create().html(CHAT_CONSTANTS.MSGS.MISSING_CATEGORY).build());
            }
            return true;
        }

        return false;
    }

    private handleNewIntent(intent: string, userText: string, amount: number, accounts: Account[], extractedInfo?: any) {
        const userId = this.userService.getCurrentUserId();
        const categories = userId ? this.categoryService.getCachedCategories() : [];

        const context: IntentContext = {
            userText,
            amount,
            categories,
            accounts,
            intent,
            lowerText: userText.toLowerCase(),
            extractedInfo,
            history: this.messages
        };

        // Special handling for CLEAR_DATA - need to clear messages array
        if (intent === INTENTS.CLEAR_DATA) {
            this.messages = [];
        }

        // Get handler from registry
        const handler = this.registry.get(intent);

        if (handler) {
            const result = handler.handle(context);
            this.processHandlerResult(result);
        } else {
            // Fallback logic: check for Gemini key first, then OpenAI
            const user = this.userService.userAuth$.value;
            if (user?.preferences?.geminiApiKey && !user?.preferences?.openaiApiKey) {
                const result = this.geminiHandler.handle(context);
                this.processHandlerResult(result);
            } else {
                // Default to OpenAI handler
                const result = this.openAiHandler.handle(context);
                this.processHandlerResult(result);
            }
        }
    }

    /**
     * Process handler result - can be Message, Observable<Message>, or null
     */
    private processHandlerResult(result: Message | Observable<Message> | null): void {
        if (!result) {
            return;
        }

        if (isObservable(result)) {
            result.pipe(takeUntil(this.destroy$)).subscribe({
                next: (message) => this.handleMessageOrCommand(message),
                error: (e) => {
                    console.error(e);
                    this.pushBot(ResponseBuilder.create().html(CHAT_CONSTANTS.MSGS.INTERNAL_ERROR).build());
                }
            });
        } else {
            this.handleMessageOrCommand(result);
        }
    }

    private handleMessageOrCommand(message: Message) {
        if (message.type === 'command') {
            // It's a command from AI! Log it and process recursively
            console.log('AI Command received:', message.command, message.data);
            const cmd = message as any; // Cast for now
            this.handleNewIntent(
                cmd.command,
                cmd.data.notes || '', // User text replacement (or use original?) - using notes as description
                cmd.data.amount || 0,
                [], // Accounts passed in handleNewIntent are for extraction context, not needed here as we have extracted data
                { // Extended context
                    categoryName: cmd.data.category,
                    accountName: cmd.data.account,
                    notes: cmd.data.notes
                } as any // Pass extra data
            );
        } else {
            this.pushBot(message);
        }
    }

    // Helper to standardise flow reply pushing
    private dispatchFlowReply(reply: any) {
        if (typeof reply === 'string') {
            this.pushBot(ResponseBuilder.create().html(reply).build());
        } else if (reply.type === 'UI-ELEMENT') {
            this.pushBot(ResponseBuilder.create().uiElement(reply.text, reply.data).build());
        } else {
            this.pushBot(ResponseBuilder.create().html(reply).build());
        }
    }

    private pushBot(message: Message, pushAtTop: boolean = false) {
        if (pushAtTop) {
            this.messages.unshift(message);
        } else {
            this.messages.push(message);
        }

        // Limit message history to prevent memory leaks
        if (this.messages.length > 50) {
            this.messages = this.messages.slice(0, 50); // Keep oldest or newest? Typically newest.
            // Wait, unshift adds to beginning, push adds to end.
            // If pushAtTop is true, we are adding to the beginning (Oldest? No, newest usually on top if reverse order).
            // Let's assume standard chat where bottom is newest.
            // If we want to keep 50 messages, and we push to end, we should remove from start.
            if (!pushAtTop && this.messages.length > 50) {
                this.messages.shift();
            }
        }

        this.isTyping = false;
        this.scrollToBottom();
    }

    private scrollToBottom() {
        setTimeout(() => {
            this.scrollToTop.next();
        }, 100);
    }

    // Called by UI dropdown or text input
    handleCategorySelection(selectedCategory: Category, account: any, amount: number, txType?: TransactionType) {
        if (!selectedCategory) return;

        const effectiveType = txType || selectedCategory.type;

        if (effectiveType === TransactionType.INCOME) {
            this.transactionHandler.addIncome(selectedCategory, account, amount);
        } else if (effectiveType === TransactionType.EXPENSE) {
            this.transactionHandler.addExpense(selectedCategory, account, amount);
        }

        const reply = this.flow.handleCategoryReply(selectedCategory.name, account, effectiveType);
        this.pushBot(ResponseBuilder.create().html(reply).build());
    }
}
