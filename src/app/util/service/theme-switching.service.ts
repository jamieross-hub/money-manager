import { DOCUMENT } from '@angular/common';
import { Inject, Injectable, Renderer2, RendererFactory2, signal, OnDestroy } from '@angular/core';
import { ThemeType } from '../models/theme.model';
import { SsrService } from './ssr.service';
import { Meta } from '@angular/platform-browser';
import { UserService } from './db/user.service';
import { Subject, fromEvent } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ThemeSwitchingService implements OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private renderer: Renderer2;
  private body: HTMLElement;

  private themeSignal = signal<ThemeType>('light-theme');
  public readonly currentTheme = this.themeSignal.asReadonly();
  
  private previousClass: ThemeType = 'light-theme';

  constructor(
    rendererFactory: RendererFactory2,
    @Inject(DOCUMENT) private document: Document,
    private ssrService: SsrService,
    private meta: Meta,
    private userService: UserService
  ) {
    this.renderer = rendererFactory.createRenderer(null, null);
    this.body = this.document.body;

    this.initTheme();
    this.listenForSystemChanges();
  }

  private initTheme() {
    if (!this.ssrService.isClientSide()) {
      this.renderer.addClass(this.body, 'light-theme');
      return;
    }

    // Run after first paint to avoid Android PWA wrong value
    requestAnimationFrame(() => {
      // 1. Immediately apply the locally cached preferred theme (if exists) so there is no layout shift
      const cachedTheme = this.userService.storageService.getItem<ThemeType>('app_theme_preference');
      if (cachedTheme) {
        this.applyTheme(cachedTheme);
      } else {
        const systemTheme = this.getSystemTheme();
        this.applyTheme(systemTheme);
      }

      // 2. Subscribe to user preferences to sync if they log in from another device
      this.userService.userAuth$
        .pipe(takeUntil(this.destroy$))
        .subscribe(user => {
          if (user && user.preferences && user.preferences.theme) {
            this.setTheme(user.preferences.theme as ThemeType);
          }
        });
    });
  }

  private listenForSystemChanges() {
    if (!this.ssrService.isClientSide()) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handler = () => {
      // Don't auto-switch if user has explicitly saved a preference locally
      const cachedTheme = this.userService.storageService.getItem<ThemeType>('app_theme_preference');
      if (cachedTheme) {
        return;
      }

      const newTheme: ThemeType = mediaQuery.matches
        ? 'dark-theme'
        : 'light-theme';
      this.applyTheme(newTheme);
    };

    // Modern browsers
    if (typeof mediaQuery.addEventListener === 'function') {
      fromEvent(mediaQuery, 'change')
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => handler());
    }
    // Older Android / WebView
    else if ((mediaQuery as any).addListener) {
      const boundHandler = () => handler();
      (mediaQuery as any).addListener(boundHandler);
      this.destroy$.subscribe(() => (mediaQuery as any).removeListener(boundHandler));
    }

    // Also sync once more after load (important for PWA)
    setTimeout(handler, 0);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private getSystemTheme(): ThemeType {
    if (!window.matchMedia) return 'light-theme';
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark-theme'
      : 'light-theme';
  }

  private applyTheme(theme: ThemeType) {
    this.renderer.removeClass(this.body, this.previousClass);
    this.renderer.addClass(this.body, theme);

    this.previousClass = theme;
    this.themeSignal.set(theme);

    // Update theme-color meta tag
    const themeColor = theme === 'dark-theme' ? '#0a0b0a' : '#f7faf5';
    this.meta.updateTag({ name: 'theme-color', content: themeColor });
  }

  public setTheme(theme: ThemeType) {
    // Save to the ultra-fast synchronous cache to prevent blinking on refresh
    this.userService.storageService.setItem('app_theme_preference', theme);
    this.applyTheme(theme);
  }
}

