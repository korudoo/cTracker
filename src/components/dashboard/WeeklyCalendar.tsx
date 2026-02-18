import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Receipt, type LucideIcon } from 'lucide-react';
import type { CalendarMode, Transaction, TransactionType } from '@/types/domain';
import { calculateProjectedBalancesForRange, computeClearedBalancesByDate } from '@/utils/balanceProjection';
import { fromIsoDate, toIsoDate } from '@/utils/date';
import { getBsDatePartsFromAd, getBsMonthName } from '@/utils/nepaliDate';
import { getChequeTextColor } from '@/utils/calendarMetricColor';
import type { CalendarMetric } from '@/components/dashboard/CalendarView';
import { CalendarDateDetailModal } from '@/components/dashboard/CalendarDateDetailModal';

interface WeeklyCalendarProps {
  mode: CalendarMode;
  metric: CalendarMetric;
  openingBalance: number;
  currentBalance: number;
  transactions: Transaction[];
}

interface WeekDay {
  date: Date;
  dateIso: string;
}

function startOfWeek(date: Date): Date {
  const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  normalized.setDate(normalized.getDate() - normalized.getDay());
  return normalized;
}

function addDays(referenceDate: Date, days: number): Date {
  const nextDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function formatNpr(amount: number, options?: { showPlusForPositive?: boolean }): string {
  const absolute = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  if (amount < 0) {
    return `-NPR ${absolute}`;
  }

  if (options?.showPlusForPositive && amount > 0) {
    return `+NPR ${absolute}`;
  }

  return `NPR ${absolute}`;
}

function formatAdWeekLabel(startIso: string, endIso: string): string {
  const startDate = fromIsoDate(startIso);
  const endDate = fromIsoDate(endIso);
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' });

  if (startYear === endYear && startMonth === endMonth) {
    return `${startMonth} ${startDate.getDate()}-${endDate.getDate()}, ${startYear}`;
  }
  if (startYear === endYear) {
    return `${startMonth} ${startDate.getDate()} - ${endMonth} ${endDate.getDate()}, ${startYear}`;
  }

  return `${startMonth} ${startDate.getDate()}, ${startYear} - ${endMonth} ${endDate.getDate()}, ${endYear}`;
}

function formatBsWeekLabel(startIso: string, endIso: string): string {
  const startParts = getBsDatePartsFromAd(startIso);
  const endParts = getBsDatePartsFromAd(endIso);

  if (!startParts || !endParts) {
    return formatAdWeekLabel(startIso, endIso);
  }

  const startMonth = getBsMonthName(startParts.month);
  const endMonth = getBsMonthName(endParts.month);

  if (!startMonth || !endMonth) {
    return formatAdWeekLabel(startIso, endIso);
  }

  if (startParts.year === endParts.year && startParts.month === endParts.month) {
    return `${startMonth} ${startParts.day}-${endParts.day}, ${startParts.year} BS`;
  }

  if (startParts.year === endParts.year) {
    return `${startMonth} ${startParts.day} - ${endMonth} ${endParts.day}, ${startParts.year} BS`;
  }

  return `${startMonth} ${startParts.day}, ${startParts.year} - ${endMonth} ${endParts.day}, ${endParts.year} BS`;
}

function formatWeekLabel(mode: CalendarMode, startIso: string, endIso: string, isCurrentWeek: boolean): string {
  const rangeLabel = mode === 'BS' ? formatBsWeekLabel(startIso, endIso) : formatAdWeekLabel(startIso, endIso);
  return isCurrentWeek ? `This week - ${rangeLabel}` : rangeLabel;
}

function getDayHeader(mode: CalendarMode, dateIso: string): { weekday: string; dateLabel: string } {
  const date = fromIsoDate(dateIso);
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });

  if (mode === 'AD') {
    return {
      weekday,
      dateLabel: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    };
  }

  const bsParts = getBsDatePartsFromAd(dateIso);
  const bsMonth = bsParts ? getBsMonthName(bsParts.month) : null;

  return {
    weekday,
    dateLabel: bsParts && bsMonth ? `${bsMonth} ${bsParts.day}` : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  };
}

function getPreviewIcon(type: TransactionType): LucideIcon {
  if (type === 'deposit') {
    return ArrowDownLeft;
  }
  if (type === 'withdrawal') {
    return ArrowUpRight;
  }
  return Receipt;
}

function getTypeLabel(type: TransactionType): string {
  if (type === 'deposit') {
    return 'Deposit';
  }
  if (type === 'withdrawal') {
    return 'Withdrawal';
  }
  return 'Cheque';
}

function getPreviewLabel(transaction: Transaction): string {
  if (transaction.type === 'cheque') {
    return transaction.payee ?? transaction.chequeNumber ?? 'Cheque';
  }

  return transaction.description ?? transaction.referenceNumber ?? transaction.accountName;
}

