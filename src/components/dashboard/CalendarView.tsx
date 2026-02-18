import { useMemo, useState } from 'react';
import type { CalendarMode, Transaction } from '@/types/domain';
import {
  calculateProjectedBalancesForRange,
  computeClearedBalancesByDate,
  getBufferedDateRange,
  getDateProjectionDetail,
} from '@/utils/balanceProjection';
import { formatMonthLabel, fromIsoDate, getMonthGrid, shiftMonth, toIsoDate } from '@/utils/date';
import {
  bsDatePartsToAdIso,
  formatBsMonthYearFromAd,
  formatDualDate,
  getBsDatePartsFromAd,
  getBsMonthDays,
  getBsMonthName,
  getBsMonthPartsFromAd,
  getBsMonthStartAdIso,
  shiftBsMonthParts,
} from '@/utils/nepaliDate';
import { getChequeTextColor } from '@/utils/calendarMetricColor';
import { getTransactionStatusLabel } from '@/utils/transactionStatus';

export type CalendarMetric = 'projectedBalance' | 'totalCheques' | 'clearedBalance';

interface CalendarViewProps {
  mode: CalendarMode;
  metric: CalendarMetric;
  openingBalance: number;
  currentBalance: number;
  monthDate: Date;
  transactions: Transaction[];
  onMonthDateChange: (nextDate: Date) => void;
}

interface CalendarGridCell {
  adDate: Date;
  adDateIso: string;
  adDayLabel: string;
  bsDayLabel: string;
  isInCurrentMonth: boolean;
}

interface CalendarGridData {
  activeMonthLabel: string;
  cells: CalendarGridCell[];
}

