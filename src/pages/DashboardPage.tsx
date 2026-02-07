import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarView } from '@/components/dashboard/CalendarView';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { useCalendar } from '@/context/CalendarContext';
import { calculateCurrentBalance, calculatePendingTotals, calculateProjectedBalanceOnDate } from '@/utils/balance';
import { toIsoDate } from '@/utils/date';
import type { Account, Profile, Transaction } from '@/types/domain';
import { getAccounts, getProfile, getTransactions, runDueStatusTransition } from '@/services/transactions';

export function DashboardPage() {
  const { mode } = useCalendar();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [monthDate, setMonthDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const profileData = await getProfile();
      await runDueStatusTransition(profileData.timezone);
      const [accountsData, transactionData] = await Promise.all([getAccounts(), getTransactions()]);

      setProfile(profileData);
      setAccounts(accountsData);
      setTransactions(transactionData);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Unable to load dashboard.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!profile?.notificationsEnabled || typeof Notification === 'undefined') {
      return;
    }

    if (Notification.permission === 'default') {
      void Notification.requestPermission();
      return;
    }

    if (Notification.permission === 'granted') {
      const today = toIsoDate(new Date());
      const dueToday = transactions.filter((transaction) => transaction.dueDate === today).length;
      if (dueToday > 0) {
        new Notification(`Cheque Tracker: ${dueToday} due item(s) today.`);
      }
    }
  }, [profile?.notificationsEnabled, transactions]);

  const openingBalance = accounts.reduce((total, account) => total + account.openingBalance, 0);
  const currentBalance = useMemo(
    () => calculateCurrentBalance(openingBalance, transactions),
    [openingBalance, transactions],
  );
  const projectedToday = useMemo(
    () => calculateProjectedBalanceOnDate(currentBalance, transactions, toIsoDate(new Date())),
    [currentBalance, transactions],
  );

  const { pendingDeposits, pendingOutflows } = useMemo(
    () => calculatePendingTotals(transactions),
    [transactions],
  );

  if (loading) {
    return <div className="rounded-xl bg-white p-6 shadow-card">Loading dashboard...</div>;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
        <p>{error}</p>
        <button
          type="button"
          onClick={() => void loadDashboard()}
          className="mt-3 rounded-lg border border-rose-300 px-3 py-1.5 text-sm font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <StatsCards
        currentBalance={currentBalance}
        projectedToday={projectedToday}
        pendingDeposits={pendingDeposits}
        pendingOutflows={pendingOutflows}
      />

      <CalendarView
        mode={mode}
        currentBalance={currentBalance}
        monthDate={monthDate}
        transactions={transactions}
        onMonthDateChange={setMonthDate}
      />
    </div>
  );
}
