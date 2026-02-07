import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
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

interface TransactionFormValues {
  accountId: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  dueDate: string;
  createdDate: string;
  chequeNumber: string;
  payee: string;
  description: string;
  referenceNumber: string;
}

function getDefaultValues(accounts: Account[]): TransactionFormValues {
  const today = toIsoDate(new Date());
  return {
    accountId: accounts[0]?.id ?? '',
    type: 'cheque',
    status: 'pending',
    amount: 0,
    dueDate: today,
    createdDate: today,
    chequeNumber: '',
    payee: '',
    description: '',
    referenceNumber: '',
  };
}

function mapTransactionToForm(transaction: Transaction): TransactionFormValues {
  return {
    accountId: transaction.accountId,
    type: transaction.type,
    status: transaction.status,
    amount: transaction.amount,
    dueDate: transaction.dueDate,
    createdDate: transaction.createdDate,
    chequeNumber: transaction.chequeNumber ?? '',
    payee: transaction.payee ?? '',
    description: transaction.description ?? '',
    referenceNumber: transaction.referenceNumber ?? '',
  };
}

function trimOrEmpty(value: string): string {
  return value.trim();
}

function trimOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function TransactionForm({
  accounts,
  calendarMode,
  initialTransaction,
  isSaving,
  onSubmit,
  onCancelEdit,
}: TransactionFormProps) {
  const todayIso = toIsoDate(new Date());

  const validationSchema = useMemo(
    () =>
      yup.object({
        accountId: yup.string().required('Account is required.'),
        type: yup
          .mixed<TransactionType>()
          .oneOf(TRANSACTION_TYPES)
          .required('Transaction type is required.'),
        status: yup
          .mixed<TransactionStatus>()
          .oneOf(TRANSACTION_STATUSES)
          .required('Status is required.'),
        amount: yup
          .number()
          .typeError('Amount must be a number.')
          .moreThan(0, 'Amount must be greater than 0.')
          .required('Amount is required.'),
        dueDate: yup
          .string()
          .required('Due date is required.')
          .test('cheque-due-date', 'Cheque date cannot be in the past.', function validate(value) {
            if (!value) return false;
            if (this.parent.type !== 'cheque') return true;
            return value >= todayIso;
          }),
        createdDate: yup
          .string()
          .required('Created date is required.')
          .test('written-date-not-future', 'Written date cannot be in the future.', function validate(value) {
            if (!value) return false;
            if (this.parent.type !== 'cheque') return true;
            return value <= todayIso;
          })
          .test('written-before-due', 'Written date cannot be after cheque date.', function validate(value) {
            if (!value) return false;
            if (this.parent.type !== 'cheque') return true;
            const dueDate: string | undefined = this.parent.dueDate;
            if (!dueDate) return true;
            return value <= dueDate;
          }),
        chequeNumber: yup.string().test('cheque-number-rule', 'Cheque number is required.', function validate(value) {
          if (this.parent.type !== 'cheque') return true;
          return Boolean(value && value.trim().length > 0);
        }),
        payee: yup.string().test('payee-rule', 'Payee is required for cheque.', function validate(value) {
          if (this.parent.type !== 'cheque') return true;
          return Boolean(value && value.trim().length > 0);
        }),
        description: yup
          .string()
          .test('description-rule', 'Description is required.', function validate(value) {
            if (this.parent.type === 'cheque') return true;
            return Boolean(value && value.trim().length > 0);
          }),
        referenceNumber: yup.string().optional(),
      }),
    [todayIso],
  );

  const defaultValues = useMemo(() => getDefaultValues(accounts), [accounts]);

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<TransactionFormValues>({
    resolver: yupResolver(validationSchema),
    mode: 'onBlur',
    defaultValues,
  });

  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (initialTransaction) {
      reset(mapTransactionToForm(initialTransaction));
      setSubmitError(null);
      return;
    }

    reset(defaultValues);
    setSubmitError(null);
  }, [defaultValues, initialTransaction, reset]);

  const selectedType = watch('type');

  const onFormSubmit = async (values: TransactionFormValues) => {
    setSubmitError(null);

    try {
      await onSubmit({
        accountId: values.accountId,
        type: values.type,
        status: values.status,
        amount: Number(values.amount),
        dueDate: values.dueDate,
        createdDate: values.type === 'cheque' ? values.createdDate : values.createdDate || todayIso,
        chequeNumber: values.type === 'cheque' ? trimOrEmpty(values.chequeNumber) : null,
        payee: values.type === 'cheque' ? trimOrEmpty(values.payee) : null,
        description: values.type === 'cheque' ? null : trimOrEmpty(values.description),
        referenceNumber:
          values.type === 'deposit' || values.type === 'withdrawal'
            ? trimOrNull(values.referenceNumber)
            : null,
      });

      if (!initialTransaction) {
        reset(defaultValues);
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to save transaction.');
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

      <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(onFormSubmit)}>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Type</span>
          <select
            {...register('type')}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            {TRANSACTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          {errors.type ? <p className="text-xs text-rose-600">{errors.type.message}</p> : null}
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Account</span>
          <select
            {...register('accountId')}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
          {errors.accountId ? <p className="text-xs text-rose-600">{errors.accountId.message}</p> : null}
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Amount</span>
          <input
            type="number"
            step="0.01"
            min="0"
            {...register('amount', { valueAsNumber: true })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
          {errors.amount ? <p className="text-xs text-rose-600">{errors.amount.message}</p> : null}
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Status</span>
          <select
            {...register('status')}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            {TRANSACTION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          {errors.status ? <p className="text-xs text-rose-600">{errors.status.message}</p> : null}
        </label>

        <Controller
          control={control}
          name="dueDate"
          render={({ field }) => (
            <DateField
              id="due-date"
              label={selectedType === 'cheque' ? 'Cheque Date' : 'Due Date'}
              mode={calendarMode}
              value={field.value}
              onChange={field.onChange}
              required
            />
          )}
        />
        {errors.dueDate ? <p className="md:col-span-2 -mt-3 text-xs text-rose-600">{errors.dueDate.message}</p> : null}

        {selectedType === 'cheque' ? (
          <>
            <Controller
              control={control}
              name="createdDate"
              render={({ field }) => (
                <DateField
                  id="created-date"
                  label="Written Date"
                  mode={calendarMode}
                  value={field.value}
                  onChange={field.onChange}
                  required
                />
              )}
            />
            {errors.createdDate ? (
              <p className="md:col-span-2 -mt-3 text-xs text-rose-600">{errors.createdDate.message}</p>
            ) : null}

            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Cheque Number</span>
              <input
                type="text"
                {...register('chequeNumber')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
              {errors.chequeNumber ? (
                <p className="text-xs text-rose-600">{errors.chequeNumber.message}</p>
              ) : null}
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Payee</span>
              <input
                type="text"
                {...register('payee')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
              {errors.payee ? <p className="text-xs text-rose-600">{errors.payee.message}</p> : null}
            </label>
          </>
        ) : (
          <>
            <label className="block space-y-1 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Description</span>
              <textarea
                rows={3}
                {...register('description')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
              {errors.description ? (
                <p className="text-xs text-rose-600">{errors.description.message}</p>
              ) : null}
            </label>

            <label className="block space-y-1 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">
                {selectedType === 'deposit' ? 'Reference Number (Optional)' : 'Reference (Optional)'}
              </span>
              <input
                type="text"
                {...register('referenceNumber')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </label>
          </>
        )}

        {submitError ? <p className="text-sm text-rose-600 md:col-span-2">{submitError}</p> : null}

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
