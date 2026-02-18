import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ListFilter,
  Receipt,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useCalendar } from '@/context/CalendarContext';
import {
  getAccounts,
  getProfile,
  getTransactions,
  runDueStatusTransition,
  updateChequeStatus,
} from '@/services/transactions';
import type { Account, Transaction, TransactionStatus, TransactionType } from '@/types/domain';
import { calculateProjectedBalancesForRange, computeClearedBalancesByDate } from '@/utils/balanceProjection';
import { calculateCurrentBalance } from '@/utils/balance';
import { formatAdDate, fromIsoDate, toIsoDate } from '@/utils/date';
import { formatBsDateDayMonthYearFromAd } from '@/utils/nepaliDate';
import { detectNegativeRisk, next7DaysSummary, topInflowsOutflows } from '@/utils/dashboard';
import { getTodayIsoInKathmandu } from '@/utils/transactionStatus';
import { getCalendarDateTotals, getTransactionsForDate } from '@/utils/calendarDay';

interface ToastState {
  tone: 'success' | 'error';
  text: string;
}

interface AttentionStatusPayload {
  transactionId: string;
  nextStatus: Extract<TransactionStatus, 'deducted' | 'cleared'>;
}

interface QuickActionItem {
  label: string;
  description: string;
  to: string;
  icon: LucideIcon;
}

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

