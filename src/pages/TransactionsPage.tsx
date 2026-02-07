import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdvancedFiltersPanel } from '@/components/transactions/AdvancedFiltersPanel';
import { QuickRangeDropdown } from '@/components/transactions/QuickRangeDropdown';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { TransactionTable } from '@/components/transactions/TransactionTable';
import { useCalendar } from '@/context/CalendarContext';
import {
  chequeNumberExistsInAccount,
  createTransaction,
  deleteTransaction,
  getAccounts,
  type GetTransactionsParams,
  getProfile,
  getTransactions,
  runDueStatusTransition,
  updateTransaction,
} from '@/services/transactions';
import type { Transaction, TransactionInput } from '@/types/domain';
import {
  DEFAULT_TRANSACTION_FILTERS,
  type TransactionFilters,
} from '@/types/transactionFilters';
import { toIsoDate } from '@/utils/date';
import { getQuickRangeDates, type QuickRangeValue } from '@/utils/quickRanges';
import { saveTransactionFiltersSnapshot } from '@/utils/transactionFiltersSnapshot';

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
  const [filters, setFilters] = useState<TransactionFilters>(DEFAULT_TRANSACTION_FILTERS);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [quickRange, setQuickRange] = useState<QuickRangeValue>('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const controlsRef = useRef<HTMLDivElement>(null);
  const dateFromInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!controlsRef.current) {
        return;
      }

      if (!controlsRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  });

  const transitionQuery = useQuery({
    queryKey: ['due-status-transition', profileQuery.data?.timezone],
    queryFn: async () => {
      const timezone = profileQuery.data?.timezone ?? 'UTC';
      await runDueStatusTransition(timezone);
      return {
        timezone,
        processedAt: new Date().toISOString(),
      };
    },
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
    if (
      filters.sortBy !== DEFAULT_TRANSACTION_FILTERS.sortBy ||
      filters.sortDirection !== DEFAULT_TRANSACTION_FILTERS.sortDirection
    ) {
      summary.push(`Sort: ${filters.sortBy} (${filters.sortDirection})`);
    }
    if (
      filters.sortBy === 'date' &&
      filters.dateSortField !== DEFAULT_TRANSACTION_FILTERS.dateSortField
    ) {
      summary.push(
        `Date sort field: ${filters.dateSortField === 'createdDate' ? 'created date' : 'due date'}`,
      );
    }
    if (!filters.showHistorical && historicalCutoffDate) {
      summary.push(`Historical hidden: cleared before ${historicalCutoffDate}`);
    }

    return summary;
  }, [filters, historicalCutoffDate]);

  useEffect(() => {
    saveTransactionFiltersSnapshot({
      params: transactionParams,
      summary: appliedSummary,
      createdAt: new Date().toISOString(),
    });
  }, [appliedSummary, transactionParams]);

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

  const clearAllFilters = () => {
    setFilters(DEFAULT_TRANSACTION_FILTERS);
    setQuickRange('');
  };

  const handleQuickRangeChange = (value: QuickRangeValue) => {
    setQuickRange(value);

    if (!value) {
      return;
    }

    if (value === 'custom') {
      setIsAdvancedOpen(true);
      setIsMenuOpen(false);
      window.setTimeout(() => {
        dateFromInputRef.current?.focus();
      }, 0);
      return;
    }

    const range = getQuickRangeDates(value);
    setFilters((previous) => ({
      ...previous,
      dateField: 'dueDate',
      dateFrom: range.startDate,
      dateTo: range.endDate,
    }));
  };

  const handleSave = async (payload: TransactionInput) => {
    setActionError(null);
    await saveMutation.mutateAsync(payload);
  };

  const handleDelete = async (transaction: Transaction) => {
    const approved = window.confirm(`Delete transaction for ${transaction.type} (${transaction.amount})?`);
    if (!approved) {
      return;
    }

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
        <div className="relative" ref={controlsRef}>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="block min-w-[15rem] flex-1 space-y-1">
              <span className="text-sm font-medium text-slate-700">Search</span>
              <input
                type="text"
                value={filters.searchText}
                onChange={(event) => updateFilter('searchText', event.target.value)}
                placeholder="Search by payee or description"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </label>

            <QuickRangeDropdown value={quickRange} onChange={handleQuickRangeChange} />

            <Link
              to="/settings/export?scope=filtered"
              className="rounded-lg border border-brand-300 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
            >
              Export Filtered
            </Link>

            <button
              type="button"
              onClick={() => setIsMenuOpen((previous) => !previous)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
            >
              Filters
            </button>
          </div>

          {isMenuOpen ? (
            <div className="absolute right-0 top-full z-20 mt-1 w-60 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setIsAdvancedOpen(true);
                  setIsMenuOpen(false);
                }}
                className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
              >
                Advanced Filters & Sorting
              </button>
              <button
                type="button"
                onClick={() => {
                  clearAllFilters();
                  setIsMenuOpen(false);
                }}
                className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
              >
                Clear all filters
              </button>
            </div>
          ) : null}

          <AdvancedFiltersPanel
            open={isAdvancedOpen}
            filters={filters}
            onClose={() => setIsAdvancedOpen(false)}
            onClearAll={clearAllFilters}
            onUpdateFilter={updateFilter}
            dateFromInputRef={dateFromInputRef}
          />
        </div>

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
