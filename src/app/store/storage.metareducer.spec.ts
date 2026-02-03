import { ActionReducer } from '@ngrx/store';
import { storageMetaReducer } from './storage.metareducer';
import { Timestamp } from '@angular/fire/firestore';

describe('storageMetaReducer', () => {
    let reducer: ActionReducer<any>;
    let metaReducer: ActionReducer<any>;

    beforeEach(() => {
        reducer = jasmine.createSpy('reducer').and.callFake((state, action) => state);
        metaReducer = storageMetaReducer(reducer);
        spyOn(localStorage, 'getItem').and.callThrough();
        spyOn(localStorage, 'setItem').and.callThrough();
        localStorage.clear();
    });

    it('should save state to localStorage', () => {
        const state = { foo: 'bar' };
        metaReducer(state, { type: 'SOME_ACTION' });
        expect(localStorage.setItem).toHaveBeenCalledWith('app_state', JSON.stringify(state));
    });

    it('should restore state from localStorage on init', () => {
        const storedState = { foo: 'baz' };
        localStorage.setItem('app_state', JSON.stringify(storedState));

        // Re-create spy to pick up the item we just set, if needed, 
        // but localStorage works globally in jsdom/browser envs usually.

        metaReducer(undefined, { type: '@ngrx/store/init' });

        // The reducer should be called with the restored state
        expect(reducer).toHaveBeenCalledWith(storedState, jasmine.anything());
    });

    it('should revive Date strings to Date objects', () => {
        const date = new Date('2023-01-01T10:00:00.000Z');
        const storedState = { myDate: date.toISOString() };
        localStorage.setItem('app_state', JSON.stringify(storedState));

        metaReducer(undefined, { type: '@ngrx/store/init' });

        const callArgs = (reducer as jasmine.Spy).calls.argsFor(0);
        const restoredState = callArgs[0];

        expect(restoredState.myDate).toBeInstanceOf(Date);
        expect(restoredState.myDate.getTime()).toBe(date.getTime());
    });

    it('should revive Firestore Timestamp objects', () => {
        const timestamp = { seconds: 1672569600, nanoseconds: 0 };
        const storedState = { myTimestamp: timestamp };
        localStorage.setItem('app_state', JSON.stringify(storedState));

        metaReducer(undefined, { type: '@ngrx/store/init' });

        const callArgs = (reducer as jasmine.Spy).calls.argsFor(0);
        const restoredState = callArgs[0];

        expect(restoredState.myTimestamp).toBeInstanceOf(Timestamp);
        expect(restoredState.myTimestamp.seconds).toBe(1672569600);
    });
});
