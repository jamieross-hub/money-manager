import { Injectable, signal, Signal, OnDestroy } from '@angular/core';
import { interval, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

export interface PerformanceMetrics {
  fps: number;
  memoryUsage?: number;
  totalJSHeapSize?: number;
  usedJSHeapSize?: number;
  jsHeapSizeLimit?: number;
  memoryUsagePercent?: number;
  cpuLoad?: number;
  networkRequests: number;
  swStatus: string;
}

@Injectable({
  providedIn: 'root'
})
export class PerformanceMetricsService implements OnDestroy {
  private destroy$ = new Subject<void>();
  
  public showDashboard = signal(false);

  private metricsSignal = signal<PerformanceMetrics>({
    fps: 0,
    networkRequests: 0,
    swStatus: 'Unknown'
  });

  public readonly metrics: Signal<PerformanceMetrics> = this.metricsSignal.asReadonly();

  private fpsCount = 0;
  private lastFpsTime = performance.now();
  private networkCount = 0;

  constructor() {
    this.startFPSCounter();
    this.startMemoryMonitoring();
    this.startCPUMonitoring();
    this.startNetworkMonitoring();
    this.checkServiceWorkerStatus();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private startFPSCounter(): void {
    const countFPS = () => {
      this.fpsCount++;
      const now = performance.now();
      if (now >= this.lastFpsTime + 1000) {
        this.metricsSignal.update(m => ({ ...m, fps: Math.round((this.fpsCount * 1000) / (now - this.lastFpsTime)) }));
        this.fpsCount = 0;
        this.lastFpsTime = now;
      }
      requestAnimationFrame(countFPS);
    };
    requestAnimationFrame(countFPS);
  }

  private startMemoryMonitoring(): void {
    if ((performance as any).memory) {
      interval(2000)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          const mem = (performance as any).memory;
          const used = mem.usedJSHeapSize;
          const limit = mem.jsHeapSizeLimit;
          this.metricsSignal.update(m => ({
            ...m,
            memoryUsage: Math.round(used / (1024 * 1024)),
            totalJSHeapSize: Math.round(mem.totalJSHeapSize / (1024 * 1024)),
            usedJSHeapSize: Math.round(used / (1024 * 1024)),
            jsHeapSizeLimit: Math.round(limit / (1024 * 1024)),
            memoryUsagePercent: Math.round((used / limit) * 100)
          }));
        });
    }
  }

  private startCPUMonitoring(): void {
    let lastTime = performance.now();
    let smoothedLoad = 0;
    const alpha = 0.2; // Smoothing factor (lower = smoother)

    const checkLoad = () => {
      const now = performance.now();
      const delta = now - lastTime;
      lastTime = now;

      // Expecting ~100ms interval. Anything above that is "lag".
      const lag = Math.max(0, delta - 100);
      const instantLoad = Math.min(100, Math.round((lag / 100) * 100));
      
      // Apply Exponential Moving Average (EMA)
      smoothedLoad = (instantLoad * alpha) + (smoothedLoad * (1 - alpha));
      
      this.metricsSignal.update(m => ({ ...m, cpuLoad: Math.round(smoothedLoad) }));
      
      setTimeout(checkLoad, 100);
    };
    setTimeout(checkLoad, 100);
  }

  private startNetworkMonitoring(): void {
    // Basic network request tracking via PerformanceObserver
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        this.networkCount += entries.length;
        this.metricsSignal.update(m => ({ ...m, networkRequests: this.networkCount }));
      });
      observer.observe({ entryTypes: ['resource'] });
    } catch (e) {
      console.warn('PerformanceObserver resource monitoring not supported');
    }
  }

  private checkServiceWorkerStatus(): void {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        this.updateSWStatus(registration.active?.state || 'Ready');
        
        const sw = registration.active || registration.installing || registration.waiting;
        if (sw) {
          sw.addEventListener('statechange', (e: any) => {
            this.updateSWStatus(e.target.state);
          });
        }
      });
    }
  }

  private updateSWStatus(status: string): void {
    this.metricsSignal.update(m => ({ ...m, swStatus: status.charAt(0).toUpperCase() + status.slice(1) }));
  }

  public resetNetworkCount(): void {
    this.networkCount = 0;
    this.metricsSignal.update(m => ({ ...m, networkRequests: 0 }));
  }
}
