import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError, from } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { IntentHandler } from './base-intent-handler';
import { IntentContext, HandlerResult } from '../../models/intent-context.types';
import { ResponseBuilder } from '../../response-builder';
import { CHAT_CONSTANTS } from '../../chat-constants';
import { UserService } from 'src/app/util/service/db/user.service';

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

    constructor(
        private http: HttpClient,
        private userService: UserService
    ) { }

    handle(context: IntentContext): HandlerResult {
        return from(this.userService.getCurrentUser()).pipe(
            switchMap(user => {
                const apiKey = user?.preferences?.openaiApiKey;

                if (!apiKey) {
                    console.error('OpenAI API key not set in user preferences');
                    return of(ResponseBuilder.create().html('Please connect your OpenAI API key in the OpenAI Integration to use this OpenAI feature.').build());
                }

                const systemMessage: OpenAIMessage = {
                    role: 'system',
                    content: `You are Money Manager AI, an advanced personal finance assistant.

PROFILE:
- Tone: Professional, empathetic, and motivating.
- Goal: Empower users to achieve financial wellness through smart tracking and knowledge.

CAPABILITIES:
1. **Financial Guidance**: Offer advice on savings, budgeting (e.g. 50/30/20 rule), and investment basics.
2. **App Assistance**: Guide users on how to use the app commands.

APP COMMANDS (Guide users to these):
- **Add Transaction**: "Spent [amount] on [category]" or "Income [amount]".
- **Insights**: "Show balance", "Recent activity", "Monthly report".
- **System**: "Clear data", "Help".

IMPORTANT RULES:
- You DO NOT have access to the user's live database. If asked for current balance, suggest typing "Show balance".
- Use <b>bold</b> for key terms.
- Keep responses mobile-friendly (short paragraphs).
- Disclaimer: For complex/legal financial advice, suggest consulting a professional.`
                };

                const userMessage: OpenAIMessage = {
                    role: 'user',
                    content: context.userText
                };

                return this.sendMessage([systemMessage, userMessage], apiKey).pipe(
                    map(reply => ResponseBuilder.create().html(reply).build()),
                    catchError(error => {
                        console.error('OpenAiIntentHandler Error:', error);
                        return of(ResponseBuilder.create().html(CHAT_CONSTANTS.MSGS.INTERNAL_ERROR).build());
                    })
                );
            }),
            catchError(error => {
                console.error('Error fetching user for OpenAI key:', error);
                return of(ResponseBuilder.create().html(CHAT_CONSTANTS.MSGS.INTERNAL_ERROR).build());
            })
        );
    }

    private sendMessage(messages: OpenAIMessage[], apiKey: string, model: string = 'gpt-3.5-turbo'): Observable<string> {
        const request = {
            model,
            messages,
            max_tokens: 1000,
            temperature: 0.7
        };

        const headers = new HttpHeaders({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
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


    /**
     * Transcribe audio to text using OpenAI Whisper API
     */
    transcribeAudio(audioBlob: Blob): Observable<string> {
        return from(this.userService.getCurrentUser()).pipe(
            switchMap(user => {
                const apiKey = user?.preferences?.openaiApiKey;
                if (!apiKey) return throwError(() => new Error('OpenAI API Key not found'));

                const formData = new FormData();
                formData.append('file', audioBlob, 'recording.webm');
                formData.append('model', 'whisper-1');

                const headers = new HttpHeaders({
                    'Authorization': `Bearer ${apiKey}`
                });

                return this.http.post<any>('https://api.openai.com/v1/audio/transcriptions', formData, { headers }).pipe(
                    map(response => response.text)
                );
            })
        );
    }


    /**
     * Generate speech from text using OpenAI TTS API
     */
    generateSpeech(text: string): Observable<Blob> {
        return from(this.userService.getCurrentUser()).pipe(
            switchMap(user => {
                const apiKey = user?.preferences?.openaiApiKey;
                if (!apiKey) return throwError(() => new Error('OpenAI API Key not found'));

                const request = {
                    model: 'tts-1',
                    input: text,
                    voice: 'alloy'
                };

                const headers = new HttpHeaders({
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                });

                return this.http.post('https://api.openai.com/v1/audio/speech', request, {
                    headers: headers,
                    responseType: 'blob'
                });
            })
        );
    }
}
