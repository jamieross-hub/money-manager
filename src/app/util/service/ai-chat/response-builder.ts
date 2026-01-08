import { Message, HtmlMessage, TextMessage, UIElementMessage, UIElementData } from './models/message.types';

/**
 * Fluent builder for constructing bot messages.
 * Provides a clean, readable API for creating type-safe messages.
 * 
 * @example
 * const msg = ResponseBuilder.create()
 *   .html('<b>Hello!</b>')
 *   .build();
 */
export class ResponseBuilder {
    private message: Partial<Message> = {
        sender: 'bot'
    };

    /**
     * Create a new ResponseBuilder instance
     */
    static create(): ResponseBuilder {
        return new ResponseBuilder();
    }

    /**
     * Create an HTML formatted message
     * @param text HTML content to display
     */
    html(text: string): this {
        this.message = {
            sender: 'bot',
            type: 'html',
            text
        } as HtmlMessage;
        return this;
    }

    /**
     * Create a plain text message
     * @param text Plain text content
     */
    text(text: string): this {
        this.message = {
            sender: 'bot',
            type: 'text',
            text
        } as TextMessage;
        return this;
    }

    /**
     * Create a UI element message (dropdown, card, etc.)
     * @param elementType Type of UI element
     * @param data Optional data for the UI element
     */
    uiElement(elementType: string, data?: UIElementData): this {
        this.message = {
            sender: 'bot',
            type: 'UI-ELEMENT',
            text: elementType,
            data
        } as UIElementMessage;
        return this;
    }

    /**
     * Set the sender (defaults to 'bot')
     * @param sender Message sender
     */
    from(sender: 'bot' | 'user'): this {
        this.message.sender = sender;
        return this;
    }

    /**
     * Build and return the final message
     */
    build(): Message {
        if (!this.message.type) {
            throw new Error('Message type must be set before building');
        }
        return this.message as Message;
    }
}
