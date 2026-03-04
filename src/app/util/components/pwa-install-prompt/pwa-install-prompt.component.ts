import { Component, OnInit, OnDestroy, Output, EventEmitter , ChangeDetectionStrategy} from '@angular/core';
import { PwaSwService } from '../../service/pwa-sw.service';
import { LocalIndexDBStorageService } from 'src/app/util/service/indexdb-storage.service';
import { LocalStorageKey } from 'src/app/util/models/local-storage.model';
import { Subject } from 'rxjs';
import { APP_CONFIG } from '../../config/config';
import { SsrService } from '../../service/ssr.service';



@Component({
  selector: 'app-pwa-install-prompt',
  standalone: true,
  imports: [],
  template: `
    @if (showInstallPrompt) {
      <div class="pwa-install-prompt">
        <div class="install-content">
          <div class="install-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="install-text">
            <h3>Install {{ APP_CONFIG.APP_NAME }}</h3>
            <p>Add to your home screen for quick access and offline functionality</p>
          </div>
          <div class="install-actions">
            <button
              (click)="installApp()"
              class="install-btn primary"
              type="button">
              Install App
            </button>
            <button
              (click)="dismissPrompt()"
              class="install-btn secondary"
              type="button">
              Not Now
            </button>
          </div>
          <button
            (click)="dismissPrompt()"
            class="close-btn"
            [attr.aria-label]="'Close install prompt'"
            type="button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    }
    `,
  styles: [`
    .pwa-install-prompt {
      position: fixed;
      bottom: 20px;
      left: 20px;
      right: 20px;
      z-index: 1000;
      animation: slideUp 0.3s ease-out;
    }

    .install-content {
      background: var(--surface-color, #ffffff);
      border: 1px solid var(--border-color, #e2e8f0);
      border-radius: 16px;
      padding: 20px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
      position: relative;
      backdrop-filter: blur(10px);
    }

    .install-icon {
      display: flex;
      justify-content: center;
      margin-bottom: 16px;
      color: var(--primary-color, #3b82f6);
    }

    .install-text {
      text-align: center;
      margin-bottom: 20px;
    }

    .install-text h3 {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-color, #1e293b);
      margin: 0 0 8px 0;
    }

    .install-text p {
      font-size: 14px;
      color: var(--text-muted, #64748b);
      margin: 0;
      line-height: 1.5;
    }

    .install-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
    }

    .install-btn {
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      min-width: 100px;
    }

    .install-btn.primary {
      background: var(--primary-color, #3b82f6);
      color: white;
    }

    .install-btn.primary:hover {
      background: var(--primary-color-dark, #2563eb);
      transform: translateY(-1px);
    }

    .install-btn.secondary {
      background: var(--surface-color, #f8fafc);
      color: var(--text-color, #1e293b);
      border: 1px solid var(--border-color, #e2e8f0);
    }

    .install-btn.secondary:hover {
      background: var(--surface-hover-color, #f1f5f9);
    }

    .close-btn {
      position: absolute;
      top: 12px;
      right: 12px;
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 50%;
      background: var(--surface-color, #f8fafc);
      color: var(--text-muted, #64748b);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }

    .close-btn:hover {
      background: var(--surface-hover-color, #f1f5f9);
      color: var(--text-color, #1e293b);
    }

    @keyframes slideUp {
      from {
        transform: translateY(100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    @media (max-width: 768px) {
      .pwa-install-prompt {
        bottom: 16px;
        left: 16px;
        right: 16px;
      }

      .install-content {
        padding: 16px;
      }

      .install-actions {
        flex-direction: column;
      }

      .install-btn {
        width: 100%;
      }
    }

    @media (max-width: 480px) {
      .pwa-install-prompt {
        bottom: 12px;
        left: 12px;
        right: 12px;
      }

      .install-text h3 {
        font-size: 16px;
      }

      .install-text p {
        font-size: 13px;
      }
    }

    /* Dark theme support */
    @media (prefers-color-scheme: dark) {
      .install-content {
        background: rgba(15, 23, 42, 0.95);
        border-color: #334155;
      }

      .install-text h3 {
        color: #f1f5f9;
      }

      .install-text p {
        color: #94a3b8;
      }

      .install-btn.secondary {
        background: #1e293b;
        color: #f1f5f9;
        border-color: #334155;
      }

      .install-btn.secondary:hover {
        background: #334155;
      }

      .close-btn {
        background: #1e293b;
        color: #94a3b8;
      }

      .close-btn:hover {
        background: #334155;
        color: #f1f5f9;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PwaInstallPromptComponent implements OnInit, OnDestroy {
  @Output() installClicked = new EventEmitter<void>();
  @Output() dismissClicked = new EventEmitter<void>();

  APP_CONFIG = APP_CONFIG;
  showInstallPrompt: boolean = false;
  private deferredPrompt: any;
  private destroy$ = new Subject<void>();

  constructor(
    private pwaSwService: PwaSwService,
    private ssrService: SsrService,
    private storageService: LocalIndexDBStorageService
  ) { }

  ngOnInit(): void {
    this.setupInstallPrompt();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupInstallPrompt(): void {
    if (this.ssrService.isClientSide()) {
      // Listen for the beforeinstallprompt event
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        this.deferredPrompt = e;

        const dismissed = this.storageService.getItem<string>(LocalStorageKey.PWA_INSTALL_DISMISSED);
        const dismissedTime = this.storageService.getItem<string>(LocalStorageKey.PWA_INSTALL_DISMISSED_TIME);
        let showPrompt = true;

        if (dismissed && dismissedTime) {
          const now = Date.now();
          const dismissedAt = parseInt(dismissedTime, 10);
          const daysSinceDismissed = (now - dismissedAt) / (1000 * 60 * 60 * 24);
          showPrompt = daysSinceDismissed >= APP_CONFIG.install_prompt_dismissed_days;
        }

        if (showPrompt && !this.pwaSwService.isAppInstalled()) {
          this.showInstallPrompt = true;
          console.log('Install prompt ready and showing');
        } else {
          console.log('Install prompt ready but not showing (either dismissed or already installed)');
        }
      });

      window.addEventListener('appinstalled', () => {
        this.showInstallPrompt = false;
        this.deferredPrompt = null;
        console.log('App installed successfully');
      });

      if (this.pwaSwService.isAppInstalled()) {
        this.showInstallPrompt = false;
      }
    }
  }

  async installApp(): Promise<void> {
    if (this.deferredPrompt) {
      this.installClicked.emit();
      this.deferredPrompt.prompt();

      const { outcome } = await this.deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
        this.showInstallPrompt = false;
      } else {
        console.log('User dismissed the install prompt');
        this.dismissPrompt();
      }

      this.deferredPrompt = null;
    }
  }

  dismissPrompt(): void {
    this.dismissClicked.emit();
    this.showInstallPrompt = false;

    this.storageService.setItem(LocalStorageKey.PWA_INSTALL_DISMISSED, 'true');
    this.storageService.setItem(LocalStorageKey.PWA_INSTALL_DISMISSED_TIME, Date.now().toString());
  }
}
