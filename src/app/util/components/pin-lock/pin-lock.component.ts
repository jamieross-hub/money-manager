import { Component, HostListener, inject, effect } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { SecurityService } from 'src/app/util/service/security.service';
import { UserService } from 'src/app/util/service/db/user.service';
import { SsrService } from 'src/app/util/service/ssr.service';

@Component({
  selector: 'app-pin-lock',
  standalone: true,
  imports: [MatIconModule, MatButtonModule],
  templateUrl: './pin-lock.component.html',
  styleUrls: ['./pin-lock.component.scss']
})
export class PinLockComponent {
  private readonly securityService = inject(SecurityService);
  private readonly userService = inject(UserService);
  private readonly ssrService = inject(SsrService);

  readonly isLocked = this.securityService.isLocked;
  enteredPin = '';
  pinError = '';

  constructor() {
    effect(() => {
      // Accessing the signal to create a dependency
      if (this.isLocked()) {
        this.pinError = '';
        this.enteredPin = '';
      }
    });
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (!this.isLocked()) return;

    if (event.key >= '0' && event.key <= '9') {
      this.onPinDigit(event.key);
    } else if (event.key === 'Backspace') {
      this.onPinClear();
    }
  }

  onPinDigit(digit: string): void {
    if (this.enteredPin.length < 4) {
      this.enteredPin += digit;
      if (this.enteredPin.length === 4) {
        this.verifyEnteredPin();
      }
    }
  }

  onPinClear(): void {
    this.enteredPin = this.enteredPin.slice(0, -1);
    this.pinError = '';
  }

  private async verifyEnteredPin(): Promise<void> {
    const user = this.userService.getCurrentUserSnapshot();
    if (user?.preferences?.pinHash) {
      const success = await this.securityService.verifyPin(this.enteredPin, user.preferences.pinHash);
      if (!success) {
        this.pinError = 'Incorrect PIN. Please try again.';
        this.enteredPin = '';
        setTimeout(() => {
          this.pinError = '';
        }, 3000);
      }
    } else {
      // If pinEnabled is true but pinHash is missing, bypass and log
      console.warn('PIN enabled but no hash found. Bypassing lock.');
      this.securityService.setPinVerified(true);
    }
  }

  async logout(): Promise<void> {
    try {
      await this.userService.signOut();
      this.securityService.setPinVerified(false);
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }
}
