import type { Transaction } from '@/types/domain';

export interface CalendarDateTotals {
  deposits: number;
  cheques: number;
  withdrawals: number;
  deductions: number;
}

export function getTransactionsForDate(transactions: Transaction[], dateIso: string): Transaction[] {
  return [...transactions]
    .filter((transaction) => transaction.dueDate === dateIso)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function getCalendarDateTotals(dayTransactions: Transaction[]): CalendarDateTotals {
  const deposits = dayTransactions
    .filter((transaction) => transaction.type === 'deposit')
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const cheques = dayTransactions
    .filter((transaction) => transaction.type === 'cheque')
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const withdrawals = dayTransactions
    .filter((transaction) => transaction.type === 'withdrawal')
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  return {
    deposits,
    cheques,
    withdrawals,
    deductions: cheques + withdrawals,
  };
}