export function WeeklyCalendar({
  mode,
  metric,
  openingBalance,
  currentBalance,
  transactions,
}: WeeklyCalendarProps) {
  const today = new Date();
  const todayIso = toIsoDate(today);
  const currentWeekStartIso = toIsoDate(startOfWeek(today));
  const [weekStartDate, setWeekStartDate] = useState<Date>(() => startOfWeek(today));
  const [selectedDateIso, setSelectedDateIso] = useState<string | null>(null);

  const weekDays = useMemo<WeekDay[]>(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = addDays(weekStartDate, index);
        return {
          date,
          dateIso: toIsoDate(date),
        };
      }),
    [weekStartDate],
  );

  const weekStartIso = weekDays[0]?.dateIso ?? todayIso;
  const weekEndIso = weekDays[weekDays.length - 1]?.dateIso ?? todayIso;
  const isCurrentWeek = weekStartIso === currentWeekStartIso;
  const weekLabel = formatWeekLabel(mode, weekStartIso, weekEndIso, isCurrentWeek);

  const projection = useMemo(
    () =>
      calculateProjectedBalancesForRange({
        currentBalance,
        transactions,
        startDate: weekStartIso,
        endDate: weekEndIso,
      }),
    [currentBalance, transactions, weekEndIso, weekStartIso],
  );

  const clearedBalanceByDate = useMemo(
    () => computeClearedBalancesByDate(weekStartIso, weekEndIso, openingBalance, transactions),
    [openingBalance, transactions, weekEndIso, weekStartIso],
  );

  const transactionsByDate = useMemo(() => {
    const map: Record<string, Transaction[]> = {};

    transactions.forEach((transaction) => {
      if (transaction.dueDate < weekStartIso || transaction.dueDate > weekEndIso) {
        return;
      }

      const list = map[transaction.dueDate] ?? [];
      list.push(transaction);
      map[transaction.dueDate] = list;
    });

    Object.values(map).forEach((dayTransactions) => {
      dayTransactions.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    });

    return map;
  }, [transactions, weekEndIso, weekStartIso]);

  const totalChequesByDate = useMemo(() => {
    const totals: Record<string, number> = {};

    Object.entries(transactionsByDate).forEach(([dateIso, dayTransactions]) => {
      totals[dateIso] = dayTransactions
        .filter((transaction) => transaction.type === 'cheque')
        .reduce((sum, transaction) => sum + transaction.amount, 0);
    });

    return totals;
  }, [transactionsByDate]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-card sm:p-4">
      <div className="mb-3 space-y-2.5 sm:mb-4">
        <h3 className="text-base font-semibold text-slate-900">Weekly Calendar</h3>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setWeekStartDate((previous) => addDays(previous, -7))}
              className="rounded-full border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 sm:px-3 sm:text-sm"
            >
              Prev Week
            </button>
            <span className="min-w-0 flex-1 truncate text-center text-sm font-medium text-slate-700">{weekLabel}</span>
            <button
              type="button"
              onClick={() => setWeekStartDate((previous) => addDays(previous, 7))}
              className="rounded-full border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 sm:px-3 sm:text-sm"
            >
              Next Week
            </button>
            <button
              type="button"
              onClick={() => setWeekStartDate(startOfWeek(new Date()))}
              className="hidden rounded-full border border-brand-300 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 sm:inline-flex"
            >
              Today
            </button>
          </div>

          <div className="flex justify-end sm:hidden">
            <button
              type="button"
              onClick={() => setWeekStartDate(startOfWeek(new Date()))}
              className="rounded-full border border-brand-300 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
            >
              Today
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {weekDays.map((day) => {
          const dayIso = day.dateIso;
          const dayProjection = projection.byDate[dayIso];
          const totalCheques = totalChequesByDate[dayIso] ?? 0;
          const projectedBalance = dayProjection?.projectedBalance ?? currentBalance;
          const clearedBalance = clearedBalanceByDate[dayIso] ?? openingBalance;
          const metricValue =
            metric === 'projectedBalance'
              ? projectedBalance
              : metric === 'totalCheques'
                ? totalCheques
                : clearedBalance;
          const dayTransactions = transactionsByDate[dayIso] ?? [];
          const previewTransactions = dayTransactions.slice(0, 3);
          const hiddenCount = Math.max(dayTransactions.length - previewTransactions.length, 0);
          const isToday = dayIso === todayIso;
          const { weekday, dateLabel } = getDayHeader(mode, dayIso);

          return (
            <button
              type="button"
              key={dayIso}
              onClick={() => setSelectedDateIso(dayIso)}
              className={`w-full rounded-xl border p-3 text-left shadow-sm transition hover:bg-slate-50 ${
                isToday ? 'border-brand-300 bg-brand-50/70' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex min-h-11 items-center gap-3">
                <div className="min-w-16">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{weekday}</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-800">{dateLabel}</p>
                  {isToday ? (
                    <span className="mt-1 inline-flex rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
                      Today
                    </span>
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className={`text-base font-semibold leading-tight ${
                      metric === 'totalCheques'
                        ? ''
                        : metricValue >= 0
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                    }`}
                  >
                    {metric === 'totalCheques' ? (
                      <span style={{ color: getChequeTextColor(totalCheques) }}>{formatNpr(totalCheques)}</span>
                    ) : (
                      formatNpr(metricValue)
                    )}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <p className="text-xs text-slate-500">
                    {dayTransactions.length} {dayTransactions.length === 1 ? 'item' : 'items'}
                  </p>
                  <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
                </div>
              </div>

              {previewTransactions.length ? (
                <ul className="mt-2 space-y-1.5 border-t border-slate-100 pt-2">
                  {previewTransactions.map((transaction) => {
                    const Icon = getPreviewIcon(transaction.type);
                    const signedAmount = transaction.type === 'deposit' ? transaction.amount : -transaction.amount;
                    const tone = transaction.type === 'deposit' ? 'text-emerald-700' : 'text-rose-700';

                    return (
                      <li key={transaction.id} className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex items-center gap-1.5 text-xs text-slate-700">
                          <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                          <span className="truncate">
                            {getTypeLabel(transaction.type)} | {getPreviewLabel(transaction)}
                          </span>
                        </div>
                        <span className={`shrink-0 text-xs font-medium ${tone}`}>
                          {formatNpr(signedAmount, { showPlusForPositive: true })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-400">No transactions</p>
              )}

              {hiddenCount > 0 ? <p className="mt-1 text-[11px] text-slate-500">+{hiddenCount} more</p> : null}
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
