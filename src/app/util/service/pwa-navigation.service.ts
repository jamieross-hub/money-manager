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
  private backPressCount = 0;
  private exitTime = 2000;

  // Overlay history states
  private skipNextPopState = false;
  private currentOverlayIndex = 0;
  private hasBottomSheetOpen = false;

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
        if (this.skipNextPopState) {
          this.skipNextPopState = false;
          return;
        }
        this.handleBackInteraction();
      });
    };

    window.addEventListener('popstate', popstateHandler);
    this.destroy$.subscribe(() => window.removeEventListener('popstate', popstateHandler));

    // 3️⃣ Push dummy state when overlays open
    this.dialog.afterOpened.pipe(takeUntil(this.destroy$)).subscribe((ref) => {
      const id = this.pushOverlayState();
      ref.afterClosed().subscribe(() => this.popOverlayStateIfNeeded(id));
    });

    const originalBsOpen = this.bottomSheet.open.bind(this.bottomSheet) as any;
    this.bottomSheet.open = (...args: any[]) => {
      const ref = originalBsOpen(...args);
      this.hasBottomSheetOpen = true;
      const id = this.pushOverlayState();
      ref.afterDismissed().subscribe(() => {
        this.hasBottomSheetOpen = false;
        this.popOverlayStateIfNeeded(id);
      });
      return ref as any;
    };

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

  // 1️⃣ Interaction guard (TOP)
  if (now - this.lastInteractionTime < this.INTERACTION_GUARD_MS) {
    this.restoreHistoryState();
    return;
  }
  this.lastInteractionTime = now;

  const hasBottomSheet = this.hasBottomSheetOpen;
  const dialogCount = this.dialog.openDialogs.length;

  // 2️⃣ UI layers (highest priority)
  if (hasBottomSheet) {
    this.bottomSheet.dismiss();
    this.restoreHistoryState();
    this.lastBackPressed = 0;
    this.backPressCount = 0;
    return;
  }

  if (dialogCount > 0) {
    this.dialog.openDialogs[dialogCount - 1].close();
    this.restoreHistoryState();
    this.lastBackPressed = 0;
    this.backPressCount = 0;
    return;
  }

  // 3️⃣ Custom handlers
  for (let i = this.backHandlers.length - 1; i >= 0; i--) {
    if (this.backHandlers[i]()) {
      this.restoreHistoryState();
      return;
    }
  }

  // 4️⃣ Navigation stack
  if (this.navigationStack.length > 0) {
    const previous = this.navigationStack.pop();
    if (previous) {
      this.router.navigateByUrl(previous);
      this.restoreHistoryState();
      return;
    }
  }

  // 5️⃣ Root exit protection
  const isAtRoot =
    this.navigationStack.length === 0 &&
    this.backHandlers.length === 0;

  if (isAtRoot) {
    const timeSinceLastBack = now - this.lastBackPressed;

    if (timeSinceLastBack < this.exitTime) {
      this.backPressCount++;
    } else {
      this.backPressCount = 1;
    }

    this.lastBackPressed = now;

    if (this.backPressCount >= 3) {
      this.backPressCount = 0;
      return; // ✅ allow exit
    } else {
      const remaining = 3 - this.backPressCount;
      this.notificationService.info(
        `Press back ${remaining} more time${remaining > 1 ? 's' : ''} to exit`
      );
      this.restoreHistoryState();
      return;
    }
  }
}

  private restoreHistoryState(): void {
    // Push synchronously so Android registers the new history entry immediately.
    // Use the current Angular router URL to prevent the browser from actually going back.
    const currentUrl = this.location.prepareExternalUrl(this.router.url);
    history.pushState(null, '', currentUrl || '/');
  }

  private pushOverlayState(): number {
    this.currentOverlayIndex++;
    const stateId = this.currentOverlayIndex;
    const currentUrl = this.location.prepareExternalUrl(this.router.url);
    history.pushState({ overlayId: stateId }, '', currentUrl || '/');
    return stateId;
  }

  private popOverlayStateIfNeeded(closedOverlayId: number): void {
    const currentStateId = history.state?.overlayId || 0;
    if (currentStateId >= closedOverlayId) {
      this.skipNextPopState = true;
      history.back();
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
 