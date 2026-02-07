import { useMemo } from 'react';
import type { CalendarMode, Transaction } from '@/types/domain';
import { calculateProjectedBalancesForRange, getBufferedDateRange } from '@/utils/balanceProjection';
import { formatMonthLabel, getMonthGrid, isSameDate, shiftMonth, toIsoDate } from '@/utils/date';
import { adToBs } from '@/utils/nepaliDate';

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
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function buildMonthLabel(referenceDate: Date, mode: CalendarMode): string {
  if (mode === 'AD') {
    return formatMonthLabel(referenceDate);
  }

  const bs = adToBs(toIsoDate(referenceDate));
  const [year, month] = bs.split('-');
  return `BS ${year}-${month}`;
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
  const dueCountByDate = useMemo(() => {
    const counts: Record<string, number> = {};
    transactions.forEach((transaction) => {
      counts[transaction.dueDate] = (counts[transaction.dueDate] ?? 0) + 1;
    });
    return counts;
  }, [transactions]);

  const projectionByDate = useMemo(() => {
    const firstCellIso = toIsoDate(grid[0]);
    const lastCellIso = toIsoDate(grid[grid.length - 1]);
    const range = getBufferedDateRange(firstCellIso, lastCellIso, 3, 3);

    return calculateProjectedBalancesForRange({
      currentBalance,
      transactions,
      startDate: range.startDate,
      endDate: range.endDate,
    }).byDate;
  }, [currentBalance, grid, transactions]);

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

          const bsDay = adToBs(dayIso).split('-')[2] ?? '';

          return (
            <article
              key={dayIso}
              className={`min-h-28 rounded-md border p-2 ${
                isToday
                  ? 'border-brand-400 bg-brand-50'
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
            </article>
          );
        })}
      </div>
    </section>
  );
}
