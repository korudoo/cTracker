import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { TransactionTable } from '@/components/transactions/TransactionTable';
import { useCalendar } from '@/context/CalendarContext';
import {
  chequeNumberExistsInAccount,
  createTransaction,
  deleteTransaction,
  type DateFieldMode,
  getAccounts,
  type GetTransactionsParams,
  getProfile,
  getTransactions,
  type SortDirection,
  type TransactionSortField,
  runDueStatusTransition,
  updateTransaction,
} from '@/services/transactions';
import type {
  Transaction,
  TransactionInput,
  TransactionStatus,
  TransactionType,
} from '@/types/domain';
import { toIsoDate } from '@/utils/date';

interface TransactionFilters {
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

const DEFAULT_FILTERS: TransactionFilters = {
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

function parseNumberInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatDateLabel(value: string) {
  return value || '-';
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function TransactionsPage() {
  const { mode } = useCalendar();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<TransactionFilters>(DEFAULT_FILTERS);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  });

  const transitionQuery = useQuery({
    queryKey: ['due-status-transition', profileQuery.data?.timezone],
    queryFn: async () => runDueStatusTransition(profileQuery.data?.timezone ?? 'UTC'),
    enabled: Boolean(profileQuery.data?.timezone),
    staleTime: Number.POSITIVE_INFINITY,
  });

  const accountsQuery = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  });

  const historicalCutoffDate = useMemo(() => {
    if (filters.showHistorical) {
      return undefined;
    }

    const date = new Date();
    date.setDate(date.getDate() - 60);
    return toIsoDate(date);
  }, [filters.showHistorical]);

  const transactionParams = useMemo<GetTransactionsParams>(
    () => ({
      type: filters.type,
      status: filters.status,
      searchText: filters.searchText,
      dateField: filters.dateField,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      amountMin: parseNumberInput(filters.amountMin),
      amountMax: parseNumberInput(filters.amountMax),
      sortBy: filters.sortBy,
      sortDirection: filters.sortDirection,
      dateSortField: filters.dateSortField,
      hideHistoricalCleared: !filters.showHistorical,
      historicalCutoffDate,
    }),
    [filters, historicalCutoffDate],
  );

  const transactionsQuery = useQuery({
    queryKey: ['transactions', transactionParams],
    queryFn: async () => getTransactions(transactionParams),
    enabled: transitionQuery.isSuccess,
  });

  const transactions = transactionsQuery.data ?? [];
  const accounts = accountsQuery.data ?? [];

  const saveMutation = useMutation({
    mutationFn: async (payload: TransactionInput) => {
      if (payload.type === 'cheque' && payload.chequeNumber) {
        const normalizedChequeNumber = payload.chequeNumber.trim().toLowerCase();
        const duplicateInList = transactions.some(
          (transaction) =>
            transaction.type === 'cheque' &&
            transaction.accountId === payload.accountId &&
            transaction.id !== (editing?.id ?? '') &&
            (transaction.chequeNumber ?? '').trim().toLowerCase() === normalizedChequeNumber,
        );

        if (duplicateInList) {
          throw new Error('Cheque number already exists for this account.');
        }

        const duplicateInDb = await chequeNumberExistsInAccount({
          accountId: payload.accountId,
          chequeNumber: payload.chequeNumber,
          excludeTransactionId: editing?.id,
        });

        if (duplicateInDb) {
          throw new Error('Cheque number already exists for this account.');
        }
      }

      if (editing) {
        return updateTransaction(editing.id, payload);
      }

      return createTransaction(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setEditing(null);
      setActionError(null);
    },
    onError: (error: unknown) => {
      setActionError(getErrorMessage(error, 'Unable to save transaction.'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (transactionId: string) => deleteTransaction(transactionId),
    onSuccess: async (_, transactionId) => {
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setActionError(null);
      if (editing?.id === transactionId) {
        setEditing(null);
      }
    },
    onError: (error: unknown) => {
      setActionError(getErrorMessage(error, 'Unable to delete transaction.'));
    },
  });

  const appliedSummary = useMemo(() => {
    const summary: string[] = [];

    if (filters.type !== 'all') {
      summary.push(`Type: ${filters.type}`);
    }
    if (filters.status !== 'all') {
      summary.push(`Status: ${filters.status}`);
    }
    if (filters.searchText.trim()) {
      summary.push(`Text: "${filters.searchText.trim()}"`);
    }
    if (filters.dateFrom || filters.dateTo) {
      const rangeLabel = filters.dateField === 'createdDate' ? 'Created date' : 'Due date';
      summary.push(
        `${rangeLabel}: ${formatDateLabel(filters.dateFrom)} to ${formatDateLabel(filters.dateTo)}`,
      );
    }
    if (filters.amountMin || filters.amountMax) {
      summary.push(`Amount: ${filters.amountMin || 'min'} to ${filters.amountMax || 'max'}`);
    }
    if (filters.sortBy !== DEFAULT_FILTERS.sortBy || filters.sortDirection !== DEFAULT_FILTERS.sortDirection) {
      summary.push(`Sort: ${filters.sortBy} (${filters.sortDirection})`);
    }
    if (
      filters.sortBy === 'date' &&
      filters.dateSortField !== DEFAULT_FILTERS.dateSortField
    ) {
      summary.push(`Date sort field: ${filters.dateSortField === 'createdDate' ? 'created date' : 'due date'}`);
    }
    if (!filters.showHistorical && historicalCutoffDate) {
      summary.push(`Historical hidden: cleared before ${historicalCutoffDate}`);
    }

    return summary;
  }, [filters, historicalCutoffDate]);

  const isLoadingInitial =
    profileQuery.isPending ||
    accountsQuery.isPending ||
    (Boolean(profileQuery.data?.timezone) && transitionQuery.isPending) ||
    (transitionQuery.isSuccess && transactionsQuery.isPending);

  const pageError =
    actionError ??
    (profileQuery.error
      ? getErrorMessage(profileQuery.error, 'Unable to load profile.')
      : accountsQuery.error
        ? getErrorMessage(accountsQuery.error, 'Unable to load accounts.')
        : transitionQuery.error
          ? getErrorMessage(transitionQuery.error, 'Unable to run due status transition.')
          : transactionsQuery.error
            ? getErrorMessage(transactionsQuery.error, 'Unable to load transactions.')
            : null);

  const updateFilter = <K extends keyof TransactionFilters>(key: K, value: TransactionFilters[K]) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
  };

  const handleSave = async (payload: TransactionInput) => {
    setActionError(null);
    await saveMutation.mutateAsync(payload);
  };

  const handleDelete = async (transaction: Transaction) => {
    const approved = window.confirm(`Delete transaction for ${transaction.type} (${transaction.amount})?`);
    if (!approved) return;

    setActionError(null);
    await deleteMutation.mutateAsync(transaction.id);
  };

  if (isLoadingInitial) {
    return <div className="rounded-xl bg-white p-6 shadow-card">Loading transactions...</div>;
  }

  return (
    <div className="space-y-5">
      {pageError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {pageError}
        </div>
      ) : null}

      <TransactionForm
        accounts={accounts}
        calendarMode={mode}
        initialTransaction={editing}
        isSaving={saveMutation.isPending}
        onSubmit={handleSave}
        onCancelEdit={() => setEditing(null)}
      />

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Transaction List Controls</h2>
            <p className="text-sm text-slate-500">Combine filters and sorting; all filtering is server-side.</p>
          </div>
          <button
            type="button"
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Clear All
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Type</span>
            <select
              value={filters.type}
              onChange={(event) => updateFilter('type', event.target.value as TransactionType | 'all')}
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
                updateFilter('status', event.target.value as TransactionStatus | 'all')
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="deducted">Deducted</option>
              <option value="cleared">Cleared</option>
            </select>
          </label>

          <label className="block space-y-1 lg:col-span-2">
            <span className="text-sm font-medium text-slate-700">Payee / Description</span>
            <input
              type="text"
              value={filters.searchText}
              onChange={(event) => updateFilter('searchText', event.target.value)}
              placeholder="Search by payee or description"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Date Filter Field</span>
            <select
              value={filters.dateField}
              onChange={(event) => updateFilter('dateField', event.target.value as DateFieldMode)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            >
              <option value="dueDate">Due Date</option>
              <option value="createdDate">Created Date</option>
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Date From</span>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(event) => updateFilter('dateFrom', event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Date To</span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(event) => updateFilter('dateTo', event.target.value)}
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
              onChange={(event) => updateFilter('amountMin', event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Sort By</span>
            <select
              value={filters.sortBy}
              onChange={(event) => updateFilter('sortBy', event.target.value as TransactionSortField)}
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
              onChange={(event) => updateFilter('dateSortField', event.target.value as DateFieldMode)}
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
              onChange={(event) => updateFilter('sortDirection', event.target.value as SortDirection)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Amount Max</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={filters.amountMax}
              onChange={(event) => updateFilter('amountMax', event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </label>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={filters.showHistorical}
            onChange={(event) => updateFilter('showHistorical', event.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Show historical cleared transactions older than 60 days
        </label>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-medium text-slate-700">Applied filters summary</p>
          {appliedSummary.length ? (
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              {appliedSummary.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No active filters (default view).</p>
          )}
        </div>
      </section>

      <TransactionTable
        transactions={transactions}
        calendarMode={mode}
        dateField={filters.sortBy === 'date' ? filters.dateSortField : filters.dateField}
        emptyMessage="No transactions found for the selected filters."
        onEdit={(transaction) => setEditing(transaction)}
        onDelete={handleDelete}
      />
    </div>
  );
}
