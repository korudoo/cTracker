import { useState, type FormEvent } from 'react';
import type { Account } from '@/types/domain';

interface AccountManagerProps {
  accounts: Account[];
  isSaving: boolean;
  onCreateAccount: (name: string) => Promise<void>;
}

export function AccountManager({ accounts, isSaving, onCreateAccount }: AccountManagerProps) {
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const name = newName.trim();
    if (!name) {
      setError('Account name is required.');
      return;
    }

    try {
      await onCreateAccount(name);
      setNewName('');
    } catch (submissionError) {
      const message = submissionError instanceof Error ? submissionError.message : 'Unable to create account.';
      setError(message);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
      <h2 className="text-lg font-semibold text-slate-900">Accounts</h2>
      <p className="mt-1 text-sm text-slate-500">Cheque numbers are unique per account.</p>

      <ul className="mt-4 space-y-2">
        {accounts.map((account) => (
          <li
            key={account.id}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-700">{account.name}</span>
              {account.isDefault ? (
                <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
                  Default
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Opening: ${account.openingBalance.toFixed(2)} | Current: ${account.currentBalance.toFixed(2)}
            </p>
          </li>
        ))}
      </ul>

      <form onSubmit={handleSubmit} className="mt-4 space-y-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">New Account Name</span>
          <input
            type="text"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            placeholder="Business Account"
          />
        </label>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        <button
          type="submit"
          disabled={isSaving}
          className="rounded-lg border border-brand-300 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
        >
          {isSaving ? 'Adding...' : 'Add Account'}
        </button>
      </form>
    </section>
  );
}
