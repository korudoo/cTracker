import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { hasAnyAccount } from '@/services/transactions';

export function OnboardingGuard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hasAccount, setHasAccount] = useState(false);

  useEffect(() => {
    let active = true;

    const checkOnboarding = async () => {
      try {
        const onboarded = await hasAnyAccount();
        if (active) {
          setHasAccount(onboarded);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void checkOnboarding();

    return () => {
      active = false;
    };
  }, [user?.id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="rounded-xl bg-white px-6 py-4 shadow-card">Checking onboarding...</div>
      </div>
    );
  }

  if (!hasAccount) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
