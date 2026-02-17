import { Component, OnInit, OnDestroy, Input, Output, EventEmitter , ChangeDetectionStrategy} from '@angular/core';
import { PwaNavigationService, NavigationState } from '../../service/pwa-navigation.service';
import { Subject, takeUntil } from 'rxjs';

import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-pwa-back-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button 
      *ngIf="showBackButton"
      (click)="onBackClick()"
      class="pwa-back-button"
      [class.standalone]="navigationState.isStandalone"
      [class.mobile]="navigationState.isMobile"
      [attr.aria-label]="'Go back'"
      type="button">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M19 12H5M12 19L5 12L12 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span *ngIf="showText" class="back-text">Back</span>
    </button>
  `,
  styles: [`
    .pwa-back-button {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border: none;
      border-radius: 8px;
      background: var(--primary-color, #3b82f6);
      color: white;
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 14px;
      font-weight: 500;
      min-height: 40px;
    }

    .pwa-back-button:hover {
      background: var(--primary-color-dark, #2563eb);
      transform: translateY(-1px);
    }

    .pwa-back-button:active {
      transform: translateY(0);
    }

    .pwa-back-button.standalone {
      background: var(--surface-color, #f8fafc);
      color: var(--text-color, #1e293b);
      border: 1px solid var(--border-color, #e2e8f0);
    }

    .pwa-back-button.standalone:hover {
      background: var(--surface-hover-color, #f1f5f9);
    }

    .pwa-back-button.mobile {
      padding: 12px 16px;
      min-height: 48px;
      font-size: 16px;
    }

    .back-text {
      font-weight: 500;
    }

    @media (max-width: 768px) {
      .pwa-back-button {
        padding: 10px 14px;
        min-height: 44px;
      }
    }

    @media (max-width: 480px) {
      .pwa-back-button {
        padding: 12px 16px;
        min-height: 48px;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PwaBackButtonComponent implements OnInit, OnDestroy {
  @Input() showText: boolean = true;
  @Input() alwaysShow: boolean = false;
  @Output() backClicked = new EventEmitter<void>();

  showBackButton: boolean = false;
  navigationState: NavigationState;
  private destroy$ = new Subject<void>();

  constructor(private pwaNavigationService: PwaNavigationService) {
    this.navigationState = {
      canGoBack: false,
      currentRoute: '',
      previousRoute: '',
      navigationStack: [],
      isStandalone: false,
      isMobile: false
    };
  }

  ngOnInit(): void {
    this.pwaNavigationService.navigationState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.navigationState = state;
        this.updateBackButtonVisibility();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateBackButtonVisibility(): void {
    if (this.alwaysShow) {
      this.showBackButton = true;
    } else {
      // Show back button if we can go back or if we're in standalone mode and not on home
      this.showBackButton = this.navigationState.canGoBack ||
        (this.navigationState.isStandalone &&
          this.navigationState.currentRoute !== '/dashboard' &&
          this.navigationState.currentRoute !== '/');
    }
  }

  onBackClick(): void {
    this.backClicked.emit();
    this.pwaNavigationService.goBack();
  }
} 