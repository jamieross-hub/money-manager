import { Component, Input, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { LoaderService } from '../../service/loader.service';
import { GreetingFacadeService } from '../../service/greeting-facade.service';

@Component({
  selector: 'app-loader',
  templateUrl: './loader.component.html',
  styleUrl: './loader.component.scss',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoaderComponent implements OnInit, OnDestroy {
  @Input() message: string = '';

  isLoading = this.loaderService.isLoading;
  displayMessage: string = '';

  private currentMessageIndex: number = 0;
  private messageInterval?: number;

  constructor(
    private loaderService: LoaderService,
    private greetingFacade: GreetingFacadeService
  ) { }

  ngOnInit(): void {
    this.currentMessageIndex = this.greetingFacade.getLoaderMessageIndex();
    const loadingMessages = this.greetingFacade.getLoadingMessages();

    // If custom message is provided, use it; otherwise start with a greeting or first message
    if (this.message) {
      this.displayMessage = this.message;
    } else if (this.greetingFacade.shouldGreet()) {
      // First load of the session: show personalized greeting
      this.displayMessage = this.greetingFacade.getPersonalizedGreeting();
      this.greetingFacade.markAsGreeted();
      
      // Start rotation after a short delay showing the greeting
      setTimeout(() => {
        this.startMessageRotation();
      }, 2000);
    } else {
      // Not the first load: skip greeting and start rotation immediately
      this.displayMessage = loadingMessages[this.currentMessageIndex];
      this.startMessageRotation();
    }
  }

  ngOnDestroy(): void {
    this.stopMessageRotation();
    // Cache current index for session survival
    this.greetingFacade.setLoaderMessageIndex(this.currentMessageIndex);
  }

  private startMessageRotation(): void {
    if (this.messageInterval) return;

    const loadingMessages = this.greetingFacade.getLoadingMessages();

    this.messageInterval = window.setInterval(() => {
      this.displayMessage = loadingMessages[this.currentMessageIndex];
      const nextIndex = this.greetingFacade.getProgressiveIndex(this.currentMessageIndex, loadingMessages.length, false);
      
      if (nextIndex === this.currentMessageIndex && this.greetingFacade.isLastIndex(this.currentMessageIndex, loadingMessages.length)) {
        this.stopMessageRotation();
        return;
      }

      this.currentMessageIndex = nextIndex;
      // Immediately track back to facade
      this.greetingFacade.setLoaderMessageIndex(this.currentMessageIndex);
    }, 3000); // Change message every 3 seconds
  }

  private stopMessageRotation(): void {
    if (this.messageInterval) {
      clearInterval(this.messageInterval);
      this.messageInterval = undefined;
    }
  }
}
