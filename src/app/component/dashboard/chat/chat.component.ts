import { Component, ElementRef, ViewChild, viewChild } from '@angular/core';
import { Category } from 'src/app/util/models';
import { ChatFacadeService } from 'src/app/util/service/ai-chat/chat-facade-service';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss']
})
export class ChatComponent {

  visible: boolean = false;

  constructor(public chatFacadeService: ChatFacadeService, public breakpointService: BreakpointService) { }

  sendMessage(input: HTMLInputElement) {
    const text = input.value?.trim();
    if (!text) return;

    this.chatFacadeService.messages.push({ sender: 'user', text , type: 'html' });
    input.value = '';
    this.chatFacadeService.startBotReply(text);
  }

  onChatCategorySelected(event: { selectedCategory: Category; account: any; amount: number; txType: string }) {
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
}
