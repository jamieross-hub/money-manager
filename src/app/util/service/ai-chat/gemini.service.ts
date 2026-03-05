import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { GeminiMessage } from './models/gemini.types';

/** Shape of the request body sent to the backend. */
interface BackendChatRequest {
  messages: GeminiMessage[];
  model: string;
  maxOutputTokens?: number;
  temperature?: number;
}

/** Shape of the response returned by the backend. */
interface BackendChatResponse {
  text: string;
  model?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private readonly http = inject(HttpClient);

  /**
   * Base URL of your backend API.
   * Override via setBackendUrl() or update the default here.
   */
  private backendUrl: string = '/api/ai/gemini/chat';

  // Kept for backward compatibility — callers can still pass an API key,
  // but in the new flow the key is managed server-side.
  private apiKey: string = '';

  // ─── Configuration ───────────────────────────────────────────────────────

  /** Optionally override the backend endpoint. */
  setBackendUrl(url: string): void {
    this.backendUrl = url;
  }

  /**
   * Kept for backward compatibility.
   * The API key is no longer used client-side; it is managed by the backend.
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  isApiKeySet(): boolean {
    // Always considered "set" since the key lives on the backend.
    // Kept for interface compatibility.
    return true;
  }

  initialize(user: any): void {
    if (user?.preferences?.geminiApiKey) {
      this.setApiKey(user.preferences.geminiApiKey);
    }
  }

  // ─── Core Methods ────────────────────────────────────────────────────────

  /**
   * Send chat messages to Gemini via the backend API.
   *
   * @param messages  Conversation history in Gemini format.
   * @param _apiKey   Ignored — kept for API compatibility.
   * @param modelName Gemini model name (default: gemini-2.0-flash).
   */
  chat(
    messages: GeminiMessage[],
    _apiKey?: string,
    modelName: string = 'gemini-2.0-flash'
  ): Observable<string> {
    const body: BackendChatRequest = {
      messages,
      model: modelName,
      maxOutputTokens: 1000,
      temperature: 0.7,
    };

    return this.http.post<BackendChatResponse>(this.backendUrl, body).pipe(
      map(response => response.text ?? ''),
      catchError((error: HttpErrorResponse) => {
        const message =
          error.error?.message ||
          error.message ||
          'Failed to get response from Gemini. Please try again.';
        console.error('GeminiService backend error:', error);
        return throwError(() => new Error(message));
      })
    );
  }

  /**
   * Simplified alias for chat().
   */
  sendMessage(
    messages: GeminiMessage[],
    model: string = 'gemini-2.0-flash'
  ): Observable<string> {
    return this.chat(messages, undefined, model);
  }
}
