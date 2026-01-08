export const CHAT_CONSTANTS = {
    BOT_SENDER: 'bot',
    MSGS: {
        GREETING: '🙂 Hello! I am your financial assistant. How can I help you today?',
        INTERNAL_ERROR: 'Internal error, please try again!',
        DATA_CLEARED: 'All your data has been cleared successfully.',
        INCOME_ADDED: (amount: number, account: string, category: string) => `Income of <b>₹${amount.toLocaleString()} credited to ${account} for ${category}</b>.`,
        EXPENSE_ADDED: (amount: number, account: string, category: string) => `Spent <b>₹${amount.toLocaleString()}  on ${category} from ${account}</b>.`,
        ASK_TYPE: (amount: number) => `Got ₹${amount.toLocaleString()}. Is this income or expense?`,
        ASK_CATEGORY_INCOME: 'Select income category',
        ASK_CATEGORY_EXPENSE: 'Select expense category',
        INVALID_TYPE: 'Please reply with "income" or "expense".',
        MISSING_CATEGORY: 'Please provide a category name.',
        ASK_CATEGORY: (type: string) => `Select ${type} category`,
        HELP_OPTIONS: `
        <div class="max-w-full">
            <b class="text-base">Available Commands:</b><br/><br/>
            <div class="space-y-2 px-2">
                <div><b class="text-sm">💰 Add Transaction:</b><br/><span class="text-xs">"Spent 500 on food", "Salary 5000"</span></div>
                <div><b class="text-sm">💳 Check Balance:</b><br/><span class="text-xs">"Show balance", "Account summary"</span></div>
                <div><b class="text-sm">📊 Recent Activity:</b><br/><span class="text-xs">"Recent transactions", "History"</span></div>
                <div><b class="text-sm">📈 Reports:</b><br/><span class="text-xs">"Show report", "Statement"</span></div>
                <div><b class="text-sm">🗑️ Manage Data:</b><br/><span class="text-xs">"Clear data", "Reset app"</span></div>
            </div>
            <br/>
            <i class="text-xs">Just type naturally! I'll understand.</i>
        </div>
        `
    },
    INTENTS: {
        ADD_INCOME: 'ADD_INCOME',
        ADD_EXPENSE: 'ADD_EXPENSE',
        CHECK_BALANCE: 'CHECK_BALANCE',
        ACCOUNT_SUMMARY_CARD: 'ACCOUNT_SUMMARY_CARD',
        RECENT_ACTIVITY_CARD: 'RECENT_ACTIVITY_CARD',
        CLEAR_DATA: 'CLEAR_DATA',
        GET_REPORT: 'GET_REPORT',
        GET_INSIGHTS: 'GET_INSIGHTS',
        AI_REPLY: 'AI_REPLY',
        HELP: 'HELP'
    },
    PATTERNS: {
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
        RECENT_ACTIVITY_KEYWORDS: [
            'recent activity', 'recent-activity', 'recentactivity', 'activity card', 'recent transactions',
            'last transactions', 'transaction history', 'show history', 'show recent'
        ],
        CLEAR_DATA_KEYWORDS: [
            'clear data', 'reset data', 'delete all', 'clear all', 'wipe data', 'erase data', 'reset app', 'factory reset'
        ],
        REPORT_KEYWORDS: ['report', 'statement'],
        INSIGHTS_KEYWORDS: ['advice', 'suggest', 'tips', 'insight', 'analyze'],
        HELP_KEYWORDS: ['help', 'usage', 'command', 'guide', 'instruction', 'what can you do', 'support', 'assist', 'help', 'usage', 'command', 'guide', 'instruction', 'support', 'assist', 'what can you do',
            'how to use', 'features', 'available commands', 'commands list', 'bot commands']
    },
    SUGGESTIONS: [
        'Spent ₹',
        'Income ₹',
        'Expense ₹',
        'Salary ₹',
        'Show balance',
        'Account summary',
        'Recent transactions',
        'Show report',
        'Clear data',
        'Help'
    ]
};
