import { Category } from '../../util/models/category.model';

export type CategoriesContext = 'personal' | 'family';

export interface CategoriesBucket {
  entities: { [id: string]: Category };
  ids: string[];
}

export interface CategoriesState {
  // Dual buckets: personal and family data are never mixed
  personal: CategoriesBucket;
  family: CategoriesBucket;
  // Which bucket is currently active (drives selectors)
  activeContext: CategoriesContext;
  loading: boolean;
  error: any;
}

const emptyBucket: CategoriesBucket = { entities: {}, ids: [] };

export const initialState: CategoriesState = {
  personal: { ...emptyBucket },
  family: { ...emptyBucket },
  activeContext: 'personal',
  loading: false,
  error: null
};