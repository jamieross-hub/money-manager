import { Transaction } from '../../util/models/transaction.model';
import { RecurringTemplate } from '../../util/models/recurring.model';

export interface TransactionsState {
  entities: { [id: string]: Transaction };
  ids: string[];
  recurringTemplates: RecurringTemplate[];
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