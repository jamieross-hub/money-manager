import { IntentContext, HandlerResult } from '../../models/intent-context.types';

/**
 * Base interface that all intent handlers must implement.
 * Follows the Strategy Pattern to allow easy addition of new intents.
 */
export interface IntentHandler {
    /**
     * Handle the detected intent and return appropriate response
     * @param context Context containing user input and available data
     * @returns Message, Observable<Message>, or null
     */
    handle(context: IntentContext): HandlerResult;

    /**
     * Optional: Check if this handler can process the given context
     * Useful for handlers that need additional validation
     * @param context Context to validate
     * @returns true if handler can process this context
     */
    canHandle?(context: IntentContext): boolean;
}
