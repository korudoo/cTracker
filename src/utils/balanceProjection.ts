import type { Transaction, TransactionStatus } from '@/types/domain';

export interface BalanceTotals {
  deposits: number;
  cheques: number;
  withdrawals: number;
}

export interface ProjectionRange {
  startDate: string;
  endDate: string;
}

export interface DayProjection {
  date: string;
  dayTotals: BalanceTotals;
  cumulativeTotals: BalanceTotals;
  projectedBalance: number;
}

export interface ProjectionResult {
  range: ProjectionRange;
  currentBalance: number;
  days: DayProjection[];
  byDate: Record<string, DayProjection>;
}

interface BuildProjectionParams {
  currentBalance: number;
  transactions: Transaction[];
  startDate: string;
  endDate: string;
}

const PROJECTION_ELIGIBLE_STATUSES: TransactionStatus[] = ['pending', 'deducted', 'cleared'];
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function toIsoDateFromUtcDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isoDateToEpochDay(dateIso: string): number {
  if (!ISO_DATE_PATTERN.test(dateIso)) {
    throw new Error(`Invalid ISO date: ${dateIso}`);
  }

  const [yearPart, monthPart, dayPart] = dateIso.split('-');
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);

  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function epochDayToIsoDate(epochDay: number): string {
  return toIsoDateFromUtcDate(new Date(epochDay * 86_400_000));
}

function addDays(dateIso: string, days: number): string {
  return epochDayToIsoDate(isoDateToEpochDay(dateIso) + days);
}

function cloneTotals(totals: BalanceTotals): BalanceTotals {
  return {
    deposits: totals.deposits,
    cheques: totals.cheques,
    withdrawals: totals.withdrawals,
  };
}

function createEmptyTotals(): BalanceTotals {
  return {
    deposits: 0,
    cheques: 0,
    withdrawals: 0,
  };
}

function isProjectionEligibleStatus(status: string): status is TransactionStatus {
  return PROJECTION_ELIGIBLE_STATUSES.includes(status as TransactionStatus);
}

function applyTransactionToTotals(totals: BalanceTotals, transaction: Transaction): void {
  if (!isProjectionEligibleStatus(transaction.status)) {
    return;
  }

  if (transaction.type === 'deposit') {
    totals.deposits += transaction.amount;
    return;
  }

  if (transaction.type === 'cheque') {
    totals.cheques += transaction.amount;
    return;
  }

  if (transaction.type === 'withdrawal') {
    totals.withdrawals += transaction.amount;
  }
}

function getProjectedBalance(currentBalance: number, totals: BalanceTotals): number {
  return currentBalance + totals.deposits - totals.cheques - totals.withdrawals;
}

function getNetImpact(totals: BalanceTotals): number {
  return totals.deposits - totals.cheques - totals.withdrawals;
}

function getEquivalentOpeningBalance(currentBalance: number, transactions: Transaction[]): number {
  const clearedTotals = createEmptyTotals();

  transactions
    .filter((transaction) => transaction.status === 'cleared')
    .forEach((transaction) => applyTransactionToTotals(clearedTotals, transaction));

  return currentBalance - getNetImpact(clearedTotals);
}

function listDateRange(startDate: string, endDate: string): string[] {
  const startEpoch = isoDateToEpochDay(startDate);
  const endEpoch = isoDateToEpochDay(endDate);

  if (startEpoch > endEpoch) {
    throw new Error('startDate must be before or equal to endDate.');
  }

  const dates: string[] = new Array(endEpoch - startEpoch + 1);

  for (let epochDay = startEpoch; epochDay <= endEpoch; epochDay += 1) {
    dates[epochDay - startEpoch] = epochDayToIsoDate(epochDay);
  }

  return dates;
}

export function calculateCurrentBalance(openingBalance: number, transactions: Transaction[]): number {
  const clearedTotals = createEmptyTotals();

  transactions
    .filter((transaction) => transaction.status === 'cleared')
    .forEach((transaction) => applyTransactionToTotals(clearedTotals, transaction));

  return getProjectedBalance(openingBalance, clearedTotals);
}

export function getMonthProjectionRange(
  monthDate: Date,
  leadingBufferDays = 7,
  trailingBufferDays = 7,
): ProjectionRange {
  if (leadingBufferDays < 0 || trailingBufferDays < 0) {
    throw new Error('Buffer days cannot be negative.');
  }

  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

  return {
    startDate: addDays(
      toIsoDateFromUtcDate(new Date(Date.UTC(monthStart.getFullYear(), monthStart.getMonth(), monthStart.getDate()))),
      -leadingBufferDays,
    ),
    endDate: addDays(
      toIsoDateFromUtcDate(new Date(Date.UTC(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate()))),
      trailingBufferDays,
    ),
  };
}

