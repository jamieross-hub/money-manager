import { Pipe, PipeTransform, inject } from '@angular/core';
import { CurrencyService, CurrencyFormatOptions } from '../service/currency.service';

@Pipe({
  name: 'currency',
  standalone: true,
  pure: true
})
export class CurrencyPipe implements PipeTransform {
  private currencyService = inject(CurrencyService);

  /**
   * Transform a number value to a formatted currency string
   * @param value - The numeric value to format
   * @param options - Optional formatting options
   * @returns Formatted currency string
   */
  transform(value: number | string | null | undefined, options?: CurrencyFormatOptions): string {
    return this.currencyService.formatAmount(value, options);
  }
}
