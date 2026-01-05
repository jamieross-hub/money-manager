import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';

@Component({
  selector: 'app-pre-login-header',
  templateUrl: './pre-login-header.component.html',
  styleUrls: ['./pre-login-header.component.scss'],
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
