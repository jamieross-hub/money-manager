import { Injectable, inject } from '@angular/core';
import { UserService } from './db/user.service';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
  providedIn: 'root'
})
export class GreetingFacadeService {
  private readonly userService = inject(UserService);
  private readonly translateService = inject(TranslateService);

  private hasGreeted = false;
  private seenMessages = new Set<string>();
  private chatPlaceholderIndex = 0;
  private loaderMessageIndex = 0;

  public getChatPlaceholders(): string[] {
    const placeholders = this.translateService.instant('GREETINGS.CHAT_PLACEHOLDERS');
    return Array.isArray(placeholders) ? placeholders : [
      'Spent ₹500 on dinner',
      'Received ₹50000 Salary',
      'What is my balance?',
      'Highest expense this week?',
      'Compare Food vs Fuel',
      'Monthly spending report',
      'Show my loan summary',
      'Ask about finances...'
    ];
  }

  public getLoadingMessages(): string[] {
    const messages = this.translateService.instant('GREETINGS.LOADING_MESSAGES');
    return Array.isArray(messages) ? messages : [
      'Preparing your financial dashboard...',
      'Gathering your latest transactions...',
      'Calculating your wealth insights...',
      'Organizing your budget categories...',
      'Making things look beautiful for you...',
      'Just a few more seconds...',
      'Almost ready to crunch those numbers...',
      'Ready when you are!'
    ];
  }

  public shouldGreet(): boolean {
    return !this.hasGreeted;
  }

  public markAsGreeted(): void {
    this.hasGreeted = true;
  }

  // Session tracking for messages
  public trackSeenMessage(msg: string): void {
    this.seenMessages.add(msg);
  }

  public filterUnseenMessages(messages: string[]): string[] {
    const unseen = messages.filter(m => !this.seenMessages.has(m));
    return unseen.length > 0 ? unseen : messages; // Fallback if all were seen
  }

  public getChatPlaceholderIndex(): number {
    return this.chatPlaceholderIndex;
  }

  public setChatPlaceholderIndex(index: number): void {
    this.chatPlaceholderIndex = index;
  }

  public getLoaderMessageIndex(): number {
    return this.loaderMessageIndex;
  }

  public setLoaderMessageIndex(index: number): void {
    this.loaderMessageIndex = index;
  }

  /**
   * Calculates the next index in a progressive cycle.
   * Useful for cycling through messages or placeholders.
   * @param currentIndex The current index.
   * @param totalItems The total number of items to cycle through.
   * @param loop Whether to loop back to the start or stick to the last item.
   * @returns The next index in the cycle.
   */
  public getProgressiveIndex(currentIndex: number, totalItems: number, loop: boolean = true): number {
    if (totalItems === 0) return 0;
    
    const nextIndex = currentIndex + 1;
    if (nextIndex < totalItems) {
      return nextIndex;
    }
    
    return loop ? 0 : currentIndex;
  }

  public isLastIndex(index: number, totalItems: number): boolean {
    return index === totalItems - 1;
  }

  public resetGreeting(): void {
    this.hasGreeted = false;
    this.seenMessages.clear();
    this.chatPlaceholderIndex = 0;
    this.loaderMessageIndex = 0;
  }

  public getPersonalizedGreeting(): string {
    const hour = new Date().getHours();
    let greeting = '';

    if (hour >= 5 && hour < 12) {
      greeting = 'Good morning';
    } else if (hour >= 12 && hour < 17) {
      greeting = 'Good afternoon';
    } else if (hour >= 17 && hour < 20) {
      greeting = 'Good evening';
    } else {
      greeting = 'Let\'s review your day';
    }

    const user = this.userService.getCurrentUserSnapshot();
    const name = user?.firstName || user?.displayName || 'there';

    return `${greeting}, ${name}!`;
  }
}
