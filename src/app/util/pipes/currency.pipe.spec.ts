import { TestBed } from '@angular/core/testing';
import { CurrencyPipe } from './currency.pipe';
import { CurrencyService } from '../service/currency.service';

describe('CurrencyPipe', () => {
    let pipe: CurrencyPipe;
    let currencyServiceMock: any;

    beforeEach(() => {
        currencyServiceMock = {
            formatAmount: jasmine.createSpy('formatAmount').and.returnValue('Formatted Amount')
        };

        TestBed.configureTestingModule({
            providers: [
                CurrencyPipe,
                { provide: CurrencyService, useValue: currencyServiceMock }
            ]
        });

        pipe = TestBed.inject(CurrencyPipe);
    });

    it('create an instance', () => {
        expect(pipe).toBeTruthy();
    });

    it('should delegate formatting to CurrencyService', () => {
        const result = pipe.transform(100, { currency: 'USD' });
        expect(currencyServiceMock.formatAmount).toHaveBeenCalledWith(100, { currency: 'USD' });
        expect(result).toBe('Formatted Amount');
    });

    it('should work with null value', () => {
        pipe.transform(null);
        expect(currencyServiceMock.formatAmount).toHaveBeenCalledWith(null, undefined);
    });
});
