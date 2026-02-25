import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'includes',
  standalone: true,
  pure: true
})
export class IncludesPipe implements PipeTransform {
  /**
   * Check if an array includes a specific value
   * @param array - The array to check
   * @param value - The value to look for
   * @returns True if the value is in the array
   */
  transform(array: any[] | null | undefined, value: any): boolean {
    if (!array) return false;
    return array.includes(value);
  }
}
