import { Injectable } from '@angular/core';
import { IntentHandler } from './base-intent-handler';
import { IntentContext, HandlerResult } from '../../models/intent-context.types';
import { ChatFlowService } from '../../chat-flow.service';
import { CHAT_CONSTANTS } from '../../chat-constants';
import { Message } from '../../models/message.types';
import { ResponseBuilder } from '../../response-builder';

/**
 * Handles ADD_INCOME and ADD_EXPENSE intents
 * Manages multi-step transaction flow when category/account info is missing
 */
@Injectable({ providedIn: 'root' })
export class TransactionIntentHandler implements IntentHandler {
    constructor(private flowService: ChatFlowService) { }

    handle(context: IntentContext): HandlerResult {
        const { intent, amount } = context;

        // If we're not in a flow, start one
        if (!this.flowService.getStage()) {
            const reply = this.flowService.startAmountFlow(amount);
            return this.convertFlowReply(reply);
        }

        // If in flow, handle the type reply
        const reply = this.flowService.handleTypeReply(intent);
        return this.convertFlowReply(reply);
    }

    /**
     * Convert flow service reply to Message type
     */
    private convertFlowReply(reply: any): Message {
        if (typeof reply === 'string') {
            return ResponseBuilder.create().html(reply).build();
        } else if (reply.type === 'UI-ELEMENT') {
            return ResponseBuilder.create()
                .uiElement(reply.text, reply.data)
                .build();
        } else {
            return ResponseBuilder.create().html(reply).build();
        }
    }
}
