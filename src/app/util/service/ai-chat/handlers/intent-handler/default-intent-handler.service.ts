import { Injectable } from '@angular/core';
import { IntentHandler } from './base-intent-handler';
import { IntentContext, HandlerResult } from '../../models/intent-context.types';
import { AiReplyHandlerService } from '../ai-reply-handler.service';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { ResponseBuilder } from '../../response-builder';
import { CHAT_CONSTANTS } from '../../chat-constants';

/**
 * Default fallback handler for unknown intents or AI_REPLY
 * Delegates to AI service for natural language responses
 */
@Injectable({ providedIn: 'root' })
export class DefaultIntentHandler implements IntentHandler {
    constructor(private aiReplyService: AiReplyHandlerService) { }

    handle(context: IntentContext): HandlerResult {
        return this.aiReplyService.handleAI(context.userText).pipe(
            map(reply => ResponseBuilder.create().html(reply).build()),
            catchError(() => of(
                ResponseBuilder.create()
                    .html(CHAT_CONSTANTS.MSGS.INTERNAL_ERROR)
                    .build()
            ))
        );
    }
}
