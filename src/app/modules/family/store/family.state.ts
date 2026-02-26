import { Family, FamilyMember, FamilyTransaction, Settlement } from 'src/app/util/models/family.model';

export interface FamilyState {
  family: Family | null;
  userFamilies: Family[];
  members: FamilyMember[];
  transactions: FamilyTransaction[];
  settlements: Settlement[];
  loading: boolean;
  settlementsLoading: boolean;
  userFamiliesLoading: boolean;
  error: string | null;
}

export const initialFamilyState: FamilyState = {
  family: null,
  userFamilies: [],
  members: [],
  transactions: [],
  settlements: [],
  loading: false,
  settlementsLoading: false,
  userFamiliesLoading: false,
  error: null,
};
