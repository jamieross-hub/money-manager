import { Injectable } from '@angular/core';
import { IntentHandler } from './base-intent-handler';
import { IntentContext, HandlerResult } from '../../models/intent-context.types';
import { ResponseBuilder } from '../../response-builder';
import { INTENTS } from '../../models/intent-config';

/**
 * Handles BUDGET_CARD intent - displays budget summary UI component
 */
@Injectable()
export class BudgetCardIntentHandler implements IntentHandler {
    handle(context: IntentContext): HandlerResult {
        return ResponseBuilder.create()
            .uiElement(INTENTS.BUDGET_CARD)
            .build();
    }
}
