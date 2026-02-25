import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'trend',
  standalone: true,
  pure: true
})
export class TrendPipe implements PipeTransform {
  transform(value: any, type: 'icon' | 'color' | 'confidenceColor'): string {
    if (type === 'icon') {
      switch (value) {
        case 'increasing': return 'trending_up';
        case 'decreasing': return 'trending_down';
        case 'stable': return 'trending_flat';
        default: return 'trending_flat';
      }
    } else if (type === 'color') {
      switch (value) {
        case 'increasing': return 'text-error-500';
        case 'decreasing': return 'text-success-500';
        case 'stable': return 'text-primary-500';
        default: return 'text-primary-500';
      }
    } else {
      switch (value) {
        case 'high': return 'text-success-500';
        case 'medium': return 'text-warning-500';
        case 'low': return 'text-error-500';
        default: return 'text-neutral-500';
      }
    }
  }
}
