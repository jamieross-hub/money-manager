import { Injectable } from "@angular/core";
import { BreakpointObserver } from '@angular/cdk/layout';

interface DeviceType {
    isMobileSmall: boolean;
    isMobile: boolean;
    isTablePortrait: boolean;
    isTableLandscape: boolean;
    isLaptop: boolean;
    isDesktop: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class BreakpointService {

    public device: DeviceType = {
        isMobileSmall: false,
        isMobile: false,
        isTablePortrait: false,
        isTableLandscape: false,
        isLaptop: false,
        isDesktop: false
    };

    constructor(private breakpointObserver: BreakpointObserver) {
        this.breakpointObserver.observe([
            '(max-width: 360px)',                           // Mobile Small
            '(max-width: 480px)',                           // Mobile
            '(min-width: 481px) and (max-width: 768px)',    // Tablet Portrait
            '(min-width: 769px) and (max-width: 1024px)',   // Tablet Landscape / Laptop Small
            '(min-width: 1025px) and (max-width: 1440px)',  // Laptop / Desktop
            '(min-width: 1441px)'                           // Large Desktop / Ultra Wide
        ])
            .subscribe(result => {
                const bp = result.breakpoints;

                this.device.isMobileSmall = bp['(max-width: 360px)'];
                this.device.isMobile = bp['(max-width: 480px)'] && !bp['(max-width: 360px)'];
                this.device.isTablePortrait = bp['(min-width: 481px) and (max-width: 768px)'];
                this.device.isTableLandscape = bp['(min-width: 769px) and (max-width: 1024px)'];
                this.device.isLaptop = bp['(min-width: 1025px) and (max-width: 1440px)'];
                this.device.isDesktop = bp['(min-width: 1441px)'];
            });
    }
}
