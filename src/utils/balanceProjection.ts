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

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fromIsoDate(dateIso: string): Date {
  const [year, month, day] = dateIso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDays(dateIso: string, days: number): string {
  const next = fromIsoDate(dateIso);
  next.setDate(next.getDate() + days);
  return toIsoDate(next);
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

function listDateRange(startDate: string, endDate: string): string[] {
  if (startDate > endDate) {
    throw new Error('startDate must be before or equal to endDate.');
  }

  const dates: string[] = [];
  let cursor = startDate;

  while (cursor <= endDate) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
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
    startDate: addDays(toIsoDate(monthStart), -leadingBufferDays),
    endDate: addDays(toIsoDate(monthEnd), trailingBufferDays),
  };
}

export function getBufferedDateRange(
  startDate: string,
  endDate: string,
  leadingBufferDays = 0,
  trailingBufferDays = 0,
): ProjectionRange {
  if (startDate > endDate) {
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

  const projectionEligibleTransactions = [...transactions]
    .filter((transaction) => isProjectionEligibleStatus(transaction.status))
    .sort(
      (left, right) =>
        left.dueDate.localeCompare(right.dueDate) || left.createdAt.localeCompare(right.createdAt),
    );

  const cumulativeTotals = createEmptyTotals();
  let index = 0;

  // Seed running totals with due items before the requested range.
  while (
    index < projectionEligibleTransactions.length &&
    projectionEligibleTransactions[index].dueDate < startDate
  ) {
    applyTransactionToTotals(cumulativeTotals, projectionEligibleTransactions[index]);
    index += 1;
  }

  const days: DayProjection[] = [];
  const byDate: Record<string, DayProjection> = {};

  for (const date of dates) {
    const dayTotals = createEmptyTotals();

    while (
      index < projectionEligibleTransactions.length &&
      projectionEligibleTransactions[index].dueDate === date
    ) {
      const transaction = projectionEligibleTransactions[index];
      applyTransactionToTotals(dayTotals, transaction);
      applyTransactionToTotals(cumulativeTotals, transaction);
      index += 1;
    }

    const dayProjection: DayProjection = {
      date,
      dayTotals,
      cumulativeTotals: cloneTotals(cumulativeTotals),
      projectedBalance: getProjectedBalance(currentBalance, cumulativeTotals),
    };

    days.push(dayProjection);
    byDate[date] = dayProjection;
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
