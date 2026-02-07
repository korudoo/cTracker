import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Transaction } from '@/types/domain';
import { calculateProjectedBalancesForRange } from '@/utils/balanceProjection';
import { formatAdDate, fromIsoDate, toIsoDate } from '@/utils/date';

type RangeMode = 'currentMonth' | 'custom';

interface StatisticsDashboardProps {
  currentBalance: number;
  allTransactions: Transaction[];
  rangeTransactions: Transaction[];
  rangeMode: RangeMode;
  rangeStartDate: string;
  rangeEndDate: string;
  customStartDate: string;
  customEndDate: string;
  loading: boolean;
  error: string | null;
  onRangeModeChange: (mode: RangeMode) => void;
  onCustomStartDateChange: (dateIso: string) => void;
  onCustomEndDateChange: (dateIso: string) => void;
}

function addDays(dateIso: string, days: number): string {
  const date = fromIsoDate(dateIso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

function currency(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'NPR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function compactCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'NPR',
    notation: 'compact',
    maximumFractionDigits: 1,
  });
}

function shortAdLabel(dateIso: string): string {
  return fromIsoDate(dateIso).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
  });
}

function monthKeyToLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
  });
}

export function StatisticsDashboard({
  currentBalance,
  allTransactions,
  rangeTransactions,
  rangeMode,
  rangeStartDate,
  rangeEndDate,
  customStartDate,
  customEndDate,
  loading,
  error,
  onRangeModeChange,
  onCustomStartDateChange,
  onCustomEndDateChange,
}: StatisticsDashboardProps) {
  const cards = useMemo(() => {
    const cheques = rangeTransactions.filter((transaction) => transaction.type === 'cheque');
    const deposits = rangeTransactions.filter((transaction) => transaction.type === 'deposit');
    const withdrawals = rangeTransactions.filter((transaction) => transaction.type === 'withdrawal');

    const totalCheques = cheques.reduce((sum, transaction) => sum + transaction.amount, 0);
    const totalDeposits = deposits
      .filter((transaction) => transaction.status === 'pending' || transaction.status === 'cleared')
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const totalWithdrawals = withdrawals.reduce((sum, transaction) => sum + transaction.amount, 0);

    const averageChequeAmount = cheques.length ? totalCheques / cheques.length : 0;
    const highestChequeAmount = cheques.length
      ? Math.max(...cheques.map((transaction) => transaction.amount))
      : 0;

    const totalPendingAmount = rangeTransactions
      .filter(
        (transaction) =>
          transaction.status === 'pending' &&
          (transaction.type === 'cheque' || transaction.type === 'withdrawal'),
      )
      .reduce((sum, transaction) => sum + transaction.amount, 0);

    const totalDeductedAwaitingClearance = rangeTransactions
      .filter(
        (transaction) =>
          transaction.status === 'deducted' &&
          (transaction.type === 'cheque' || transaction.type === 'withdrawal'),
      )
      .reduce((sum, transaction) => sum + transaction.amount, 0);

    return [
      { title: 'Current Balance', value: currency(currentBalance), tone: 'text-brand-700' },
      { title: 'Total Cheques', value: currency(totalCheques), tone: 'text-rose-700' },
      { title: 'Total Deposits', value: currency(totalDeposits), tone: 'text-emerald-700' },
      { title: 'Total Withdrawals', value: currency(totalWithdrawals), tone: 'text-rose-700' },
      { title: 'Average Cheque Amount', value: currency(averageChequeAmount), tone: 'text-slate-900' },
      { title: 'Highest Cheque Amount', value: currency(highestChequeAmount), tone: 'text-slate-900' },
      { title: 'Total Pending Amount', value: currency(totalPendingAmount), tone: 'text-amber-700' },
      {
        title: 'Deducted Awaiting Clearance',
        value: currency(totalDeductedAwaitingClearance),
        tone: 'text-indigo-700',
      },
    ];
  }, [currentBalance, rangeTransactions]);

  const monthlyBreakdownData = useMemo(() => {
    const buckets = new Map<string, { month: string; cheques: number; deposits: number; withdrawals: number }>();

    rangeTransactions.forEach((transaction) => {
      const monthKey = transaction.dueDate.slice(0, 7);
      const existing = buckets.get(monthKey) ?? {
        month: monthKeyToLabel(monthKey),
        cheques: 0,
        deposits: 0,
        withdrawals: 0,
      };

      if (transaction.type === 'cheque') {
        existing.cheques += transaction.amount;
      } else if (transaction.type === 'deposit') {
        existing.deposits += transaction.amount;
      } else {
        existing.withdrawals += transaction.amount;
      }

      buckets.set(monthKey, existing);
    });

    return [...buckets.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([, value]) => value);
  }, [rangeTransactions]);

  const statusBreakdownData = useMemo(() => {
    const totals = {
      pending: 0,
      deducted: 0,
      cleared: 0,
    };

    rangeTransactions.forEach((transaction) => {
      totals[transaction.status] += transaction.amount;
    });

    return [
      { name: 'Pending', value: totals.pending, color: '#f59e0b' },
      { name: 'Deducted', value: totals.deducted, color: '#6366f1' },
      { name: 'Cleared', value: totals.cleared, color: '#10b981' },
    ];
  }, [rangeTransactions]);

  const projectedCashFlowData = useMemo(() => {
    const todayIso = toIsoDate(new Date());
    const end30 = addDays(todayIso, 30);
    const projection = calculateProjectedBalancesForRange({
      currentBalance,
      transactions: allTransactions,
      startDate: todayIso,
      endDate: end30,
    });

    return projection.days.map((day, index) => ({
      date: day.date,
      label: shortAdLabel(day.date),
      next7: index <= 6 ? day.projectedBalance : null,
      next30: day.projectedBalance,
    }));
  }, [allTransactions, currentBalance]);

  return (
    <section className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Range</span>
            <select
              value={rangeMode}
              onChange={(event) => onRangeModeChange(event.target.value as RangeMode)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            >
              <option value="currentMonth">Current Month</option>
              <option value="custom">Custom Range</option>
            </select>
          </label>

          {rangeMode === 'custom' ? (
            <>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Start (AD)</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(event) => onCustomStartDateChange(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">End (AD)</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(event) => onCustomEndDateChange(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
              </label>
            </>
          ) : null}

          <p className="text-sm text-slate-500">
            Applied range: <span className="font-medium text-slate-700">{formatAdDate(rangeStartDate)}</span> to{' '}
            <span className="font-medium text-slate-700">{formatAdDate(rangeEndDate)}</span>
          </p>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article key={card.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
            <p className="text-xs uppercase tracking-wide text-slate-500">{card.title}</p>
            <p className={`mt-2 text-lg font-semibold ${card.tone}`}>{card.value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
          <h3 className="text-base font-semibold text-slate-900">Monthly Breakdown</h3>
          <p className="text-sm text-slate-500">Cheques vs deposits vs withdrawals</p>
          <div className="mt-3 h-72">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">Loading...</div>
            ) : monthlyBreakdownData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyBreakdownData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={compactCurrency} />
                  <Tooltip formatter={(value: number) => currency(value)} />
                  <Legend />
                  <Bar dataKey="cheques" fill="#ef4444" name="Cheques" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="deposits" fill="#10b981" name="Deposits" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="withdrawals" fill="#f97316" name="Withdrawals" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                No data for selected range.
              </div>
            )}
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
          <h3 className="text-base font-semibold text-slate-900">Status Breakdown</h3>
          <p className="text-sm text-slate-500">Pending vs deducted vs cleared</p>
          <div className="mt-3 h-72">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">Loading...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusBreakdownData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={95}
                    label={(entry) => `${entry.name}: ${compactCurrency(entry.value as number)}`}
                  >
                    {statusBreakdownData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => currency(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>
      </section>

      <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
        <h3 className="text-base font-semibold text-slate-900">Projected Cash Flow</h3>
        <p className="text-sm text-slate-500">Next 7 days and next 30 days</p>
        <div className="mt-3 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={projectedCashFlowData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis tickFormatter={compactCurrency} />
              <Tooltip formatter={(value: number) => currency(value)} labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ''} />
              <Legend />
              <Line type="monotone" dataKey="next7" name="Projected (7d)" stroke="#0ea5e9" strokeWidth={2.5} dot={false} connectNulls={false} />
              <Line type="monotone" dataKey="next30" name="Projected (30d)" stroke="#6366f1" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </article>
    </section>
  );
}
