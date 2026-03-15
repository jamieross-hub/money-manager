import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NavigationStackService } from './navigation-stack.service';

@Injectable({ providedIn: 'root' })
export class BackButtonService {

  private lastBackPressed = 0;
  private exitTime = 2000;

  constructor(
    private dialog: MatDialog,
    private router: Router,
    private snackBar: MatSnackBar,
    private navStack: NavigationStackService
  ) {}

  init() {

    history.pushState(null, '', location.href);

    window.onpopstate = () => {

      // 1️⃣ Close Dialog First
      if (this.dialog.openDialogs.length > 0) {
        this.dialog.closeAll();
        history.pushState(null, '', location.href);
        return;
      }

      // 2️⃣ Navigate stack if available
      if (this.navStack.canGoBack()) {
        const previous = this.navStack.pop();
        if (previous) {
          this.router.navigateByUrl(previous);
          return;
        }
      }

      // 3️⃣ Exit app protection
      const now = Date.now();

      if (now - this.lastBackPressed < this.exitTime) {
        window.close(); // PWA exit
      } else {
        this.lastBackPressed = now;

        this.snackBar.open(
          'Press back again to exit',
          '',
          { duration: 2000 }
        );

        history.pushState(null, '', location.href);
      }

    };

  }

}

