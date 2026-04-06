import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { useCalendar } from '@/context/CalendarContext';
import {
  getAccounts,
  getTransactionById,
  updateTransaction,
} from '@/services/transactions';
import type { TransactionInput } from '@/types/domain';

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function getReturnToPath(state: unknown): string {
  if (
    typeof state === 'object' &&
    state !== null &&
    'returnTo' in state &&
    typeof (state as { returnTo?: unknown }).returnTo === 'string'
  ) {
    return (state as { returnTo: string }).returnTo;
  }

  return '/transactions';
}

export function EditTransactionPage() {
  const { transactionId } = useParams<{ transactionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { mode } = useCalendar();
  const [actionError, setActionError] = useState<string | null>(null);
  const returnTo = getReturnToPath(location.state);

  const accountsQuery = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  });

  const transactionQuery = useQuery({
    queryKey: ['transaction', transactionId],
    queryFn: async () => {
      if (!transactionId) {
        throw new Error('Transaction id is missing.');
      }

      return getTransactionById(transactionId);
    },
    enabled: Boolean(transactionId),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: TransactionInput) => {
      if (!transactionId) {
        throw new Error('Transaction id is missing.');
      }

      return updateTransaction(transactionId, payload);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transaction', transactionId] }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['cheques'] }),
        queryClient.invalidateQueries({ queryKey: ['accounts'] }),
      ]);
      setActionError(null);
      navigate(returnTo, { replace: true });
    },
    onError: (error: unknown) => {
      setActionError(getErrorMessage(error, 'Unable to save transaction.'));
    },
  });

  const isLoadingInitial = accountsQuery.isPending || transactionQuery.isPending;
  const pageError =
    actionError ??
    (!transactionId
      ? 'Transaction id is missing.'
      : accountsQuery.error
        ? getErrorMessage(accountsQuery.error, 'Unable to load accounts.')
        : transactionQuery.error
          ? getErrorMessage(transactionQuery.error, 'Unable to load transaction.')
          : null);

  if (isLoadingInitial) {
    return <div className="rounded-xl bg-white p-6 shadow-card">Loading transaction...</div>;
  }

  if (pageError || !transactionQuery.data) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {pageError ?? 'Transaction was not found.'}
        </div>
        <button
          type="button"
          onClick={() => navigate(returnTo, { replace: true })}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
        >
          Back to Transactions
        </button>
      </div>
    );
  }

  return (
    <TransactionForm
      accounts={accountsQuery.data ?? []}
      calendarMode={mode}
      initialTransaction={transactionQuery.data}
      isSaving={saveMutation.isPending}
      onSubmit={async (payload) => {
        setActionError(null);
        await saveMutation.mutateAsync(payload);
      }}
      onCancelEdit={() => navigate(returnTo)}
    />
  );
}
