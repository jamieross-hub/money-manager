import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '@env/environment';
import { IntentHandler } from './base-intent-handler';
import { IntentContext, HandlerResult } from '../../models/intent-context.types';
import { ResponseBuilder } from '../../response-builder';
import { CHAT_CONSTANTS } from '../../chat-constants';

export interface OpenAIMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface OpenAIResponse {
    choices: Array<{
        message: {
            content: string;
            role: string;
        };
        finish_reason: string;
    }>;
}

/**
 * Consolidated handler for OpenAI-powered responses.
 * Replaces DefaultIntentHandler, AiReplyHandlerService, and OpenaiService.
 */
@Injectable({ providedIn: 'root' })
export class OpenAiIntentHandler implements IntentHandler {
    private readonly apiUrl = 'https://api.openai.com/v1/chat/completions';
    private readonly apiKey: string = environment.openAiApiKey || '';

    constructor(private http: HttpClient) { }

    handle(context: IntentContext): HandlerResult {
        if (!this.apiKey) {
            console.error('OpenAI API key not set');
            return of(ResponseBuilder.create().html(CHAT_CONSTANTS.MSGS.INTERNAL_ERROR).build());
        }

        const systemMessage: OpenAIMessage = {
            role: 'system',
            content: `You are a helpful financial advisor AI assistant. You provide personalized financial advice, 
      budget analysis, investment recommendations, tax optimization strategies, and debt management tips. 
      Always provide practical, actionable advice while reminding users to consult with qualified financial 
      professionals for personalized guidance. Be clear, concise, and focus on educational content that 
      helps users make informed financial decisions.`
        };

        const userMessage: OpenAIMessage = {
            role: 'user',
            content: context.userText
        };

        return this.sendMessage([systemMessage, userMessage]).pipe(
            map(reply => ResponseBuilder.create().html(reply).build()),
            catchError(error => {
                console.error('OpenAiIntentHandler Error:', error);
                return of(ResponseBuilder.create().html(CHAT_CONSTANTS.MSGS.INTERNAL_ERROR).build());
            })
        );
    }

    private sendMessage(messages: OpenAIMessage[], model: string = 'gpt-3.5-turbo'): Observable<string> {
        const request = {
            model,
            messages,
            max_tokens: 1000,
            temperature: 0.7
        };

        const headers = new HttpHeaders({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
        });

        return this.http.post<OpenAIResponse>(this.apiUrl, request, { headers }).pipe(
            map(response => {
                if (response.choices && response.choices.length > 0) {
                    return response.choices[0].message.content;
                }
                throw new Error('No response from OpenAI');
            })
        );
    }
}
