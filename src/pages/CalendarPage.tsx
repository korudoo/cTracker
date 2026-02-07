import { useCallback, useMemo, useState } from 'react';
import { CalendarView } from '@/components/dashboard/CalendarView';
import { useCalendar } from '@/context/CalendarContext';
import { calculateCurrentBalance } from '@/utils/balance';
import type { Account, Transaction } from '@/types/domain';
import { getAccounts, getProfile, getTransactions, runDueStatusTransition } from '@/services/transactions';
import { useQuery } from '@tanstack/react-query';

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

export function CalendarPage() {
  const { mode, setMode } = useCalendar();
  const [monthDate, setMonthDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

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

  const transactionsQuery = useQuery({
    queryKey: ['transactions', 'calendar'],
    queryFn: async () => getTransactions(),
    enabled: transitionQuery.isSuccess,
  });

  const loading =
    profileQuery.isPending ||
    accountsQuery.isPending ||
    (Boolean(profileQuery.data?.timezone) && transitionQuery.isPending) ||
    (transitionQuery.isSuccess && transactionsQuery.isPending);

  const pageError =
    profileQuery.error
      ? getErrorMessage(profileQuery.error, 'Unable to load profile.')
      : accountsQuery.error
        ? getErrorMessage(accountsQuery.error, 'Unable to load accounts.')
        : transitionQuery.error
          ? getErrorMessage(transitionQuery.error, 'Unable to run due status transition.')
          : transactionsQuery.error
            ? getErrorMessage(transactionsQuery.error, 'Unable to load calendar transactions.')
            : null;

  const accounts: Account[] = accountsQuery.data ?? [];
  const transactions: Transaction[] = transactionsQuery.data ?? [];

  const openingBalance = accounts.reduce((total, account) => total + account.openingBalance, 0);
  const currentBalance = useMemo(
    () => calculateCurrentBalance(openingBalance, transactions),
    [openingBalance, transactions],
  );

  const setAdMode = useCallback(() => setMode('AD'), [setMode]);
  const setBsMode = useCallback(() => setMode('BS'), [setMode]);

  if (loading) {
    return <div className="rounded-xl bg-white p-6 shadow-card">Loading calendar...</div>;
  }

  if (pageError) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
        <p>{pageError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Calendar</h2>
            <p className="mt-1 text-sm text-slate-500">
              View projected daily balance and open date details for transactions due on that date.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={setAdMode}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                mode === 'AD'
                  ? 'border border-brand-300 bg-brand-50 text-brand-700'
                  : 'border border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              AD
            </button>
            <button
              type="button"
              onClick={setBsMode}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                mode === 'BS'
                  ? 'border border-brand-300 bg-brand-50 text-brand-700'
                  : 'border border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              BS
            </button>
          </div>
        </div>
      </section>

      <CalendarView
        mode={mode}
        currentBalance={currentBalance}
        monthDate={monthDate}
        transactions={transactions}
        onMonthDateChange={setMonthDate}
      />
    </div>
  );
}
