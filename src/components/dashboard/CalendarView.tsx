import { useMemo, useState } from 'react';
import type { CalendarMode, Transaction } from '@/types/domain';
import {
  calculateProjectedBalancesForRange,
  getBufferedDateRange,
  getDateProjectionDetail,
} from '@/utils/balanceProjection';
import { formatMonthLabel, getMonthGrid, isSameDate, shiftMonth, toIsoDate } from '@/utils/date';
import { formatBsMonthYearFromAd, formatDualDate, getBsDatePartsFromAd } from '@/utils/nepaliDate';

interface CalendarViewProps {
  mode: CalendarMode;
  currentBalance: number;
  monthDate: Date;
  transactions: Transaction[];
  onMonthDateChange: (nextDate: Date) => void;
}

function currencyShort(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'NPR',
    maximumFractionDigits: 0,
  });
}

function currency(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'NPR',
    minimumFractionDigits: 2,
  });
}

function buildMonthLabel(referenceDate: Date, mode: CalendarMode): string {
  if (mode === 'AD') {
    return formatMonthLabel(referenceDate);
  }

  const bsMonthLabel = formatBsMonthYearFromAd(toIsoDate(referenceDate));
  return bsMonthLabel || formatMonthLabel(referenceDate);
}

export function CalendarView({
  mode,
  currentBalance,
  monthDate,
  transactions,
  onMonthDateChange,
}: CalendarViewProps) {
  const grid = useMemo(() => getMonthGrid(monthDate), [monthDate]);
  const today = new Date();
  const todayMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const [selectedDateIso, setSelectedDateIso] = useState<string | null>(null);
  const dueCountByDate = useMemo(() => {
    const counts: Record<string, number> = {};
    transactions.forEach((transaction) => {
      counts[transaction.dueDate] = (counts[transaction.dueDate] ?? 0) + 1;
    });
    return counts;
  }, [transactions]);

  const projection = useMemo(() => {
    const firstCellIso = toIsoDate(grid[0]);
    const lastCellIso = toIsoDate(grid[grid.length - 1]);
    const range = getBufferedDateRange(firstCellIso, lastCellIso, 3, 3);

    return calculateProjectedBalancesForRange({
      currentBalance,
      transactions,
      startDate: range.startDate,
      endDate: range.endDate,
    });
  }, [currentBalance, grid, transactions]);

  const projectionByDate = projection.byDate;

  const selectedDateTransactions = useMemo(() => {
    if (!selectedDateIso) {
      return [];
    }

    return [...transactions]
      .filter((transaction) => transaction.dueDate === selectedDateIso)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }, [selectedDateIso, transactions]);

  const selectedDateTotals = useMemo(() => {
    const deposits = selectedDateTransactions
      .filter((transaction) => transaction.type === 'deposit')
      .reduce((sum, transaction) => sum + transaction.amount, 0);

    const deductions = selectedDateTransactions
      .filter((transaction) => transaction.type === 'cheque' || transaction.type === 'withdrawal')
      .reduce((sum, transaction) => sum + transaction.amount, 0);

    return {
      deposits,
      deductions,
    };
  }, [selectedDateTransactions]);

  const selectedProjection = useMemo(() => {
    if (!selectedDateIso) {
      return null;
    }

    return getDateProjectionDetail(projection, selectedDateIso);
  }, [projection, selectedDateIso]);

  const selectedDateProjectedBalance = selectedProjection?.projectedBalance ?? currentBalance;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Cash Flow Calendar</h2>
          <p className="text-sm text-slate-500">
            Projection rule: current + deposits - cheques - withdrawals (up to selected date).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onMonthDateChange(shiftMonth(monthDate, -1))}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            Prev
          </button>
          <span className="min-w-32 text-center text-sm font-medium text-slate-700">
            {buildMonthLabel(monthDate, mode)}
          </span>
          <button
            type="button"
            onClick={() => onMonthDateChange(shiftMonth(monthDate, 1))}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            Next
          </button>
          <button
            type="button"
            onClick={() => onMonthDateChange(todayMonthStart)}
            className="rounded-md border border-brand-300 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
          >
            Today
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
        <span>Sun</span>
        <span>Mon</span>
        <span>Tue</span>
        <span>Wed</span>
        <span>Thu</span>
        <span>Fri</span>
        <span>Sat</span>
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1">
        {grid.map((day) => {
          const dayIso = toIsoDate(day);
          const projection = projectionByDate[dayIso]?.projectedBalance ?? currentBalance;
          const dueItemsCount = dueCountByDate[dayIso] ?? 0;
          const inCurrentMonth = day.getMonth() === monthDate.getMonth();
          const isToday = isSameDate(day, today);
          const isSelected = selectedDateIso === dayIso;

          const bsParts = getBsDatePartsFromAd(dayIso);
          const bsDay = bsParts ? String(bsParts.day) : '';

          return (
            <button
              type="button"
              key={dayIso}
              onClick={() => setSelectedDateIso(dayIso)}
              className={`min-h-28 rounded-md border p-2 ${
                isToday
                  ? 'border-brand-400 bg-brand-50'
                  : isSelected
                    ? 'border-brand-300 bg-brand-50/70'
                  : inCurrentMonth
                    ? 'border-slate-200 bg-slate-50'
                    : 'border-slate-200 bg-slate-100/60'
              }`}
            >
              <div className="flex items-start justify-between">
                <span className={`text-sm font-semibold ${inCurrentMonth ? 'text-slate-800' : 'text-slate-400'}`}>
                  {mode === 'AD' ? day.getDate() : bsDay}
                </span>
                <span className="text-[10px] text-slate-400">{mode === 'AD' ? bsDay : day.getDate()}</span>
              </div>

              <p className="mt-2 text-[11px] text-slate-500">Projected</p>
              <p className={`text-xs font-semibold ${projection >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {currencyShort(projection)}
              </p>

              <p className="mt-1 text-[11px] text-slate-500">Due items: {dueItemsCount}</p>
            </button>
          );
        })}
      </div>

      {selectedDateIso ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label="Close date detail modal"
            className="absolute inset-0 cursor-default"
            onClick={() => setSelectedDateIso(null)}
          />

          <section className="relative z-10 w-full max-w-xl rounded-t-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:rounded-2xl sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Date Details</h3>
                <p className="text-sm text-slate-500">{formatDualDate(selectedDateIso)}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDateIso(null)}
                className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <article className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                <p className="text-xs uppercase tracking-wide text-emerald-700">Total Deposits</p>
                <p className="mt-1 text-sm font-semibold text-emerald-800">
                  {currency(selectedDateTotals.deposits)}
                </p>
              </article>
              <article className="rounded-lg border border-rose-100 bg-rose-50 p-3">
                <p className="text-xs uppercase tracking-wide text-rose-700">Total Deductions</p>
                <p className="mt-1 text-sm font-semibold text-rose-800">
                  {currency(selectedDateTotals.deductions)}
                </p>
              </article>
              <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-700">Projected Balance</p>
                <p
                  className={`mt-1 text-sm font-semibold ${
                    selectedDateProjectedBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {currency(selectedDateProjectedBalance)}
                </p>
              </article>
            </div>

            <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
              {selectedDateTransactions.length ? (
                <ul className="divide-y divide-slate-100">
                  {selectedDateTransactions.map((transaction) => {
                    const isDeposit = transaction.type === 'deposit';
                    const details =
                      transaction.type === 'cheque'
                        ? `Payee: ${transaction.payee ?? '-'}${transaction.chequeNumber ? ` | Cheque #: ${transaction.chequeNumber}` : ''}`
                        : `${transaction.description ?? '-'}${transaction.referenceNumber ? ` | Ref: ${transaction.referenceNumber}` : ''}`;

                    return (
                      <li key={transaction.id} className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium capitalize text-slate-900">
                              {transaction.type} <span className="text-slate-500">({transaction.status})</span>
                            </p>
                            <p className="mt-0.5 truncate text-xs text-slate-600">{details}</p>
                          </div>
                          <p
                            className={`shrink-0 text-sm font-semibold ${
                              isDeposit ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {isDeposit ? '+' : '-'}
                            {currency(transaction.amount)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="p-4 text-sm text-slate-500">No transactions due on this date.</p>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
