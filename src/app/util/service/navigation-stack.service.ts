import { Injectable } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class NavigationStackService {

  private stack: string[] = [];

  constructor(private router: Router) {

    this.router.events.subscribe(event => {

      if (event instanceof NavigationEnd) {

        const url = event.urlAfterRedirects;

        // Prevent duplicate entries
        if (this.stack.length === 0 || this.stack[this.stack.length - 1] !== url) {
          this.stack.push(url);
        }

      }

    });

  }

  pop() {
    this.stack.pop();
    return this.stack[this.stack.length - 1];
  }

  canGoBack() {
    return this.stack.length > 1;
  }

  getCurrent() {
    return this.stack[this.stack.length - 1];
  }

  getStack() {
    return [...this.stack];
  }

}
