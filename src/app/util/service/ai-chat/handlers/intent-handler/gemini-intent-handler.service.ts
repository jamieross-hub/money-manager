import { Injectable } from '@angular/core';
import { Observable, of, from } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { IntentHandler } from './base-intent-handler';
import { IntentContext, HandlerResult } from '../../models/intent-context.types';
import { ResponseBuilder } from '../../response-builder';
import { CHAT_CONSTANTS } from '../../models/chat-constants';
import { UserService } from 'src/app/util/service/db/user.service';
import { GeminiMessage } from '../../models/gemini.types';
import { GeminiService } from '../../gemini.service';
import { SYSTEM_PROMPTS } from '../../prompts/system.prompts';

/**
 * Handler for Google Gemini-powered responses.
 */
@Injectable()
export class GeminiIntentHandler implements IntentHandler {

    constructor(
        private geminiClient: GeminiService,
        private userService: UserService
    ) { }

    handle(context: IntentContext): HandlerResult {
        return from(this.userService.getCurrentUser()).pipe(
            switchMap(user => {
                const apiKey = user?.preferences?.geminiApiKey;

                if (!apiKey) {
                    console.error('Gemini API key not set in user preferences');
                    return of(ResponseBuilder.create().html(
                        'Please configure your Gemini API key in the Settings to enable Google Gemini chat.<br/><br/>' +
                        '<b>In the meantime, you can try these built-in offline commands:</b><br/><br/>' + 
                        CHAT_CONSTANTS.MSGS.HELP_OPTIONS
                    ).build());
                }

                // Gemini expects a specific format for messages
                const contents: GeminiMessage[] = [];
                
                // Add System Prompt (Gemini 1.5 prefers it as a 'system' role if supported, 
                // but for simplicity we'll prepend it to the first user message or as a separate role if the API allows.
                // Standard approach for generateContent is role 'user' and role 'model'.
                // Some models support system instruction separately. 
                // For now, we'll prepend to the user message to be safe across models.
                
                const systemPrompt = SYSTEM_PROMPTS['moneyManagerDefault'].content;
                let userContent = context.userText;

                // Append Chat History if available
                if (context.history && context.history.length > 0) {
                    const lastFive = context.history.slice(-5);
                    const historyText = lastFive
                        .map(msg => `${msg.sender === 'bot' ? 'AI' : 'User'}: ${msg.text || (msg.type === 'command' ? 'Executed Command' : 'Content')}`)
                        .join('\n');

                    userContent = `System Context: ${systemPrompt}\n\nRecent History:\n${historyText}\n\nUser: ${userContent}`;
                } else {
                    userContent = `System Context: ${systemPrompt}\n\nUser: ${userContent}`;
                }

                contents.push({
                    role: 'user',
                    parts: [{ text: userContent }]
                });

                return this.geminiClient.chat(contents, apiKey).pipe(
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
                                    } as any;
                                }
                            } catch (e) {
                                console.warn('Failed to parse potential JSON command from Gemini', e);
                            }
                        }
                        return ResponseBuilder.create().html(reply).build();
                    }),
                    catchError(error => {
                        console.error('GeminiIntentHandler Error:', error);
                        return of(ResponseBuilder.create().html(CHAT_CONSTANTS.MSGS.INTERNAL_ERROR).build());
                    })
                );
            }),
            catchError(error => {
                console.error('Error fetching user for Gemini key:', error);
                return of(ResponseBuilder.create().html(CHAT_CONSTANTS.MSGS.INTERNAL_ERROR).build());
            })
        );
    }
}
