import { CHAT_CONSTANTS } from '../chat-constants';

export interface IntentDefinition {
    id: string;
    keywords?: string[];
    regex?: RegExp;
    priority: number;
    requiresAmount?: boolean;
}

export const INTENTS = {
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
        requiresAmount: true
    },
    {
        id: INTENTS.ADD_EXPENSE,
        keywords: CHAT_CONSTANTS.PATTERNS.EXPENSE_KEYWORDS,
        priority: 100,
        requiresAmount: true
    },
    {
        id: INTENTS.CHECK_BALANCE,
        keywords: CHAT_CONSTANTS.PATTERNS.BALANCE_KEYWORDS,
        priority: 80
    },
    {
        id: INTENTS.ACCOUNT_SUMMARY_CARD,
        keywords: CHAT_CONSTANTS.PATTERNS.ACCOUNT_SUMMARY_KEYWORDS,
        priority: 80
    },
    {
        id: INTENTS.RECENT_ACTIVITY_CARD,
        keywords: CHAT_CONSTANTS.PATTERNS.RECENT_ACTIVITY_KEYWORDS,
        priority: 80
    },
    {
        id: INTENTS.CLEAR_DATA,
        keywords: CHAT_CONSTANTS.PATTERNS.CLEAR_DATA_KEYWORDS,
        priority: 90
    },
    {
        id: INTENTS.GET_REPORT,
        keywords: CHAT_CONSTANTS.PATTERNS.REPORT_KEYWORDS,
        priority: 70
    },
    {
        id: INTENTS.GET_INSIGHTS,
        keywords: CHAT_CONSTANTS.PATTERNS.INSIGHTS_KEYWORDS,
        priority: 70
    },
    {
        id: INTENTS.HELP,
        keywords: CHAT_CONSTANTS.PATTERNS.HELP_KEYWORDS,
        priority: 110 // Highest priority to always catch help requests
    }
];
