import { Transaction } from '../../util/models/transaction.model';

export interface TransactionsState {
  entities: { [id: string]: Transaction };
  ids: string[];
  recurringTemplates: Transaction[];
  loading: boolean;
  recurringLoading: boolean;
  error: any;
  selectedTransactionId: string | null;
}

export const initialState: TransactionsState = {
  entities: {},
  ids: [],
  recurringTemplates: [],
  loading: false,
  recurringLoading: false,
  error: null,
  selectedTransactionId: null
}; 