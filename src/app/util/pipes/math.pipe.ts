import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'math',
  standalone: true,
  pure: true
})
export class MathPipe implements PipeTransform {
  transform(value: number, operation: 'percentWidth' | 'ratio', ...args: any[]): any {
    switch (operation) {
      case 'percentWidth': {
        const max = args[0] || 1;
        return max > 0 ? (value / max) * 100 : 0;
      }
      case 'ratio': {
        const other = args[0];
        const max = Math.max(value, other, 1);
        return {
          value1Width: (value / max) * 100,
          value2Width: (other / max) * 100
        };
      }
      default:
        return value;
    }
  }
}
