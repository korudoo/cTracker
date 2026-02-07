import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { markAuthSession } from '@/utils/authSession';

type AuthMode = 'login' | 'register' | 'reset';

export function AuthPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate, user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      if (mode === 'login') {
        const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
        if (loginError) throw loginError;
        markAuthSession(rememberMe);
        navigate('/dashboard', { replace: true });
      }

      if (mode === 'register') {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match.');
        }

        const { data, error: signupError } = await supabase.auth.signUp({ email, password });
        if (signupError) throw signupError;

        if (data.session) {
          markAuthSession(true);
          navigate('/dashboard', { replace: true });
        } else {
          setMessage('Registration successful. Check your email to confirm your account.');
        }
      }

      if (mode === 'reset') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });

        if (resetError) throw resetError;
        setMessage('Password reset email sent.');
      }
    } catch (submissionError) {
      const nextError = submissionError instanceof Error ? submissionError.message : 'Auth request failed.';
      setError(nextError);
    } finally {
      setLoading(false);
    }
  };

  const submitLabel =
    mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : 'Send reset link';

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <h1 className="text-2xl font-semibold text-slate-900">Cheque Tracker</h1>
        <p className="mt-1 text-sm text-slate-500">Secure cheque, deposit, and withdrawal tracking.</p>

        <div className="mt-4 flex rounded-lg bg-slate-100 p-1">
          {(['login', 'register', 'reset'] as AuthMode[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium capitalize ${
                mode === item ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              required
            />
          </label>

          {mode !== 'reset' ? (
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                required
              />
            </label>
          ) : null}

          {mode === 'login' ? (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Remember me for 30 days
            </label>
          ) : null}

          {mode === 'register' ? (
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Confirm Password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                required
              />
            </label>
          ) : null}

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            {loading ? 'Please wait...' : submitLabel}
          </button>
        </form>
      </section>
    </main>
  );
}
