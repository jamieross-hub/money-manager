import { Injectable, NgZone, Inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { Location } from '@angular/common';
import { Router, NavigationEnd, NavigationStart, Event as RouterEvent } from '@angular/router';
import { BehaviorSubject, Observable, filter, takeUntil, Subject, map } from 'rxjs';
import { Platform } from '@angular/cdk/platform';
import { isPlatformServer } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatSnackBar } from '@angular/material/snack-bar';

export interface NavigationState {
  canGoBack: boolean;
  currentRoute: string;
  previousRoute: string;
  navigationStack: string[];
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
    navigationStack: [],
    isStandalone: false,
    isMobile: false
  });

  private destroy$ = new Subject<void>();
  private navigationStack: string[] = [];
  private maxStackSize = 50;

  // Back button protection
  private lastBackPressed = 0;
  private exitTime = 2000;

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

    this.router.events
      .pipe(
        filter((event: RouterEvent): event is NavigationStart => event instanceof NavigationStart),
        takeUntil(this.destroy$)
      )
      .subscribe((event: NavigationStart) => {
        this.ngZone.run(() => {
          this.handleNavigationStart(event);
        });
      });

    // 2️⃣ Handle browser back/forward buttons (Web popstate)
    if (typeof window !== 'undefined') {
      // Ensure there's a state to pop even at root
      history.pushState(null, '', location.href);

      window.onpopstate = () => {
        this.ngZone.run(() => {
          this.handleBackInteraction();
        });
      };
    }

    // 3️⃣ Handle hardware back button for Android (if applicable, e.g. Capacitor)
    if (isMobile && this.platform.ANDROID) {
      const backButtonHandler = (event: Event) => {
        event.preventDefault();
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

  private handleNavigationStart(event: NavigationStart): void {
    if (event.url !== this.navigationStateSubject.value.currentRoute) {
      this.addToNavigationStack(this.navigationStateSubject.value.currentRoute);
    }
  }

  private handleNavigationEnd(event: NavigationEnd): void {
    const currentState = this.navigationStateSubject.value;
    const previousRoute = currentState.currentRoute;
    
    this.updateNavigationState({
      currentRoute: event.url,
      previousRoute,
      canGoBack: this.navigationStack.length > 0
    });
  }

  /**
   * Universal handler for all back interactions (popstate, hardware back, swipe)
   */
  private handleBackInteraction(): void {
    // A. Close Overlays (Topmost First)
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
      
      this.restoreHistoryState();
      return;
    }

    // B. Navigate Stack
    if (this.navigationStack.length > 0) {
      const previous = this.navigationStack.pop();
      if (previous) {
        this.router.navigateByUrl(previous);
        return;
      }
    }

    // C. Exit App Protection
    const now = Date.now();
    if (now - this.lastBackPressed < this.exitTime) {
      window.close(); // PWA exit
    } else {
      this.lastBackPressed = now;
      this.snackBar.open('Press back again to exit', '', { duration: 2000 });
      this.restoreHistoryState();
    }
  }

  private restoreHistoryState(): void {
    // Add back the popped state so the next back button also triggers an event
    setTimeout(() => {
      history.pushState(null, '', location.href);
    }, 50);
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

  private addToNavigationStack(route: string): void {
    if (route && route !== '/' && route !== '') {
      this.navigationStack.push(route);
      if (this.navigationStack.length > this.maxStackSize) {
        this.navigationStack.shift();
      }
    }
  }

  public goBack(): void {
    this.handleBackInteraction();
  }

  public goForward(): void {
    this.location.forward();
  }

  public navigateTo(route: string): void {
    this.router.navigateByUrl(route);
  }

  public clearNavigationStack(): void {
    this.navigationStack = [];
    this.updateNavigationState({
      canGoBack: false
    });
  }

  public getNavigationStack(): string[] {
    return [...this.navigationStack];
  }

  private updateNavigationState(updates: Partial<NavigationState>): void {
    const currentState = this.navigationStateSubject.value;
    const newState = { ...currentState, ...updates };
    this.navigationStateSubject.next(newState);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.navigationStack = [];
    window.onpopstate = null;
  }
}
 