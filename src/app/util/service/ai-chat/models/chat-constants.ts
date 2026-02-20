const PATTERNS = {
    AMOUNT: /₹?\$?\d+[.,]?\d*/,
    ACTIONS: ['add', 'paid', 'received', 'got', 'spent', 'debit', 'credit', 'purchase', 'buy', 'transfer', 'sent', 'deposit', 'withdraw', 'income:', 'expense:'],
    INCOME_KEYWORDS: ['salary', 'income', 'income:', 'received', 'got', 'credited', 'deposit', 'salary', 'income', 'credited', 'deposit', 'received', 'got', 'credit', 'add income',
        'income added', 'income received', 'credited to', 'credit in', 'earn', 'earned',
        'paycheck', 'allowance', 'pocket money', 'deposited', 'mil gaye', 'mila', 'aayi',
        'income:', 'money received', 'received money', 'cash in'],
    EXPENSE_KEYWORDS: ['spent', 'expense', 'expense:', 'paid', 'debited', 'withdraw', 'purchase', 'buy', 'spent', 'expense', 'paid', 'debited', 'withdraw', 'purchase', 'buy', 'payment',
        'pay', 'debit', 'debit from', 'spent on', 'used for', 'paid for', 'purchase of',
        'expense added', 'cost', 'bill', 'paid bill', 'shopping', 'transaction debit',
        'kharche', 'kharch', 'diya', 'gaya', 'expense:', 'money spent', 'cash out'],
    BALANCE_KEYWORDS: ['balance', 'wallet', 'bank'],
    ACCOUNT_SUMMARY_KEYWORDS: [
        'account summary', 'account-summary', 'accountsummary', 'account summary card', 'account card',
        'show accounts', 'my accounts', 'list accounts'
    ],
    LOAN_SUMMARY_KEYWORDS: [
        'loan summary', 'loan-summary', 'loansummary', 'loan summary card', 'loan card',
        'show loans', 'my loans', 'list loans'
    ],
    RECENT_ACTIVITY_KEYWORDS: [
        'recent activity', 'recent-activity', 'recentactivity', 'activity card', 'recent transactions',
        'last transactions', 'transaction history', 'show history', 'show recent'
    ],
    CLEAR_DATA_KEYWORDS: [
        'clear data', 'reset data', 'delete all', 'clear all', 'wipe data', 'erase data', 'reset app', 'factory reset'
    ],
    REPORT_KEYWORDS: ['report', 'statement'],
    MONTHLY_EXPENDITURE_KEYWORDS: [
        'monthly expenditure', 'spending trend', 'expenditure chart', 'monthly trend',
        'monthly spending', 'expense trend', 'expenditure trend'
    ],
    BUDGET_KEYWORDS: [
        'budget summary', 'budget-summary', 'budgetsummary', 'budget card', 'budget overview',
        'show budget', 'my budget', 'category budget', 'budgets', 'budget status',
        'budget tracking', 'spending limit', 'budget progress'
    ],
    INSIGHTS_KEYWORDS: ['advice', 'suggest', 'tips', 'insight', 'analyze'],
    QUERY_SPENDING_KEYWORDS: ['how much did i spend', 'total expense', 'spending this month', 'how much spent', 'my spending', 'what i spent', 'spend today', 'spent today'],
    CATEGORY_SPENDING_KEYWORDS: ['spend on', 'spending on', 'expenses for', 'show my', 'how much on'],
    HIGHEST_CATEGORY_KEYWORDS: ['highest spending category', 'where is most of my money going', 'top category', 'spend the most on'],
    COMPARE_CATEGORY_KEYWORDS: ['compare', 'vs', 'versus'],
    HIGHEST_EXPENSE_KEYWORDS: ['highest expense', 'biggest expense', 'max spent', 'largest expense', 'most expensive'],
    LAST_EXPENSE_KEYWORDS: ['last expense', 'latest expense', 'recent expense'],
    QUERY_TRANSACTIONS_KEYWORDS: ['transactions today', 'expense yesterday', 'did i add', "show today's transactions", 'recent transactions', 'transactions yesterday'],
    HELP_KEYWORDS: ['help', 'usage', 'command', 'guide', 'instruction', 'what can you do', 'support', 'assist', 'help', 'usage', 'command', 'guide', 'instruction', 'support', 'assist', 'what can you do',
        'how to use', 'features', 'available commands', 'commands list', 'bot commands']
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const CHAT_CONSTANTS = {
    BOT_SENDER: 'bot',
    MSGS: {
        GREETING: '🙂 Hello! I am your financial assistant. How can I help you today?',
        INTERNAL_ERROR: 'Internal error, please try again!',
        DATA_CLEARED: 'All your data has been cleared successfully.',
        // Note: These functions now expect formatted currency strings instead of raw amounts
        // The calling code should use CurrencyService.formatAmount() before passing to these functions
        INCOME_ADDED: (formattedAmount: string, account: string, category: string) => `Income of ${formattedAmount} credited to ${account} for ${category}.`,
        EXPENSE_ADDED: (formattedAmount: string, account: string, category: string) => `Spent ${formattedAmount}  on ${category} from ${account}.`,
        ASK_TYPE: (formattedAmount: string) => `Got ${formattedAmount}. Is this income or expense?`,
        ASK_CATEGORY: (type: string) => `Select ${type} category`,
        ASK_CATEGORY_INCOME: 'Select income category',
        ASK_CATEGORY_EXPENSE: 'Select expense category',
        INVALID_TYPE: 'Please reply with "income" or "expense".',
        MISSING_CATEGORY: 'Please provide a category name.',
        FLOW_CANCELLED: 'Okay, cancelled. How else can I help you?',

        HELP_OPTIONS: `<b>You can ask me things like:</b><br><br><b>Add:</b> "Spent 500 on dinner", "Added 5000 to Salary"<br><b>Check:</b> "What is my balance?", "How much cash do I have?"<br><b>Activity:</b> "Show my latest transactions", "What was my last expense?"<br><b>Spending:</b> "How much did I spend today?"<br><b>Categories:</b> "Compare food and travel", "What is my highest expense?"<br><b>Manage Data:</b> "Clear all my data"<br><br><i>Just type naturally! I'll understand.</i><br><i>💡 Type "cancel" anytime to stop.</i>`
    },
    PATTERNS,
    SUGGESTIONS: [
        'Spent ₹',
        'Income ₹',
        'Expense ₹',
        capitalize(PATTERNS.INCOME_KEYWORDS[0]),
        'Show ' + PATTERNS.BALANCE_KEYWORDS[0],
        capitalize(PATTERNS.ACCOUNT_SUMMARY_KEYWORDS[0]),
        capitalize(PATTERNS.LOAN_SUMMARY_KEYWORDS[0]),
        capitalize(PATTERNS.RECENT_ACTIVITY_KEYWORDS[0]),
        capitalize(PATTERNS.BUDGET_KEYWORDS[0]),
        capitalize(PATTERNS.REPORT_KEYWORDS[0]),
        capitalize(PATTERNS.CLEAR_DATA_KEYWORDS[0]),
        capitalize(PATTERNS.HELP_KEYWORDS[0]),
        capitalize(PATTERNS.MONTHLY_EXPENDITURE_KEYWORDS[0]),
        capitalize(PATTERNS.HIGHEST_EXPENSE_KEYWORDS[0]),
        capitalize(PATTERNS.LAST_EXPENSE_KEYWORDS[0]),
        capitalize(PATTERNS.QUERY_TRANSACTIONS_KEYWORDS[0]),
        
    ],
    EXIT_KEYWORDS: ['cancel', 'exit', 'quit', 'stop', 'nevermind', 'never mind', 'back', 'abort']
};
