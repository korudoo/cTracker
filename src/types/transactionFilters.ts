import type {
  DateFieldMode,
  SortDirection,
  TransactionSortField,
} from '@/services/transactions';
import type { TransactionStatus, TransactionType } from '@/types/domain';

export interface TransactionFilters {
  type: TransactionType | 'all';
  status: TransactionStatus | 'all';
  searchText: string;
  dateField: DateFieldMode;
  dateFrom: string;
  dateTo: string;
  amountMin: string;
  amountMax: string;
  sortBy: TransactionSortField;
  sortDirection: SortDirection;
  dateSortField: DateFieldMode;
  showHistorical: boolean;
}

export const DEFAULT_TRANSACTION_FILTERS: TransactionFilters = {
  type: 'all',
  status: 'all',
  searchText: '',
  dateField: 'dueDate',
  dateFrom: '',
  dateTo: '',
  amountMin: '',
  amountMax: '',
  sortBy: 'date',
  sortDirection: 'asc',
  dateSortField: 'dueDate',
  showHistorical: false,
};

