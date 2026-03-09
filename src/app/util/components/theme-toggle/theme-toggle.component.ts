import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, Input, effect, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ThemeSwitchingService } from '../../service/theme-switching.service';
import { ThemeType } from '../../models/theme.model';
import { UserService } from '../../service/db/user.service';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import * as ProfileSelectors from 'src/app/store/profile/profile.selectors';

@Component({
  selector: 'app-theme-toggle',
  templateUrl: './theme-toggle.component.html',
  styleUrl: './theme-toggle.component.scss',
  standalone: true,
  imports: [MatIconModule, MatSlideToggleModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ThemeToggleComponent implements OnInit {
  private readonly store = inject(Store<AppState>);
  private readonly _themeSwitchingService = inject(ThemeSwitchingService);
  private readonly userService = inject(UserService);
  private readonly cdr = inject(ChangeDetectorRef);

  isDarkTheme: boolean = false;
  @Input() hideIcons: boolean = false;

  // Use signal for reactive profile access
  private readonly profile = this.store.selectSignal(ProfileSelectors.selectProfile);

  constructor() {
    effect(() => {
      const theme = this._themeSwitchingService.currentTheme();
      this.isDarkTheme = theme === 'dark-theme';
      this.cdr.markForCheck();
    });
  }

  ngOnInit() {
  }

  public async toggleTheme() {
    const newTheme: ThemeType = this.isDarkTheme ? 'light-theme' : 'dark-theme';
    this._themeSwitchingService.setTheme(newTheme);

    // Save choice to User Profile if logged in or guest
    const currentUser = this.profile();
    if (currentUser) {
      const updatedPreferences = {
        ...currentUser.preferences,
        theme: newTheme
      };
      await this.userService.createOrUpdateUser({
        ...currentUser,
        preferences: updatedPreferences
      } as any);
    }
  }
}
 