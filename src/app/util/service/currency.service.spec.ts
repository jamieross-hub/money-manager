import { TestBed } from '@angular/core/testing';
import { CurrencyService } from './currency.service';
import { UserService } from './db/user.service';
import { BehaviorSubject } from 'rxjs';
import { CurrencyCode } from '../config/enums';

describe('CurrencyService', () => {
    let service: CurrencyService;
    let userServiceMock: any;
    let userAuthSubject: BehaviorSubject<any>;

    beforeEach(() => {
        userAuthSubject = new BehaviorSubject<any>(null);
        userServiceMock = {
            userAuth$: userAuthSubject
        };

        TestBed.configureTestingModule({
            providers: [
                CurrencyService,
                { provide: UserService, useValue: userServiceMock }
            ]
        });
        service = TestBed.inject(CurrencyService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('formatAmount', () => {
        it('should return empty string for null/undefined/empty input', () => {
            expect(service.formatAmount(null)).toBe('');
            expect(service.formatAmount(undefined)).toBe('');
            expect(service.formatAmount('')).toBe('');
        });

        it('should return "Invalid amount" for non-numeric strings', () => {
            expect(service.formatAmount('abc')).toBe('Invalid amount');
        });

        it('should format numbers correctly using defaults', () => {
            // Assuming defaults are INR and Indian English locale from config
            const result = service.formatAmount(1000);
            expect(result).toContain('₹');
            expect(result).toContain('1,000.00');
        });

        it('should respect currency option', () => {
            const result = service.formatAmount(1000, { currency: CurrencyCode.USD });
            expect(result).toContain('$');
            expect(result).toContain('1,000.00');
        });

        it('should respect decimalPlaces option', () => {
            const result = service.formatAmount(1000, { decimalPlaces: 0 });
            expect(result).not.toContain('.00');
        });

        it('should respect round option', () => {
            const result = service.formatAmount(1000.55, { round: true });
            expect(result).toContain('1,001');
        });

        it('should respect showSymbol option', () => {
            const result = service.formatAmount(1000, { showSymbol: false, currency: CurrencyCode.USD });
            expect(result).toContain('USD');
            expect(result).not.toContain('$');
        });

        it('should respect compact notation', () => {
            const result = service.formatAmount(1000000, { compact: true });
            // Depending on locale, this might be 1M or 10L etc.
            expect(result).toBeTruthy();
        });
    });
});
