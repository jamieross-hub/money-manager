import { ActionReducer } from '@ngrx/store';
import { storageMetaReducer } from './storage.metareducer';
import { Timestamp } from '@angular/fire/firestore';
import { LocalIndexDBStorageService } from '../util/service/indexdb-storage.service';
import { LocalStorageKey } from '../util/models/local-storage.model';
import { fakeAsync, tick } from '@angular/core/testing';

describe('storageMetaReducer', () => {
    let reducer: ActionReducer<any>;
    let metaReducer: ActionReducer<any>;
    let storageServiceMock: jasmine.SpyObj<LocalIndexDBStorageService>;

    beforeEach(() => {
        // Mock the storage service
        storageServiceMock = jasmine.createSpyObj('LocalIndexDBStorageService', ['getItem', 'setItem', 'removeItem']);

        // Mock getInstance to return our spy object
        spyOn(LocalIndexDBStorageService, 'getInstance').and.returnValue(storageServiceMock);

        reducer = jasmine.createSpy('reducer').and.callFake((state, action) => state);
        metaReducer = storageMetaReducer(reducer);
    });

    it('should save state to storage using LocalStorageKey.APP_STATE', fakeAsync(() => {
        const initialState = { foo: 'old' };
        const nextState = { foo: 'bar' };
        
        // Setup reducer to return nextState
        (reducer as jasmine.Spy).and.returnValue(nextState);
        
        metaReducer(initialState, { type: 'SOME_ACTION' });
        
        // Advance time by 1 second to trigger debounce
        tick(1000);
        
        expect(storageServiceMock.setItem).toHaveBeenCalledWith(LocalStorageKey.APP_STATE, nextState);
    }));

    it('should restore state from storage on init', () => {
        const storedState = { foo: 'baz' };
        // Setup mock return value
        storageServiceMock.getItem.and.returnValue(storedState);

        metaReducer(undefined, { type: '@ngrx/store/init' });

        // The reducer should be called with the restored state
        expect(reducer).toHaveBeenCalledWith(storedState, jasmine.anything());
        expect(storageServiceMock.getItem).toHaveBeenCalledWith(LocalStorageKey.APP_STATE);
    });

    it('should revive Date strings to Date objects', () => {
        const date = new Date('2023-01-01T10:00:00.000Z');
        // When stored as JSON string (simulator internal behavior of getItem if it returned string)
        // But the service returns `any`. The meta reducer handles string parsing if getItem returns string.
        // Let's simulate getItem returning a JSON string to test the reviver logic in meta-reducer
        const storedStateString = JSON.stringify({ myDate: date.toISOString() });
        storageServiceMock.getItem.and.returnValue(storedStateString);

        metaReducer(undefined, { type: '@ngrx/store/init' });

        const callArgs = (reducer as jasmine.Spy).calls.argsFor(0);
        const restoredState = callArgs[0];

        expect(restoredState.myDate).toBeInstanceOf(Date);
        expect(restoredState.myDate.getTime()).toBe(date.getTime());
    });

    it('should revive Firestore Timestamp objects', () => {
        const timestamp = { seconds: 1672569600, nanoseconds: 0 };
        const storedStateString = JSON.stringify({ myTimestamp: timestamp });
        storageServiceMock.getItem.and.returnValue(storedStateString);

        metaReducer(undefined, { type: '@ngrx/store/init' });

        const callArgs = (reducer as jasmine.Spy).calls.argsFor(0);
        const restoredState = callArgs[0];

        expect(restoredState.myTimestamp).toBeInstanceOf(Timestamp);
        expect(restoredState.myTimestamp.seconds).toBe(1672569600);
    });

    it('should handle parsing errors gracefully', () => {
        storageServiceMock.getItem.and.returnValue('invalid json');

        metaReducer(undefined, { type: '@ngrx/store/init' });

        expect(storageServiceMock.removeItem).toHaveBeenCalledWith(LocalStorageKey.APP_STATE);
        // Should return undefined/initial state to reducer if parsing fails
        expect(reducer).toHaveBeenCalledWith(undefined, jasmine.anything());
    });
});
