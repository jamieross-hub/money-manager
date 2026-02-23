import { Component, ElementRef, ViewChild, ChangeDetectorRef, AfterViewInit, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { TransactionType } from 'src/app/util/config/enums';
import { Category } from 'src/app/util/models';
import { ChatFacadeService } from 'src/app/util/service/ai-chat/chat-facade-service';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';
import { CHAT_CONSTANTS } from 'src/app/util/service/ai-chat/models/chat-constants';
import { AudioRecordingService } from 'src/app/util/service/ai-chat/audio-recording.service';
import { OpenAiIntentHandler } from 'src/app/util/service/ai-chat/handlers/intent-handler/openai-intent-handler.service';
import { take } from 'rxjs/operators';
import { UserService } from 'src/app/util/service/db/user.service';
import { NotificationService } from 'src/app/util/service/notification.service';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AccountSummaryCardComponent } from 'src/app/util/components/cards/account-summary-card/account-summary-card.component';
import { LoanSummaryCardComponent } from 'src/app/util/components/cards/loan-summary-card/loan-summary-card.component';
import { MonthlyExpenditureCardComponent } from 'src/app/util/components/cards/monthly-expenditure-card/monthly-expenditure-card.component';
import { RecentActivityCardComponent } from 'src/app/util/components/cards/recent-activity-card/recent-activity-card.component';
import { ChatCategoryDropdownComponent } from 'src/app/util/components/chat-category-dropdown/chat-category-dropdown.component';
import { BudgetCardComponent } from 'src/app/util/components/cards/budget-card/budget-card.component';
import { SafeHtmlPipe } from 'src/app/util/pipes/safe-html.pipe';

