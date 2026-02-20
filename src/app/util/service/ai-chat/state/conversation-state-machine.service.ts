import { Injectable } from '@angular/core';
import { TransactionType } from 'src/app/util/config/enums';

export enum ChatState {
    IDLE = 'IDLE',
    AWAITING_TYPE = 'AWAITING_TYPE',
    AWAITING_CATEGORY = 'AWAITING_CATEGORY',
    AWAITING_AMOUNT = 'AWAITING_AMOUNT'
}

export enum ChatEvent {
    START_FLOW = 'START_FLOW',
    AMOUNT_PROVIDED = 'AMOUNT_PROVIDED',
    TYPE_PROVIDED = 'TYPE_PROVIDED',
    CATEGORY_PROVIDED = 'CATEGORY_PROVIDED',
    CANCEL = 'CANCEL'
}

export interface ChatContext {
    amount: number | null;
    type: TransactionType | null;
    category: string | null;
    accountName: string | null;
}

/**
 * Manages the state and context of the conversation.
 * Implements a Finite State Machine (FSM) for predictable flow transitions.
 */
@Injectable({ providedIn: 'root' })
export class ConversationStateMachine {
    private currentState: ChatState = ChatState.IDLE;
    private context: ChatContext = this.getInitialContext();

    constructor() { }

    getState(): ChatState {
        return this.currentState;
    }

    getContext(): ChatContext {
        return { ...this.context };
    }

    /**
     * Transition to a new state based on an event
     */
    transition(event: ChatEvent, data?: Partial<ChatContext>): void {
        const nextState = this.getNextState(this.currentState, event);

        if (nextState !== this.currentState) {
            console.log(`[ChatFSM] Transition: ${this.currentState} --(${event})--> ${nextState}`);
            this.currentState = nextState;
        }

        if (data) {
            this.context = { ...this.context, ...data };
        }

        if (this.currentState === ChatState.IDLE && event === ChatEvent.CANCEL) {
            this.reset();
        }
    }

    private getNextState(current: ChatState, event: ChatEvent): ChatState {
        if (event === ChatEvent.CANCEL) return ChatState.IDLE;

        switch (current) {
            case ChatState.IDLE:
                if (event === ChatEvent.START_FLOW) {
                    return ChatState.AWAITING_AMOUNT; // Default if nothing provided
                }
                if (event === ChatEvent.AMOUNT_PROVIDED) return ChatState.AWAITING_CATEGORY;
                if (event === ChatEvent.TYPE_PROVIDED) return ChatState.AWAITING_CATEGORY;
                break;

            case ChatState.AWAITING_AMOUNT:
                if (event === ChatEvent.AMOUNT_PROVIDED) return ChatState.AWAITING_CATEGORY;
                break;

            case ChatState.AWAITING_TYPE:
                if (event === ChatEvent.TYPE_PROVIDED) return ChatState.AWAITING_CATEGORY;
                break;

            case ChatState.AWAITING_CATEGORY:
                if (event === ChatEvent.CATEGORY_PROVIDED) return ChatState.IDLE;
                break;
        }

        return current;
    }

    reset(): void {
        this.currentState = ChatState.IDLE;
        this.context = this.getInitialContext();
    }

    private getInitialContext(): ChatContext {
        return {
            amount: null,
            type: null,
            category: null,
            accountName: null
        };
    }
}
