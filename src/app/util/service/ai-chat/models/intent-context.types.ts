import { Category, Account } from '../../../models';
import { Message } from './message.types';
import { Observable } from 'rxjs';

/**
 * Context passed to intent handlers containing all necessary information
 * to process user input and generate appropriate responses.
 */
export interface IntentContext {
    /** Original user input text */
    userText: string;

    /** Extracted amount from user input (0 if not found) */
    amount: number;

    /** Available categories for the current user */
    categories: Category[];

    /** Available accounts for the current user */
    accounts: Account[];

    /** Detected intent type */
    intent: string;

    /** Lowercase version of user text for easier matching */
    lowerText: string;
}

/**
 * Result returned by intent handlers.
 * Can be a Message, Observable<Message>, or null for no response.
 */
export type HandlerResult = Message | Observable<Message> | null;
