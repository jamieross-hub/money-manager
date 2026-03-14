import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'truncate',
  standalone: true
})
export class TruncatePipe implements PipeTransform {
  transform(value: number, digits: number = 2): number {
    if (value === null || value === undefined || isNaN(value)) return 0;
    const factor = Math.pow(10, digits);
    return Math.trunc(value * factor) / factor;
  }
}
