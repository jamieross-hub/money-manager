import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { take } from 'rxjs';

export interface ModalReference {
  id: string;
  ref: any;
  closeCallback: () => void;
  urlBeforeOpen: string;
  allowBackNavigation: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class MobileBackButtonService {
  private stack: ModalReference[] = [];

  constructor(private router: Router, private location: Location) {}

  /**
   * Checks if there are any open modals in the stack.
   */
  hasOpenModals(): boolean {
    return this.stack.length > 0;
  }

  /**
   * Returns the current stack of open modals.
   */
  getOpenModals(): ModalReference[] {
    return [...this.stack];
  }

  /**
   * Pops the top modal off the stack and executes its close callback.
   * If allowBackNavigation is false, it re-pushes history to maintain the modal.
   */
  popModal(): void {
    const modal = this.stack[this.stack.length - 1];
    if (modal) {
      if (modal.allowBackNavigation === false) {
        // "Prevent" back button by pushing the state back immediately
        this.location.go(this.router.url, '', { modal: modal.id });
        return;
      }
      
      this.stack.pop();
      modal.closeCallback();
    }
  }

  /**
   * Register a modal/popup when it opens.
   * Pushes a history state and sets up automatic cleanup.
   * 
   * @param id Unique identifier for the modal
   * @param ref The actual reference (MatDialogRef, MatBottomSheetRef, etc.)
   * @param closeCallback Optional custom close logic or config object
   */
  openModal(id: string, ref: any, closeCallbackOrOptions?: (() => void) | { closeCallback?: () => void; allowBackNavigation?: boolean }) {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      const currentUrl = this.router.url;
      
      // Push state via Location to keep history in sync
      this.location.go(currentUrl, '', { modal: id });
      
      let closeFn: () => void;
      let allowBack = true;
      
      // Handle different argument types for backward compatibility
      if (typeof closeCallbackOrOptions === 'function') {
        closeFn = closeCallbackOrOptions;
      } else if (typeof ref === 'function') {
        closeFn = ref;
        ref = null;
      } else {
        const options = closeCallbackOrOptions || {};
        allowBack = options.allowBackNavigation !== false;
        closeFn = options.closeCallback || (() => {
          if (ref && typeof ref.close === 'function') ref.close();
          else if (ref && typeof ref.dismiss === 'function') ref.dismiss();
        });
      }

      this.stack.push({ 
        id, 
        ref, 
        closeCallback: closeFn, 
        urlBeforeOpen: currentUrl,
        allowBackNavigation: allowBack 
      });

      // Tight control: Auto-sync history if modal is closed via other means (backdrop click, etc)
      if (ref) {
        const closingObservable = 
          (typeof ref.afterClosed === 'function') ? ref.afterClosed() : 
          (typeof ref.afterDismissed === 'function') ? ref.afterDismissed() : null;

        if (closingObservable && typeof closingObservable.subscribe === 'function') {
          closingObservable.pipe(take(1)).subscribe(() => {
            this.closeModal(id);
          });
        }
      }
    }
  }

  /**
   * Unregister a modal/popup when it is closed programmatically.
   * Pops the history state if it matches the current modal.
   */
  closeModal(id: string) {
    const index = this.stack.findIndex((item) => item.id === id);
    if (index !== -1) {
      const isTopMost = index === this.stack.length - 1;
      const state = this.location.getState() as { modal?: string };

      if (isTopMost && state && state.modal === id) {
        // This will trigger a popstate event, which calls popModal() and pops the stack
        this.location.back();
      } else {
        // If not topmost or history already went back, just remove from stack
        this.stack.splice(index, 1);
      }
    }
  }

  /**
   * Closes all open modals in the stack.
   */
  closeAll(): void {
    while (this.stack.length > 0) {
      this.popModal();
    }
  }
}
