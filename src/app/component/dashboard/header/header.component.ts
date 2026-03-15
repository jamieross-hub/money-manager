import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SideBarComponent } from '../side-bar/side-bar.component';
import { UserComponent } from './user/user.component';
import { PerformanceMetricsService } from 'src/app/util/service/performance-metrics.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  standalone: true,
  imports: [CommonModule, SideBarComponent, UserComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent {
  private metricsService = inject(PerformanceMetricsService);
  public showPerformanceDashboard = this.metricsService.showDashboard;
  private clickCount = 0;
  private lastClickTime = 0;

  public handleHeaderClick(): void {
    const now = Date.now();
    if (now - this.lastClickTime > 500) {
      this.clickCount = 1;
    } else {
      this.clickCount++;
    }
    
    this.lastClickTime = now;

    if (this.clickCount === 8) {
      this.metricsService.showDashboard.update(v => !v);
      this.clickCount = 0;
    }
  }
}
