import { Injectable, signal, inject, PLATFORM_ID } from "@angular/core";
import { BreakpointObserver } from "@angular/cdk/layout";
import { isPlatformBrowser } from "@angular/common";

@Injectable({
  providedIn: "root",
})
export class BreakpointService {

  private platformId = inject(PLATFORM_ID);

  // Signals
  public readonly isMobile = signal(false);
  public readonly isTablePortrait = signal(false);
  public readonly isTableLandscape = signal(false);
  public readonly isLaptop = signal(false);
  public readonly isDesktop = signal(false);

  public device = {
    isMobile: false,
    isTablePortrait: false,
    isTableLandscape: false,
    isLaptop: false,
    isDesktop: false,
  };

  constructor(private breakpointObserver: BreakpointObserver) {

    this.breakpointObserver
      .observe([
        "(max-width: 480px)",
        "(min-width: 481px) and (max-width: 768px)",
        "(min-width: 769px) and (max-width: 1024px)",
        "(min-width: 1025px) and (max-width: 1440px)",
        "(min-width: 1441px)",
      ])
      .subscribe((result) => {
        const bp = result.breakpoints;

        const widthMobile = bp["(max-width: 480px)"];
        const isTablePortrait =
          bp["(min-width: 481px) and (max-width: 768px)"];
        const isTableLandscape =
          bp["(min-width: 769px) and (max-width: 1024px)"];
        const isLaptop =
          bp["(min-width: 1025px) and (max-width: 1440px)"];
        const isDesktop = bp["(min-width: 1441px)"];

        // 🔥 Smart Mobile Detection
        const smartMobile = this.detectRealMobile(widthMobile);

        this.isMobile.set(smartMobile);
        this.isTablePortrait.set(isTablePortrait);
        this.isTableLandscape.set(isTableLandscape);
        this.isLaptop.set(isLaptop);
        this.isDesktop.set(isDesktop);

        this.device = {
          isMobile: smartMobile,
          isTablePortrait,
          isTableLandscape,
          isLaptop,
          isDesktop,
        };
      });
  }

  /**
   * Detect real mobile device (Android / iPhone)
   * Prevent desktop resize false positives
   */
  private detectRealMobile(widthMobile: boolean): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;

    const ua = navigator.userAgent;

    const isAndroid = /Android/i.test(ua);
    const isIPhone = /iPhone/i.test(ua);

    const isTouch =
      "ontouchstart" in window || navigator.maxTouchPoints > 0;

    // Real mobile = (Android or iPhone) AND touch
    const realMobile = (isAndroid || isIPhone) && isTouch;

    // If OS detected mobile → trust it
    if (realMobile) return true;

    // Fallback to width (optional)
    return widthMobile;
  }
}