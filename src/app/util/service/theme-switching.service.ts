import { DOCUMENT } from '@angular/common';
import { Inject, Injectable, Renderer2, RendererFactory2 } from '@angular/core';
import { environment } from '@env/environment';
import { BehaviorSubject } from 'rxjs';
import { ThemeType } from '../models/theme.model';
import { SsrService } from './ssr.service';

const THEME_STORAGE_KEY = 'app-theme-preference';

@Injectable({
  providedIn: 'root'
})
export class ThemeSwitchingService {
  private renderer: Renderer2;
  public currentTheme = new BehaviorSubject<ThemeType>(environment.defaultAppTheme);
  private previousClass: ThemeType = environment.defaultAppTheme;
  private body = this.document.body;

  constructor(
    rendererFactory: RendererFactory2,
    @Inject(DOCUMENT) private document: Document,
    private ssrService: SsrService
  ) {
    this.renderer = rendererFactory.createRenderer(null, null);
    this.initTheme();
    this._switchTheme();
    this.listenForSystemChanges();
  }

  private initTheme() {
    if (!this.ssrService.isClientSide()) {
      this.renderer.addClass(this.body, environment.defaultAppTheme);
      return;
    }

    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeType;
    if (savedTheme) {
      this.currentTheme.next(savedTheme);
      this.previousClass = savedTheme;
      this.renderer.addClass(this.body, savedTheme);
    } else {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark-theme' : 'light-theme';
      this.currentTheme.next(systemTheme);
      this.previousClass = systemTheme;
      this.renderer.addClass(this.body, systemTheme);
    }
  }

  private _switchTheme() {
    this.currentTheme.subscribe(theme => {
      if (!this.ssrService.isClientSide()) return;

      if (theme === this.previousClass && this.body.classList.contains(theme)) return;

      this.renderer.removeClass(this.body, this.previousClass);
      this.renderer.addClass(this.body, theme);
      this.previousClass = theme;
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    });
  }

  private listenForSystemChanges() {
    if (!this.ssrService.isClientSide()) return;

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      // Only auto-switch if the user hasn't manually set a preference
      if (!localStorage.getItem(THEME_STORAGE_KEY)) {
        const newTheme: ThemeType = e.matches ? 'dark-theme' : 'light-theme';
        this.currentTheme.next(newTheme);
      }
    });
  }
}
