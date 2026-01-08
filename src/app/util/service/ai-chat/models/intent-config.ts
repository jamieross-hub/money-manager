import { CHAT_CONSTANTS } from '../chat-constants';

export interface IntentDefinition {
    id: string;
    keywords?: string[];
    regex?: RegExp;
    priority: number;
    requiresAmount?: boolean;
}

/**
 * Configuration for all supported intents.
 * Order of detection is determined by priority (highest first).
 */
export const INTENT_CONFIG: IntentDefinition[] = [
    {
        id: CHAT_CONSTANTS.INTENTS.ADD_INCOME,
        keywords: CHAT_CONSTANTS.PATTERNS.INCOME_KEYWORDS,
        priority: 100,
        requiresAmount: true
    },
    {
        id: CHAT_CONSTANTS.INTENTS.ADD_EXPENSE,
        keywords: CHAT_CONSTANTS.PATTERNS.EXPENSE_KEYWORDS,
        priority: 100,
        requiresAmount: true
    },
    {
        id: CHAT_CONSTANTS.INTENTS.CHECK_BALANCE,
        keywords: CHAT_CONSTANTS.PATTERNS.BALANCE_KEYWORDS,
        priority: 80
    },
    {
        id: CHAT_CONSTANTS.INTENTS.ACCOUNT_SUMMARY_CARD,
        keywords: CHAT_CONSTANTS.PATTERNS.ACCOUNT_SUMMARY_KEYWORDS,
        priority: 80
    },
    {
        id: CHAT_CONSTANTS.INTENTS.RECENT_ACTIVITY_CARD,
        keywords: CHAT_CONSTANTS.PATTERNS.RECENT_ACTIVITY_KEYWORDS,
        priority: 80
    },
    {
        id: CHAT_CONSTANTS.INTENTS.CLEAR_DATA,
        keywords: CHAT_CONSTANTS.PATTERNS.CLEAR_DATA_KEYWORDS,
        priority: 90
    },
    {
        id: CHAT_CONSTANTS.INTENTS.GET_REPORT,
        keywords: CHAT_CONSTANTS.PATTERNS.REPORT_KEYWORDS,
        priority: 70
    },
    {
        id: CHAT_CONSTANTS.INTENTS.GET_INSIGHTS,
        keywords: CHAT_CONSTANTS.PATTERNS.INSIGHTS_KEYWORDS,
        priority: 70
    },
    {
        id: CHAT_CONSTANTS.INTENTS.HELP,
        keywords: CHAT_CONSTANTS.PATTERNS.HELP_KEYWORDS,
        priority: 110 // Highest priority to always catch help requests
    }
];
