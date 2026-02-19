import { Injectable } from '@angular/core';
import { Observable, of, throwError, from } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { IntentHandler } from './base-intent-handler';
import { IntentContext, HandlerResult } from '../../models/intent-context.types';
import { ResponseBuilder } from '../../response-builder';
import { CHAT_CONSTANTS } from '../../models/chat-constants';
import { UserService } from 'src/app/util/service/db/user.service';
import { OpenAIMessage } from '../../models/openai.types';
import { OpenaiService } from '../../openai.service';
import { SYSTEM_PROMPTS } from '../../prompts/system.prompts';

/**
 * Consolidated handler for OpenAI-powered responses.
 * Replaces DefaultIntentHandler, AiReplyHandlerService, and OpenaiService.
 */
@Injectable()
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

                const systemMessage: OpenAIMessage = { ...SYSTEM_PROMPTS['moneyManagerDefault'] };

                // Append Chat History if available
                if (context.history && context.history.length > 0) {
                    const lastFive = context.history.slice(-5);
                    const historyText = lastFive
                        .map(msg => `${msg.sender === 'bot' ? 'AI' : 'User'}: ${msg.text || (msg.type === 'command' ? 'Executed Command' : 'Content')}`)
                        .join('\n');

                    systemMessage.content += `\n\nLAST 5 MESSAGES:\n${historyText}`;
                }

                const userMessage: OpenAIMessage = {
                    role: 'user',
                    content: context.userText
                };

                return this.openAiClient.chat([systemMessage, userMessage], apiKey).pipe(
                    map(reply => {
                        const trimmedReply = reply.trim();
                        // Check if response looks like a JSON command
                        if (trimmedReply.startsWith('{') && trimmedReply.endsWith('}')) {
                            try {
                                const commandData = JSON.parse(trimmedReply);
                                if (commandData.command) {
                                    return {
                                        sender: 'bot',
                                        type: 'command',
                                        text: trimmedReply,
                                        command: commandData.command,
                                        data: commandData
                                    } as any; // Cast to any to satisfy the Observable output type temporarily until interface alignment
                                }
                            } catch (e) {
                                console.warn('Failed to parse potential JSON command from AI', e);
                            }
                        }
                        return ResponseBuilder.create().html(reply).build();
                    }),
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
                return this.openAiClient.transcribe(audioBlob, apiKey, SYSTEM_PROMPTS['moneyManagerVoiceAssistant'].content);
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
