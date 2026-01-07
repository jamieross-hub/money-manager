import { Injectable } from "@angular/core";
import { CHAT_CONSTANTS } from "./chat-constants";


@Injectable({ providedIn: 'root' })
export class ChatIntentService {
  detectIntent(text: string): string {
    const t = text.toLowerCase();
    const C = CHAT_CONSTANTS;

    const hasAmount = C.PATTERNS.AMOUNT.test(t);
    const hasAction = C.PATTERNS.ACTIONS.some(a => t.includes(a));
    const isIncome = C.PATTERNS.INCOME_KEYWORDS.some(w => t.includes(w));
    const isExpense = C.PATTERNS.EXPENSE_KEYWORDS.some(w => t.includes(w));

    // Direct Transactions
    if (hasAmount && hasAction) {
      if (isIncome) return C.INTENTS.ADD_INCOME;
      if (isExpense) return C.INTENTS.ADD_EXPENSE;
    }

    // Balance Check
    if (C.PATTERNS.BALANCE_KEYWORDS.some(w => t.includes(w))) {
      return C.INTENTS.CHECK_BALANCE;
    }

    // Account Summary
    const accountsMatch = C.PATTERNS.ACCOUNT_SUMMARY_KEYWORDS.some(k => t.includes(k)) ||
      (t.includes('accounts') && ['summary', 'balances', 'overview', 'card'].some(k => t.includes(k)));
    if (accountsMatch) return C.INTENTS.ACCOUNT_SUMMARY_CARD;

    // Recent Activity
    const activityMatch = C.PATTERNS.RECENT_ACTIVITY_KEYWORDS.some(k => t.includes(k)) ||
      (t.includes('activity') && ['log', 'list', 'history'].some(k => t.includes(k)));
    if (activityMatch) return C.INTENTS.RECENT_ACTIVITY_CARD;

    // Clear Data
    const clearMatch = C.PATTERNS.CLEAR_DATA_KEYWORDS.some(k => t.includes(k)) ||
      (t.includes('delete') && t.includes('data'));
    if (clearMatch) return C.INTENTS.CLEAR_DATA;

    // Reports
    if (C.PATTERNS.REPORT_KEYWORDS.some(w => t.includes(w))) return C.INTENTS.GET_REPORT;

    // Insights
    if (C.PATTERNS.INSIGHTS_KEYWORDS.some(w => t.includes(w))) return C.INTENTS.GET_INSIGHTS;

    return C.INTENTS.AI_REPLY;
  }
}



