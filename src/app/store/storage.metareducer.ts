import { ActionReducer, MetaReducer } from '@ngrx/store';
import { Timestamp } from '@angular/fire/firestore';

export function storageMetaReducer(reducer: ActionReducer<any>): ActionReducer<any> {
    return function (state, action) {
        // 1. On init, if state is undefined, try to search in localStorage
        if (action.type === '@ngrx/store/init' || action.type === '@ngrx/effects/init') {
            const storedState = localStorage.getItem('app_state');
            if (storedState) {
                try {
                    const parsedState = JSON.parse(storedState, dateTimeReviver);
                    // Merge initial state with stored state to handle new properties/features
                    return reducer(parsedState, action);
                } catch (e) {
                    console.error('Failed to parse stored state', e);
                    localStorage.removeItem('app_state');
                }
            }
        }

        // 2. Compute the next state
        const nextState = reducer(state, action);

        // 3. Save the next state to localStorage
        // We only save if the state is actual data (not undefined)
        if (nextState) {
            try {
                const stateToSave = JSON.stringify(nextState);
                localStorage.setItem('app_state', stateToSave);
            } catch (e) {
                console.error('Failed to save state to localStorage', e);
            }
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