export function getBufferedDateRange(
  startDate: string,
  endDate: string,
  leadingBufferDays = 0,
  trailingBufferDays = 0,
): ProjectionRange {
  if (isoDateToEpochDay(startDate) > isoDateToEpochDay(endDate)) {
    throw new Error('startDate must be before or equal to endDate.');
  }
  if (leadingBufferDays < 0 || trailingBufferDays < 0) {
    throw new Error('Buffer days cannot be negative.');
  }

  return {
    startDate: addDays(startDate, -leadingBufferDays),
    endDate: addDays(endDate, trailingBufferDays),
  };
}

export function calculateProjectedBalancesForRange(params: BuildProjectionParams): ProjectionResult {
  const { currentBalance, transactions, startDate, endDate } = params;
  const dates = listDateRange(startDate, endDate);
  const startEpoch = isoDateToEpochDay(startDate);
  const openingBalance = getEquivalentOpeningBalance(currentBalance, transactions);

  const projectionEligibleTransactions = transactions
    .filter((transaction) => isProjectionEligibleStatus(transaction.status))
    .map((transaction) => ({
      transaction,
      dueEpoch: isoDateToEpochDay(transaction.dueDate),
    }))
    .sort(
      (left, right) =>
        left.dueEpoch - right.dueEpoch ||
        left.transaction.createdAt.localeCompare(right.transaction.createdAt),
    );

  const cumulativeTotals = createEmptyTotals();
  let index = 0;

  // Seed running totals with due items before the requested range.
  while (index < projectionEligibleTransactions.length && projectionEligibleTransactions[index].dueEpoch < startEpoch) {
    applyTransactionToTotals(cumulativeTotals, projectionEligibleTransactions[index].transaction);
    index += 1;
  }

  const days: DayProjection[] = [];
  const byDate: Record<string, DayProjection> = {};

  let dayEpoch = startEpoch;
  for (const date of dates) {
    const dayTotals = createEmptyTotals();

    while (index < projectionEligibleTransactions.length && projectionEligibleTransactions[index].dueEpoch === dayEpoch) {
      const transaction = projectionEligibleTransactions[index].transaction;
      applyTransactionToTotals(dayTotals, transaction);
      applyTransactionToTotals(cumulativeTotals, transaction);
      index += 1;
    }

    const dayProjection: DayProjection = {
      date,
      dayTotals,
      cumulativeTotals: cloneTotals(cumulativeTotals),
      projectedBalance: getProjectedBalance(openingBalance, cumulativeTotals),
    };

    days.push(dayProjection);
    byDate[date] = dayProjection;
    dayEpoch += 1;
  }

  return {
    range: { startDate, endDate },
    currentBalance,
    days,
    byDate,
  };
}

export function getDateProjectionDetail(
  projection: ProjectionResult,
  dateIso: string,
): DayProjection | null {
  return projection.byDate[dateIso] ?? null;
}

function isFinalizedForClearedBalance(transaction: Transaction): boolean {
  const status = transaction.status as string;

  if (transaction.type === 'deposit') {
    return status === 'cleared' || status === 'deposited';
  }

  if (transaction.type === 'cheque') {
    return status === 'cleared';
  }

  if (transaction.type === 'withdrawal') {
    return status === 'deducted';
  }

  return false;
}

function getClearedBalanceDelta(transaction: Transaction): number {
  if (transaction.type === 'deposit') {
    return transaction.amount;
  }

  if (transaction.type === 'cheque' || transaction.type === 'withdrawal') {
    return -transaction.amount;
  }

  return 0;
}

export function computeClearedBalancesByDate(
  rangeStart: string,
  rangeEnd: string,
  openingBalance: number,
  transactions: Transaction[],
): Record<string, number> {
  const dates = listDateRange(rangeStart, rangeEnd);
  const startEpoch = isoDateToEpochDay(rangeStart);

  const finalizedTransactions = transactions
    .filter((transaction) => isFinalizedForClearedBalance(transaction))
    .map((transaction) => ({
      transaction,
      dueEpoch: isoDateToEpochDay(transaction.dueDate),
    }))
    .sort(
      (left, right) =>
        left.dueEpoch - right.dueEpoch ||
        left.transaction.createdAt.localeCompare(right.transaction.createdAt),
    );

  let runningBalance = openingBalance;
  let index = 0;

  while (index < finalizedTransactions.length && finalizedTransactions[index].dueEpoch < startEpoch) {
    runningBalance += getClearedBalanceDelta(finalizedTransactions[index].transaction);
    index += 1;
  }

  const balancesByDate: Record<string, number> = {};

  let dayEpoch = startEpoch;
  for (const date of dates) {
    while (index < finalizedTransactions.length && finalizedTransactions[index].dueEpoch === dayEpoch) {
      runningBalance += getClearedBalanceDelta(finalizedTransactions[index].transaction);
      index += 1;
    }

    balancesByDate[date] = runningBalance;
    dayEpoch += 1;
  }

  return balancesByDate;
}
