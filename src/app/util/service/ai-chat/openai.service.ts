import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { User } from '../../models';
import { environment } from 'src/environments/environment';
import { SYSTEM_PROMPTS } from './prompts/system.prompts';
import { CategoryIcon } from '../../config/config';
// If openai.types.ts exists and we want to use it, we could import it.
// However, to be safe and self-contained as per the current file structure:
export interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  temperature?: number;
}

export interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class OpenaiService {
  private readonly baseUrl = 'https://api.openai.com/v1';
  private apiKey: string = '';

  constructor(private http: HttpClient) {
    this.loadApiKey();
  }

  private loadApiKey(): void {
    // API key should be set via setApiKey method or loaded from user preferences context
    this.apiKey = '';
  }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  removeApiKey(): void {
    this.apiKey = '';
  }

  initialize(user: User | null): void {
    const key = this.getApiKey(user);
    this.apiKey = key || '';
  }

  isApiKeySet(): boolean {
    return !!this.apiKey;
  }

  /**
   * Centralized method to retrieve the OpenAI API key.
   * Priority: User Preferences > Environment Key (only for regular users)
   */
  getApiKey(user: User | null): string | undefined {
    // 1. Check user preferences
    if (user?.preferences?.openaiApiKey) {
      return user.preferences.openaiApiKey;
    }

    // 2. Return environment key ONLY if NOT an offline guest
    if (user && user.uid !== 'offline-guest') {
      return environment.openAiApiKey;
    }

    return undefined;
  }

  /**
   * Main method to send chat messages to OpenAI.
   * @param messages Array of message objects
   * @param apiKey Optional API key. If not provided, uses the stored key.
   * @param model Model to use (default: gpt-3.5-turbo)
   */
  chat(messages: OpenAIMessage[], apiKey?: string, model: string = 'gpt-3.5-turbo'): Observable<string> {
    const key = apiKey || this.apiKey;
    if (!key) {
      return throwError(() => new Error('OpenAI API Key is required'));
    }

    const headers = this.getHeaders(key, true);
    const body: OpenAIRequest = {
      model,
      messages,
      max_tokens: 1000,
      temperature: 0.7
    };

    return this.http.post<OpenAIResponse>(`${this.baseUrl}/chat/completions`, body, { headers }).pipe(
      map(response => {
        if (response.choices && response.choices.length > 0) {
          return response.choices[0].message.content;
        }
        throw new Error('No response from OpenAI');
      }),
      catchError(error => {
        return throwError(() => new Error(error?.error?.error?.message || 'Failed to get response from OpenAI. Please try again.'));
      })
    );
  }

  /**
   * Alias for chat, used by OpenaiInteractionComponent.
   * Uses the stored API key.
   */
  sendMessage(messages: OpenAIMessage[], model: string = 'gpt-3.5-turbo'): Observable<string> {
    return this.chat(messages, this.apiKey, model);
  }

  transcribe(audio: Blob, apiKey?: string, prompt?: string): Observable<string> {
    const key = apiKey || this.apiKey;
    if (!key) return throwError(() => new Error('OpenAI API Key is required'));

    const headers = this.getHeaders(key, false); // Content-Type handled by browser for FormData
    const formData = new FormData();
    formData.append('file', audio, 'recording.webm');
    formData.append('model', 'whisper-1');
    if (prompt) {
      formData.append('prompt', prompt);
    }

    return this.http.post<any>(`${this.baseUrl}/audio/transcriptions`, formData, { headers }).pipe(
      map(response => response.text)
    );
  }

  speak(text: string, apiKey?: string): Observable<Blob> {
    const key = apiKey || this.apiKey;
    if (!key) return throwError(() => new Error('OpenAI API Key is required'));

    const headers = this.getHeaders(key, true);
    const body = {
      model: 'tts-1',
      input: text,
      voice: 'alloy'
    };

    return this.http.post(`${this.baseUrl}/audio/speech`, body, {
      headers: headers,
      responseType: 'blob'
    });
  }

  private getHeaders(apiKey: string, json: boolean): HttpHeaders {
    let headers = new HttpHeaders({
      'Authorization': `Bearer ${apiKey}`
    });
    if (json) {
      headers = headers.set('Content-Type', 'application/json');
    }
    return headers;
  }

  // --- Commented out placeholders as requested ---

  // // Helper method to create a financial advisor system message
  // createFinancialAdvisorMessage(): OpenAIMessage {
  //   return {
  //     role: 'system',
  //     content: `You are a helpful financial advisor AI assistant. You provide personalized financial advice, 
  //     budget analysis, investment recommendations, tax optimization strategies, and debt management tips. 
  //     Always provide practical, actionable advice while reminding users to consult with qualified financial 
  //     professionals for personalized guidance. Be clear, concise, and focus on educational content that 
  //     helps users make informed financial decisions.`
  //   };
  // }

  // // Helper method to analyze spending patterns (placeholder for future integration)
  // analyzeSpendingPatterns(transactions: any[]): Observable<string> {
  //   const systemMessage = this.createFinancialAdvisorMessage();
  //   const userMessage: OpenAIMessage = {
  //     role: 'user',
  //     content: `Analyze these spending patterns and provide recommendations for budget optimization: ${JSON.stringify(transactions)}`
  //   };
  //   return this.sendMessage([systemMessage, userMessage]);
  // }

  // // Helper method to get investment advice (placeholder for future integration)
  // getInvestmentAdvice(financialProfile: any): Observable<string> {
  //   const systemMessage = this.createFinancialAdvisorMessage();
  //   const userMessage: OpenAIMessage = {
  //     role: 'user',
  //     content: `Based on this financial profile, provide investment recommendations: ${JSON.stringify(financialProfile)}`
  //   };
  //   return this.sendMessage([systemMessage, userMessage]);
  // }

  // // Helper method to get tax optimization advice (placeholder for future integration)
  // getTaxOptimizationAdvice(financialData: any): Observable<string> {
  //   const systemMessage = this.createFinancialAdvisorMessage();
  //   const userMessage: OpenAIMessage = {
  //     role: 'user',
  //     content: `Provide tax optimization strategies based on this financial data: ${JSON.stringify(financialData)}`
  //   };
  //   return this.sendMessage([systemMessage, userMessage]);
  // }

  suggestCategoryIconAndColor(
    categoryName: string, 
    availableIcons: CategoryIcon[], 
    availableColors: { label: string; value: string }[]
  ): Observable<{ icon: string; color: string }> {
    const systemMessage = SYSTEM_PROMPTS['categorySuggestion'];
    const userMessage: OpenAIMessage = {
      role: 'user',
      content: `Suggest an icon and color for the category: "${categoryName}".
      
      Available Icons (use only the "icon" string): ${JSON.stringify(availableIcons.map(i => i.icon))}
      Available Colors (use only the HEX code): ${JSON.stringify(availableColors.map(c => c.value))}
      
      Return JSON: {"icon": "...", "color": "..."}`
    };

    return this.sendMessage([systemMessage, userMessage]).pipe(
      map(response => {
        try {
          // Find the first { and last } to handle any extra text from AI
          const start = response.indexOf('{');
          const end = response.lastIndexOf('}');
          if (start !== -1 && end !== -1) {
            const jsonStr = response.substring(start, end + 1);
            return JSON.parse(jsonStr);
          }
          return JSON.parse(response);
        } catch (e) {
          console.error('Failed to parse AI suggestion JSON:', response);
          throw new Error('Invalid suggestion format');
        }
      })
    );
  }

  categorizeCategories(
    items: { id: string; name: string }[],
    existingGroups: string[]
  ): Observable<{ id: string; group: string }[]> {
    const systemMessage = SYSTEM_PROMPTS['autoCategorize'];
    const userMessage: OpenAIMessage = {
      role: 'user',
      content: `Please categorize the following items into appropriate groups.
      
Existing groups: [${existingGroups.join(', ')}]

Items to categorize:
${JSON.stringify(items)}

Remember, return ONLY a JSON array.`
    };

    return this.sendMessage([systemMessage, userMessage]).pipe(
      map(response => {
        try {
          // Find the first [ and last ]
          const start = response.indexOf('[');
          const end = response.lastIndexOf(']');
          if (start !== -1 && end !== -1) {
            const jsonStr = response.substring(start, end + 1);
            return JSON.parse(jsonStr);
          }
          return JSON.parse(response);
        } catch (e) {
          console.error('Failed to parse AI categorization JSON:', response);
          throw new Error('Invalid categorization format');
        }
      })
    );
  }
}
