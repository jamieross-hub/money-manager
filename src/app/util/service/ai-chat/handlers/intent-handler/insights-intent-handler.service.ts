import { Injectable } from '@angular/core';
import { IntentHandler } from './base-intent-handler';
import { IntentContext, HandlerResult } from '../../models/intent-context.types';
import { AiReplyHandlerService } from '../ai-reply-handler.service';
import { map } from 'rxjs/operators';
import { ResponseBuilder } from '../../response-builder';

/**
 * Handles GET_INSIGHTS and AI_REPLY intents - delegates to AI service
 */
@Injectable({ providedIn: 'root' })
export class InsightsIntentHandler implements IntentHandler {
    constructor(private aiReplyService: AiReplyHandlerService) { }

    handle(context: IntentContext): HandlerResult {
        return this.aiReplyService.handleAI(context.userText).pipe(
            map(reply => ResponseBuilder.create().html(reply).build())
        );
    }
}
