import { useCallback, useEffect, useState } from 'react';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { TransactionTable } from '@/components/transactions/TransactionTable';
import { useCalendar } from '@/context/CalendarContext';
import {
  createTransaction,
  deleteTransaction,
  getAccounts,
  getProfile,
  getTransactions,
  runDueStatusTransition,
  updateTransaction,
} from '@/services/transactions';
import type { Account, Transaction, TransactionInput } from '@/types/domain';

export function TransactionsPage() {
  const { mode } = useCalendar();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const profile = await getProfile();
      await runDueStatusTransition(profile.timezone);
      const [accountsData, transactionData] = await Promise.all([getAccounts(), getTransactions()]);

      setAccounts(accountsData);
      setTransactions(transactionData);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Unable to load transactions.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSave = async (payload: TransactionInput) => {
    setSaving(true);
    setError(null);

    try {
      if (editing) {
        await updateTransaction(editing.id, payload);
      } else {
        await createTransaction(payload);
      }

      const transactionData = await getTransactions();
      setTransactions(transactionData);
      setEditing(null);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Unable to save transaction.';
      setError(message);
      throw saveError;
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (transaction: Transaction) => {
    const approved = window.confirm(`Delete transaction for ${transaction.type} (${transaction.amount})?`);
    if (!approved) return;

    setError(null);

    try {
      await deleteTransaction(transaction.id);
      setTransactions((previous) => previous.filter((item) => item.id !== transaction.id));
      if (editing?.id === transaction.id) {
        setEditing(null);
      }
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : 'Unable to delete transaction.';
      setError(message);
    }
  };

  if (loading) {
    return <div className="rounded-xl bg-white p-6 shadow-card">Loading transactions...</div>;
  }

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      <TransactionForm
        accounts={accounts}
        calendarMode={mode}
        initialTransaction={editing}
        isSaving={saving}
        onSubmit={handleSave}
        onCancelEdit={() => setEditing(null)}
      />

      <TransactionTable
        transactions={transactions}
        calendarMode={mode}
        onEdit={(transaction) => setEditing(transaction)}
        onDelete={handleDelete}
      />
    </div>
  );
}
