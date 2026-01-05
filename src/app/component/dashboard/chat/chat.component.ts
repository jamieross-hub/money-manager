import { Component, ElementRef, ViewChild, viewChild } from '@angular/core';
import { Category } from 'src/app/util/models';
import { ChatFacadeService } from 'src/app/util/service/ai-chat/chat-facade-service';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss']
})
export class ChatComponent {

  constructor(public chatFacadeService: ChatFacadeService) {}

  sendMessage(input: HTMLInputElement) {
    const text = input.value?.trim();
    if (!text) return;

    this.chatFacadeService.messages.push({ sender: 'user', text });
    input.value = '';
    this.chatFacadeService.startBotReply(text);
  }

  onChatCategorySelected(event: { selectedCategory: Category; amount: number; txType: string }) {
    this.chatFacadeService.handleCategorySelection(event.selectedCategory, event.amount, event.txType);
  }
}
