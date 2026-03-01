import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoaderService {
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private loaderCount = 0;
  private hideTimeout: any;
  loading$ = this.loadingSubject.asObservable();

  show() {
    this.loaderCount++;
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
    if (this.loaderCount === 1) {
      this.loadingSubject.next(true);
    }
  }

  hide() {
    this.loaderCount = Math.max(0, this.loaderCount - 1);
    if (this.loaderCount === 0) {
      // Small delay before actually hiding to prevent flickering during rapid state changes
      if (this.hideTimeout) clearTimeout(this.hideTimeout);
      this.hideTimeout = setTimeout(() => {
        if (this.loaderCount === 0) {
          this.loadingSubject.next(false);
          this.hideTimeout = null;
        }
      }, 100); 
    }
  }
}
