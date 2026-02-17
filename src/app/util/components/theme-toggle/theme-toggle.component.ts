import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ThemeSwitchingService } from '../../service/theme-switching.service';
import { ThemeType } from '../../models/theme.model';

@Component({
  selector: 'app-theme-toggle',
  templateUrl: './theme-toggle.component.html',
  styleUrl: './theme-toggle.component.scss',
  standalone: true,
  imports: [MatIconModule, MatSlideToggleModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ThemeToggleComponent implements OnInit {
  isDarkTheme: boolean = false;

  constructor(
    private _themeSwitchingService: ThemeSwitchingService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    // Subscribe to theme changes to update the toggle state
    this._themeSwitchingService.currentTheme.subscribe(theme => {
      this.isDarkTheme = theme === 'dark-theme';
      this.cdr.markForCheck();
    });
  }

  public toggleTheme() {
    const newTheme: ThemeType = this.isDarkTheme ? 'light-theme' : 'dark-theme';
    this._themeSwitchingService.currentTheme.next(newTheme);
  }
} 