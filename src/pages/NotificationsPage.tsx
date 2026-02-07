import { useCallback, useEffect, useMemo, useState } from 'react';
import type { InAppNotification } from '@/types/domain';
import {
  getInAppNotifications,
  markAllInAppNotificationsRead,
  markInAppNotificationRead,
} from '@/services/notifications';
import { formatDualDate } from '@/utils/nepaliDate';

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

function getAdDateFromTimestamp(timestampIso: string): string {
  const date = new Date(timestampIso);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatReminderType(type: InAppNotification['type']): string {
  if (type === 'week_before') return '1 week before';
  if (type === 'three_days_before') return '3 days before';
  if (type === 'one_day_before') return '1 day before';
  if (type === 'day_of') return 'Day of due date';
  return 'Manual';
}

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.readAt).length,
    [notifications],
  );

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const data = await getInAppNotifications({ unreadOnly, limit: 200 });
      setNotifications(data);
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Unable to load notifications.'));
    } finally {
      setLoading(false);
    }
  }, [unreadOnly]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const handleMarkRead = async (notificationId: string) => {
    setUpdating(true);
    setError(null);
    setMessage(null);
    try {
      await markInAppNotificationRead(notificationId);
      setNotifications((previous) =>
        previous.map((notification) =>
          notification.id === notificationId
            ? { ...notification, readAt: new Date().toISOString() }
            : notification,
        ),
      );
      setMessage('Notification marked as read.');
    } catch (markError) {
      setError(getErrorMessage(markError, 'Unable to mark notification as read.'));
    } finally {
      setUpdating(false);
    }
  };

  const handleMarkAllRead = async () => {
    setUpdating(true);
    setError(null);
    setMessage(null);
    try {
      const updatedCount = await markAllInAppNotificationsRead();
      if (updatedCount > 0) {
        setNotifications((previous) =>
          previous.map((notification) => ({ ...notification, readAt: notification.readAt ?? new Date().toISOString() })),
        );
      }
      setMessage(updatedCount ? 'All unread notifications marked as read.' : 'No unread notifications.');
    } catch (markError) {
      setError(getErrorMessage(markError, 'Unable to mark all notifications as read.'));
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return <div className="rounded-xl bg-white p-6 shadow-card">Loading notifications...</div>;
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Notification Center</h2>
            <p className="text-sm text-slate-500">Unread: {unreadCount}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(event) => setUnreadOnly(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Show unread only
            </label>

            <button
              type="button"
              onClick={() => void loadNotifications()}
              disabled={updating}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Refresh
            </button>

            <button
              type="button"
              onClick={() => void handleMarkAllRead()}
              disabled={updating}
              className="rounded-md border border-brand-300 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
            >
              Mark All Read
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <div className="space-y-3">
        {notifications.map((notification) => {
          const adDate = getAdDateFromTimestamp(notification.scheduledFor);
          const read = Boolean(notification.readAt);

          return (
            <article
              key={notification.id}
              className={`rounded-xl border bg-white p-4 shadow-card ${
                read ? 'border-slate-200' : 'border-brand-200'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2">
                    {!read ? <span className="h-2.5 w-2.5 rounded-full bg-brand-500" /> : null}
                    <h3 className="text-sm font-semibold text-slate-900">{notification.title}</h3>
                  </div>
                  <p className="text-sm text-slate-700">{notification.body}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Scheduled: {formatDualDate(adDate)} | Reminder: {formatReminderType(notification.type)}
                  </p>
                </div>

                {!read ? (
                  <button
                    type="button"
                    onClick={() => void handleMarkRead(notification.id)}
                    disabled={updating}
                    className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Mark Read
                  </button>
                ) : (
                  <span className="text-xs text-slate-500">Read</span>
                )}
              </div>
            </article>
          );
        })}

        {!notifications.length ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-card">
            No notifications found.
          </div>
        ) : null}
      </div>
    </section>
  );
}
