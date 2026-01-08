import { Injectable } from '@angular/core';
import { IntentHandler } from './base-intent-handler';
import { IntentContext, HandlerResult } from '../../models/intent-context.types';
import { ResponseBuilder } from '../../response-builder';

/**
 * Handles GET_REPORT intent - generates financial reports
 */
@Injectable({ providedIn: 'root' })
export class ReportIntentHandler implements IntentHandler {
    handle(context: IntentContext): HandlerResult {
        console.log('Generating report...');
        return ResponseBuilder.create()
            .html('Generating your financial report...')
            .build();
    }
}
