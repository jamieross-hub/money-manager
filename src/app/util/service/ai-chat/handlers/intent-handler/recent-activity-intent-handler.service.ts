import { Injectable } from '@angular/core';
import { IntentHandler } from './base-intent-handler';
import { IntentContext, HandlerResult } from '../../models/intent-context.types';
import { ResponseBuilder } from '../../response-builder';
import { CHAT_CONSTANTS } from '../../chat-constants';

/**
 * Handles RECENT_ACTIVITY_CARD intent - displays recent transactions UI component
 */
@Injectable({ providedIn: 'root' })
export class RecentActivityIntentHandler implements IntentHandler {
    handle(context: IntentContext): HandlerResult {
        return ResponseBuilder.create()
            .uiElement(CHAT_CONSTANTS.INTENTS.RECENT_ACTIVITY_CARD)
            .build();
    }
}
