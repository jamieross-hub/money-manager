export const CHAT_CONSTANTS = {
    BOT_SENDER: 'bot',
    MSGS: {
        GREETING: '🙂 Hello! I am your financial assistant. How can I help you today?',
        INTERNAL_ERROR: 'Internal error, please try again!',
        DATA_CLEARED: 'All your data has been cleared successfully.',
        INCOME_ADDED: (amount: number, account: string, category: string) => `Income of ₹${amount} credited to ${account} for ${category}.`,
        EXPENSE_ADDED: (amount: number, account: string, category: string) => `Spent ₹${amount} on ${category} from ${account}.`,
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
        AI_REPLY: 'AI_REPLY'
    },
    PATTERNS: {
        AMOUNT: /₹?\$?\d+[.,]?\d*/,
        ACTIONS: ['add', 'paid', 'received', 'got', 'spent', 'debit', 'credit', 'purchase', 'buy', 'transfer', 'sent', 'deposit', 'withdraw'],
        INCOME_KEYWORDS: ['salary', 'income', 'received', 'got', 'credited', 'deposit'],
        EXPENSE_KEYWORDS: ['spent', 'expense', 'paid', 'debited', 'withdraw', 'purchase', 'buy'],
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
        INSIGHTS_KEYWORDS: ['advice', 'suggest', 'tips', 'insight', 'analyze']
    }
};
