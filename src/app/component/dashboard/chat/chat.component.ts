import { Component, ElementRef, ViewChild, viewChild } from '@angular/core';
import { TransactionType } from 'src/app/util/config/enums';
import { Category } from 'src/app/util/models';
import { ChatFacadeService } from 'src/app/util/service/ai-chat/chat-facade-service';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';
import { CHAT_CONSTANTS } from 'src/app/util/service/ai-chat/chat-constants';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss']
})
export class ChatComponent {

  visible: boolean = false;
  suggestion: string = '';
  suggestions = CHAT_CONSTANTS.SUGGESTIONS;

  constructor(public chatFacadeService: ChatFacadeService, public breakpointService: BreakpointService) { }

  sendMessage(input: HTMLInputElement) {
    const text = input.value?.trim();
    if (!text) return;

    this.chatFacadeService.messages.push({ sender: 'user', text, type: 'html' });
    input.value = '';
    this.suggestion = '';
    this.chatFacadeService.startBotReply(text);
  }

  onChatCategorySelected(event: { selectedCategory: Category; account: any; amount: number; txType: TransactionType }) {
    this.chatFacadeService.messages.pop();
    this.chatFacadeService.handleCategorySelection(event.selectedCategory, event.account, event.amount, event.txType);
  }

  setQuickAction(action: string, inputRef: HTMLInputElement) {
    inputRef.value = `${action}: `;
    inputRef.focus();
  }

  onMicClick() {
    console.log("Mic clicked - Placeholder for speech-to-text");
    // TODO: Implement speech-to-text logic
  }

  onAttachmentClick() {
    console.log("Attachment clicked - Placeholder for file upload");
    // TODO: Implement file upload logic
  }

  onInputChange(input: HTMLInputElement) {
    const value = input.value;
    if (!value) {
      this.suggestion = '';
      return;
    }

    // Find matching suggestion
    const match = this.suggestions.find(s =>
      s.toLowerCase().startsWith(value.toLowerCase()) && s.toLowerCase() !== value.toLowerCase()
    );

    if (match) {
      this.suggestion = match.substring(value.length);
    } else {
      this.suggestion = '';
    }
  }

  onTabKey(event: KeyboardEvent, input: HTMLInputElement) {
    if (this.suggestion) {
      event.preventDefault();
      input.value += this.suggestion;
      this.suggestion = '';
    }
  }
}
