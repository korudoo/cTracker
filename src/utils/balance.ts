import type { Transaction } from '@/types/domain';
import {
  calculateCurrentBalance as calculateCurrentBalanceFromProjection,
  calculateProjectedBalancesForRange,
} from '@/utils/balanceProjection';

export function calculateCurrentBalance(openingBalance: number, transactions: Transaction[]): number {
  return calculateCurrentBalanceFromProjection(openingBalance, transactions);
}

export function calculateProjectedBalanceOnDate(
  currentBalance: number,
  transactions: Transaction[],
  dateIso: string,
): number {
  const projection = calculateProjectedBalancesForRange({
    currentBalance,
    transactions,
    startDate: dateIso,
    endDate: dateIso,
  });

  return projection.byDate[dateIso]?.projectedBalance ?? currentBalance;
}

export function calculatePendingTotals(transactions: Transaction[]) {
  const pendingDeposits = transactions
    .filter((transaction) => transaction.status === 'pending' && transaction.type === 'deposit')
    .reduce((total, transaction) => total + transaction.amount, 0);

  const pendingOutflows = transactions
    .filter(
      (transaction) =>
        transaction.status === 'pending' &&
        (transaction.type === 'cheque' || transaction.type === 'withdrawal'),
    )
    .reduce((total, transaction) => total + transaction.amount, 0);

  return {
    pendingDeposits,
    pendingOutflows,
  };
}
