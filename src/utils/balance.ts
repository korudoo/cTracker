import type { Transaction } from '@/types/domain';

export function calculateCurrentBalance(openingBalance: number, transactions: Transaction[]): number {
  const cleared = transactions.filter((transaction) => transaction.status === 'cleared');

  const clearedDeposits = cleared
    .filter((transaction) => transaction.type === 'deposit')
    .reduce((total, transaction) => total + transaction.amount, 0);

  const clearedOutflows = cleared
    .filter((transaction) => transaction.type === 'cheque' || transaction.type === 'withdrawal')
    .reduce((total, transaction) => total + transaction.amount, 0);

  return openingBalance + clearedDeposits - clearedOutflows;
}

export function calculateProjectedBalanceOnDate(
  currentBalance: number,
  transactions: Transaction[],
  dateIso: string,
): number {
  const projectionEligible = transactions.filter((transaction) => transaction.dueDate <= dateIso);

  const projectedDeposits = projectionEligible
    .filter((transaction) => transaction.type === 'deposit')
    .reduce((total, transaction) => total + transaction.amount, 0);

  const projectedCheques = projectionEligible
    .filter((transaction) => transaction.type === 'cheque')
    .reduce((total, transaction) => total + transaction.amount, 0);

  const projectedWithdrawals = projectionEligible
    .filter((transaction) => transaction.type === 'withdrawal')
    .reduce((total, transaction) => total + transaction.amount, 0);

  return currentBalance + projectedDeposits - projectedCheques - projectedWithdrawals;
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
