import { Injectable, NgZone, Inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { Location } from '@angular/common';
import { Router, NavigationEnd, NavigationStart, Event as RouterEvent } from '@angular/router';
import { BehaviorSubject, Observable, filter, takeUntil, Subject, map } from 'rxjs';
import { Platform } from '@angular/cdk/platform';
import { isPlatformServer } from '@angular/common';

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

  public navigationState$: Observable<NavigationState> = this.navigationStateSubject.asObservable();
  public canGoBack$: Observable<boolean> = this.navigationState$.pipe(
    filter(state => state.canGoBack),
    map(state => state.canGoBack)
  );

  constructor(
    private location: Location,
    private router: Router,
    private platform: Platform,
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    if (!isPlatformServer(this.platformId)) {
      this.initializePwaNavigation();
    }
  }

  private initializePwaNavigation(): void {
    // Detect PWA environment
    const isStandalone = this.isStandalonePwa();
    const isMobile = this.isMobileDevice();

    // Initialize navigation stack
    this.navigationStack = [];
    
    // Listen to router events
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

    // Listen to router events for navigation start
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

    // Handle browser back/forward buttons
    const popstateHandler = () => {
      this.ngZone.run(() => {
        this.handlePopState();
      });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', popstateHandler);

      // Store for cleanup
      this.destroy$.subscribe(() => {
        window.removeEventListener('popstate', popstateHandler);
      });
    }

    // Handle hardware back button on mobile
    if (isMobile) {
      this.setupHardwareBackButton();
    }

    // Handle keyboard events
    this.setupKeyboardNavigation();

    // Update initial state
    this.updateNavigationState({
      isStandalone,
      isMobile,
      currentRoute: this.router.url
    });
  }

  private isStandalonePwa(): boolean {
    if (isPlatformServer(this.platformId)) {
      return false; // Default to false on server-side
    }
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as any).standalone === true;
  }

  private isMobileDevice(): boolean {
    if (isPlatformServer(this.platformId)) {
      return false; // Default to false on server-side
    }
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  private handleNavigationStart(event: NavigationStart): void {
    // Don't add to stack if it's a navigation within the same route
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
      canGoBack: this.navigationStack.length > 0 || this.canNavigateBack()
    });
  }

  private handlePopState(): void {
    // Handle browser back/forward navigation
    const currentRoute = this.router.url;
    const currentState = this.navigationStateSubject.value;
    
    // Update navigation stack when user uses browser back/forward
    if (currentRoute !== currentState.currentRoute) {
      this.updateNavigationState({
        currentRoute,
        previousRoute: currentState.currentRoute,
        canGoBack: this.navigationStack.length > 0 || this.canNavigateBack()
      });
    }
  }

  private setupHardwareBackButton(): void {
    // Handle hardware back button on Android
    if (this.platform.ANDROID) {
      const backButtonHandler = (event: Event) => {
        event.preventDefault();
        this.ngZone.run(() => {
          this.handleHardwareBackButton();
        });
      };
      
      document.addEventListener('backbutton', backButtonHandler, false);
      
      // Store for cleanup
      this.destroy$.subscribe(() => {
        document.removeEventListener('backbutton', backButtonHandler);
      });
    }

    // Handle iOS back gesture and hardware back button
    if (this.platform.IOS) {
      // iOS doesn't have a hardware back button, but we can handle swipe gestures
      this.setupIosBackGesture();
    }
  }

  private setupIosBackGesture(): void {
    // Handle iOS swipe back gesture
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

      // Check if it's a horizontal swipe from left edge
      if (deltaX > threshold && deltaY < threshold && startX < 50) {
        this.ngZone.run(() => {
          this.handleHardwareBackButton();
        });
      }
    };

    document.addEventListener('touchstart', touchStartHandler, { passive: true });
    document.addEventListener('touchend', touchEndHandler, { passive: true });

    // Store for cleanup
    this.destroy$.subscribe(() => {
      document.removeEventListener('touchstart', touchStartHandler);
      document.removeEventListener('touchend', touchEndHandler);
    });
  }

  private setupKeyboardNavigation(): void {
    const keydownHandler = (event: KeyboardEvent) => {
      // Handle Alt+Left arrow (browser back)
      if (event.altKey && event.key === 'ArrowLeft') {
        event.preventDefault();
        this.ngZone.run(() => {
          this.goBack();
        });
      }
      
      // Handle Escape key for closing modals/dialogs
      if (event.key === 'Escape') {
        this.ngZone.run(() => {
          this.handleEscapeKey();
        });
      }
    };

    document.addEventListener('keydown', keydownHandler);

    // Store for cleanup
    this.destroy$.subscribe(() => {
      document.removeEventListener('keydown', keydownHandler);
    });
  }

  private handleHardwareBackButton(): void {
    const currentState = this.navigationStateSubject.value;
    
    // Check if we're in a modal or dialog
    if (this.isInModal()) {
      this.closeModal();
      return;
    }

    // Check if we can go back in navigation stack
    if (currentState.canGoBack) {
      this.goBack();
    } else {
      // Show exit confirmation for PWA
      this.showExitConfirmation();
    }
  }

  private handleEscapeKey(): void {
    // Close modals or dialogs when Escape is pressed
    if (this.isInModal()) {
      this.closeModal();
    }
  }

  private isInModal(): boolean {
    // Check if there are any modal elements open
    const modals = document.querySelectorAll('.modal, .dialog, [role="dialog"]');
    return modals.length > 0;
  }

  private closeModal(): void {
    // Find and close the topmost modal
    const modals = document.querySelectorAll('.modal, .dialog, [role="dialog"]');
    if (modals.length > 0) {
      const topModal = modals[modals.length - 1];
      const closeButton = topModal.querySelector('[data-dismiss="modal"], .close, .modal-close');
      if (closeButton) {
        (closeButton as HTMLElement).click();
      }
    }
  }

  private showExitConfirmation(): void {
    if (this.navigationStateSubject.value.isStandalone) {
      // For standalone PWA, show a custom exit confirmation
      if (confirm('Do you want to exit the app?')) {
        this.exitApp();
      }
    }
  }

  private exitApp(): void {
    // For standalone PWA, we can't programmatically exit, but we can minimize
    if (this.navigationStateSubject.value.isStandalone) {
      // Try to minimize the app (this works on some platforms)
      window.close();
    }
  }

  private addToNavigationStack(route: string): void {
    if (route && route !== '/') {
      this.navigationStack.push(route);
      
      // Keep stack size manageable
      if (this.navigationStack.length > this.maxStackSize) {
        this.navigationStack.shift();
      }
    }
  }

  private canNavigateBack(): boolean {
    return this.navigationStack.length > 0 || window.history.length > 1;
  }

  public goBack(): void {
    const currentState = this.navigationStateSubject.value;
    
    // Check if we have routes in our navigation stack
    if (this.navigationStack.length > 0) {
      const previousRoute = this.navigationStack.pop();
      if (previousRoute) {
        this.router.navigateByUrl(previousRoute);
        return;
      }
    }

    // Fallback to browser back
    if (window.history.length > 1) {
      this.location.back();
    } else {
      // If no history, navigate to home
      this.router.navigate(['/dashboard']);
    }
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
      canGoBack: false,
      navigationStack: []
    });
  }

  public getNavigationStack(): string[] {
    return [...this.navigationStack];
  }

  public isStandaloneMode(): boolean {
    return this.navigationStateSubject.value.isStandalone;
  }

  public isMobileMode(): boolean {
    return this.navigationStateSubject.value.isMobile;
  }

  private updateNavigationState(updates: Partial<NavigationState>): void {
    const currentState = this.navigationStateSubject.value;
    const newState = { ...currentState, ...updates };
    
    if (updates.navigationStack) {
      this.navigationStack = updates.navigationStack;
    }
    
    this.navigationStateSubject.next(newState);
  }

  ngOnDestroy(): void {
    // Clean up all event listeners and subscriptions
    this.destroy$.next();
    this.destroy$.complete();
    
    // Clear navigation stack
    this.navigationStack = [];
    
    // Reset navigation state
    this.navigationStateSubject.next({
      canGoBack: false,
      currentRoute: '',
      previousRoute: '',
      navigationStack: [],
      isStandalone: false,
      isMobile: false
    });
  }
} 