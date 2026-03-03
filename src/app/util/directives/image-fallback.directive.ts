import {
  Directive,
  ElementRef,
  HostListener,
  Input,
  Renderer2
} from '@angular/core';

/**
 * Robust directive to handle image fallback logic.
 * Handles both initial missing/null src values and runtime loading errors.
 * Optimized for offline scenarios by providing a guaranteed SVG fallback.
 */
@Directive({
  selector: 'img[appImageFallback]',
  standalone: true
})
export class ImageFallbackDirective {

  // Use an absolute path (leading slash) to ensure it works regardless of route depth
  @Input('appImageFallback')
  fallback: string = '/assets/images/profile.png';

  /** 
   * Guaranteed offline fallback (SVG data URI) 
   * Used if both the primary src AND the asset fallback fail.
   */
  private readonly offlineFallback = 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23e2e2e2"/%3E%3Ccircle cx="50" cy="50" r="42" fill="%231c2a2b"/%3E%3Ccircle cx="50" cy="38" r="13" fill="white"/%3E%3Cpath d="M30 75 c0-10 9-18 20-18 s20 8 20 18 v2 h-40 z" fill="white"/%3E%3C/svg%3E';

  /** 
   * 0: No fallback applied yet
   * 1: Asset fallback applied (/assets/images/profile.png)
   * 2: Last resort SVG applied (stops here to prevent infinite loop)
   */
  private fallbackLevel = 0;

  constructor(
    private el: ElementRef<HTMLImageElement>,
    private renderer: Renderer2
  ) {}

  /** 
   * Intercept native [src] binding.
   * Whenever the source changes, we reset the fallback state.
   */
  @Input('src')
  set src(value: string | null | undefined) {
    if (!value || value.trim() === '' || value === 'null' || value === 'undefined') {
      this.applyFallback();
      return;
    }

    // New valid source being tried, allow fallback chain to start over if it fails
    this.fallbackLevel = 0;
    this.renderer.setStyle(this.el.nativeElement, 'opacity', '1');
    this.renderer.setAttribute(this.el.nativeElement, 'src', value);
  }

  /** 
   * Captures the 'error' event emitted by the browser when an image fails to load.
   */
  @HostListener('error')
  onError() {
    this.applyFallback();
  }

  /**
   * Applies the fallback image in a tiered approach to handle offline states.
   */
  private applyFallback() {
    const img = this.el.nativeElement;

    // Level 0 -> 1: Try the local asset fallback
    if (this.fallbackLevel === 0) {
      this.fallbackLevel = 1;

      // Temporary hide to prevent "broken image" icon flicker
      this.renderer.setStyle(img, 'opacity', '0');
      
      this.renderer.setAttribute(img, 'src', this.fallback);
      
      // Show again - if it fails, onError will trigger Level 2
      this.renderer.setStyle(img, 'opacity', '1');
      return;
    }

    // Level 1 -> 2: Asset failed (likely offline and not cached), use local SVG string
    if (this.fallbackLevel === 1) {
      this.fallbackLevel = 2;
      this.renderer.setAttribute(img, 'src', this.offlineFallback);
      this.renderer.setStyle(img, 'opacity', '1');
      return;
    }

    // Level 2: Stop to prevent infinite loop
  }
}