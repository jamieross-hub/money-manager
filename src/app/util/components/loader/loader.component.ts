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

  private loadingMessages: string[] = [
    'Preparing your financial dashboard...',
    'Gathering your latest transactions...',
    'Calculating your wealth insights...',
    'Organizing your budget categories...',
    'Making things look beautiful for you...',
    'Just a few more seconds...',
    'Almost ready to crunch those numbers...'
  ];

  private currentMessageIndex: number = 0;
  private messageInterval?: number;

  constructor(
    private loaderService: LoaderService,
    private greetingFacade: GreetingFacadeService
  ) { }

  ngOnInit(): void {
    // If custom message is provided, use it; otherwise start with a greeting
    if (this.message) {
      this.displayMessage = this.message;
    } else {
      this.displayMessage = this.greetingFacade.getPersonalizedGreeting();
      // Start rotation after a short delay showing the greeting
      setTimeout(() => {
        this.startMessageRotation();
      }, 2000);
    }
  }

  ngOnDestroy(): void {
    this.stopMessageRotation();
  }

  private startMessageRotation(): void {
    if (this.messageInterval) return;

    this.messageInterval = window.setInterval(() => {
      this.displayMessage = this.loadingMessages[this.currentMessageIndex];
      this.currentMessageIndex = (this.currentMessageIndex + 1) % this.loadingMessages.length;
    }, 3000); // Change message every 3 seconds
  }

  private stopMessageRotation(): void {
    if (this.messageInterval) {
      clearInterval(this.messageInterval);
      this.messageInterval = undefined;
    }
  }
}
