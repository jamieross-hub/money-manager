import { Injectable, NgZone, Inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { Location } from '@angular/common';
import { Router, NavigationEnd, NavigationStart, Event as RouterEvent } from '@angular/router';
import { BehaviorSubject, Observable, filter, takeUntil, Subject, map, fromEvent } from 'rxjs';
import { Platform } from '@angular/cdk/platform';
import { isPlatformServer } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatSnackBar } from '@angular/material/snack-bar';

export interface NavigationState {
  canGoBack: boolean;
  currentRoute: string;
  previousRoute: string;
  isStandalone: boolean;
  isMobile: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PwaNavigationService implements OnDestroy {
  private navigationStateSubject = new BehaviorSubject<NavigationState>({
    canGoBack: false,
    currentRoute: '',
    previousRoute: '',
    isStandalone: false,
    isMobile: false
  });

  private destroy$ = new Subject<void>();
  private backHandlers: (() => boolean)[] = [];

  // Back button protection
  private lastBackPressed = 0;
  private exitTime = 2000;
  private lastInteractionTime = 0;
  private readonly INTERACTION_GUARD_MS = 100;

  public navigationState$: Observable<NavigationState> = this.navigationStateSubject.asObservable();
  public canGoBack$: Observable<boolean> = this.navigationState$.pipe(
    map(state => state.canGoBack)
  );

  constructor(
    private location: Location,
    private router: Router,
    private platform: Platform,
    private ngZone: NgZone,
    private dialog: MatDialog,
    private bottomSheet: MatBottomSheet,
    private snackBar: MatSnackBar,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    if (!isPlatformServer(this.platformId)) {
      this.initializePwaNavigation();
    }
  }

  private initializePwaNavigation(): void {
    const isStandalone = this.isStandalonePwa();
    const isMobile = this.isMobileDevice();

    // 1️⃣ Listen to router events
    this.router.events
      .pipe(
        filter((event: RouterEvent): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event: NavigationEnd) => {
        this.ngZone.run(() => {
          this.handleNavigationEnd(event);
        });
      });

    // 2️⃣ Handle browser back/forward buttons (Web popstate)
    if (typeof window !== 'undefined') {
      fromEvent(window, 'popstate')
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.ngZone.run(() => {
            this.handleBackInteraction();
          });
        });
    }

    // 3️⃣ Handle hardware back button for Android (if applicable, e.g. Capacitor)
    if (isMobile && this.platform.ANDROID) {
      const backButtonHandler = (event: Event) => {
        // Only prevent default if we're handling it ourselves (e.g. closing an overlay)
        // However, standard hardware back button on Android usually triggers popstate.
        // If we're in a wrapper like Capacitor, we might need this.
        this.ngZone.run(() => {
          this.handleBackInteraction();
        });
      };
      
      document.addEventListener('backbutton', backButtonHandler, false);
      this.destroy$.subscribe(() => document.removeEventListener('backbutton', backButtonHandler));
    }

    // 4️⃣ iOS back gesture
    if (isMobile && this.platform.IOS) {
      this.setupIosBackGesture();
    }

    // 5️⃣ Keyboard interactions
    this.setupKeyboardNavigation();

