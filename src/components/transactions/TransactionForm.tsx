import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { DateField } from '@/components/common/DateField';
import type {
  Account,
  CalendarMode,
  Transaction,
  TransactionInput,
  TransactionStatus,
  TransactionType,
} from '@/types/domain';
import { TRANSACTION_STATUSES, TRANSACTION_TYPES } from '@/types/domain';
import { toIsoDate } from '@/utils/date';

interface TransactionFormProps {
  accounts: Account[];
  calendarMode: CalendarMode;
  initialTransaction: Transaction | null;
  isSaving: boolean;
  onSubmit: (payload: TransactionInput) => Promise<void>;
  onCancelEdit: () => void;
}

function mapTransactionToInput(transaction: Transaction): TransactionInput {
  return {
    accountId: transaction.accountId,
    type: transaction.type,
    amount: transaction.amount,
    status: transaction.status,
    dueDate: transaction.dueDate,
    chequeNumber: transaction.chequeNumber,
    note: transaction.note,
  };
}

function buildDefaultInput(accounts: Account[]): TransactionInput {
  return {
    accountId: accounts[0]?.id ?? '',
    type: 'cheque',
    amount: 0,
    status: 'pending',
    dueDate: toIsoDate(new Date()),
    chequeNumber: '',
    note: '',
  };
}

export function TransactionForm({
  accounts,
  calendarMode,
  initialTransaction,
  isSaving,
  onSubmit,
  onCancelEdit,
}: TransactionFormProps) {
  const defaultInput = useMemo(() => buildDefaultInput(accounts), [accounts]);
  const [formData, setFormData] = useState<TransactionInput>(defaultInput);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialTransaction) {
      setFormData(mapTransactionToInput(initialTransaction));
    } else {
      setFormData(defaultInput);
    }
    setError(null);
  }, [defaultInput, initialTransaction]);

  const handleTypeChange = (type: TransactionType) => {
    setFormData((previous) => ({
      ...previous,
      type,
      chequeNumber: type === 'cheque' ? previous.chequeNumber ?? '' : null,
    }));
  };

  const handleStatusChange = (status: TransactionStatus) => {
    setFormData((previous) => ({ ...previous, status }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!formData.accountId) {
      setError('Select an account before saving.');
      return;
    }

    if (!formData.dueDate) {
      setError('Due date is required.');
      return;
    }

    try {
      await onSubmit({
        ...formData,
        amount: Number(formData.amount),
        chequeNumber: formData.type === 'cheque' ? formData.chequeNumber : null,
      });

      if (!initialTransaction) {
        setFormData(defaultInput);
      }
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Unable to save transaction.';
      setError(message);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">
          {initialTransaction ? 'Edit Transaction' : 'Add Transaction'}
        </h2>
        {initialTransaction ? (
          <button
            type="button"
            onClick={onCancelEdit}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
        ) : null}
      </div>

      <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Account</span>
          <select
            value={formData.accountId}
            onChange={(event) => setFormData((previous) => ({ ...previous, accountId: event.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            required
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Type</span>
          <select
            value={formData.type}
            onChange={(event) => handleTypeChange(event.target.value as TransactionType)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            required
          >
            {TRANSACTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Amount</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={formData.amount || ''}
            onChange={(event) =>
              setFormData((previous) => ({
                ...previous,
                amount: Number(event.target.value),
              }))
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Status</span>
          <select
            value={formData.status}
            onChange={(event) => handleStatusChange(event.target.value as TransactionStatus)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            required
          >
            {TRANSACTION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <DateField
          id="due-date"
          label="Due Date"
          mode={calendarMode}
          value={formData.dueDate}
          onChange={(nextDate) => setFormData((previous) => ({ ...previous, dueDate: nextDate }))}
          required
        />

        {formData.type === 'cheque' ? (
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Cheque Number</span>
            <input
              type="text"
              value={formData.chequeNumber ?? ''}
              onChange={(event) =>
                setFormData((previous) => ({
                  ...previous,
                  chequeNumber: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              required
            />
          </label>
        ) : null}

        <label className="block space-y-1 md:col-span-2">
          <span className="text-sm font-medium text-slate-700">Note</span>
          <textarea
            rows={3}
            value={formData.note ?? ''}
            onChange={(event) => setFormData((previous) => ({ ...previous, note: event.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </label>

        {error ? <p className="text-sm text-rose-600 md:col-span-2">{error}</p> : null}

        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            {isSaving ? 'Saving...' : initialTransaction ? 'Update Transaction' : 'Create Transaction'}
          </button>
        </div>
      </form>
    </section>
  );
}
