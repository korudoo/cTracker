import { type RefObject } from 'react';
import type { DateFieldMode, SortDirection, TransactionSortField } from '@/services/transactions';
import type { TransactionStatus, TransactionType } from '@/types/domain';
import type { TransactionFilters } from '@/types/transactionFilters';

interface AdvancedFiltersPanelProps {
  panelId: string;
  open: boolean;
  filters: TransactionFilters;
  onClose: () => void;
  onClearAll: () => void;
  onUpdateFilter: <K extends keyof TransactionFilters>(key: K, value: TransactionFilters[K]) => void;
  dateFromInputRef: RefObject<HTMLInputElement>;
}

export function AdvancedFiltersPanel({
  panelId,
  open,
  filters,
  onClose,
  onClearAll,
  onUpdateFilter,
  dateFromInputRef,
}: AdvancedFiltersPanelProps) {
  if (!open) {
    return null;
  }

  return (
    <section
      id={panelId}
      role="region"
      aria-label="Advanced filters and sorting"
      className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Advanced Filters & Sorting</h3>
          <p className="text-sm text-slate-500">Server-side filters are applied immediately.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClearAll}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white"
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-brand-300 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
          >
            Hide advanced
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <label className="block space-y-1 lg:col-span-2">
          <span className="text-sm font-medium text-slate-700">Payee / Description</span>
          <input
            type="text"
            value={filters.searchText}
            onChange={(event) => onUpdateFilter('searchText', event.target.value)}
            placeholder="Search by payee or description"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Type</span>
            <select
              value={filters.type}
              onChange={(event) => onUpdateFilter('type', event.target.value as TransactionType | 'all')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            >
              <option value="all">All</option>
              <option value="cheque">Cheque</option>
              <option value="deposit">Deposit</option>
              <option value="withdrawal">Withdrawal</option>
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Status</span>
            <select
              value={filters.status}
              onChange={(event) =>
                onUpdateFilter('status', event.target.value as TransactionStatus | 'all')
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="deducted">Deducted</option>
              <option value="cleared">Cleared</option>
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Date Filter Field</span>
            <select
              value={filters.dateField}
              onChange={(event) => onUpdateFilter('dateField', event.target.value as DateFieldMode)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            >
              <option value="dueDate">Due Date</option>
              <option value="createdDate">Created Date</option>
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Date From</span>
            <input
              ref={dateFromInputRef}
              type="date"
              value={filters.dateFrom}
              onChange={(event) => onUpdateFilter('dateFrom', event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Date To</span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(event) => onUpdateFilter('dateTo', event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Amount Min</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={filters.amountMin}
              onChange={(event) => onUpdateFilter('amountMin', event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Amount Max</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={filters.amountMax}
              onChange={(event) => onUpdateFilter('amountMax', event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Sort By</span>
            <select
              value={filters.sortBy}
              onChange={(event) => onUpdateFilter('sortBy', event.target.value as TransactionSortField)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            >
              <option value="date">Date</option>
              <option value="amount">Amount</option>
              <option value="status">Status</option>
              <option value="type">Type</option>
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Date Sort Field</span>
            <select
              value={filters.dateSortField}
              onChange={(event) => onUpdateFilter('dateSortField', event.target.value as DateFieldMode)}
              disabled={filters.sortBy !== 'date'}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:bg-slate-100"
            >
              <option value="dueDate">Due Date</option>
              <option value="createdDate">Created Date</option>
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Sort Direction</span>
            <select
              value={filters.sortDirection}
              onChange={(event) => onUpdateFilter('sortDirection', event.target.value as SortDirection)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </label>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={filters.showHistorical}
          onChange={(event) => onUpdateFilter('showHistorical', event.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        Show historical cleared transactions older than 60 days
      </label>
    </section>
  );
}