    // Update initial state
    this.updateNavigationState({
      isStandalone,
      isMobile,
      currentRoute: this.router.url
    });
  }

  private isStandalonePwa(): boolean {
    if (isPlatformServer(this.platformId)) return false;
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as any).standalone === true;
  }

  private isMobileDevice(): boolean {
    if (isPlatformServer(this.platformId)) return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  private handleNavigationEnd(event: NavigationEnd): void {
    const currentState = this.navigationStateSubject.value;
    const previousRoute = currentState.currentRoute;
    
    this.updateNavigationState({
      currentRoute: event.url,
      previousRoute,
      canGoBack: window.history.length > 1
    });
  }

  /**
   * Register a custom back button handler.
   * @param handler A function that returns true if it handled the back action.
   * @returns A function to unregister the handler.
   */
  public registerBackHandler(handler: () => boolean): () => void {
    this.backHandlers.push(handler);
    return () => {
      this.backHandlers = this.backHandlers.filter(h => h !== handler);
    };
  }

  /**
   * Universal handler for all back interactions (popstate, hardware back, swipe)
   */
  private handleBackInteraction(): void {
    const now = Date.now();
    if (now - this.lastInteractionTime < this.INTERACTION_GUARD_MS) {
      return;
    }
    this.lastInteractionTime = now;

    // 1️⃣ Run registered custom handlers (topmost/last-registered first)
    for (let i = this.backHandlers.length - 1; i >= 0; i--) {
      if (this.backHandlers[i]()) {
        return;
      }
    }

    // 2️⃣ Close Overlays (Topmost First)
    const overlays = Array.from(document.querySelectorAll('mat-dialog-container, mat-bottom-sheet-container'));
    if (overlays.length > 0) {
      const lastOverlay = overlays[overlays.length - 1];
      
      if (lastOverlay.tagName.toLowerCase() === 'mat-bottom-sheet-container') {
        this.bottomSheet.dismiss();
      } else {
        if (this.dialog.openDialogs.length > 0) {
          this.dialog.openDialogs[this.dialog.openDialogs.length - 1].close();
        }
      }
      return;
    }

    // 3️⃣ If at root or no history to go back to, handle exit
    if (this.router.url === '/' || window.history.length <= 1) {
      this.handleExit();
    } else {
      // Browser already navigated if this was a popstate event
      // If triggered manually via UI button, we'll call location.back() in goBack()
    }
  }

  private handleExit(): void {
    const now = Date.now();

    if (now - this.lastBackPressed < this.exitTime) {
      // Android PWA safe exit
      const nav = navigator as any;
      if (nav.app?.exitApp) {
        nav.app.exitApp();
      } else {
        // Fallback for pure PWA: cannot force exit easily
        // window.close() usually fails, so we just let the user know or stay
      }
    } else {
      this.lastBackPressed = now;
      this.snackBar.open('Press back again to exit', '', { duration: 2000 });
    }
  }

  private setupIosBackGesture(): void {
    let startX = 0;
    let startY = 0;
    const threshold = 50;

    const touchStartHandler = (event: TouchEvent) => {
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
    };

    const touchEndHandler = (event: TouchEvent) => {
      const endX = event.changedTouches[0].clientX;
      const endY = event.changedTouches[0].clientY;
      const deltaX = startX - endX;
      const deltaY = Math.abs(startY - endY);

      if (deltaX > threshold && deltaY < threshold && startX < 50) {
        this.ngZone.run(() => {
          this.handleBackInteraction();
        });
      }
    };

    document.addEventListener('touchstart', touchStartHandler, { passive: true });
    document.addEventListener('touchend', touchEndHandler, { passive: true });

    this.destroy$.subscribe(() => {
      document.removeEventListener('touchstart', touchStartHandler);
      document.removeEventListener('touchend', touchEndHandler);
    });
  }

  private setupKeyboardNavigation(): void {
    const keydownHandler = (event: KeyboardEvent) => {
      if (event.altKey && event.key === 'ArrowLeft') {
        event.preventDefault();
        this.ngZone.run(() => this.goBack());
      }
      
      if (event.key === 'Escape') {
        this.ngZone.run(() => this.handleBackInteraction());
      }
    };

    document.addEventListener('keydown', keydownHandler);
    this.destroy$.subscribe(() => document.removeEventListener('keydown', keydownHandler));
  }

  public goBack(): void {
    if (this.router.url !== '/') {
      this.location.back();
    } else {
      this.handleExit();
    }
  }

  public goForward(): void {
    this.location.forward();
  }

  public navigateTo(route: string): void {
    this.router.navigateByUrl(route);
  }

  private updateNavigationState(updates: Partial<NavigationState>): void {
    const currentState = this.navigationStateSubject.value;
    const newState = { ...currentState, ...updates };
    this.navigationStateSubject.next(newState);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
 