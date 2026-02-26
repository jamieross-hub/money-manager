import { Family, FamilyMember, FamilyTransaction } from 'src/app/util/models/family.model';

export interface FamilyState {
  family: Family | null;
  userFamilies: Family[];
  members: FamilyMember[];
  transactions: FamilyTransaction[];
  loading: boolean;
  userFamiliesLoading: boolean;
  error: string | null;
}

export const initialFamilyState: FamilyState = {
  family: null,
  userFamilies: [],
  members: [],
  transactions: [],
  loading: false,
  userFamiliesLoading: false,
  error: null,
};
