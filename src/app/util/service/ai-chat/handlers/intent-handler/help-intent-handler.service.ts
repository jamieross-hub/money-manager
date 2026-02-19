import { Injectable } from '@angular/core';
import { IntentHandler } from './base-intent-handler';
import { IntentContext, HandlerResult } from '../../models/intent-context.types';
import { ResponseBuilder } from '../../response-builder';
import { CHAT_CONSTANTS } from '../../models/chat-constants';

/**
 * Handles HELP intent - displays available commands to user
 */
@Injectable()
export class HelpIntentHandler implements IntentHandler {
    handle(context: IntentContext): HandlerResult {
        return ResponseBuilder.create()
            .html(CHAT_CONSTANTS.MSGS.HELP_OPTIONS)
            .build();
    }
}
