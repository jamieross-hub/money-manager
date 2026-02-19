import { Injectable } from '@angular/core';
import { IntentHandler } from './base-intent-handler';
import { IntentContext, HandlerResult } from '../../models/intent-context.types';
import { ResponseBuilder } from '../../response-builder';
import { INTENTS } from '../../models/intent-config';

/**
 * Handles MONTHLY_EXPENDITURE_CARD intent - displays monthly expenditure trend UI component
 */
@Injectable()
export class MonthlyExpenditureIntentHandler implements IntentHandler {
    handle(context: IntentContext): HandlerResult {
        return ResponseBuilder.create()
            .uiElement(INTENTS.MONTHLY_EXPENDITURE_CARD)
            .build();
    }
}
