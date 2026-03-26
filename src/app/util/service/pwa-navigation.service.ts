import { Injectable, NgZone, Inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { Location } from '@angular/common';
import { Router, NavigationEnd, NavigationStart, Event as RouterEvent } from '@angular/router';
import { BehaviorSubject, Observable, filter, takeUntil, Subject, map } from 'rxjs';
import { Platform } from '@angular/cdk/platform';
import { isPlatformServer } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NotificationService } from './notification.service';

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
    private notificationService: NotificationService,
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

    // 2️⃣ Handle Android back button in PWA via popstate
    // Note: initial history.pushState is done in AppComponent.ngOnInit() after full bootstrap
    const popstateHandler = () => {
      this.ngZone.run(() => {
        this.handleBackInteraction();
      });
    };

    window.addEventListener('popstate', popstateHandler);
    this.destroy$.subscribe(() => window.removeEventListener('popstate', popstateHandler));

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

  private backHandlers: (() => boolean)[] = [];

  private lastInteractionTime = 0;
  private readonly INTERACTION_GUARD_MS = 350; // must be > overlay close animation (~250ms)

  /**
   * Universal handler for all back interactions (popstate, hardware back, swipe)
   */
  private handleBackInteraction(): void {
    const now = Date.now();
    this.notificationService.info(`[PWA-NAV] handleBackInteraction fired`);

    const hasBottomSheet = !!(this.bottomSheet as any)._openedBottomSheetRef;
    const dialogCount = this.dialog.openDialogs.length;
    const isAtRoot = !hasBottomSheet && dialogCount === 0 && this.navigationStack.length === 0 && this.backHandlers.length === 0;

    if (isAtRoot) {
      // C. Exit App Protection (Root only)
      const timeSinceLastBack = now - this.lastBackPressed;
      this.notificationService.info(`[PWA-NAV] Exit guard: ${timeSinceLastBack}ms`);
      if (timeSinceLastBack < this.exitTime) {
        this.notificationService.info(`[PWA-NAV] 🚪 Exiting app`);
        // window.close() only works for windows opened via window.open().
        // For Android PWA, navigate back past all history entries to close the app.
        history.go(-history.length);
      } else {
        this.notificationService.info(`[PWA-NAV] ⚠️ 1st root back — show snackbar`);
        this.lastBackPressed = now;
        this.snackBar.open('Press back again to exit', '', { duration: 2000 });
        this.restoreHistoryState();
      }
      return;
    }

    if (now - this.lastInteractionTime < this.INTERACTION_GUARD_MS) {
      this.notificationService.info(`[PWA-NAV] ⛔ Guard active (${now - this.lastInteractionTime}ms)`);
      this.restoreHistoryState(); // MUST push state back that was popped by browser to prevent native exit
      return;
    }
    this.lastInteractionTime = now;

    // 1️⃣ Run registered custom handlers (topmost/last-registered first)
    this.notificationService.info(`[PWA-NAV] backHandlers: ${this.backHandlers.length}`);
    for (let i = this.backHandlers.length - 1; i >= 0; i--) {
      const handled = this.backHandlers[i]();
      this.notificationService.info(`[PWA-NAV] handler[${i}]: ${handled}`);
      if (handled) {
        this.notificationService.info(`[PWA-NAV] ✅ Custom handled — restoring`);
        this.restoreHistoryState();
        return;
      }
    }

    // 2️⃣ Close Overlays (Topmost First) — use Angular Material APIs, not DOM queries
    this.notificationService.info(`[PWA-NAV] BS: ${hasBottomSheet} | Dlg: ${dialogCount} | Nav: ${this.navigationStack.length}`);

    // ✅ Bottom sheet check (renders above dialogs, dismiss first)
    if (hasBottomSheet) {
     // this.notificationService.info(`[PWA-NAV] ✅ Dismissing bottom sheet`);
      this.bottomSheet.dismiss();
      this.lastBackPressed = 0;
      this.restoreHistoryState();
      return;
    }

    // ✅ Dialog check (handles multiple stacked dialogs)
    if (dialogCount > 0) {
      //this.notificationService.info(`[PWA-NAV] ✅ Closing dialog (${dialogCount - 1})`);
      this.dialog.openDialogs[dialogCount - 1].close();
      this.lastBackPressed = 0;
      this.restoreHistoryState();
      return;
    }

    // B. Navigate Stack
    if (this.navigationStack.length > 0) {
      const previous = this.navigationStack.pop();
      this.notificationService.info(`[PWA-NAV] ✅ Nav back to: ${previous}`);
      if (previous) {
        this.router.navigateByUrl(previous);
        return;
      }
    }
  }

  private restoreHistoryState(): void {
    // Push synchronously so Android registers the new history entry immediately.
    // A setTimeout here lets the system think history is empty and kills the PWA
    // before the next back press can fire a popstate event.
    history.pushState(null, '', location.href);
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
  }
}
 