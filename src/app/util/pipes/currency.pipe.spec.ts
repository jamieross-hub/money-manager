import { TestBed } from '@angular/core/testing';
import { CurrencyPipe } from './currency.pipe';
import { UserService } from '../service/db/user.service';
import { BehaviorSubject } from 'rxjs';
import { APP_CONFIG } from '../config/config';
import { CurrencyCode } from '../config/enums';

describe('CurrencyPipe', () => {
    let pipe: CurrencyPipe;
    let userServiceMock: any;
    let userAuthSubject: BehaviorSubject<any>;

    beforeEach(() => {
        userAuthSubject = new BehaviorSubject<any>(null);
        userServiceMock = {
            userAuth$: userAuthSubject
        };

        TestBed.configureTestingModule({
            providers: [
                CurrencyPipe,
                { provide: UserService, useValue: userServiceMock }
            ]
        });

        pipe = TestBed.inject(CurrencyPipe);
    });

    it('create an instance', () => {
        expect(pipe).toBeTruthy();
    });

    it('should use default currency from config when no user is logged in', () => {
        const result = pipe.transform(100);
        // Assuming default is INR based on config file view
        // Search for symbol in COUNTRY_MAPPING
        const mapping = APP_CONFIG.CURRENCY.COUNTRY_MAPPING;
        let symbol = '';
        for (const data of Object.values(mapping)) {
            if (data.currency === APP_CONFIG.CURRENCY.DEFAULT) {
                symbol = data.symbol;
                break;
            }
        }
        expect(result).toContain(symbol);
    });

    it('should use user preferred currency when user is logged in', () => {
        userAuthSubject.next({
            preferences: {
                defaultCurrency: CurrencyCode.USD
            }
        });

        const result = pipe.transform(100);
        expect(result).toContain('$'); // USD symbol
    });

    it('should override user preference if currency option is provided', () => {
        userAuthSubject.next({
            preferences: {
                defaultCurrency: CurrencyCode.USD
            }
        });

        const result = pipe.transform(100, { currency: CurrencyCode.EUR });
        expect(result).toContain('€'); // EUR symbol
    });

    it('should handle undefined user preferences gracefully', () => {
        userAuthSubject.next({}); // No preferences

        const result = pipe.transform(100);
        const mapping = APP_CONFIG.CURRENCY.COUNTRY_MAPPING;
        let symbol = '';
        for (const data of Object.values(mapping)) {
            if (data.currency === APP_CONFIG.CURRENCY.DEFAULT) {
                symbol = data.symbol;
                break;
            }
        }
        expect(result).toContain(symbol);
    });
});
