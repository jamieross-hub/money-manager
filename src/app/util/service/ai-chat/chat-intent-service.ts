import { Injectable } from "@angular/core";
import { CHAT_CONSTANTS } from "./models/chat-constants";
import { INTENT_CONFIG, IntentDefinition, INTENTS } from "./models/intent-config";

@Injectable({ providedIn: 'root' })
export class ChatIntentService {

  /**
   * Detects user intent based on text configuration.
   * Prioritizes intents based on the defined priority in INTENT_CONFIG.
   */
  detectIntent(text: string): string {
    const textLower = text.toLowerCase();

    // Check for amount if an intent requires it
    const hasAmount = CHAT_CONSTANTS.PATTERNS.AMOUNT.test(textLower);

    // Sort config by priority (highest first)
    const sortedConfig = [...INTENT_CONFIG].sort((a: IntentDefinition, b: IntentDefinition) => b.priority - a.priority);

    for (const config of sortedConfig) {
      if (this.matches(textLower, config, hasAmount)) {
        return config.id;
      }
    }

    // Special case for complex account summary match if not caught by keywords
    if (textLower.includes('accounts') && ['summary', 'balances', 'overview', 'card'].some(k => textLower.includes(k))) {
      return INTENTS.ACCOUNT_SUMMARY_CARD;
    }

    // Special case for complex recent activity match if not caught by keywords
    if (textLower.includes('activity') && ['log', 'list', 'history'].some(k => textLower.includes(k))) {
      return INTENTS.RECENT_ACTIVITY_CARD;
    }

    return INTENTS.AI_REPLY;
  }

  /**
   * Checks if the text matches an intent definition
   */
  private matches(text: string, config: IntentDefinition, hasAmount: boolean): boolean {
    // If intent requires an amount and we don't have one, it's not a match
    if (config.requiresAmount && !hasAmount) {
      return false;
    }

    // Priority 1: Regex match
    if (config.regex && config.regex.test(text)) {
      return true;
    }

    // Priority 2: Keyword match
    if (config.keywords && config.keywords.some(k => text.includes(k.toLowerCase()))) {
      return true;
    }

    return false;
  }
}



