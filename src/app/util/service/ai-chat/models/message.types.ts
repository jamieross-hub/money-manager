/**
 * Type-safe message definitions using discriminated unions.
 * This ensures compile-time type checking and better IDE support.
 */

export interface BaseMessage {
    id?: string;
}

export interface HtmlMessage extends BaseMessage {
    sender: 'bot' | 'user';
    type: 'html';
    text: string;
    data?: never;
}

export interface TextMessage extends BaseMessage {
    sender: 'bot' | 'user';
    type: 'text';
    text: string;
    data?: never;
}

export interface UIElementMessage extends BaseMessage {
    sender: 'bot';
    type: 'UI-ELEMENT';
    text: string; // Element identifier (e.g., 'categoryDropdown', 'ACCOUNT_SUMMARY_CARD')
    data?: UIElementData;
}

export interface CommandMessage extends BaseMessage {
    sender: 'bot';
    type: 'command';
    text: string; // JSON string of the command
    command: string; // The intent (e.g., ADD_INCOME)
    data?: any; // Parsed command data
}

/**
 * Union type of all possible message types.
 * TypeScript will enforce correct properties based on the 'type' discriminator.
 */
export type Message = HtmlMessage | TextMessage | UIElementMessage | CommandMessage;

/**
 * Data for UI elements
 */
export type UIElementData = CategoryDropdownData | Record<string, any>;

export interface CategoryDropdownData {
    type: string;
    placeholder: string;
    amount: number;
    txType: string;
}

/**
 * Type guards for runtime type checking
 */
export function isHtmlMessage(msg: Message): msg is HtmlMessage {
    return msg.type === 'html';
}

export function isTextMessage(msg: Message): msg is TextMessage {
    return msg.type === 'text';
}

export function isUIElementMessage(msg: Message): msg is UIElementMessage {
    return msg.type === 'UI-ELEMENT';
}

export function isCommandMessage(msg: Message): msg is CommandMessage {
    return msg.type === 'command';
}
