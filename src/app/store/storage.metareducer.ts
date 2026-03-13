import { ActionReducer, MetaReducer } from '@ngrx/store';
import { Timestamp } from '@angular/fire/firestore';
import { LocalIndexDBStorageService } from '../util/service/indexdb-storage.service';
import { LocalStorageKey } from '../util/models/local-storage.model';

/**
 * One-time migration: old persisted state had flat { entities, ids } for accounts
 * and categories. New state uses dual-bucket { personal, family, activeContext }.
 * Without this, restored state would crash the new selectors on first launch after upgrade.
 */
function migrateStateShape(state: any): any {
  if (!state) return state;

  const emptyBucket = { entities: {}, ids: [] };

  let accounts = state.accounts;
  if (accounts && !accounts.personal) {
    accounts = {
      personal: { entities: accounts.entities ?? {}, ids: accounts.ids ?? [] },
      family: emptyBucket,
      activeContext: 'personal',
      loading: false,
      error: null,
      selectedAccountId: accounts.selectedAccountId ?? null
    };
  }

  let categories = state.categories;
  if (categories && !categories.personal) {
    categories = {
      personal: { entities: categories.entities ?? {}, ids: categories.ids ?? [] },
      family: emptyBucket,
      activeContext: 'personal',
      loading: false,
      error: null
    };
  }

  return { ...state, accounts, categories };
}

/**
 * Only these action types trigger a debounced state persist.
 * Defined at module scope so the Set is created once, not on every action dispatch.
 */
const PERSIST_ON = new Set([
    '[Accounts] Load Accounts Success',
    '[Accounts] Create Account Success',
    '[Accounts] Update Account Success',
    '[Accounts] Delete Account Success',
    '[Accounts] Set Context',
    '[Categories] Load Categories Success',
    '[Categories] Create Category Success',
    '[Categories] Update Category Success',
    '[Categories] Delete Category Success',
    '[Categories] Set Context',
    '[Profile] Load Profile Success',
    '[Profile] Update Profile Success',
    '[Budgets] Load Budgets Success',
    '[Goals] Load Goals Success',
    '@ngrx/store/init',
    '@ngrx/effects/init',
]);

export function storageMetaReducer(reducer: ActionReducer<any>): ActionReducer<any> {

    const storageService = LocalIndexDBStorageService.getInstance();
    let saveTimeout: any = null;

    return function (state, action) {
        // 1. On init, if state is undefined, try to restore from storage
        if (action.type === '@ngrx/store/init' || action.type === '@ngrx/effects/init') {
            const storedState = storageService.getItem(LocalStorageKey.APP_STATE);
            if (storedState) {
                try {
                    const parsedState = typeof storedState === 'string'
                        ? JSON.parse(storedState, dateTimeReviver)
                        : storedState;

                    // Migrate old flat accounts/categories shape → dual-bucket shape
                    const migratedState = migrateStateShape(parsedState);

                    return reducer(migratedState, action);
                } catch (e) {
                    console.warn('Metadata: Failed to parse stored state (expected if corrupted or in tests)', e);
                    storageService.removeItem(LocalStorageKey.APP_STATE);
                }
            }
        }

        // 2. Compute the next state
        const nextState = reducer(state, action);

        // 3. Only persist on meaningful state-changing actions (see module-level PERSIST_ON set).
        if (nextState && nextState !== state && PERSIST_ON.has(action.type)) {
            if (saveTimeout) clearTimeout(saveTimeout);

            saveTimeout = setTimeout(() => {
                try {
                    const { transactions, ...persistableState } = nextState;
                    storageService.setItem(LocalStorageKey.APP_STATE, persistableState);
                } catch (e) {
                    console.error('Failed to save state to storage service', e);
                }
                saveTimeout = null;
            }, 1000);
        }

        return nextState;

    };
}

function dateTimeReviver(key: string, value: any): any {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
        return new Date(value);
    }
    if (value && typeof value === 'object' && 'seconds' in value && 'nanoseconds' in value) {
        return new Timestamp(value.seconds, value.nanoseconds);
    }
    return value;
}
