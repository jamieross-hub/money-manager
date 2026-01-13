import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

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
  private readonly apiUrl = 'https://api.openai.com/v1/chat/completions';
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
    // try {
    //   localStorage.setItem('openai_api_key', apiKey);
    // } catch (error) {
    //   console.error('Error saving OpenAI API key:', error);
    // }
  }

  removeApiKey(): void {
    this.apiKey = '';
    // try {
    //   localStorage.removeItem('openai_api_key');
    // } catch (error) {
    //   console.error('Error removing OpenAI API key:', error);
    // }
  }

  isApiKeySet(): boolean {
    return !!this.apiKey;
  }

  sendMessage(messages: OpenAIMessage[], model: string = 'gpt-3.5-turbo'): Observable<string> {
    if (!this.apiKey) {
      return throwError(() => new Error('OpenAI API key not set'));
    }

    const request: OpenAIRequest = {
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
      }),
      catchError(error => {
        return throwError(() => new Error(error?.error?.error?.message || 'Failed to get response from OpenAI. Please try again.'));
      })
    );
  }

  // Helper method to create a financial advisor system message
  createFinancialAdvisorMessage(): OpenAIMessage {
    return {
      role: 'system',
      content: `You are a helpful financial advisor AI assistant. You provide personalized financial advice, 
      budget analysis, investment recommendations, tax optimization strategies, and debt management tips. 
      Always provide practical, actionable advice while reminding users to consult with qualified financial 
      professionals for personalized guidance. Be clear, concise, and focus on educational content that 
      helps users make informed financial decisions.`
    };
  }

  // Helper method to analyze spending patterns (placeholder for future integration)
  analyzeSpendingPatterns(transactions: any[]): Observable<string> {
    const systemMessage = this.createFinancialAdvisorMessage();
    const userMessage: OpenAIMessage = {
      role: 'user',
      content: `Analyze these spending patterns and provide recommendations for budget optimization: ${JSON.stringify(transactions)}`
    };

    return this.sendMessage([systemMessage, userMessage]);
  }

  // Helper method to get investment advice (placeholder for future integration)
  getInvestmentAdvice(financialProfile: any): Observable<string> {
    const systemMessage = this.createFinancialAdvisorMessage();
    const userMessage: OpenAIMessage = {
      role: 'user',
      content: `Based on this financial profile, provide investment recommendations: ${JSON.stringify(financialProfile)}`
    };

    return this.sendMessage([systemMessage, userMessage]);
  }

  // Helper method to get tax optimization advice (placeholder for future integration)
  getTaxOptimizationAdvice(financialData: any): Observable<string> {
    const systemMessage = this.createFinancialAdvisorMessage();
    const userMessage: OpenAIMessage = {
      role: 'user',
      content: `Provide tax optimization strategies based on this financial data: ${JSON.stringify(financialData)}`
    };

    return this.sendMessage([systemMessage, userMessage]);
  }
} 