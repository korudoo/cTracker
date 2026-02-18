import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarView, type CalendarMetric } from '@/components/dashboard/CalendarView';
import { WeeklyCalendar } from '@/components/dashboard/WeeklyCalendar';
import { useCalendar } from '@/context/CalendarContext';
import { calculateCurrentBalance } from '@/utils/balance';
import { fromIsoDate } from '@/utils/date';
import type { Account, Transaction } from '@/types/domain';
import { getAccounts, getProfile, getTransactions, runDueStatusTransition } from '@/services/transactions';
import { useQuery } from '@tanstack/react-query';
import { getTodayIsoInKathmandu, isIsoDate } from '@/utils/transactionStatus';

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
  const [searchParams] = useSearchParams();
  const { calendarPreference } = useCalendar();
  const [monthDate, setMonthDate] = useState(() => fromIsoDate(getTodayIsoInKathmandu()));
  const [metric, setMetric] = useState<CalendarMetric>('projectedBalance');
  const [appliedDeepLinkIso, setAppliedDeepLinkIso] = useState<string | null>(null);

  const deepLinkDateIso = useMemo(() => {
    const dateParam = searchParams.get('date');
    return dateParam && isIsoDate(dateParam) ? dateParam : null;
  }, [searchParams]);

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

  const setProjectedMetric = useCallback(() => setMetric('projectedBalance'), []);
  const setTotalChequesMetric = useCallback(() => setMetric('totalCheques'), []);
  const setClearedBalanceMetric = useCallback(() => setMetric('clearedBalance'), []);
  const metricLabel =
    metric === 'projectedBalance'
      ? 'Projected Balance'
      : metric === 'totalCheques'
        ? 'Total Cheques'
        : 'Cleared Balance';

  useEffect(() => {
    if (!deepLinkDateIso || deepLinkDateIso === appliedDeepLinkIso) {
      return;
    }

    const [yearPart, monthPart, dayPart] = deepLinkDateIso.split('-').map(Number);
    setMonthDate(new Date(yearPart, monthPart - 1, dayPart));
    setAppliedDeepLinkIso(deepLinkDateIso);
  }, [appliedDeepLinkIso, deepLinkDateIso]);

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
    <div className="space-y-3 sm:space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-card sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Calendar</h2>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={setProjectedMetric}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium sm:px-3 sm:text-sm ${
                  metric === 'projectedBalance'
                    ? 'border border-brand-300 bg-brand-50 text-brand-700'
                    : 'border border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="sm:hidden">Projected</span>
                <span className="hidden sm:inline">Projected Balance</span>
              </button>
              <button
                type="button"
                onClick={setTotalChequesMetric}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium sm:px-3 sm:text-sm ${
                  metric === 'totalCheques'
                    ? 'border border-brand-300 bg-brand-50 text-brand-700'
                    : 'border border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="sm:hidden">Cheques</span>
                <span className="hidden sm:inline">Total Cheques</span>
              </button>
              <button
                type="button"
                onClick={setClearedBalanceMetric}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium sm:px-3 sm:text-sm ${
                  metric === 'clearedBalance'
                    ? 'border border-brand-300 bg-brand-50 text-brand-700'
                    : 'border border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="sm:hidden">Cleared</span>
                <span className="hidden sm:inline">Cleared Balance</span>
              </button>
            </div>
            <p className="text-xs text-slate-600 sm:text-sm">
              Showing: <span className="font-medium text-slate-800">{metricLabel}</span>
            </p>
          </div>
        </div>
      </section>

      <CalendarView
        mode={calendarPreference}
        metric={metric}
        openingBalance={openingBalance}
        currentBalance={currentBalance}
        monthDate={monthDate}
        transactions={transactions}
        onMonthDateChange={setMonthDate}
        deepLinkDateIso={deepLinkDateIso}
      />

      <WeeklyCalendar
        mode={calendarPreference}
        metric={metric}
        openingBalance={openingBalance}
        currentBalance={currentBalance}
        transactions={transactions}
      />
    </div>
  );
}
