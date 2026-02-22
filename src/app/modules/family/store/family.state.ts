import { Family, FamilyMember, FamilyTransaction } from 'src/app/util/models/family.model';

export interface FamilyState {
  family: Family | null;
  members: FamilyMember[];
  transactions: FamilyTransaction[];
  loading: boolean;
  error: string | null;
}

export const initialFamilyState: FamilyState = {
  family: null,
  members: [],
  transactions: [],
  loading: false,
  error: null,
};
