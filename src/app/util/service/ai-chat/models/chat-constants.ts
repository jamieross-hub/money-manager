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
        INCOME_ADDED: (amount: number, account: string, category: string) => `Income of ₹${amount.toLocaleString()} credited to ${account} for ${category}.`,
        EXPENSE_ADDED: (amount: number, account: string, category: string) => `Spent ₹${amount.toLocaleString()}  on ${category} from ${account}.`,
        ASK_TYPE: (amount: number) => `Got ₹${amount.toLocaleString()}. Is this income or expense?`,
        ASK_CATEGORY: (type: string) => `Select ${type} category`,
        ASK_CATEGORY_INCOME: 'Select income category',
        ASK_CATEGORY_EXPENSE: 'Select expense category',
        INVALID_TYPE: 'Please reply with "income" or "expense".',
        MISSING_CATEGORY: 'Please provide a category name.',
        FLOW_CANCELLED: 'Okay, cancelled. How else can I help you?',

        HELP_OPTIONS: `
        <div class="max-w-full">
            <b class="text-base">Available Commands:</b><br/><br/>
            <div class="space-y-2 px-2">
                <div><b class="text-sm">💰 Add Transaction:</b><br/><span class="text-xs">"Spent 500 on food", "Salary 5000"</span></div>
                <div><b class="text-sm">💳 Check Balance:</b><br/><span class="text-xs">"Show balance", "Account summary"</span></div>
                <div><b class="text-sm">📊 Recent Activity:</b><br/><span class="text-xs">"Recent transactions", "History"</span></div>
                <div><b class="text-sm">� Budget Overview:</b><br/><span class="text-xs">"Budget summary", "Show budget"</span></div>
                <div><b class="text-sm">�📈 Reports:</b><br/><span class="text-xs">"Show report", "Statement"</span></div>
                <div><b class="text-sm">🗑️ Manage Data:</b><br/><span class="text-xs">"Clear data", "Reset app"</span></div>
            </div>
            <br/>
            <i class="text-xs">Just type naturally! I'll understand.</i><br/>
            <i class="text-xs">💡 Type "cancel" or "exit" anytime to stop.</i>
        </div>
        `
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
        capitalize(PATTERNS.MONTHLY_EXPENDITURE_KEYWORDS[0])
    ],
    EXIT_KEYWORDS: ['cancel', 'exit', 'quit', 'stop', 'nevermind', 'never mind', 'back', 'abort']
};
