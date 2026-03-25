import { Injectable, NgZone } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { NavigationStackService } from './navigation-stack.service';

@Injectable({ providedIn: 'root' })
export class BackButtonService {

  private lastBackPressed = 0;
  private exitTime = 2000;

  constructor(
    private dialog: MatDialog,
    private bottomSheet: MatBottomSheet,
    private router: Router,
    private snackBar: MatSnackBar,
    private navStack: NavigationStackService,
    private zone: NgZone
  ) {}

  init() {

    history.pushState(null, '', location.href);

    window.onpopstate = () => {
      this.zone.run(() => {

        // 1️⃣ Close Overlays (Topmost First)
        // We check the DOM to see which overlay (Dialog or Bottom Sheet) is actually on top
        const overlays = Array.from(document.querySelectorAll('mat-dialog-container, mat-bottom-sheet-container'));
        if (overlays.length > 0) {
          const lastOverlay = overlays[overlays.length - 1];

          if (lastOverlay.tagName.toLowerCase() === 'mat-bottom-sheet-container') {
            this.bottomSheet.dismiss();
          } else {
            // It's a dialog, close the last one
            if (this.dialog.openDialogs.length > 0) {
              this.dialog.openDialogs[this.dialog.openDialogs.length - 1].close();
            }
          }

          // Small delay for history to settle
          setTimeout(() => {
            history.pushState(null, '', location.href);
          }, 50);
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

          // Small delay for history to settle
          setTimeout(() => {
            history.pushState(null, '', location.href);
          }, 50);
        }
      });

    };

  }

}

