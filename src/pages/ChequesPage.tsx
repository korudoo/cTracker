import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TableSortHeader } from '@/components/common/TableSortHeader';
import { useCalendar } from '@/context/CalendarContext';
import {
  getAccounts,
  getChequesForAccount,
  getProfile,
  runDueStatusTransition,
  updateChequeStatus,
} from '@/services/transactions';
import type { Transaction, TransactionStatus } from '@/types/domain';
import { formatDateForMode } from '@/utils/nepaliDate';
import { getTodayIsoInKathmandu, getTransactionStatusLabel } from '@/utils/transactionStatus';

type ChequeView = 'past' | 'future' | 'all' | 'cleared';
type SortDirection = 'asc' | 'desc';
type ChequeSortKey = 'chequeNumber' | 'dueDate' | 'amount' | 'status';

interface ToastState {
  tone: 'success' | 'error';
  text: string;
}

interface StatusMutationPayload {
  transactionId: string;
  nextStatus: Extract<TransactionStatus, 'deducted' | 'cleared'>;
}

function parseChequeView(value: string | null): ChequeView {
  if (value === 'past' || value === 'future' || value === 'all' || value === 'cleared') {
    return value;
  }

  return 'all';
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return fallback;
}

function formatAmount(value: number): string {
  return `NPR ${value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function getStatusPillClass(status: TransactionStatus): string {
  if (status === 'cleared') {
    return 'border border-emerald-300 bg-emerald-100 text-emerald-800';
  }
  if (status === 'deducted') {
    return 'border border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  return 'border border-amber-200 bg-amber-50 text-amber-700';
}

function getEffectiveChequeStatus(
  transaction: Transaction,
  todayIso: string,
  coercePendingPastToDeducted: boolean,
): TransactionStatus {
  if (coercePendingPastToDeducted && transaction.dueDate <= todayIso && transaction.status === 'pending') {
    return 'deducted';
  }

  return transaction.status;
}

function getComparableStatusValue(status: TransactionStatus): number {
  if (status === 'pending') return 0;
  if (status === 'deducted') return 1;
  return 2;
}

function filterChequesForView(cheques: Transaction[], view: ChequeView, todayIso: string): Transaction[] {
  return cheques.filter((transaction) => {
    if (view === 'cleared') {
      return transaction.status === 'cleared';
    }

    if (transaction.status === 'cleared') {
      return false;
    }

    if (view === 'past') {
      return transaction.dueDate <= todayIso;
    }

    if (view === 'future') {
      return transaction.dueDate >= todayIso;
    }

    return true;
  });
}

export function ChequesPage() {
  const [searchParams] = useSearchParams();
  const { mode } = useCalendar();
  const queryClient = useQueryClient();
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [view, setView] = useState<ChequeView>(() => parseChequeView(searchParams.get('view')));
  const [sortKey, setSortKey] = useState<ChequeSortKey>('dueDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [toast, setToast] = useState<ToastState | null>(null);
  const todayIso = getTodayIsoInKathmandu();
  const requestedView = parseChequeView(searchParams.get('view'));
  const lastAppliedRequestedView = useRef(requestedView);

  useEffect(() => {
    if (requestedView === lastAppliedRequestedView.current) {
      return;
    }

    lastAppliedRequestedView.current = requestedView;
    setView(requestedView);
  }, [requestedView]);

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

  const accounts = accountsQuery.data ?? [];

  useEffect(() => {
    if (!accounts.length) {
      if (selectedAccountId) {
        setSelectedAccountId('');
      }
      return;
    }

    const hasSelected = accounts.some((account) => account.id === selectedAccountId);
    if (hasSelected) {
      return;
    }

    const defaultAccountId = accounts.find((account) => account.isDefault)?.id ?? accounts[0]?.id ?? '';
    setSelectedAccountId(defaultAccountId);
  }, [accounts, selectedAccountId]);

  const chequesQuery = useQuery({
    queryKey: ['cheques', selectedAccountId],
    queryFn: async () => getChequesForAccount(selectedAccountId),
    enabled: Boolean(selectedAccountId) && transitionQuery.isSuccess,
  });

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setToast(null);
    }, 3000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [toast]);

  const statusMutation = useMutation({
    mutationFn: async (payload: StatusMutationPayload) =>
      updateChequeStatus(payload.transactionId, payload.nextStatus),
    onMutate: async (payload) => {
      const accountId = selectedAccountId;
      await queryClient.cancelQueries({ queryKey: ['cheques', accountId] });
      const previous = queryClient.getQueryData<Transaction[]>(['cheques', accountId]) ?? [];

      queryClient.setQueryData<Transaction[]>(['cheques', accountId], (current) =>
        (current ?? []).map((transaction) =>
          transaction.id === payload.transactionId
            ? {
                ...transaction,
                status: payload.nextStatus,
              }
            : transaction,
        ),
      );

      return { previous, accountId };
    },
    onError: (error, _payload, context) => {
      const accountId = context?.accountId ?? selectedAccountId;
      if (context?.previous) {
        queryClient.setQueryData(['cheques', accountId], context.previous);
      }
      setToast({
        tone: 'error',
        text: getErrorMessage(error, 'Unable to update cheque status.'),
      });
    },
    onSuccess: (transaction) => {
      const label = getTransactionStatusLabel('cheque', transaction.status);
      setToast({
        tone: 'success',
        text: `Status updated to ${label}.`,
      });
    },
    onSettled: async (_data, _error, _payload, context) => {
      const accountId = context?.accountId ?? selectedAccountId;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['cheques', accountId] }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      ]);
    },
  });

  const isLoadingInitial =
    profileQuery.isPending ||
    accountsQuery.isPending ||
    (Boolean(profileQuery.data?.timezone) && transitionQuery.isPending) ||
    (transitionQuery.isSuccess && Boolean(selectedAccountId) && chequesQuery.isPending);

  const pageError =
    profileQuery.error
      ? getErrorMessage(profileQuery.error, 'Unable to load profile.')
      : accountsQuery.error
        ? getErrorMessage(accountsQuery.error, 'Unable to load accounts.')
        : transitionQuery.error
          ? getErrorMessage(transitionQuery.error, 'Unable to run due status transition.')
          : chequesQuery.error
            ? getErrorMessage(chequesQuery.error, 'Unable to load cheques.')
            : null;

  const filteredCheques = useMemo(
    () => filterChequesForView(chequesQuery.data ?? [], view, todayIso),
    [chequesQuery.data, todayIso, view],
  );

  const sortedCheques = useMemo(() => {
    const toSorted = [...filteredCheques];

    toSorted.sort((left, right) => {
      const leftEffectiveStatus = getEffectiveChequeStatus(left, todayIso, view !== 'future');
      const rightEffectiveStatus = getEffectiveChequeStatus(right, todayIso, view !== 'future');

      let compareValue = 0;

      if (sortKey === 'chequeNumber') {
        compareValue = (left.chequeNumber ?? '').localeCompare(right.chequeNumber ?? '', undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      } else if (sortKey === 'dueDate') {
        compareValue = left.dueDate.localeCompare(right.dueDate);
      } else if (sortKey === 'amount') {
        compareValue = left.amount - right.amount;
      } else if (sortKey === 'status') {
        compareValue =
          getComparableStatusValue(leftEffectiveStatus) - getComparableStatusValue(rightEffectiveStatus);
      }

      if (compareValue === 0) {
        compareValue = left.dueDate.localeCompare(right.dueDate);
      }
      if (compareValue === 0) {
        compareValue = (left.chequeNumber ?? '').localeCompare(right.chequeNumber ?? '', undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      }

      return sortDirection === 'asc' ? compareValue : -compareValue;
    });

    return toSorted;
  }, [filteredCheques, sortDirection, sortKey, todayIso, view]);

  const handleSort = (nextSortKey: ChequeSortKey) => {
    if (nextSortKey === sortKey) {
      setSortDirection((previous) => (previous === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(nextSortKey);
    setSortDirection('asc');
  };

  const canToggleStatus = (transaction: Transaction): boolean => {
    if (view === 'future') {
      return false;
    }

    if (view === 'cleared') {
      return true;
    }

    return transaction.dueDate <= todayIso;
  };

  const handleStatusToggle = async (transaction: Transaction) => {
    if (!canToggleStatus(transaction)) {
      return;
    }

    const activeMutationTransactionId = statusMutation.variables?.transactionId;
    if (statusMutation.isPending && activeMutationTransactionId === transaction.id) {
      return;
    }

    const effectiveStatus = getEffectiveChequeStatus(transaction, todayIso, true);
    const nextStatus: Extract<TransactionStatus, 'deducted' | 'cleared'> =
      effectiveStatus === 'cleared' ? 'deducted' : 'cleared';

    await statusMutation.mutateAsync({
      transactionId: transaction.id,
      nextStatus,
    });
  };

  if (isLoadingInitial) {
    return <div className="rounded-xl bg-white p-6 shadow-card">Loading cheques...</div>;
  }

  if (pageError) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
        <p>{pageError}</p>
      </div>
    );
  }

  if (!accounts.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
        <h2 className="text-lg font-semibold text-slate-900">Cheques</h2>
        <p className="mt-2 text-sm text-slate-500">No accounts found. Create an account first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {toast ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            toast.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
          role="status"
          aria-live="polite"
        >
          {toast.text}
        </div>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Cheques</h2>
          </div>

          <label className="block min-w-56 space-y-1">
            <span className="text-sm font-medium text-slate-700">Account</span>
            <select
              value={selectedAccountId}
              onChange={(event) => setSelectedAccountId(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 inline-flex rounded-lg border border-slate-300 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setView('past')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              view === 'past' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Past
          </button>
          <button
            type="button"
            onClick={() => setView('future')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              view === 'future' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Future
          </button>
          <button
            type="button"
            onClick={() => setView('all')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              view === 'all' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setView('cleared')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              view === 'cleared' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Cleared
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-slate-500">{sortedCheques.length} cheques</p>
          <p className="text-xs text-slate-500">Today (Asia/Kathmandu): {todayIso}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <TableSortHeader
                  label="Cheque Number"
                  sortKey="chequeNumber"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onToggle={handleSort}
                />
                <TableSortHeader
                  label="Cheque Date"
                  sortKey="dueDate"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onToggle={handleSort}
                />
                <th className="py-2 pr-4 font-medium">Payee</th>
                <TableSortHeader
                  label="Cheque Amount"
                  sortKey="amount"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onToggle={handleSort}
                />
                <TableSortHeader
                  label="Status"
                  sortKey="status"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onToggle={handleSort}
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedCheques.map((transaction) => {
                const isEditable = canToggleStatus(transaction);
                const activeStatus = getEffectiveChequeStatus(transaction, todayIso, isEditable);
                const pendingForSameRow =
                  statusMutation.isPending && statusMutation.variables?.transactionId === transaction.id;

                return (
                  <tr key={transaction.id}>
                    <td className="py-3 pr-4 text-slate-700">{transaction.chequeNumber ?? '—'}</td>
                    <td className="py-3 pr-4 text-slate-700">{formatDateForMode(transaction.dueDate, mode)}</td>
                    <td className="py-3 pr-4 text-slate-700">{transaction.payee ?? '—'}</td>
                    <td className="py-3 pr-4 font-semibold text-slate-900">{formatAmount(transaction.amount)}</td>
                    <td className="py-3 pr-4">
                      {isEditable ? (
                        <button
                          type="button"
                          onClick={() => void handleStatusToggle(transaction)}
                          disabled={pendingForSameRow}
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusPillClass(activeStatus)} ${
                            pendingForSameRow ? 'cursor-wait opacity-70' : ''
                          }`}
                          aria-label={`Toggle status. Current ${getTransactionStatusLabel('cheque', activeStatus)}.`}
                          title="Tap to toggle deducted/cleared"
                        >
                          {getTransactionStatusLabel('cheque', activeStatus)}
                        </button>
                      ) : (
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusPillClass(
                            activeStatus,
                          )}`}
                        >
                          {getTransactionStatusLabel('cheque', activeStatus)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!sortedCheques.length ? (
          <p className="py-6 text-center text-sm text-slate-500">No cheques found for this view.</p>
        ) : null}
      </section>
    </div>
  );
}
