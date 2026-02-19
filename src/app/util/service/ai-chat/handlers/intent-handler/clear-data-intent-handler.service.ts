import { Injectable } from '@angular/core';
import { IntentHandler } from './base-intent-handler';
import { IntentContext, HandlerResult } from '../../models/intent-context.types';
import { ResponseBuilder } from '../../response-builder';
import { CHAT_CONSTANTS } from '../../models/chat-constants';

/**
 * Handles CLEAR_DATA intent - clears chat messages
 * Note: Actual message clearing is handled by facade
 */
@Injectable()
export class ClearDataIntentHandler implements IntentHandler {
    handle(context: IntentContext): HandlerResult {
        return ResponseBuilder.create()
            .html(CHAT_CONSTANTS.MSGS.DATA_CLEARED)
            .build();
    }
}
