import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarView } from '@/components/dashboard/CalendarView';
import { StatisticsDashboard } from '@/components/dashboard/StatisticsDashboard';
import { useCalendar } from '@/context/CalendarContext';
import { calculateCurrentBalance } from '@/utils/balance';
import { toIsoDate } from '@/utils/date';
import type { Account, Profile, Transaction } from '@/types/domain';
import { getAccounts, getProfile, getTransactions, runDueStatusTransition } from '@/services/transactions';

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return fallback;
}

type RangeMode = 'currentMonth' | 'custom';

interface DateRange {
  startDate: string;
  endDate: string;
}

function getCurrentMonthRange(referenceDate: Date = new Date()): DateRange {
  const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);
  return {
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
  };
}

export function DashboardPage() {
  const { mode } = useCalendar();
  const initialRange = getCurrentMonthRange(new Date());

  const [profile, setProfile] = useState<Profile | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [statsTransactions, setStatsTransactions] = useState<Transaction[]>([]);
  const [rangeMode, setRangeMode] = useState<RangeMode>('currentMonth');
  const [customStartDate, setCustomStartDate] = useState(initialRange.startDate);
  const [customEndDate, setCustomEndDate] = useState(initialRange.endDate);
  const [appliedRange, setAppliedRange] = useState<DateRange>(initialRange);
  const [monthDate, setMonthDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const profileData = await getProfile();
      try {
        await runDueStatusTransition(profileData.timezone);
      } catch (transitionError) {
        // Keep dashboard usable even if RPC is missing or temporarily unavailable.
        console.warn(
          'Unable to run due status transition:',
          getErrorMessage(transitionError, 'Transition error'),
        );
      }
      const [accountsData, transactionData] = await Promise.all([getAccounts(), getTransactions()]);

      setProfile(profileData);
      setAccounts(accountsData);
      setTransactions(transactionData);
    } catch (loadError) {
      const message = getErrorMessage(loadError, 'Unable to load dashboard.');
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (rangeMode === 'currentMonth') {
      setAppliedRange(getCurrentMonthRange(new Date()));
      return;
    }

    if (customStartDate && customEndDate && customStartDate <= customEndDate) {
      setAppliedRange({
        startDate: customStartDate,
        endDate: customEndDate,
      });
    }
  }, [customEndDate, customStartDate, rangeMode]);

  const loadStatsTransactions = useCallback(async (range: DateRange) => {
    setStatsLoading(true);
    setStatsError(null);

    try {
      const data = await getTransactions({
        dateField: 'dueDate',
        dateFrom: range.startDate,
        dateTo: range.endDate,
        sortBy: 'date',
        sortDirection: 'asc',
      });
      setStatsTransactions(data);
    } catch (statsLoadError) {
      setStatsTransactions([]);
      setStatsError(getErrorMessage(statsLoadError, 'Unable to load dashboard statistics.'));
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatsTransactions(appliedRange);
  }, [appliedRange, loadStatsTransactions]);

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
      <StatisticsDashboard
        currentBalance={currentBalance}
        allTransactions={transactions}
        rangeTransactions={statsTransactions}
        rangeMode={rangeMode}
        rangeStartDate={appliedRange.startDate}
        rangeEndDate={appliedRange.endDate}
        customStartDate={customStartDate}
        customEndDate={customEndDate}
        loading={statsLoading}
        error={statsError}
        onRangeModeChange={setRangeMode}
        onCustomStartDateChange={setCustomStartDate}
        onCustomEndDateChange={setCustomEndDate}
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
