import { Component, Input, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { LoaderService } from '../../service/loader.service';

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
    'Loading your data...',
    'Just a moment...',
    'Almost there...',
    'Preparing everything...',
    'Getting things ready...',
    'Processing your request...',
    'Hang tight...',
    'Working on it...'
  ];

  private currentMessageIndex: number = 0;
  private messageInterval?: number;

  constructor(private loaderService: LoaderService) { }

  ngOnInit(): void {
    // If custom message is provided, use it; otherwise rotate through messages
    if (this.message) {
      this.displayMessage = this.message;
    } else {
      this.displayMessage = this.loadingMessages[0];
      this.startMessageRotation();
    }
  }

  ngOnDestroy(): void {
    this.stopMessageRotation();
  }

  private startMessageRotation(): void {
    this.messageInterval = window.setInterval(() => {
      this.currentMessageIndex = (this.currentMessageIndex + 1) % this.loadingMessages.length;
      this.displayMessage = this.loadingMessages[this.currentMessageIndex];
    }, 3000); // Change message every 3 seconds
  }

  private stopMessageRotation(): void {
    if (this.messageInterval) {
      clearInterval(this.messageInterval);
      this.messageInterval = undefined;
    }
  }
}
