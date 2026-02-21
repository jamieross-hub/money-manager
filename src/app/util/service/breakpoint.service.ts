import { Injectable, signal } from "@angular/core";
import { BreakpointObserver } from '@angular/cdk/layout';

@Injectable({
    providedIn: 'root'
})
export class BreakpointService {

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
        isDesktop: false
    };

    constructor(private breakpointObserver: BreakpointObserver) {
        this.breakpointObserver.observe([
            '(max-width: 480px)',                           // Mobile
            '(min-width: 481px) and (max-width: 768px)',    // Tablet Portrait
            '(min-width: 769px) and (max-width: 1024px)',   // Tablet Landscape / Laptop Small
            '(min-width: 1025px) and (max-width: 1440px)',  // Laptop / Desktop
            '(min-width: 1441px)'                           // Large Desktop / Ultra Wide
        ])
            .subscribe(result => {
                const bp = result.breakpoints;

                const isMobile = bp['(max-width: 480px)'];
                const isTablePortrait = bp['(min-width: 481px) and (max-width: 768px)'];
                const isTableLandscape = bp['(min-width: 769px) and (max-width: 1024px)'];
                const isLaptop = bp['(min-width: 1025px) and (max-width: 1440px)'];
                const isDesktop = bp['(min-width: 1441px)'];

                this.isMobile.set(isMobile);
                this.isTablePortrait.set(isTablePortrait);
                this.isTableLandscape.set(isTableLandscape);
                this.isLaptop.set(isLaptop);
                this.isDesktop.set(isDesktop);

                this.device = {
                    isMobile,
                    isTablePortrait,
                    isTableLandscape,
                    isLaptop,
                    isDesktop
                };
            });
    }
}
