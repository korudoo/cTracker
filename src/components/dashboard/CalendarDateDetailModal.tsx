import { useMemo } from 'react';
import type { ProjectionResult } from '@/utils/balanceProjection';
import { getDateProjectionDetail } from '@/utils/balanceProjection';
import { formatDualDate } from '@/utils/nepaliDate';
import { getTransactionStatusLabel } from '@/utils/transactionStatus';
import { getCalendarDateTotals, getTransactionsForDate } from '@/utils/calendarDay';
import type { Transaction } from '@/types/domain';

interface CalendarDateDetailModalProps {
  selectedDateIso: string | null;
  onClose: () => void;
  transactions: Transaction[];
  projection: ProjectionResult;
  currentBalance: number;
  clearedBalanceByDate: Record<string, number>;
  openingBalance: number;
}

function currency(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'NPR',
    minimumFractionDigits: 2,
  });
}

export function CalendarDateDetailModal({
  selectedDateIso,
  onClose,
  transactions,
  projection,
  currentBalance,
  clearedBalanceByDate,
  openingBalance,
}: CalendarDateDetailModalProps) {
  const selectedDateTransactions = useMemo(() => {
    if (!selectedDateIso) {
      return [];
    }

    return getTransactionsForDate(transactions, selectedDateIso);
  }, [selectedDateIso, transactions]);

  const selectedDateTotals = useMemo(
    () => getCalendarDateTotals(selectedDateTransactions),
    [selectedDateTransactions],
  );

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

  if (!selectedDateIso) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Close date detail modal"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />

      <section className="relative z-10 w-full max-w-xl rounded-t-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:rounded-2xl sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Date Details</h3>
            <p className="text-sm text-slate-500">{formatDualDate(selectedDateIso)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-4">
          <article className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
            <p className="text-xs uppercase tracking-wide text-emerald-700">Total Deposits</p>
            <p className="mt-1 text-sm font-semibold text-emerald-800">{currency(selectedDateTotals.deposits)}</p>
          </article>
          <article className="rounded-lg border border-rose-100 bg-rose-50 p-3">
            <p className="text-xs uppercase tracking-wide text-rose-700">Total Deductions</p>
            <p className="mt-1 text-sm font-semibold text-rose-800">{currency(selectedDateTotals.deductions)}</p>
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
  );
}
