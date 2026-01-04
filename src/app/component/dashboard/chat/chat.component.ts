import { Component } from '@angular/core';
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

  onChatCategorySelected(event: { name: string; amount: number; txType: string }) {
    this.chatFacadeService.handleCategorySelection(event.name, event.amount, event.txType);
  }
}
