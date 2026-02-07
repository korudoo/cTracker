import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { createOnboardingAccount, hasAnyAccount } from '@/services/transactions';

export function OnboardingPage() {
  const navigate = useNavigate();
  const [accountName, setAccountName] = useState('Primary Account');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const checkExistingAccount = async () => {
      try {
        const onboarded = await hasAnyAccount();
        if (onboarded && active) {
          navigate('/dashboard', { replace: true });
          return;
        }
      } catch {
        // Keep page interactive even if check fails.
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void checkExistingAccount();

    return () => {
      active = false;
    };
  }, [navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const parsedOpeningBalance = Number(openingBalance);
    if (!Number.isFinite(parsedOpeningBalance)) {
      setError('Opening balance must be a valid number.');
      setSubmitting(false);
      return;
    }

    try {
      await createOnboardingAccount({
        name: accountName,
        openingBalance: parsedOpeningBalance,
      });
      navigate('/dashboard', { replace: true });
    } catch (submissionError) {
      const message =
        submissionError instanceof Error ? submissionError.message : 'Unable to create onboarding account.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="rounded-xl bg-white px-6 py-4 shadow-card">Loading onboarding...</div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Step 1 of 1</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Set up your first account</h1>
        <p className="mt-1 text-sm text-slate-500">
          Create your default account and initial opening balance.
        </p>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Account name</span>
            <input
              type="text"
              value={accountName}
              onChange={(event) => setAccountName(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              required
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Opening balance</span>
            <input
              type="number"
              step="0.01"
              value={openingBalance}
              onChange={(event) => setOpeningBalance(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              required
            />
          </label>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            {submitting ? 'Saving...' : 'Finish setup'}
          </button>
        </form>
      </section>
    </main>
  );
}
