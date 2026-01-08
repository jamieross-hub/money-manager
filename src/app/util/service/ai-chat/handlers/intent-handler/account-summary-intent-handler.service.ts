import { Injectable } from '@angular/core';
import { IntentHandler } from './base-intent-handler';
import { IntentContext, HandlerResult } from '../../models/intent-context.types';
import { ResponseBuilder } from '../../response-builder';
import { CHAT_CONSTANTS } from '../../chat-constants';

/**
 * Handles ACCOUNT_SUMMARY_CARD intent - displays account summary UI component
 */
@Injectable({ providedIn: 'root' })
export class AccountSummaryIntentHandler implements IntentHandler {
    handle(context: IntentContext): HandlerResult {
        return ResponseBuilder.create()
            .uiElement(CHAT_CONSTANTS.INTENTS.ACCOUNT_SUMMARY_CARD)
            .build();
    }
}