function addDays(dateIso: string, days: number): string {
  const date = fromIsoDate(dateIso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

function formatNpr(value: number, options?: { showPlusForPositive?: boolean }): string {
  const absolute = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  if (value < 0) {
    return `-NPR ${absolute}`;
  }

  if (options?.showPlusForPositive && value > 0) {
    return `+NPR ${absolute}`;
  }

  return `NPR ${absolute}`;
}

function formatDateForPreference(dateIso: string, calendarPreference: 'AD' | 'BS'): string {
  if (calendarPreference === 'BS') {
    return formatBsDateDayMonthYearFromAd(dateIso) || formatAdDate(dateIso);
  }

  return formatAdDate(dateIso);
}

function formatWeekdayDate(dateIso: string, calendarPreference: 'AD' | 'BS'): string {
  const weekday = fromIsoDate(dateIso).toLocaleDateString('en-US', { weekday: 'short' });
  return `${weekday}, ${formatDateForPreference(dateIso, calendarPreference)}`;
}

function getTransactionLabel(transaction: Transaction): string {
  if (transaction.type === 'cheque') {
    return transaction.payee ?? transaction.chequeNumber ?? 'Cheque';
  }

  return transaction.description ?? transaction.referenceNumber ?? transaction.accountName;
}

function getTransactionAmount(transaction: Transaction): number {
  return transaction.type === 'deposit' ? transaction.amount : -transaction.amount;
}

function getTransactionTypeIcon(type: TransactionType) {
  if (type === 'deposit') {
    return ArrowDownLeft;
  }

  return ArrowUpRight;
}

function getTransactionTypeTone(type: TransactionType): string {
  return type === 'deposit' ? 'text-emerald-700' : 'text-rose-700';
}

export function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { calendarPreference } = useCalendar();
  const [toast, setToast] = useState<ToastState | null>(null);
  const todayIso = getTodayIsoInKathmandu();
  const nextSevenEndIso = addDays(todayIso, 6);
  const horizonEndIso = addDays(todayIso, 30);

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
    queryKey: ['transactions', 'dashboard'],
    queryFn: async () => getTransactions(),
    enabled: transitionQuery.isSuccess,
  });

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setToast(null);
    }, 2600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [toast]);

  useEffect(() => {
    const profile = profileQuery.data;
    if (!profile?.notificationsEnabled || typeof Notification === 'undefined') {
      return;
    }

    if (Notification.permission === 'default') {
      void Notification.requestPermission();
      return;
    }

    if (Notification.permission !== 'granted') {
      return;
    }

    const dueTodayCount = (transactionsQuery.data ?? []).filter(
      (transaction) => transaction.dueDate === todayIso,
    ).length;

    if (dueTodayCount > 0) {
      new Notification(`Cheque Tracker: ${dueTodayCount} due item(s) today.`);
    }
  }, [profileQuery.data, todayIso, transactionsQuery.data]);

  const attentionMutation = useMutation({
    mutationFn: async (payload: AttentionStatusPayload) =>
      updateChequeStatus(payload.transactionId, payload.nextStatus),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ['transactions', 'dashboard'] });
      const previousTransactions =
        queryClient.getQueryData<Transaction[]>(['transactions', 'dashboard']) ?? [];

      queryClient.setQueryData<Transaction[]>(
        ['transactions', 'dashboard'],
        (current) =>
          (current ?? [])
            .map((transaction) =>
              transaction.id === payload.transactionId
                ? {
                    ...transaction,
                    status: payload.nextStatus,
                  }
                : transaction,
            ),
      );

      return {
        previousTransactions,
      };
    },
    onError: (error, _payload, context) => {
      if (context?.previousTransactions) {
        queryClient.setQueryData(['transactions', 'dashboard'], context.previousTransactions);
      }

      setToast({
        tone: 'error',
        text: getErrorMessage(error, 'Unable to update cheque status.'),
      });
    },
    onSuccess: () => {
      setToast({
        tone: 'success',
        text: 'Cheque marked as cleared.',
      });
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transactions', 'dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['cheques'] }),
      ]);
    },
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
            ? getErrorMessage(transactionsQuery.error, 'Unable to load dashboard data.')
            : null;

  const accounts = accountsQuery.data ?? EMPTY_ACCOUNTS;
  const transactions = transactionsQuery.data ?? EMPTY_TRANSACTIONS;
  const openingBalance = accounts.reduce((total, account) => total + account.openingBalance, 0);
  const currentBalance = useMemo(
    () => calculateCurrentBalance(openingBalance, transactions),
    [openingBalance, transactions],
  );

  const projection = useMemo(
    () =>
      calculateProjectedBalancesForRange({
        currentBalance,
        transactions,
        startDate: todayIso,
        endDate: horizonEndIso,
      }),
    [currentBalance, horizonEndIso, todayIso, transactions],
  );

  const clearedBalanceByDate = useMemo(
    () => computeClearedBalancesByDate(todayIso, horizonEndIso, openingBalance, transactions),
    [horizonEndIso, openingBalance, todayIso, transactions],
  );
  const clearedBalanceToday = clearedBalanceByDate[todayIso] ?? currentBalance;

  const nextSevenSummary = useMemo(() => next7DaysSummary(projection.days), [projection.days]);
  const todaySummary = nextSevenSummary.find((day) => day.date === todayIso) ?? nextSevenSummary[0];
  const todayTransactions = useMemo(
    () => getTransactionsForDate(transactions, todayIso),
    [todayIso, transactions],
  );
  const todayTotals = useMemo(() => getCalendarDateTotals(todayTransactions), [todayTransactions]);
  const netMovementToday = todayTotals.deposits - todayTotals.deductions;
  const risk = useMemo(() => detectNegativeRisk(nextSevenSummary), [nextSevenSummary]);

  const highestDeduction = Math.max(...nextSevenSummary.map((day) => day.deductions), 0);
  const largeDeductionThreshold = highestDeduction > 0 ? highestDeduction * 0.7 : Number.POSITIVE_INFINITY;

  const topFlows = useMemo(
    () => topInflowsOutflows(transactions, todayIso, nextSevenEndIso, 5),
    [nextSevenEndIso, todayIso, transactions],
  );

  const attentionCheques = useMemo(
    () =>
      transactions
        .filter(
          (transaction) =>
            transaction.type === 'cheque' &&
            transaction.status === 'deducted' &&
            transaction.dueDate <= todayIso,
        )
        .sort((left, right) => left.dueDate.localeCompare(right.dueDate)),
    [todayIso, transactions],
  );

  const overduePending = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          transaction.status === 'pending' &&
          transaction.dueDate < todayIso &&
          (transaction.type === 'deposit' || transaction.type === 'withdrawal'),
      ),
    [todayIso, transactions],
  );

  const inconsistentOverdueItems = useMemo(
    () =>
      overduePending.filter(
        (transaction) =>
          transaction.dueDate < todayIso &&
          (transaction.type === 'deposit' || transaction.type === 'withdrawal'),
      ),
    [overduePending, todayIso],
  );

  const hasAttentionItems = attentionCheques.length > 0 || inconsistentOverdueItems.length > 0;

  const quickActions: QuickActionItem[] = [
    {
      label: 'Add Cheque',
      description: 'Create cheque entry',
      to: '/transactions?type=cheque',
      icon: Receipt,
    },
    {
      label: 'Add Deposit',
      description: 'Record incoming funds',
      to: '/transactions?type=deposit',
      icon: ArrowDownLeft,
    },
    {
      label: 'Add Withdrawal',
      description: 'Record outflow',
      to: '/transactions?type=withdrawal',
      icon: ArrowUpRight,
    },
    {
      label: 'Jump to Today',
      description: 'Open today in calendar',
      to: `/calendar?date=${todayIso}`,
      icon: CalendarDays,
    },
    {
      label: 'Search Transactions',
      description: 'Open quick search',
      to: '/transactions?focus=search',
      icon: ListFilter,
    },
    {
      label: 'Cheques (Past)',
      description: 'Review archive candidates',
      to: '/cheques?view=past',
      icon: WalletCards,
    },
  ];

  if (loading) {
    return <div className="rounded-xl bg-white p-6 shadow-card">Loading dashboard...</div>;
  }

  if (pageError) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
        <p>{pageError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-2">
      {toast ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
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

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Today | {formatWeekdayDate(todayIso, calendarPreference)}
        </p>
        <p className="mt-2 text-sm font-medium text-slate-600">Projected Balance</p>
        <p
          className={`mt-1 text-3xl font-semibold leading-tight ${
            (todaySummary?.projectedBalance ?? currentBalance) >= 0 ? 'text-slate-900' : 'text-rose-700'
          }`}
        >
          {formatNpr(todaySummary?.projectedBalance ?? currentBalance)}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
            Cleared: {formatNpr(clearedBalanceToday)}
          </span>
          {netMovementToday !== 0 ? (
            <span
              className={`rounded-full px-2.5 py-1 font-medium ${
                netMovementToday > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
              }`}
            >
              Net today: {formatNpr(netMovementToday, { showPlusForPositive: true })}
            </span>
          ) : null}
        </div>

        <div
          className={`mt-3 rounded-xl border px-3 py-2 text-sm ${
            risk.hasRisk
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {risk.hasRisk ? (
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-semibold">Risk of negative balance</p>
                <p className="mt-0.5 text-xs">
                  Earliest: {risk.earliestNegativeDate ? formatDateForPreference(risk.earliestNegativeDate, calendarPreference) : '-'} | Low:{' '}
                  {risk.minProjected !== null ? formatNpr(risk.minProjected) : '-'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              <p className="font-semibold">Safe for 7 days</p>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">Next 7 Days</h2>
        <div className="mt-3 space-y-2">
          {nextSevenSummary.map((day) => {
            const isNegative = day.projectedBalance < 0;
            const hasLargeDeductions =
              day.deductions > 0 && day.deductions >= largeDeductionThreshold;

            return (
              <button
                key={day.date}
                type="button"
                onClick={() => navigate(`/calendar?date=${day.date}`)}
                className={`w-full rounded-xl border px-3 py-2.5 text-left transition hover:bg-slate-50 ${
                  isNegative
                    ? 'border-rose-300 bg-rose-50/70'
                    : hasLargeDeductions
                      ? 'border-amber-300 bg-amber-50/70'
                      : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {formatWeekdayDate(day.date, calendarPreference)}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">
                        + {formatNpr(day.deposits)}
                      </span>
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-700">
                        - {formatNpr(day.deductions)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <p
                      className={`text-sm font-semibold ${
                        day.projectedBalance >= 0 ? 'text-slate-900' : 'text-rose-700'
                      }`}
                    >
                      {formatNpr(day.projectedBalance)}
                    </p>
                    <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
          <h3 className="text-sm font-semibold text-slate-900">Biggest Outflows (7d)</h3>
          {topFlows.outflows.length ? (
            <ul className="mt-3 space-y-2">
              {topFlows.outflows.map((transaction) => {
                const Icon = getTransactionTypeIcon(transaction.type);

                return (
                  <li key={transaction.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/calendar?date=${transaction.dueDate}`)}
                      className="flex min-h-11 w-full items-start justify-between gap-2 rounded-xl border border-slate-200 px-2.5 py-2 text-left hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">{getTransactionLabel(transaction)}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="text-xs text-slate-500">
                            {formatDateForPreference(transaction.dueDate, calendarPreference)}
                          </span>
                          <StatusBadge status={transaction.status} type={transaction.type} />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <Icon className={`ml-auto h-4 w-4 ${getTransactionTypeTone(transaction.type)}`} aria-hidden="true" />
                        <p className={`mt-1 text-sm font-semibold ${getTransactionTypeTone(transaction.type)}`}>
                          {formatNpr(getTransactionAmount(transaction))}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No upcoming outflows in the next 7 days.</p>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
          <h3 className="text-sm font-semibold text-slate-900">Biggest Inflows (7d)</h3>
          {topFlows.inflows.length ? (
            <ul className="mt-3 space-y-2">
              {topFlows.inflows.map((transaction) => {
                const Icon = getTransactionTypeIcon(transaction.type);

                return (
                  <li key={transaction.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/calendar?date=${transaction.dueDate}`)}
                      className="flex min-h-11 w-full items-start justify-between gap-2 rounded-xl border border-slate-200 px-2.5 py-2 text-left hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">{getTransactionLabel(transaction)}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="text-xs text-slate-500">
                            {formatDateForPreference(transaction.dueDate, calendarPreference)}
                          </span>
                          <StatusBadge status={transaction.status} type={transaction.type} />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <Icon className={`ml-auto h-4 w-4 ${getTransactionTypeTone(transaction.type)}`} aria-hidden="true" />
                        <p className={`mt-1 text-sm font-semibold ${getTransactionTypeTone(transaction.type)}`}>
                          {formatNpr(getTransactionAmount(transaction))}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No upcoming inflows in the next 7 days.</p>
          )}
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">Needs Attention</h2>

        {hasAttentionItems ? (
          <div className="mt-3 space-y-3">
            {attentionCheques.length ? (
              <article className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                  Deducted Cheques Not Cleared
                </p>
                <ul className="mt-2 space-y-2">
                  {attentionCheques.slice(0, 5).map((transaction) => {
                    const isUpdating =
                      attentionMutation.isPending &&
                      attentionMutation.variables?.transactionId === transaction.id;

                    return (
                      <li
                        key={transaction.id}
                        className="flex min-h-11 items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">{getTransactionLabel(transaction)}</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {formatDateForPreference(transaction.dueDate, calendarPreference)} | {formatNpr(transaction.amount)}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() =>
                            void attentionMutation.mutateAsync({
                              transactionId: transaction.id,
                              nextStatus: transaction.status === 'cleared' ? 'deducted' : 'cleared',
                            })
                          }
                          className="shrink-0 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-60"
                        >
                          {isUpdating ? 'Saving...' : 'Mark Cleared'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </article>
            ) : null}

            {inconsistentOverdueItems.length ? (
              <article className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
                  Overdue Pending Items
                </p>
                <ul className="mt-2 space-y-1.5">
                  {inconsistentOverdueItems.slice(0, 4).map((transaction) => (
                    <li key={transaction.id} className="flex items-center gap-2 text-sm text-rose-700">
                      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">
                        {transaction.type} | {getTransactionLabel(transaction)} |{' '}
                        {formatDateForPreference(transaction.dueDate, calendarPreference)}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            ) : null}
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              <p className="font-medium">All caught up</p>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">Quick Actions</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.label}
                to={action.to}
                className="min-h-[78px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 transition hover:bg-slate-100"
              >
                <Icon className="h-5 w-5 text-brand-700" aria-hidden="true" />
                <p className="mt-2 text-sm font-semibold text-slate-900">{action.label}</p>
                <p className="mt-0.5 text-xs text-slate-500">{action.description}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
