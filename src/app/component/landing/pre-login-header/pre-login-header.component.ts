import { Component , ChangeDetectionStrategy} from '@angular/core';
import { Router } from '@angular/router';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';

import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-pre-login-header',
  templateUrl: './pre-login-header.component.html',
  styleUrls: ['./pre-login-header.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule, MatIconModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PreLoginHeaderComponent {
  isMobileMenuOpen = false;

  constructor(
    private router: Router,
    public breakpointService: BreakpointService
  ) { }

  navigateToSignIn(): void {
    this.router.navigate(['/sign-in']);
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }
}
