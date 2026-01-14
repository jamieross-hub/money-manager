import { Injectable } from '@angular/core';
import { Observable, of, throwError, from } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { IntentHandler } from './base-intent-handler';
import { IntentContext, HandlerResult } from '../../models/intent-context.types';
import { ResponseBuilder } from '../../response-builder';
import { CHAT_CONSTANTS } from '../../chat-constants';
import { UserService } from 'src/app/util/service/db/user.service';
import { OpenAIMessage } from '../../models/openai.types';
import { OpenaiService } from '../../openai.service';
import { AI_PROMPTS } from '../../prompts/system.prompts';

/**
 * Consolidated handler for OpenAI-powered responses.
 * Replaces DefaultIntentHandler, AiReplyHandlerService, and OpenaiService.
 */
@Injectable({ providedIn: 'root' })
export class OpenAiIntentHandler implements IntentHandler {

    constructor(
        private openAiClient: OpenaiService,
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
                    content: AI_PROMPTS.SYSTEM_INSTRUCTION
                };

                const userMessage: OpenAIMessage = {
                    role: 'user',
                    content: context.userText
                };

                return this.openAiClient.chat([systemMessage, userMessage], apiKey).pipe(
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

    /**
     * Transcribe audio to text using OpenAI Whisper API
     */
    transcribeAudio(audioBlob: Blob): Observable<string> {
        return from(this.userService.getCurrentUser()).pipe(
            switchMap(user => {
                const apiKey = user?.preferences?.openaiApiKey;
                if (!apiKey) return throwError(() => new Error('OpenAI API Key not found'));

                // System message prompt to guide usage of domain-specific terms
                return this.openAiClient.transcribe(audioBlob, apiKey, AI_PROMPTS.SYSTEM_INSTRUCTION);
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

                return this.openAiClient.speak(text, apiKey);
            })
        );
    }
}
