import type { TransactionStatus, TransactionType } from '@/types/domain';
import { getTransactionStatusLabel } from '@/utils/transactionStatus';

const STATUS_STYLES: Record<TransactionStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  deducted: 'bg-rose-100 text-rose-800',
  cleared: 'bg-emerald-100 text-emerald-800',
};

export function StatusBadge({ status, type }: { status: TransactionStatus; type: TransactionType }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[status]}`}>
      {getTransactionStatusLabel(type, status)}
    </span>
  );
}
