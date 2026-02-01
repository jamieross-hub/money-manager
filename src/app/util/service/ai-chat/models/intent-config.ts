import { CHAT_CONSTANTS } from './chat-constants';

export interface IntentDefinition {
    id: string;
    keywords?: string[];
    regex?: RegExp;
    priority: number;
    requiresAmount?: boolean;
    description?: string;
    examples?: string[];
}

export const INTENTS = {
    ADD_INCOME: 'ADD_INCOME',
    ADD_EXPENSE: 'ADD_EXPENSE',
    CHECK_BALANCE: 'CHECK_BALANCE',
    ACCOUNT_SUMMARY_CARD: 'ACCOUNT_SUMMARY_CARD',
    LOAN_SUMMARY_CARD: 'LOAN_SUMMARY_CARD',
    RECENT_ACTIVITY_CARD: 'RECENT_ACTIVITY_CARD',
    BUDGET_CARD: 'BUDGET_CARD',
    CLEAR_DATA: 'CLEAR_DATA',
    GET_REPORT: 'GET_REPORT',
    MONTHLY_EXPENDITURE_CARD: 'MONTHLY_EXPENDITURE_CARD',
    AI_REPLY: 'AI_REPLY',
    HELP: 'HELP'
}

/**
 * Configuration for all supported intents.
 * Order of detection is determined by priority (highest first).
 */
export const INTENT_CONFIG: IntentDefinition[] = [
    {
        id: INTENTS.ADD_INCOME,
        keywords: CHAT_CONSTANTS.PATTERNS.INCOME_KEYWORDS,
        priority: 100,
        requiresAmount: true,
        description: 'Add Income',
        examples: ['Salary 5000', 'Received 500 from friend', 'Income 2000']
    },
    {
        id: INTENTS.ADD_EXPENSE,
        keywords: CHAT_CONSTANTS.PATTERNS.EXPENSE_KEYWORDS,
        priority: 100,
        requiresAmount: true,
        description: 'Add Expense',
        examples: ['Spent 500 on food', 'Cab fare 200', 'Paid bill 1000', 'Buy coffee 50']
    },
    {
        id: INTENTS.CHECK_BALANCE,
        keywords: CHAT_CONSTANTS.PATTERNS.BALANCE_KEYWORDS,
        priority: 80,
        description: 'Check Balance',
        examples: ['Show balance', 'How much money do I have?', 'Account summary']
    },
    {
        id: INTENTS.ACCOUNT_SUMMARY_CARD,
        keywords: CHAT_CONSTANTS.PATTERNS.ACCOUNT_SUMMARY_KEYWORDS,
        priority: 80,
        description: 'Account Summary', // Merged with Check Balance conceptually for user, but kept separate in config if needed, or just omit description if it's internal. But user prompt had 'Account summary' under Check Balance. Let's stick to the prompt structure.
        // Actually, the prompt combined "Check Balance" and "Account summary". 
        // Let's see: "Check Balance": "Show balance", "How much money do I have?", "Account summary"
        // In intent config, we have CHECK_BALANCE and ACCOUNT_SUMMARY_CARD.
        // I will add description/examples to CHECK_BALANCE as in the prompt. 
        // For ACCOUNT_SUMMARY_CARD, it seems to trigger a specific UI. 
        // The prompt only listed "Check Balance". I'll stick to that in CHECK_BALANCE.
        // I won't add description/examples to internal/UI specific intents if they weren't in the original prompt, OR I will map them.
        // Original prompt:
        // - Add Income...
        // - Add Expense...
        // - Check Balance...
        // - Recent Activity...
        // - Reports...
        // - Manage Data...
        // - Help...

        // Let's map these:
        // CHECK_BALANCE -> "Check Balance"
        // RECENT_ACTIVITY_CARD -> "Recent Activity" ("Recent transactions", "History", "Last 5 expenses")
        // GET_REPORT -> "Reports" ("Show report", "Monthly statement", "Spending analysis")
        // CLEAR_DATA -> "Manage Data" ("Clear data" (Caution: This wipes all data))
        // HELP -> "Help" ("Help", "What can you do?", "Commands")

        // internal intents or duplicates? ACCOUNT_SUMMARY_CARD seems to be "Account summary" in the prompt example for Check Balance. 
        // I'll leave ACCOUNT_SUMMARY_CARD without description for now or maybe it's fine. 
        // Wait, the prompt lists "Account summary" as an example of "Check Balance". 
        // In INTENT_CONFIG, ACCOUNT_SUMMARY_CARD is a separate intent. 
        // I'll add the specific examples to the specific intents.
    },
    {
        id: INTENTS.ACCOUNT_SUMMARY_CARD,
        keywords: CHAT_CONSTANTS.PATTERNS.ACCOUNT_SUMMARY_KEYWORDS,
        priority: 80
        // No visual description/examples needed for the prompt list if it's covered by Check Balance or if we want to list it separately?
        // The original prompt list was:
        // - Check Balance: "Show balance", "How much money do I have?", "Account summary"
        // - Recent Activity: ...

        // If I strictly follow the prompt structure:
        // I should probably group them or just list the main ones.
        // I'll add metadata to the ones that correspond to the prompt list.
    },
    {
        id: INTENTS.RECENT_ACTIVITY_CARD,
        keywords: CHAT_CONSTANTS.PATTERNS.RECENT_ACTIVITY_KEYWORDS,
        priority: 80,
        description: 'Recent Activity',
        examples: ['Recent transactions', 'History', 'Last 5 expenses']
    },
    {
        id: INTENTS.CLEAR_DATA,
        keywords: CHAT_CONSTANTS.PATTERNS.CLEAR_DATA_KEYWORDS,
        priority: 90,
        description: 'Manage Data',
        examples: ['"Clear data" (Caution: This wipes all data)']
    },
    {
        id: INTENTS.GET_REPORT,
        keywords: CHAT_CONSTANTS.PATTERNS.REPORT_KEYWORDS,
        priority: 70,
        description: 'Reports',
        examples: ['Show report', 'Monthly statement', 'Spending analysis']
    },
    {
        id: INTENTS.HELP,
        keywords: CHAT_CONSTANTS.PATTERNS.HELP_KEYWORDS,
        priority: 110, // Highest priority to always catch help requests
        description: 'Help',
        examples: ['Help', 'What can you do?', 'Commands']
    },
    {
        id: INTENTS.LOAN_SUMMARY_CARD,
        keywords: CHAT_CONSTANTS.PATTERNS.LOAN_SUMMARY_KEYWORDS,
        priority: 80,
        description: 'Loan Summary',
        examples: ['Loan summary', 'Loan details', 'Loan balance']
    },
    {
        id: INTENTS.MONTHLY_EXPENDITURE_CARD,
        keywords: CHAT_CONSTANTS.PATTERNS.MONTHLY_EXPENDITURE_KEYWORDS,
        priority: 80,
        description: 'Monthly Expenditure',
        examples: ['Monthly expenditure', 'Spending trend', 'Expenditure chart']
    },
    {
        id: INTENTS.BUDGET_CARD,
        keywords: CHAT_CONSTANTS.PATTERNS.BUDGET_KEYWORDS,
        priority: 80,
        description: 'Budget Overview',
        examples: ['Budget summary', 'Show budget', 'Budget overview', 'Category budgets']
    }
];
