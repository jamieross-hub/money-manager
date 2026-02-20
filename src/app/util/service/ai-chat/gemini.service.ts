import { Injectable } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { GoogleGenAI } from '@google/genai';
import { GeminiMessage } from './models/gemini.types';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private apiKey: string = '';
  private genAI: GoogleGenAI | null = null;

  constructor() { }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    this.genAI = new GoogleGenAI({ apiKey, apiVersion: 'v1' });
  }

  isApiKeySet(): boolean {
    return !!this.apiKey;
  }

  /**
   * Main method to send chat messages to Gemini using the official Unified SDK.
   * @param messages Array of message objects
   * @param apiKey Optional API key. If not provided, uses the stored key.
   * @param modelName Model to use (default: gemini-2.0-flash)
   */
  chat(messages: GeminiMessage[], apiKey?: string, modelName: string = 'gemini-2.0-flash'): Observable<string> {
    const key = apiKey || this.apiKey;
    if (!key) {
      return throwError(() => new Error('Gemini API Key is required'));
    }

    // Initialize SDK if not already done or if key changed
    if (!this.genAI || (apiKey && apiKey !== this.apiKey)) {
      this.genAI = new GoogleGenAI({ apiKey: key, apiVersion: 'v1' });
    }

    return from(this.genAI.models.generateContent({
      model: modelName,
      contents: messages.map(m => ({
        role: m.role,
        parts: m.parts
      })),
      config: {
        maxOutputTokens: 1000,
        temperature: 0.7,
      }
    })).pipe(
      map(response => response.text || ''),
      catchError(error => {
        console.error('Gemini SDK Error:', error);
        return throwError(() => new Error(error?.message || 'Failed to get response from Gemini. Please try again.'));
      })
    );
  }

  /**
   * Alias for chat, simplified for general usage.
   */
  sendMessage(messages: GeminiMessage[], model: string = 'gemini-2.0-flash'): Observable<string> {
    return this.chat(messages, this.apiKey, model);
  }
}
