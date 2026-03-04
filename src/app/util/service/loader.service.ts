import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LoaderService {
  private loadingSignal = signal<boolean>(false);
  private loaderCount = 0;
  
  public readonly isLoading = this.loadingSignal.asReadonly();

  show() {
    this.loaderCount++;
    if (this.loaderCount === 1) {
      this.loadingSignal.set(true);
    }
  }

  hide() {
    this.loaderCount = Math.max(0, this.loaderCount - 1);
    if (this.loaderCount === 0) {
      this.loadingSignal.set(false);
    }
  }
}
