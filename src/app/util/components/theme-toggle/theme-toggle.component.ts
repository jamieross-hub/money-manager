import { Component, OnInit } from '@angular/core';
import { ThemeSwitchingService } from '../../service/theme-switching.service';
import { ThemeType } from '../../models/theme.model';

@Component({
  selector: 'app-theme-toggle',
  templateUrl: './theme-toggle.component.html',
  styleUrl: './theme-toggle.component.scss'
})
export class ThemeToggleComponent implements OnInit {
  isDarkTheme: boolean = false;

  constructor(private _themeSwitchingService: ThemeSwitchingService) { }

  ngOnInit() {
    // Subscribe to theme changes to update the toggle state
    this._themeSwitchingService.currentTheme.subscribe(theme => {
      this.isDarkTheme = theme === 'dark-theme';
    });
  }

  public toggleTheme() {
    const newTheme: ThemeType = this.isDarkTheme ? 'light-theme' : 'dark-theme';
    this._themeSwitchingService.currentTheme.next(newTheme);
  }
} 