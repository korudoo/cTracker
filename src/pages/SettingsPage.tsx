import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AccountManager } from '@/components/settings/AccountManager';
import { useCalendar } from '@/context/CalendarContext';
import {
  getNotificationSettings,
  updateNotificationSettings,
} from '@/services/notifications';
import {
  adjustAccountOpeningBalance,
  createAccount,
  getAccounts,
  getProfile,
  getTransactions,
  runDueStatusTransition,
  updateProfile,
} from '@/services/transactions';
import type { Account, NotificationSettings, Transaction } from '@/types/domain';
import { downloadCsv, toCsv } from '@/utils/csv';

export function SettingsPage() {
  const { mode, setMode } = useCalendar();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [calendarPreference, setCalendarPreference] = useState<'AD' | 'BS'>('AD');
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);

  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [newOpeningBalance, setNewOpeningBalance] = useState('0');
  const [adjustReason, setAdjustReason] = useState('Opening balance correction');

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingNotificationSettings, setSavingNotificationSettings] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [adjustingBalance, setAdjustingBalance] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const profileData = await getProfile();
      const [accountsData, transactionData, userNotificationSettings] = await Promise.all([
        getAccounts(),
        getTransactions(),
        getNotificationSettings(),
      ]);

      setAccounts(accountsData);
      setTransactions(transactionData);
      setNotificationsEnabled(profileData.notificationsEnabled);
      setTimezone(profileData.timezone);
      setCalendarPreference(profileData.calendarPreference);
      setNotificationSettings(userNotificationSettings);

      if (accountsData.length > 0) {
        const firstAccount = accountsData[0];
        setSelectedAccountId(firstAccount.id);
        setNewOpeningBalance(firstAccount.openingBalance.toFixed(2));
      }
    } catch (loadError) {
      const nextError = loadError instanceof Error ? loadError.message : 'Unable to load settings.';
      setError(nextError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) ?? null;

  const handleNotificationSettingChange = <K extends keyof NotificationSettings>(
    key: K,
    value: NotificationSettings[K],
  ) => {
    setNotificationSettings((previous) => (previous ? { ...previous, [key]: value } : previous));
  };

  const handleSaveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingProfile(true);
    setMessage(null);
    setError(null);

    try {
      await updateProfile({
        notificationsEnabled,
        timezone,
        calendarPreference,
      });

      setMode(calendarPreference);
      setMessage('Settings saved.');
    } catch (saveError) {
      const nextError = saveError instanceof Error ? saveError.message : 'Unable to update settings.';
      setError(nextError);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCreateAccount = async (name: string) => {
    setSavingAccount(true);
    setMessage(null);
    setError(null);

    try {
      const account = await createAccount(name);
      const nextAccounts = [...accounts, account].sort((a, b) => a.name.localeCompare(b.name));
      setAccounts(nextAccounts);

      if (!selectedAccountId) {
        setSelectedAccountId(account.id);
        setNewOpeningBalance(account.openingBalance.toFixed(2));
      }

      setMessage('Account created.');
    } catch (saveError) {
      const nextError = saveError instanceof Error ? saveError.message : 'Unable to create account.';
      setError(nextError);
      throw saveError;
    } finally {
      setSavingAccount(false);
    }
  };

  const handleSaveNotificationSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!notificationSettings) {
      return;
    }

    setSavingNotificationSettings(true);
    setMessage(null);
    setError(null);

    try {
      const updated = await updateNotificationSettings({
        enableCheque: notificationSettings.enableCheque,
        enableDeposit: notificationSettings.enableDeposit,
        enableWithdrawal: notificationSettings.enableWithdrawal,
        timing1Week: notificationSettings.timing1Week,
        timing3Days: notificationSettings.timing3Days,
        timing1Day: notificationSettings.timing1Day,
        timingDayOf: notificationSettings.timingDayOf,
        quietHoursEnabled: notificationSettings.quietHoursEnabled,
        quietHoursStart: notificationSettings.quietHoursStart,
        quietHoursEnd: notificationSettings.quietHoursEnd,
        deliveryTime: notificationSettings.deliveryTime,
        timezone: notificationSettings.timezone,
      });

      setNotificationSettings(updated);
      setMessage('Notification settings saved.');
    } catch (saveError) {
      const nextError =
        saveError instanceof Error ? saveError.message : 'Unable to update notification settings.';
      setError(nextError);
    } finally {
      setSavingNotificationSettings(false);
    }
  };

  const handleAdjustOpeningBalance = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAdjustingBalance(true);
    setError(null);
    setMessage(null);

    const parsedOpeningBalance = Number(newOpeningBalance);
    if (!selectedAccountId) {
      setError('Select an account first.');
      setAdjustingBalance(false);
      return;
    }

    if (!Number.isFinite(parsedOpeningBalance)) {
      setError('Opening balance must be a valid number.');
      setAdjustingBalance(false);
      return;
    }

    if (!adjustReason.trim()) {
      setError('Reason is required.');
      setAdjustingBalance(false);
      return;
    }

    try {
      const updatedAccount = await adjustAccountOpeningBalance({
        accountId: selectedAccountId,
        newOpeningBalance: parsedOpeningBalance,
        reason: adjustReason,
      });

      setAccounts((previous) =>
        previous.map((account) => (account.id === updatedAccount.id ? updatedAccount : account)),
      );
      setNewOpeningBalance(updatedAccount.openingBalance.toFixed(2));
      setMessage('Opening balance updated and adjustment log created.');
    } catch (adjustError) {
      const nextError = adjustError instanceof Error ? adjustError.message : 'Unable to adjust opening balance.';
      setError(nextError);
    } finally {
      setAdjustingBalance(false);
    }
  };

  const handleExport = () => {
    if (!transactions.length) {
      setMessage('No transactions available to export.');
      return;
    }

    const rows = [
      ['Due Date (AD)', 'Account', 'Type', 'Status', 'Amount', 'Cheque Number', 'Description'],
      ...transactions.map((transaction) => [
        transaction.dueDate,
        transaction.accountName,
        transaction.type,
        transaction.status,
        transaction.amount.toFixed(2),
        transaction.chequeNumber ?? '',
        transaction.type === 'cheque'
          ? transaction.payee ?? ''
          : `${transaction.description ?? ''}${transaction.referenceNumber ? ` (Ref: ${transaction.referenceNumber})` : ''}`,
      ]),
    ];

    const csv = toCsv(rows);
    const now = new Date();
    const filename = `cheque-tracker-export-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      '0',
    )}-${String(now.getDate()).padStart(2, '0')}.csv`;

    downloadCsv(filename, csv);
    setMessage('CSV exported.');
  };

  const handleManualTransition = async () => {
    setError(null);
    setMessage(null);

    try {
      await runDueStatusTransition(timezone);
      const latestTransactions = await getTransactions();
      setTransactions(latestTransactions);
      setMessage('Status transition completed for today.');
    } catch (transitionError) {
      const nextError =
        transitionError instanceof Error ? transitionError.message : 'Unable to run status transition.';
      setError(nextError);
    }
  };

  if (loading) {
    return <div className="rounded-xl bg-white p-6 shadow-card">Loading settings...</div>;
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="text-lg font-semibold text-slate-900">Preferences</h2>
        <p className="mt-1 text-sm text-slate-500">Configure notifications, timezone, and calendar mode.</p>

        <form onSubmit={handleSaveProfile} className="mt-4 space-y-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={notificationsEnabled}
              onChange={(event) => setNotificationsEnabled(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Enable browser notifications
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Timezone</span>
            <input
              type="text"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              required
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Default Calendar</span>
            <select
              value={calendarPreference}
              onChange={(event) => setCalendarPreference(event.target.value as 'AD' | 'BS')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            >
              <option value="AD">AD (Gregorian)</option>
              <option value="BS">BS (Nepali)</option>
            </select>
          </label>

          <p className="text-sm text-slate-600">
            Active Calendar Mode: <span className="font-semibold">{mode}</span>
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={savingProfile}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              {savingProfile ? 'Saving...' : 'Save Settings'}
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => void handleManualTransition()}
              className="rounded-lg border border-brand-300 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
            >
              Run Today Transition
            </button>
          </div>
        </form>

        <div className="mt-6 border-t border-slate-200 pt-5">
          <h3 className="text-base font-semibold text-slate-900">In-App Notification Rules</h3>
          <p className="mt-1 text-sm text-slate-500">
            Configure reminder types, timing, and quiet hours for notification scheduling.
          </p>

          {notificationSettings ? (
            <form className="mt-4 space-y-4" onSubmit={handleSaveNotificationSettings}>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={notificationSettings.enableCheque}
                    onChange={(event) =>
                      handleNotificationSettingChange('enableCheque', event.target.checked)
                    }
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Cheque reminders
                </label>

                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={notificationSettings.enableDeposit}
                    onChange={(event) =>
                      handleNotificationSettingChange('enableDeposit', event.target.checked)
                    }
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Deposit reminders
                </label>

                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={notificationSettings.enableWithdrawal}
                    onChange={(event) =>
                      handleNotificationSettingChange('enableWithdrawal', event.target.checked)
                    }
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Withdrawal reminders
                </label>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Timing options</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={notificationSettings.timing1Week}
                      onChange={(event) =>
                        handleNotificationSettingChange('timing1Week', event.target.checked)
                      }
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    1 week before
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={notificationSettings.timing3Days}
                      onChange={(event) =>
                        handleNotificationSettingChange('timing3Days', event.target.checked)
                      }
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    3 days before
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={notificationSettings.timing1Day}
                      onChange={(event) =>
                        handleNotificationSettingChange('timing1Day', event.target.checked)
                      }
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    1 day before
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={notificationSettings.timingDayOf}
                      onChange={(event) =>
                        handleNotificationSettingChange('timingDayOf', event.target.checked)
                      }
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Day of due date
                  </label>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Delivery Time</span>
                  <input
                    type="time"
                    value={notificationSettings.deliveryTime}
                    onChange={(event) =>
                      handleNotificationSettingChange('deliveryTime', event.target.value)
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Notification Timezone</span>
                  <input
                    type="text"
                    value={notificationSettings.timezone}
                    onChange={(event) =>
                      handleNotificationSettingChange('timezone', event.target.value)
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                    required
                  />
                </label>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={notificationSettings.quietHoursEnabled}
                  onChange={(event) =>
                    handleNotificationSettingChange('quietHoursEnabled', event.target.checked)
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />
                Enable quiet hours
              </label>

              {notificationSettings.quietHoursEnabled ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="text-sm font-medium text-slate-700">Quiet Hours Start</span>
                    <input
                      type="time"
                      value={notificationSettings.quietHoursStart}
                      onChange={(event) =>
                        handleNotificationSettingChange('quietHoursStart', event.target.value)
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-sm font-medium text-slate-700">Quiet Hours End</span>
                    <input
                      type="time"
                      value={notificationSettings.quietHoursEnd}
                      onChange={(event) =>
                        handleNotificationSettingChange('quietHoursEnd', event.target.value)
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                    />
                  </label>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={savingNotificationSettings}
                className="rounded-lg border border-brand-300 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
              >
                {savingNotificationSettings ? 'Saving...' : 'Save Notification Rules'}
              </button>
            </form>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Loading notification rules...</p>
          )}
        </div>

        <div className="mt-6 border-t border-slate-200 pt-5">
          <h3 className="text-base font-semibold text-slate-900">Opening Balance Adjustment</h3>
          <p className="mt-1 text-sm text-slate-500">
            Updating opening balance logs a balance adjustment and updates current balance.
          </p>

          {accounts.length ? (
            <form className="mt-4 space-y-3" onSubmit={handleAdjustOpeningBalance}>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Account</span>
                <select
                  value={selectedAccountId}
                  onChange={(event) => {
                    const nextId = event.target.value;
                    setSelectedAccountId(nextId);
                    const nextAccount = accounts.find((account) => account.id === nextId);
                    if (nextAccount) {
                      setNewOpeningBalance(nextAccount.openingBalance.toFixed(2));
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>

              {selectedAccount ? (
                <p className="text-sm text-slate-600">
                  Current opening: <span className="font-semibold">${selectedAccount.openingBalance.toFixed(2)}</span>{' '}
                  | Current balance: <span className="font-semibold">${selectedAccount.currentBalance.toFixed(2)}</span>
                </p>
              ) : null}

              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">New opening balance</span>
                <input
                  type="number"
                  step="0.01"
                  value={newOpeningBalance}
                  onChange={(event) => setNewOpeningBalance(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                  required
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Reason</span>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(event) => setAdjustReason(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                  required
                />
              </label>

              <button
                type="submit"
                disabled={adjustingBalance}
                className="rounded-lg border border-brand-300 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
              >
                {adjustingBalance ? 'Updating...' : 'Update Opening Balance'}
              </button>
            </form>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Create an account first.</p>
          )}
        </div>

        {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
      </section>

      <AccountManager accounts={accounts} isSaving={savingAccount} onCreateAccount={handleCreateAccount} />
    </div>
  );
}
