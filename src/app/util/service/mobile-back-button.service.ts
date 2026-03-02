import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class MobileBackButtonService {
  private stack: { id: string; closeCallback: () => void; urlBeforeOpen: string }[] = [];

  constructor(private router: Router, private location: Location) {}

  /**
   * Checks if there are any open modals in the stack.
   */
  hasOpenModals(): boolean {
    return this.stack.length > 0;
  }

  /**
   * Pops the top modal off the stack and executes its close callback,
   * while preserving the browser history.
   */
  popModal(): void {
    const modal = this.stack.pop();
    if (modal) {
      // Execute the callback to close the modal.
      // We don't need to restore history because the back action actually cleared the dummy state correctly.
      modal.closeCallback();
    }
  }

  /**
   * Register a modal/popup when it opens.
   * Pushes a history state so physical back button can be intercepted.
   * 
   * @param id Unique identifier for the modal
   * @param closeCallback The function to call to actually close the modal
   */
  openModal(id: string, closeCallback: () => void) {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      // Record the current URL before opening
      const currentUrl = this.router.url;
      
      // Push state via Location to keep Angular sync 
      // (Location doesn't trigger router nav when pushing state)
      this.location.go(currentUrl, '', { modal: id });
      
      this.stack.push({ id, closeCallback, urlBeforeOpen: currentUrl });
    }
  }

  /**
   * Unregister a modal/popup when it is closed programmatically.
   * Pops the history state if it matches the modal.
   * 
   * @param id Unique identifier for the modal
   */
  closeModal(id: string) {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      const index = this.stack.findIndex((item) => item.id === id);
      if (index !== -1) {
        // Remove from our stack
        this.stack.splice(index, 1);
        
        // If the current location state is our modal, go back to clear it
        const state = this.location.getState() as { modal?: string };
        if (state && state.modal === id) {
          this.location.back();
        }
      }
    }
  }
}
