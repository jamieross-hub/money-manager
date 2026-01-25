import { Component, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { TransactionType } from 'src/app/util/config/enums';
import { Category } from 'src/app/util/models';
import { ChatFacadeService } from 'src/app/util/service/ai-chat/chat-facade-service';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';
import { CHAT_CONSTANTS } from 'src/app/util/service/ai-chat/models/chat-constants';
import { AudioRecordingService } from 'src/app/util/service/ai-chat/audio-recording.service';
import { OpenAiIntentHandler } from 'src/app/util/service/ai-chat/handlers/intent-handler/openai-intent-handler.service';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss']
})
export class ChatComponent {

  visible: boolean = false;
  suggestion: string = '';
  suggestions = CHAT_CONSTANTS.SUGGESTIONS;
  @ViewChild('chatInput', { static: false }) ChatInput!: ElementRef<HTMLInputElement>;

  // Voice Interaction State
  isRecording: boolean = false;
  isProcessingAudio: boolean = false;
  voiceBlob: Blob | null = null;
  isPlayingAudio: boolean = false;

  constructor(
    public chatFacadeService: ChatFacadeService,
    public breakpointService: BreakpointService,
    private audioRecordingService: AudioRecordingService,
    private openAiHandler: OpenAiIntentHandler,
    private cdr: ChangeDetectorRef
  ) { }

  sendMessage(input: HTMLInputElement) {
    const text = input.value?.trim();
    if (!text) return;

    input.value = '';
    this.suggestion = '';

    this.processUserMessage(text);
  }

  processUserMessage(text: string, isVoiceMessage: boolean = false) {
    this.chatFacadeService.messages.push({ sender: 'user', text, type: 'html' });

    // If it's a voice message, we want to play the response as audio
    this.chatFacadeService.startBotReply(text);

    // We listen for the next bot message to play TTS if it was a voice message
    if (isVoiceMessage) {
      const currentLength = this.chatFacadeService.messages.length;
      const checkInterval = setInterval(() => {
        if (this.chatFacadeService.messages.length > currentLength) {
          const lastMsg = this.chatFacadeService.messages[this.chatFacadeService.messages.length - 1];
          if (lastMsg.sender === 'bot') {
            this.playTts(lastMsg.text);
            clearInterval(checkInterval);
          }
        }
        // Timeout after 10s to stop checking
      }, 500);
      setTimeout(() => clearInterval(checkInterval), 10000);
    }
  }

  playTts(text: string) {
    this.isPlayingAudio = true;
    this.openAiHandler.generateSpeech(text).subscribe({
      next: (blob) => {
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audio.onended = () => {
          this.isPlayingAudio = false;
          URL.revokeObjectURL(audioUrl);
          this.cdr.detectChanges();
        };
        audio.play();
      },
      error: (err) => {
        console.error('TTS Error', err);
        this.isPlayingAudio = false;
      }
    });
  }

  onChatCategorySelected(event: { selectedCategory: Category; account: any; amount: number; txType: TransactionType }) {
    this.chatFacadeService.messages.pop();
    this.chatFacadeService.handleCategorySelection(event.selectedCategory, event.account, event.amount, event.txType);
  }

  setQuickAction(action: string, inputRef: ElementRef<HTMLInputElement>) {
    if (inputRef && inputRef.nativeElement) {
      inputRef.nativeElement.value = `${action}: `;
      inputRef.nativeElement.focus();
    }
  }

  // --- Voice Interaction Methods ---

  async onMicClick() {
    this.isRecording = true;
    this.voiceBlob = null;
    try {
      await this.audioRecordingService.startRecording();
    } catch (error) {
      this.isRecording = false;
      console.error('Failed to start recording', error);
    }
  }

  async stopRecording() {
    try {
      this.voiceBlob = await this.audioRecordingService.stopRecording();
      this.isRecording = false; // Now in "Confirmation" state (blob exists, not recording)
    } catch (error) {
      this.isRecording = false;
      console.error('Failed to stop recording', error);
    }
  }

  discardVoice() {
    this.audioRecordingService.cancelRecording();
    this.isRecording = false;
    this.voiceBlob = null;
  }

  confirmVoice() {
    if (!this.voiceBlob) return;

    this.isProcessingAudio = true;
    this.openAiHandler.transcribeAudio(this.voiceBlob).subscribe({
      next: (text) => {
        // Send directly without needing the input element
        this.processUserMessage(text, true);
        this.isProcessingAudio = false;
        this.voiceBlob = null;
      },
      error: (err) => {
        console.error('Transcription failed', err);
        this.isProcessingAudio = false;
        // Optionally show error to user
      }
    });
  }

  // ---------------------------------

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
    if (this.suggestion && event.key === 'Tab') {
      event.preventDefault();
      input.value += this.suggestion;
      this.suggestion = '';
    }
  }

  completeSuggestion(input: HTMLInputElement) {
    if (this.suggestion) {
      input.value += this.suggestion;
      this.suggestion = '';
      input.focus();
    }
  }
}
