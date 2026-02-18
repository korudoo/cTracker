import { useMemo, useState } from 'react';
import type { CalendarMode, Transaction } from '@/types/domain';
import {
  calculateProjectedBalancesForRange,
  computeClearedBalancesByDate,
  getBufferedDateRange,
} from '@/utils/balanceProjection';
import { formatMonthLabel, fromIsoDate, getMonthGrid, shiftMonth, toIsoDate } from '@/utils/date';
import {
  bsDatePartsToAdIso,
  formatBsMonthYearFromAd,
  getBsDatePartsFromAd,
  getBsMonthDays,
  getBsMonthName,
  getBsMonthPartsFromAd,
  getBsMonthStartAdIso,
  shiftBsMonthParts,
} from '@/utils/nepaliDate';
import { getChequeTextColor } from '@/utils/calendarMetricColor';
import { CalendarDateDetailModal } from '@/components/dashboard/CalendarDateDetailModal';

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

function formatMobileCompactValue(value: number): string {
  const absoluteValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absoluteValue === 0) {
    return '0';
  }

  if (absoluteValue >= 1_000_000) {
    const millions = absoluteValue / 1_000_000;
    const millionLabel =
      millions >= 10 ? Math.round(millions).toString() : millions.toFixed(1).replace(/\.0$/, '');
    return `${sign}${millionLabel}M`;
  }

  if (absoluteValue >= 1_000) {
    const thousands = absoluteValue / 1_000;
    const thousandLabel =
      thousands >= 100 ? Math.round(thousands).toString() : thousands.toFixed(1).replace(/\.0$/, '');
    return `${sign}${thousandLabel}k`;
  }

  return `${sign}${Math.round(absoluteValue)}`;
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

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-card sm:p-4">
      <div className="mb-3 space-y-2 sm:mb-4 sm:space-y-2.5">
        <h2 className="text-lg font-semibold text-slate-900">Cash Flow Calendar</h2>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => onMonthDateChange(shiftMonthForMode(mode, monthDate, -1))}
              className="rounded-full border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 sm:px-3 sm:text-sm"
            >
              Prev
            </button>
            <span className="min-w-0 flex-1 truncate text-center text-sm font-medium text-slate-700">
              {gridData.activeMonthLabel}
            </span>
            <button
              type="button"
              onClick={() => onMonthDateChange(shiftMonthForMode(mode, monthDate, 1))}
              className="rounded-full border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 sm:px-3 sm:text-sm"
            >
              Next
            </button>
            <button
              type="button"
              onClick={() => onMonthDateChange(getTodayMonthStartForMode(mode, today))}
              className="hidden rounded-full border border-brand-300 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 sm:inline-flex"
            >
              Today
            </button>
          </div>
          <div className="flex justify-end sm:hidden">
            <button
              type="button"
              onClick={() => onMonthDateChange(getTodayMonthStartForMode(mode, today))}
              className="rounded-full border border-brand-300 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
            >
              Today
            </button>
          </div>
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

      <div className="mt-1.5 grid grid-cols-7 gap-1 sm:mt-2">
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
          const desktopValue = metric === 'totalCheques' ? currencyShort(totalCheques) : currencyShort(cellMetricValue);
          const mobileValue =
            metric === 'totalCheques'
              ? formatMobileCompactValue(totalCheques)
              : formatMobileCompactValue(cellMetricValue);

          return (
            <button
              type="button"
              key={dayIso}
              onClick={() => setSelectedDateIso(dayIso)}
              className={`min-h-[72px] rounded-md border px-1 py-1 sm:min-h-28 sm:px-2 sm:py-2 ${
                isToday
                  ? 'border-brand-400 bg-brand-50'
                  : isSelected
                    ? 'border-brand-300 bg-brand-50/70'
                    : inCurrentMonth
                      ? 'border-slate-200 bg-slate-50'
                      : 'border-slate-200 bg-slate-100/60'
              }`}
            >
              <div className="flex h-full flex-col">
                <div className="flex items-start justify-between">
                  <span
                    className={`text-sm font-semibold leading-tight sm:text-sm ${
                      inCurrentMonth ? 'text-slate-800' : 'text-slate-400'
                    }`}
                  >
                    {mode === 'AD' ? cell.adDayLabel : cell.bsDayLabel}
                  </span>
                  <span className="hidden text-[10px] text-slate-400 sm:inline">
                    {mode === 'AD' ? cell.bsDayLabel : cell.adDayLabel}
                  </span>
                </div>

                <p
                  className={`mt-1 text-sm font-medium leading-tight whitespace-nowrap sm:mt-2 sm:text-xs sm:font-semibold ${
                    metric === 'projectedBalance' || metric === 'clearedBalance'
                      ? cellMetricValue >= 0
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                      : ''
                  }`}
                >
                  {metric === 'totalCheques' ? (
                    <>
                      <span className="block sm:hidden" style={{ color: chequeTextColor }}>
                        {mobileValue}
                      </span>
                      <span className="hidden sm:inline" style={{ color: chequeTextColor }}>
                        {desktopValue}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="block sm:hidden">{mobileValue}</span>
                      <span className="hidden sm:inline">{desktopValue}</span>
                    </>
                  )}
                </p>

                {dueItemsCount > 0 ? (
                  <p className="mt-auto text-[10px] leading-tight text-slate-500">
                    {dueItemsCount} {dueItemsCount === 1 ? 'item' : 'items'}
                  </p>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      <CalendarDateDetailModal
        selectedDateIso={selectedDateIso}
        onClose={() => setSelectedDateIso(null)}
        transactions={transactions}
        projection={projection}
        currentBalance={currentBalance}
        clearedBalanceByDate={clearedBalanceByDate}
        openingBalance={openingBalance}
      />
    </section>
  );
}
