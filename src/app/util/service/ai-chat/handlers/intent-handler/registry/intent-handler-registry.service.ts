import { Injectable } from '@angular/core';
import { IntentHandler } from '../base-intent-handler';

/**
 * Central registry for all intent handlers.
 * Implements the Strategy Pattern by mapping intent types to their handlers.
 * 
 * This allows easy addition of new intents without modifying core facade logic.
 */
@Injectable({ providedIn: 'root' })
export class IntentHandlerRegistry {
    private handlers = new Map<string, IntentHandler>();

    /**
     * Register an intent handler
     * @param intent Intent type (e.g., 'HELP', 'ADD_INCOME')
     * @param handler Handler instance
     */
    register(intent: string, handler: IntentHandler): void {
        this.handlers.set(intent, handler);
    }

    /**
     * Get handler for a specific intent
     * @param intent Intent type
     * @returns Handler instance or undefined if not found
     */
    get(intent: string): IntentHandler | undefined {
        return this.handlers.get(intent);
    }

    /**
     * Check if a handler exists for an intent
     * @param intent Intent type
     * @returns true if handler is registered
     */
    has(intent: string): boolean {
        return this.handlers.has(intent);
    }

    /**
     * Get all registered intent types
     * @returns Array of registered intent types
     */
    getRegisteredIntents(): string[] {
        return Array.from(this.handlers.keys());
    }

    /**
     * Clear all registered handlers (useful for testing)
     */
    clear(): void {
        this.handlers.clear();
    }
}
