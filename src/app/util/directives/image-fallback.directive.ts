import { Directive, ElementRef, HostListener, Input, Renderer2, AfterViewInit } from '@angular/core';

/**
 * Robust directive to handle image fallback logic.
 * Handles both runtime errors (onerror) and initial missing/invalid src values.
 */
@Directive({
  selector: 'img[appImageFallback]',
  standalone: true
})
export class ImageFallbackDirective implements AfterViewInit {
  
  @Input('appImageFallback') fallback: string = 'assets/images/profile.png';
  
  private isFallbackApplied = false;

  constructor(private el: ElementRef, private renderer: Renderer2) { }

  ngAfterViewInit(): void {
    this.checkImage();
  }

  @HostListener('error')
  onError(): void {
    this.applyFallback();
  }

  private checkImage(): void {
    const element = this.el.nativeElement as HTMLImageElement;
    // Check if src is missing or has "null"/"undefined" strings from bindings
    const src = element.getAttribute('src');
    if (!src || src === 'null' || src === 'undefined' || src.trim() === '') {
      this.applyFallback();
    }
  }

  private applyFallback(): void {
    if (!this.isFallbackApplied) {
      this.isFallbackApplied = true;
      this.renderer.setAttribute(this.el.nativeElement, 'src', this.fallback);
    }
  }
}
