import { Account } from '../../util/models/account.model';

export type AccountsContext = 'personal' | 'family';

export interface AccountsBucket {
  entities: { [id: string]: Account };
  ids: string[];
}

export interface AccountsState {
  // Dual buckets: personal and family data are never mixed
  personal: AccountsBucket;
  family: AccountsBucket;
  // Which bucket is currently active (drives selectors)
  activeContext: AccountsContext;
  loading: boolean;
  error: any;
  selectedAccountId: string | null;
}

const emptyBucket: AccountsBucket = { entities: {}, ids: [] };

export const initialState: AccountsState = {
  personal: { ...emptyBucket },
  family: { ...emptyBucket },
  activeContext: 'personal',
  loading: false,
  error: null,
  selectedAccountId: null
};