interface BsMonthContext {
  year: number;
  month: number;
  monthLabel: string;
  monthStartAdDate: Date;
  daysInMonth: number;
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

function addDays(referenceDate: Date, delta: number): Date {
  const shifted = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  shifted.setDate(shifted.getDate() + delta);
  return shifted;
}

function buildCell(adDate: Date, isInCurrentMonth: boolean, bsDayOverride?: string): CalendarGridCell {
  const adDateIso = toIsoDate(adDate);
  const bsDayFromAd = getBsDatePartsFromAd(adDateIso);

  return {
    adDate,
    adDateIso,
    adDayLabel: String(adDate.getDate()),
    bsDayLabel: bsDayOverride ?? (bsDayFromAd ? String(bsDayFromAd.day) : ''),
    isInCurrentMonth,
  };
}

function buildAdGridData(referenceDate: Date): CalendarGridData {
  const monthIndex = referenceDate.getMonth();
  const cells = getMonthGrid(referenceDate).map((day) => buildCell(day, day.getMonth() === monthIndex));

  return {
    activeMonthLabel: formatMonthLabel(referenceDate),
    cells,
  };
}

function buildBsMonthContext(referenceDate: Date): BsMonthContext | null {
  const referenceIso = toIsoDate(referenceDate);
  const monthParts = getBsMonthPartsFromAd(referenceIso);

  if (!monthParts) {
    return null;
  }

  const monthStartAdIso = getBsMonthStartAdIso(monthParts);
  const daysInMonth = getBsMonthDays(monthParts);

  if (!monthStartAdIso || !daysInMonth) {
    return null;
  }

  const monthName = getBsMonthName(monthParts.month);

  return {
    year: monthParts.year,
    month: monthParts.month,
    monthLabel: monthName ? `${monthName} ${monthParts.year} BS` : formatBsMonthYearFromAd(referenceIso),
    monthStartAdDate: fromIsoDate(monthStartAdIso),
    daysInMonth,
  };
}

function buildBsGridData(referenceDate: Date): CalendarGridData {
  const context = buildBsMonthContext(referenceDate);

  if (!context) {
    return buildAdGridData(referenceDate);
  }

  const cells: CalendarGridCell[] = [];
  const leadingCount = context.monthStartAdDate.getDay();

  for (let offset = leadingCount; offset > 0; offset -= 1) {
    const adDate = addDays(context.monthStartAdDate, -offset);
    cells.push(buildCell(adDate, false));
  }

  for (let day = 1; day <= context.daysInMonth; day += 1) {
    const dayAdIso =
      bsDatePartsToAdIso({
        year: context.year,
        month: context.month,
        day,
      }) ?? toIsoDate(addDays(context.monthStartAdDate, day - 1));

    cells.push(buildCell(fromIsoDate(dayAdIso), true, String(day)));
  }

  let trailingOffset = 1;
  while (cells.length < 42) {
    const adDate = addDays(context.monthStartAdDate, context.daysInMonth - 1 + trailingOffset);
    cells.push(buildCell(adDate, false));
    trailingOffset += 1;
  }

  return {
    activeMonthLabel: context.monthLabel,
    cells,
  };
}

function getGridData(mode: CalendarMode, monthDate: Date): CalendarGridData {
  return mode === 'BS' ? buildBsGridData(monthDate) : buildAdGridData(monthDate);
}

function shiftMonthForMode(mode: CalendarMode, referenceDate: Date, delta: number): Date {
  if (mode === 'AD') {
    return shiftMonth(referenceDate, delta);
  }

  const currentBsParts = getBsMonthPartsFromAd(toIsoDate(referenceDate));
  if (!currentBsParts) {
    return shiftMonth(referenceDate, delta);
  }

  const shiftedMonth = shiftBsMonthParts(currentBsParts, delta);
  const shiftedStartIso = getBsMonthStartAdIso(shiftedMonth);

  return shiftedStartIso ? fromIsoDate(shiftedStartIso) : shiftMonth(referenceDate, delta);
}

function getTodayMonthStartForMode(mode: CalendarMode, today: Date): Date {
  if (mode === 'AD') {
    return new Date(today.getFullYear(), today.getMonth(), 1);
  }

  const todayBsParts = getBsMonthPartsFromAd(toIsoDate(today));
  if (!todayBsParts) {
    return new Date(today.getFullYear(), today.getMonth(), 1);
  }

  const monthStartIso = getBsMonthStartAdIso(todayBsParts);
  return monthStartIso ? fromIsoDate(monthStartIso) : new Date(today.getFullYear(), today.getMonth(), 1);
}

export function CalendarView({
  mode,
  metric,
  openingBalance,
  currentBalance,
  monthDate,
  transactions,
  onMonthDateChange,
}: CalendarViewProps) {
  const gridData = useMemo(() => getGridData(mode, monthDate), [mode, monthDate]);
  const today = new Date();
  const todayIso = toIsoDate(today);
  const [selectedDateIso, setSelectedDateIso] = useState<string | null>(null);
  const dueCountByDate = useMemo(() => {
    const counts: Record<string, number> = {};
    transactions.forEach((transaction) => {
      counts[transaction.dueDate] = (counts[transaction.dueDate] ?? 0) + 1;
    });
    return counts;
  }, [transactions]);

  const totalChequesByDate = useMemo(() => {
    const totals: Record<string, number> = {};

    transactions.forEach((transaction) => {
      if (transaction.type !== 'cheque') {
        return;
      }

      totals[transaction.dueDate] = (totals[transaction.dueDate] ?? 0) + transaction.amount;
    });

    return totals;
  }, [transactions]);

  const projectionRange = useMemo(() => {
    const firstCellIso = gridData.cells[0]?.adDateIso;
    const lastCellIso = gridData.cells[gridData.cells.length - 1]?.adDateIso;

    if (!firstCellIso || !lastCellIso) {
      return {
        startDate: todayIso,
        endDate: todayIso,
      };
    }

    return getBufferedDateRange(firstCellIso, lastCellIso, 3, 3);
  }, [gridData.cells, todayIso]);

  const projection = useMemo(() => {
    return calculateProjectedBalancesForRange({
      currentBalance,
      transactions,
      startDate: projectionRange.startDate,
      endDate: projectionRange.endDate,
    });
  }, [currentBalance, projectionRange.endDate, projectionRange.startDate, transactions]);

  const clearedBalanceByDate = useMemo(
    () =>
      computeClearedBalancesByDate(
        projectionRange.startDate,
        projectionRange.endDate,
        openingBalance,
        transactions,
      ),
    [openingBalance, projectionRange.endDate, projectionRange.startDate, transactions],
  );

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
  const selectedDateClearedBalance = selectedDateIso
    ? (clearedBalanceByDate[selectedDateIso] ?? openingBalance)
    : openingBalance;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Cash Flow Calendar</h2>
          <p className="text-sm text-slate-500">
            {metric === 'projectedBalance'
              ? 'Projection rule: current + deposits - cheques - withdrawals (up to selected date).'
              : metric === 'totalCheques'
                ? 'Total Cheques view: sum of cheque amounts due on each date regardless of status.'
                : 'Cleared Balance view: opening + finalized deposits - cleared cheques - deducted withdrawals.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onMonthDateChange(shiftMonthForMode(mode, monthDate, -1))}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            Prev
          </button>
          <span className="min-w-32 text-center text-sm font-medium text-slate-700">{gridData.activeMonthLabel}</span>
          <button
            type="button"
            onClick={() => onMonthDateChange(shiftMonthForMode(mode, monthDate, 1))}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            Next
          </button>
          <button
            type="button"
            onClick={() => onMonthDateChange(getTodayMonthStartForMode(mode, today))}
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
        {gridData.cells.map((cell) => {
          const dayIso = cell.adDateIso;
          const projectedBalance = projectionByDate[dayIso]?.projectedBalance ?? currentBalance;
          const totalCheques = totalChequesByDate[dayIso] ?? 0;
          const clearedBalance = clearedBalanceByDate[dayIso] ?? openingBalance;
          const cellMetricValue =
            metric === 'projectedBalance'
              ? projectedBalance
              : metric === 'totalCheques'
                ? totalCheques
                : clearedBalance;
          const chequeTextColor = getChequeTextColor(totalCheques);
          const dueItemsCount = dueCountByDate[dayIso] ?? 0;
          const inCurrentMonth = cell.isInCurrentMonth;
          const isToday = dayIso === todayIso;
          const isSelected = selectedDateIso === dayIso;

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
                  {mode === 'AD' ? cell.adDayLabel : cell.bsDayLabel}
                </span>
                <span className="text-[10px] text-slate-400">{mode === 'AD' ? cell.bsDayLabel : cell.adDayLabel}</span>
              </div>

              <p className="mt-2 text-[11px] text-slate-500">
                {metric === 'projectedBalance'
                  ? 'Projected'
                  : metric === 'totalCheques'
                    ? 'Total Cheques'
                    : 'Cleared Balance'}
              </p>
              <p
                className={`text-xs font-semibold ${
                  metric === 'projectedBalance' || metric === 'clearedBalance'
                    ? cellMetricValue >= 0
                      ? 'text-emerald-700'
                      : 'text-rose-700'
                    : ''
                }`}
              >
                {metric === 'totalCheques' ? (
                  <span style={{ color: chequeTextColor }}>{currencyShort(totalCheques)}</span>
                ) : (
                  currencyShort(cellMetricValue)
                )}
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

            <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-4">
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
              <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-700">Cleared Balance</p>
                <p
                  className={`mt-1 text-sm font-semibold ${
                    selectedDateClearedBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {currency(selectedDateClearedBalance)}
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
                              {transaction.type}{' '}
                              <span className="text-slate-500">
                                ({getTransactionStatusLabel(transaction.type, transaction.status)})
                              </span>
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
