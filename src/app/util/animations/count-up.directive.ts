import { Directive, ElementRef, Input, OnInit, OnChanges, SimpleChanges, inject, OnDestroy } from '@angular/core';
import { Subject, interval, animationFrameScheduler } from 'rxjs';
import { map, takeUntil, takeWhile, switchMap, endWith } from 'rxjs/operators';
import { CurrencyService } from '../service/currency.service';

@Directive({
  selector: '[appCountUp]',
  standalone: true
})
export class CountUpDirective implements OnInit, OnChanges, OnDestroy {
  @Input('appCountUp') endValue: number = 0;
  @Input() duration: number = 1000;
  @Input() decimalPlaces: number = 2;
  @Input() useCurrency: boolean = true;

  private elementRef = inject(ElementRef);
  private currencyService = inject(CurrencyService);
  private destroy$ = new Subject<void>();
  private value$ = new Subject<number>();

  ngOnInit() {
    this.value$.pipe(
      switchMap(end => {
        const start = parseFloat(this.elementRef.nativeElement.innerText.replace(/[^0-9.-]+/g, '')) || 0;
        const startTime = animationFrameScheduler.now();
        
        return interval(0, animationFrameScheduler).pipe(
          map(() => {
            const now = animationFrameScheduler.now();
            const progress = Math.min(1, (now - startTime) / this.duration);
            // Ease out quad
            const easedProgress = progress * (2 - progress);
            return start + (end - start) * easedProgress;
          }),
          takeWhile(val => animationFrameScheduler.now() - startTime <= this.duration, true),
          endWith(end),
          takeUntil(this.destroy$)
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe(val => {
      this.displayValue(val);
    });

    this.value$.next(this.endValue);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['endValue'] && !changes['endValue'].firstChange) {
      this.value$.next(changes['endValue'].currentValue);
    }
  }

  private displayValue(val: number) {
    if (this.useCurrency) {
      this.elementRef.nativeElement.innerText = this.currencyService.formatAmount(val, {
        decimalPlaces: this.decimalPlaces
      });
    } else {
      const formatted = val.toLocaleString(undefined, {
        minimumFractionDigits: this.decimalPlaces,
        maximumFractionDigits: this.decimalPlaces
      });
      this.elementRef.nativeElement.innerText = formatted;
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
