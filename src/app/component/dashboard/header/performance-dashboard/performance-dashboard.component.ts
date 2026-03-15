import { Component, ChangeDetectionStrategy, Signal, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PerformanceMetricsService, PerformanceMetrics } from 'src/app/util/service/performance-metrics.service';

@Component({
  selector: 'app-performance-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './performance-dashboard.component.html',
  styleUrl: './performance-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PerformanceDashboardComponent implements OnDestroy {
  private metricsService = inject(PerformanceMetricsService);
  public metrics: Signal<PerformanceMetrics> = this.metricsService.metrics;

  constructor() {
    console.log('PerformanceDashboardComponent: Created');
  }

  ngOnDestroy(): void {
    console.log('PerformanceDashboardComponent: Destroyed');
  }

  resetNetwork(): void {
    this.metricsService.resetNetworkCount();
  }
}