import { ChatIntentService } from 'src/app/util/service/ai-chat/chat-intent-service';
import { ChatFlowService } from 'src/app/util/service/ai-chat/chat-flow.service';
import { EntityExtractorService } from 'src/app/util/service/ai-chat/extractors/entity-extractor.service';
import { IntentHandlerRegistry } from 'src/app/util/service/ai-chat/handlers/intent-handler/registry/intent-handler-registry.service';
import { HelpIntentHandler } from 'src/app/util/service/ai-chat/handlers/intent-handler/help-intent-handler.service';
import { AccountSummaryIntentHandler } from 'src/app/util/service/ai-chat/handlers/intent-handler/account-summary-intent-handler.service';
import { RecentActivityIntentHandler } from 'src/app/util/service/ai-chat/handlers/intent-handler/recent-activity-intent-handler.service';
import { ClearDataIntentHandler } from 'src/app/util/service/ai-chat/handlers/intent-handler/clear-data-intent-handler.service';
import { ReportIntentHandler } from 'src/app/util/service/ai-chat/handlers/intent-handler/report-intent-handler.service';
import { TransactionIntentHandler } from 'src/app/util/service/ai-chat/handlers/intent-handler/transaction-intent-handler.service';
import { LoanSummaryIntentHandler } from 'src/app/util/service/ai-chat/handlers/intent-handler/loan-summary-intent-handler.service';
import { MonthlyExpenditureIntentHandler } from 'src/app/util/service/ai-chat/handlers/intent-handler/monthly-expenditure-intent-handler.service';
import { BudgetCardIntentHandler } from 'src/app/util/service/ai-chat/handlers/intent-handler/budget-card-intent-handler.service';
import { LoanReportIntentHandler } from 'src/app/util/service/ai-chat/handlers/intent-handler/loan-report-intent-handler.service';
import { GeminiIntentHandler } from 'src/app/util/service/ai-chat/handlers/intent-handler/gemini-intent-handler.service';
import { QueryIntentHandler } from 'src/app/util/service/ai-chat/handlers/intent-handler/query-intent-handler.service';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    AccountSummaryCardComponent,
    LoanSummaryCardComponent,
    MonthlyExpenditureCardComponent,
    RecentActivityCardComponent,
    ChatCategoryDropdownComponent,
    BudgetCardComponent,
    SafeHtmlPipe
  ],
  providers: [
    ChatFacadeService,
    ChatIntentService,
    ChatFlowService,
    EntityExtractorService,
    IntentHandlerRegistry,
    HelpIntentHandler,
    AccountSummaryIntentHandler,
    RecentActivityIntentHandler,
    ClearDataIntentHandler,
    ReportIntentHandler,
    TransactionIntentHandler,
    OpenAiIntentHandler,
    GeminiIntentHandler,
    LoanSummaryIntentHandler,
    MonthlyExpenditureIntentHandler,
    BudgetCardIntentHandler,
    LoanReportIntentHandler,
    QueryIntentHandler
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatComponent implements AfterViewInit, OnInit, OnDestroy {

  visible: boolean = false;
  suggestion: string = '';
  suggestions = CHAT_CONSTANTS.SUGGESTIONS;
  @ViewChild('chatInput', { static: false }) ChatInput!: ElementRef<HTMLInputElement>;

  // Placeholder Animation State
  placeholders: string[] = [
    'Ask about your spending...',
    'Enter: "Spent $50 on food"...',
    'How much did I spend this month?',
    'What is my highest expense?',
    'Add $2000 as salary income...',
    'Report of last month',
    'Loan report',

  ];
  currentAnimatedPlaceholder: string = 'Ask AI about your spending...';
  private currentPlaceholderIndex = 0;
  private currentCharIndex = 0;
  private isDeleting = false;
  private typingTimeout: any;

  // Voice Interaction State
  isRecording: boolean = false;
  isProcessingAudio: boolean = false;
  voiceBlob: Blob | null = null;
  isPlayingAudio: boolean = false;


  @ViewChild('scrollContainer') chatScrollContainer!: ElementRef<HTMLElement>;

  constructor(
    public chatFacadeService: ChatFacadeService,
    public breakpointService: BreakpointService,
    private audioRecordingService: AudioRecordingService,
    private openAiHandler: OpenAiIntentHandler,
    private cdr: ChangeDetectorRef,
    private userService: UserService,
    private notificationService: NotificationService
  ) { }

  ngOnInit() {
    this.animatePlaceholder();
  }

  ngOnDestroy() {
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
  }

  private animatePlaceholder() {
    const currentText = this.placeholders[this.currentPlaceholderIndex];
    
    if (this.isDeleting) {
      this.currentAnimatedPlaceholder = currentText.substring(0, this.currentCharIndex - 1);
      this.currentCharIndex--;
    } else {
      this.currentAnimatedPlaceholder = currentText.substring(0, this.currentCharIndex + 1);
      this.currentCharIndex++;
    }
    
    this.cdr.markForCheck();

    let typeSpeed = this.isDeleting ? 30 : 60;

    if (!this.isDeleting && this.currentCharIndex === currentText.length) {
      typeSpeed = 2500; // Pause at the end before deleting
      this.isDeleting = true;
    } else if (this.isDeleting && this.currentCharIndex === 0) {
      this.isDeleting = false;
      this.currentPlaceholderIndex = (this.currentPlaceholderIndex + 1) % this.placeholders.length;
      typeSpeed = 500; // Pause before typing the next phrase
    }

    this.typingTimeout = setTimeout(() => this.animatePlaceholder(), typeSpeed);
  }

  ngAfterViewInit() {
    this.chatFacadeService.scrollToTop.subscribe(() => {
      this.cdr.detectChanges();
      if (this.chatScrollContainer) {
        // it is scroll to bottom
        this.chatScrollContainer.nativeElement.scrollTop = this.chatScrollContainer.nativeElement.scrollHeight;
      }
    });

    // Also scroll to top on initial load if needed, or rely on service trigger
  }

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
      setTimeout(() => clearInterval(checkInterval), 1000);
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
    // Check for API key first
    const user = await this.userService.getCurrentUser();
    // if (!user?.preferences?.openaiApiKey ) {
    //   this.notificationService.error('OpenAI API key not found. Please connect your API key in Settings > OpenAI Integration.');
    //   return;
    // }

    this.isRecording = true;
    this.voiceBlob = null;
    try {
      await this.audioRecordingService.startRecording();
    } catch (error) {
      this.isRecording = false;
      console.error('Failed to start recording', error);
      this.notificationService.error('Failed to start recording. Please check your microphone permissions.');
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
        this.notificationService.error('Transcription failed. Please ensure your OpenAI API key is correct.');
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

    const lowerV = value.toLowerCase();

    // 1. Direct Prefix Check
    let match = this.suggestions.find(s =>
      s.toLowerCase().startsWith(lowerV) && s.toLowerCase() !== lowerV
    );

    if (match) {
        this.suggestion = match.substring(value.length);
        return;
    }

    // 2. Word by word matching logic
    // Split the user's input to isolate the last word being typed
    const words = lowerV.split(' ');
    const lastWord = words[words.length - 1];
    
    // Only attempt mid-word completion if they've typed at least 2 chars of the word
    if (lastWord.length > 0) {
        // Find a suggestion that contains this last word at a word boundary
        const partialMatch = this.suggestions.find(s => {
           const lowerS = s.toLowerCase();
           let searchIdx = 0;
           while (true) {
               const idx = lowerS.indexOf(lastWord, searchIdx);
               if (idx === -1) return false;
               if (idx === 0 || lowerS[idx - 1] === ' ') return true;
               searchIdx = idx + 1;
           }
        });
        
        if (partialMatch) {
             const lowerS = partialMatch.toLowerCase();
             let wordIdx = -1;
             let searchIdx = 0;
             while (true) {
                 const idx = lowerS.indexOf(lastWord, searchIdx);
                 if (idx === -1) break;
                 if (idx === 0 || lowerS[idx - 1] === ' ') {
                     wordIdx = idx;
                     break;
                 }
                 searchIdx = idx + 1;
             }

             if (wordIdx !== -1) {
                 // Extract only the remainder of the partially typed word and any subsequent words in the suggestion
                 this.suggestion = partialMatch.substring(wordIdx + lastWord.length);
                 return;
             }
        }
    }

    this.suggestion = '';
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
