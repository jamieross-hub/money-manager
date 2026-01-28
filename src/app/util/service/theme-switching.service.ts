import { DOCUMENT } from '@angular/common';
import { Inject, Injectable, Renderer2, RendererFactory2 } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ThemeType } from '../models/theme.model';
import { SsrService } from './ssr.service';

@Injectable({
  providedIn: 'root'
})
export class ThemeSwitchingService {
  private renderer: Renderer2;
  private body: HTMLElement;

  public currentTheme = new BehaviorSubject<ThemeType>('light-theme');
  private previousClass: ThemeType = 'light-theme';

  constructor(
    rendererFactory: RendererFactory2,
    @Inject(DOCUMENT) private document: Document,
    private ssrService: SsrService
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

    const systemTheme = this.getSystemTheme();
    this.applyTheme(systemTheme);
  }

  private listenForSystemChanges() {
    if (!this.ssrService.isClientSide()) return;

    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', (event) => {
        const newTheme: ThemeType = event.matches
          ? 'dark-theme'
          : 'light-theme';

        this.applyTheme(newTheme);
      });
  }

  private getSystemTheme(): ThemeType {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark-theme'
      : 'light-theme';
  }

  private applyTheme(theme: ThemeType) {
    if (theme === this.previousClass) return;

    this.renderer.removeClass(this.body, this.previousClass);
    this.renderer.addClass(this.body, theme);

    this.previousClass = theme;
    this.currentTheme.next(theme);
  }
}
