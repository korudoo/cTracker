import type { DayProjection } from '@/utils/balanceProjection';
import type { Transaction } from '@/types/domain';

export interface SevenDaySummaryItem {
  date: string;
  deposits: number;
  deductions: number;
  projectedBalance: number;
}

export interface NegativeRiskResult {
  hasRisk: boolean;
  earliestNegativeDate: string | null;
  minProjected: number | null;
}

export interface TopFlowsResult {
  outflows: Transaction[];
  inflows: Transaction[];
}

function isInRange(dateIso: string, startIso: string, endIso: string): boolean {
  return dateIso >= startIso && dateIso <= endIso;
}

export function next7DaysSummary(days: DayProjection[]): SevenDaySummaryItem[] {
  return days.slice(0, 7).map((day) => ({
    date: day.date,
    deposits: day.dayTotals.deposits,
    deductions: day.dayTotals.cheques + day.dayTotals.withdrawals,
    projectedBalance: day.projectedBalance,
  }));
}

export function detectNegativeRisk(days: SevenDaySummaryItem[]): NegativeRiskResult {
  const negativeDays = days.filter((day) => day.projectedBalance < 0);

  if (!negativeDays.length) {
    return {
      hasRisk: false,
      earliestNegativeDate: null,
      minProjected: null,
    };
  }

  const minProjected = negativeDays.reduce(
    (minimum, day) => (day.projectedBalance < minimum ? day.projectedBalance : minimum),
    negativeDays[0].projectedBalance,
  );

  return {
    hasRisk: true,
    earliestNegativeDate: negativeDays[0].date,
    minProjected,
  };
}

export function topInflowsOutflows(
  transactions: Transaction[],
  rangeStartIso: string,
  rangeEndIso: string,
  limit = 5,
): TopFlowsResult {
  const nextRangeTransactions = transactions.filter((transaction) =>
    isInRange(transaction.dueDate, rangeStartIso, rangeEndIso),
  );

  const outflows = nextRangeTransactions
    .filter((transaction) => {
      if (transaction.type === 'cheque') {
        return transaction.status === 'pending' || transaction.status === 'deducted';
      }

      return transaction.type === 'withdrawal';
    })
    .sort((left, right) => right.amount - left.amount)
    .slice(0, limit);

  const inflows = nextRangeTransactions
    .filter((transaction) => transaction.type === 'deposit')
    .sort((left, right) => right.amount - left.amount)
    .slice(0, limit);

  return {
    outflows,
    inflows,
  };
}
