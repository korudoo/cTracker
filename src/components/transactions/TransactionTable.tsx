import { StatusBadge } from '@/components/common/StatusBadge';
import type { CalendarMode, Transaction } from '@/types/domain';
import { formatDateForMode } from '@/utils/nepaliDate';

type DateFieldMode = 'dueDate' | 'createdDate';

interface TransactionTableProps {
  transactions: Transaction[];
  calendarMode: CalendarMode;
  dateField: DateFieldMode;
  emptyMessage?: string;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
}

function formatCurrency(value: number) {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'NPR',
    minimumFractionDigits: 2,
  });
}

function getDetails(transaction: Transaction, calendarMode: CalendarMode): string {
  if (transaction.type === 'cheque') {
    return `Payee: ${transaction.payee ?? '-'} | Written: ${formatDateForMode(transaction.createdDate, calendarMode)}`;
  }

  return `${transaction.description ?? '-'}${
    transaction.referenceNumber ? ` | Ref: ${transaction.referenceNumber}` : ''
  }`;
}

export function TransactionTable({
  transactions,
  calendarMode,
  dateField,
  emptyMessage = 'No transactions match the current filters.',
  onEdit,
  onDelete,
}: TransactionTableProps) {
  const dateLabel = dateField === 'createdDate' ? 'Created Date' : 'Due Date';

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Transactions</h2>
        <p className="text-sm text-slate-500">{transactions.length} total</p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-2 pr-4 font-medium">{dateLabel}</th>
              <th className="py-2 pr-4 font-medium">Account</th>
              <th className="py-2 pr-4 font-medium">Type</th>
              <th className="py-2 pr-4 font-medium">Amount</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 pr-4 font-medium">Cheque #</th>
              <th className="py-2 pr-4 font-medium">Details</th>
              <th className="py-2 pr-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {transactions.map((transaction) => (
              <tr key={transaction.id}>
                <td className="py-3 pr-4 text-slate-700">
                  {formatDateForMode(
                    dateField === 'createdDate' ? transaction.createdDate : transaction.dueDate,
                    calendarMode,
                  )}
                </td>
                <td className="py-3 pr-4 text-slate-700">{transaction.accountName}</td>
                <td className="py-3 pr-4 capitalize text-slate-700">{transaction.type}</td>
                <td
                  className={`py-3 pr-4 font-semibold ${
                    transaction.type === 'deposit' ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {transaction.type === 'deposit' ? '+' : '-'}
                  {formatCurrency(transaction.amount)}
                </td>
                <td className="py-3 pr-4">
                  <StatusBadge status={transaction.status} />
                </td>
                <td className="py-3 pr-4 text-slate-700">{transaction.chequeNumber ?? '—'}</td>
                <td className="py-3 pr-4 text-xs text-slate-600">
                  {getDetails(transaction, calendarMode)}
                </td>
                <td className="py-3 pr-4">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(transaction)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(transaction)}
                      className="rounded-md border border-rose-300 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!transactions.length ? (
        <p className="py-6 text-center text-sm text-slate-500">{emptyMessage}</p>
      ) : null}
    </section>
  );
}
