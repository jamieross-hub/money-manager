import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { PwaNavigationService, NavigationState } from '../../service/pwa-navigation.service';
import { CommonSyncService } from '../../service/common-sync.service';
import { Subject, takeUntil } from 'rxjs';

import { CommonModule } from '@angular/common';
import { PwaBackButtonComponent } from '../pwa-back-button/pwa-back-button.component';

@Component({
  selector: 'app-pwa-navigation-bar',
  standalone: true,
  imports: [CommonModule, PwaBackButtonComponent],
  template: `
    <nav class="pwa-navigation-bar" [class.standalone]="navigationState.isStandalone">
      <div class="nav-left">
        <app-pwa-back-button 
          *ngIf="showBackButton"
          (backClicked)="onBackClick()"
          [showText]="showBackText">
        </app-pwa-back-button>
        
        <div *ngIf="!showBackButton && showHomeButton" class="home-button">
          <button 
            (click)="onHomeClick()"
            class="home-btn"
            [attr.aria-label]="'Go to home'"
            type="button">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M9 22V12H15V22" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="nav-center">
        <h1 *ngIf="title" class="nav-title">{{ title }}</h1>
        <div *ngIf="!isOnline" class="offline-indicator">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1L23 23M16.72 11.06A10.94 10.94 0 0 1 19 12.55M8.53 5.77A10.94 10.94 0 0 1 12 5C16.42 5 20 8.58 20 13M2 2L22 22M5.47 5.47A10.94 10.94 0 0 0 5 12.55M12 19C7.58 19 4 15.42 4 11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>Offline</span>
        </div>
      </div>

      <div class="nav-right">
        <ng-content select="[nav-actions]"></ng-content>
        
        <button 
          *ngIf="showRefreshButton"
          (click)="onRefreshClick()"
          class="refresh-btn"
          [attr.aria-label]="'Refresh'"
          type="button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 4V10H7M23 20V14H17M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14L18.36 18.36A9 9 0 0 1 3.51 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </nav>
  `,
  styles: [`
    .pwa-navigation-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: var(--surface-color, #ffffff);
      border-bottom: 1px solid var(--border-color, #e2e8f0);
      min-height: 60px;
      position: sticky;
      top: 0;
      z-index: 100;
      backdrop-filter: blur(10px);
      background: rgba(255, 255, 255, 0.95);
    }

    .pwa-navigation-bar.standalone {
      padding-top: calc(12px + env(safe-area-inset-top));
      background: var(--surface-color, #f8fafc);
    }

    .nav-left, .nav-right {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 80px;
    }

    .nav-center {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
    }

    .nav-title {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-color, #1e293b);
      margin: 0;
      text-align: center;
    }

    .home-button {
      display: flex;
      align-items: center;
    }

    .home-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border: none;
      border-radius: 8px;
      background: var(--primary-color, #3b82f6);
      color: white;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .home-btn:hover {
      background: var(--primary-color-dark, #2563eb);
      transform: translateY(-1px);
    }

    .refresh-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border: none;
      border-radius: 8px;
      background: var(--surface-color, #f8fafc);
      color: var(--text-color, #1e293b);
      cursor: pointer;
      transition: all 0.2s ease;
      border: 1px solid var(--border-color, #e2e8f0);
    }

    .refresh-btn:hover {
      background: var(--surface-hover-color, #f1f5f9);
      transform: translateY(-1px);
    }

    .offline-indicator {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      background: var(--warning-color, #fef3c7);
      color: var(--warning-text-color, #92400e);
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }

    @media (max-width: 768px) {
      .pwa-navigation-bar {
        padding: 12px 12px;
        min-height: 56px;
      }

      .nav-title {
        font-size: 16px;
      }

      .home-btn, .refresh-btn {
        width: 44px;
        height: 44px;
      }
    }

    @media (max-width: 480px) {
      .pwa-navigation-bar {
        padding: 12px 8px;
      }

      .nav-left, .nav-right {
        min-width: 60px;
      }

      .nav-title {
        font-size: 15px;
      }
    }

    /* Dark theme support */
    @media (prefers-color-scheme: dark) {
      .pwa-navigation-bar {
        background: rgba(15, 23, 42, 0.95);
        border-bottom-color: #334155;
      }

      .nav-title {
        color: #f1f5f9;
      }

      .home-btn {
        background: #3b82f6;
      }

      .refresh-btn {
        background: #1e293b;
        color: #f1f5f9;
        border-color: #334155;
      }

      .refresh-btn:hover {
        background: #334155;
      }
    }
  `]
})
export class PwaNavigationBarComponent implements OnInit, OnDestroy {
  @Input() title: string = '';
  @Input() showBackButton: boolean = true;
  @Input() showHomeButton: boolean = true;
  @Input() showRefreshButton: boolean = true;
  @Input() showBackText: boolean = true;
  @Output() backClicked = new EventEmitter<void>();
  @Output() homeClicked = new EventEmitter<void>();
  @Output() refreshClicked = new EventEmitter<void>();

  navigationState: NavigationState;
  isOnline: boolean = true;
  private destroy$ = new Subject<void>();

  constructor(
    private pwaNavigationService: PwaNavigationService,
    private commonSyncService: CommonSyncService
  ) {
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
      });

    this.commonSyncService.isOnline$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isOnline => {
        this.isOnline = isOnline;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onBackClick(): void {
    this.backClicked.emit();
  }

  onHomeClick(): void {
    this.homeClicked.emit();
    this.pwaNavigationService.navigateTo('/dashboard');
  }

  onRefreshClick(): void {
    this.refreshClicked.emit();
    window.location.reload();
  }
} 