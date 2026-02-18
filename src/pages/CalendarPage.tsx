import { useCallback, useMemo, useState } from 'react';
import { CalendarView, type CalendarMetric } from '@/components/dashboard/CalendarView';
import { useCalendar } from '@/context/CalendarContext';
import { calculateCurrentBalance } from '@/utils/balance';
import type { Account, Transaction } from '@/types/domain';
import { getAccounts, getProfile, getTransactions, runDueStatusTransition } from '@/services/transactions';
import { useQuery } from '@tanstack/react-query';

const EMPTY_ACCOUNTS: Account[] = [];
const EMPTY_TRANSACTIONS: Transaction[] = [];

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
  const { calendarPreference, setCalendarPreference } = useCalendar();
  const [monthDate, setMonthDate] = useState(new Date());
  const [metric, setMetric] = useState<CalendarMetric>('projectedBalance');

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

  const accounts = accountsQuery.data ?? EMPTY_ACCOUNTS;
  const transactions = transactionsQuery.data ?? EMPTY_TRANSACTIONS;

  const openingBalance = accounts.reduce((total, account) => total + account.openingBalance, 0);
  const currentBalance = useMemo(
    () => calculateCurrentBalance(openingBalance, transactions),
    [openingBalance, transactions],
  );

  const setAdMode = useCallback(() => setCalendarPreference('AD'), [setCalendarPreference]);
  const setBsMode = useCallback(() => setCalendarPreference('BS'), [setCalendarPreference]);
  const setProjectedMetric = useCallback(() => setMetric('projectedBalance'), []);
  const setTotalChequesMetric = useCallback(() => setMetric('totalCheques'), []);

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
              View projected daily balance or total cheque amount due by date, then open date details.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={setAdMode}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  calendarPreference === 'AD'
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
                  calendarPreference === 'BS'
                    ? 'border border-brand-300 bg-brand-50 text-brand-700'
                    : 'border border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                BS
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={setProjectedMetric}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  metric === 'projectedBalance'
                    ? 'border border-brand-300 bg-brand-50 text-brand-700'
                    : 'border border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Projected Balance
              </button>
              <button
                type="button"
                onClick={setTotalChequesMetric}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  metric === 'totalCheques'
                    ? 'border border-brand-300 bg-brand-50 text-brand-700'
                    : 'border border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Total Cheques
              </button>
            </div>
          </div>
        </div>
      </section>

      <CalendarView
        mode={calendarPreference}
        metric={metric}
        currentBalance={currentBalance}
        monthDate={monthDate}
        transactions={transactions}
        onMonthDateChange={setMonthDate}
      />
    </div>
  );
}
