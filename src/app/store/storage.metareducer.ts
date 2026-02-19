import { ActionReducer, MetaReducer } from '@ngrx/store';
import { Timestamp } from '@angular/fire/firestore';
import { LocalIndexDBStorageService } from '../util/service/indexdb-storage.service';
import { LocalStorageKey } from '../util/models/local-storage.model';

export function storageMetaReducer(reducer: ActionReducer<any>): ActionReducer<any> {
    const storageService = LocalIndexDBStorageService.getInstance();
    let saveTimeout: any = null;

    return function (state, action) {
        // 1. On init, if state is undefined, try to search in storage service
        if (action.type === '@ngrx/store/init' || action.type === '@ngrx/effects/init') {
            const storedState = storageService.getItem(LocalStorageKey.APP_STATE);
            if (storedState) {
                try {
                    // storageService handles parsing if it was stored as an object
                    // but we keep the reviver for complex types like Dates/Timestamps
                    const parsedState = typeof storedState === 'string'
                        ? JSON.parse(storedState, dateTimeReviver)
                        : storedState;

                    // Merge initial state with stored state to handle new properties/features
                    return reducer(parsedState, action);
                } catch (e) {
                    console.error('Failed to parse stored state', e);
                    storageService.removeItem(LocalStorageKey.APP_STATE);
                }
            }
        }

        // 2. Compute the next state
        const nextState = reducer(state, action);

        // 3. Save the next state to storage service with Debounce
        // We only save if the state is actual data (not undefined) and has changed
        if (nextState && nextState !== state) {
            if (saveTimeout) {
                clearTimeout(saveTimeout);
            }

            saveTimeout = setTimeout(() => {
                try {
                    storageService.setItem(LocalStorageKey.APP_STATE, nextState);
                } catch (e) {
                    console.error('Failed to save state to storage service', e);
                }
                saveTimeout = null;
            }, 1000); // Debounce for 1 second
        }

        return nextState;
    };
}

/**
 * Reviver function to restore Date and Firestore Timestamp objects
 */
function dateTimeReviver(key: string, value: any): any {
    // Check for ISO 8601 Date Strings
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
        return new Date(value);
    }

    // Check for Firestore Timestamp objects (serialized as { seconds: number, nanoseconds: number })
    if (value && typeof value === 'object' && 'seconds' in value && 'nanoseconds' in value) {
        return new Timestamp(value.seconds, value.nanoseconds);
    }

    return value;
}
