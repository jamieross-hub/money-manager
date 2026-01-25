import { Injectable } from '@angular/core';
import { IntentHandler } from './base-intent-handler';
import { IntentContext, HandlerResult } from '../../models/intent-context.types';
import { ResponseBuilder } from '../../response-builder';
import { INTENTS } from '../../models/intent-config';

/**
 * Handles LOAN_SUMMARY_CARD intent - displays loan summary UI component
 */
@Injectable({ providedIn: 'root' })
export class LoanSummaryIntentHandler implements IntentHandler {
    handle(context: IntentContext): HandlerResult {
        return ResponseBuilder.create()
            .uiElement(INTENTS.LOAN_SUMMARY_CARD)
            .build();
    }
}
