import { supabase } from '@/lib/supabaseClient';
import type { InAppNotification, NotificationSettings } from '@/types/domain';

const NOTIFICATION_SETTINGS_SELECT =
  'user_id,enable_cheque,enable_deposit,enable_withdrawal,timing_1week,timing_3days,timing_1day,timing_day_of,quiet_hours_enabled,quiet_hours_start,quiet_hours_end,delivery_time,timezone,created_at,updated_at';

const IN_APP_NOTIFICATIONS_SELECT =
  'id,user_id,transaction_id,account_id,type,scheduled_for,created_at,read_at,title,body';

interface PgErrorLike {
  code?: string;
  message?: string;
}

function isPgErrorLike(error: unknown): error is PgErrorLike {
  return typeof error === 'object' && error !== null;
}

function isMissingInAppUserIdColumnError(error: unknown): boolean {
  if (!isPgErrorLike(error)) {
    return false;
  }

  const code = typeof error.code === 'string' ? error.code : '';
  const message = typeof error.message === 'string' ? error.message : '';
  return code === '42703' && message.includes('in_app_notifications.user_id');
}

function isMissingUserNotificationSettingsTable(error: unknown): boolean {
  if (!isPgErrorLike(error)) {
    return false;
  }

  const code = typeof error.code === 'string' ? error.code : '';
  const message = typeof error.message === 'string' ? error.message : '';
  return code === '42P01' && message.includes('user_notification_settings');
}

async function getAuthenticatedUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    throw new Error('You must be logged in.');
  }

  return user;
}

function mapNotificationSettings(row: {
  user_id: string;
  enable_cheque: boolean;
  enable_deposit: boolean;
  enable_withdrawal: boolean;
  timing_1week: boolean;
  timing_3days: boolean;
  timing_1day: boolean;
  timing_day_of: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  delivery_time: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}): NotificationSettings {
  return {
    userId: row.user_id,
    enableCheque: row.enable_cheque,
    enableDeposit: row.enable_deposit,
    enableWithdrawal: row.enable_withdrawal,
    timing1Week: row.timing_1week,
    timing3Days: row.timing_3days,
    timing1Day: row.timing_1day,
    timingDayOf: row.timing_day_of,
    quietHoursEnabled: row.quiet_hours_enabled,
    quietHoursStart: row.quiet_hours_start,
    quietHoursEnd: row.quiet_hours_end,
    deliveryTime: row.delivery_time,
    timezone: row.timezone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInAppNotification(row: {
  id: string;
  user_id: string;
  transaction_id: string | null;
  account_id: string;
  type: 'week_before' | 'three_days_before' | 'one_day_before' | 'day_of' | 'manual';
  scheduled_for: string;
  created_at: string;
  read_at: string | null;
  title: string;
  body: string;
}): InAppNotification {
  return {
    id: row.id,
    userId: row.user_id,
    transactionId: row.transaction_id,
    accountId: row.account_id,
    type: row.type,
    scheduledFor: row.scheduled_for,
    createdAt: row.created_at,
    readAt: row.read_at,
    title: row.title,
    body: row.body,
  };
}

function mapLegacyInAppNotification(
  row: {
    id: string;
    account_id: string;
    title: string;
    description: string | null;
    is_read: boolean | null;
    read_at: string | null;
    created_at: string;
  },
  userId: string,
): InAppNotification {
  return {
    id: row.id,
    userId,
    transactionId: null,
    accountId: row.account_id,
    type: 'manual',
    scheduledFor: row.created_at,
    createdAt: row.created_at,
    readAt: row.read_at ?? (row.is_read ? row.created_at : null),
    title: row.title,
    body: row.description ?? row.title,
  };
}

async function createDefaultNotificationSettings(userId: string): Promise<NotificationSettings> {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kathmandu';
  const { data, error } = await supabase
    .from('user_notification_settings')
    .upsert(
      {
        user_id: userId,
        timezone,
      },
      { onConflict: 'user_id' },
    )
    .select(NOTIFICATION_SETTINGS_SELECT)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    throw error ?? new Error('Unable to create default notification settings.');
  }

  return mapNotificationSettings(data);
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const user = await getAuthenticatedUser();
  const { data, error } = await supabase
    .from('user_notification_settings')
    .select(NOTIFICATION_SETTINGS_SELECT)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error && isMissingUserNotificationSettingsTable(error)) {
    const now = new Date().toISOString();
    return {
      userId: user.id,
      enableCheque: true,
      enableDeposit: true,
      enableWithdrawal: true,
      timing1Week: false,
      timing3Days: true,
      timing1Day: true,
      timingDayOf: true,
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      deliveryTime: '09:00',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kathmandu',
      createdAt: now,
      updatedAt: now,
    };
  }

  if (error) {
    throw error;
  }

  if (!data) {
    return createDefaultNotificationSettings(user.id);
  }

  return mapNotificationSettings(data);
}

export async function updateNotificationSettings(payload: {
  enableCheque?: boolean;
  enableDeposit?: boolean;
  enableWithdrawal?: boolean;
  timing1Week?: boolean;
  timing3Days?: boolean;
  timing1Day?: boolean;
  timingDayOf?: boolean;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  deliveryTime?: string;
  timezone?: string;
}): Promise<NotificationSettings> {
  const user = await getAuthenticatedUser();

  const updatePayload: Record<string, unknown> = {
    user_id: user.id,
  };

  if (typeof payload.enableCheque === 'boolean') updatePayload.enable_cheque = payload.enableCheque;
  if (typeof payload.enableDeposit === 'boolean') updatePayload.enable_deposit = payload.enableDeposit;
  if (typeof payload.enableWithdrawal === 'boolean')
    updatePayload.enable_withdrawal = payload.enableWithdrawal;
  if (typeof payload.timing1Week === 'boolean') updatePayload.timing_1week = payload.timing1Week;
  if (typeof payload.timing3Days === 'boolean') updatePayload.timing_3days = payload.timing3Days;
  if (typeof payload.timing1Day === 'boolean') updatePayload.timing_1day = payload.timing1Day;
  if (typeof payload.timingDayOf === 'boolean') updatePayload.timing_day_of = payload.timingDayOf;
  if (typeof payload.quietHoursEnabled === 'boolean')
    updatePayload.quiet_hours_enabled = payload.quietHoursEnabled;
  if (typeof payload.quietHoursStart === 'string') updatePayload.quiet_hours_start = payload.quietHoursStart;
  if (typeof payload.quietHoursEnd === 'string') updatePayload.quiet_hours_end = payload.quietHoursEnd;
  if (typeof payload.deliveryTime === 'string') updatePayload.delivery_time = payload.deliveryTime;
  if (typeof payload.timezone === 'string') updatePayload.timezone = payload.timezone;

  const { data, error } = await supabase
    .from('user_notification_settings')
    .upsert(updatePayload, { onConflict: 'user_id' })
    .select(NOTIFICATION_SETTINGS_SELECT)
    .eq('user_id', user.id)
    .single();

  if (error && isMissingUserNotificationSettingsTable(error)) {
    throw new Error(
      'Notification settings schema is not applied. Please run migration 006_notification_settings_and_scheduler.sql in Supabase.',
    );
  }

  if (error || !data) {
    throw error ?? new Error('Unable to update notification settings.');
  }

  return mapNotificationSettings(data);
}

export async function getInAppNotifications(options?: {
  unreadOnly?: boolean;
  limit?: number;
}): Promise<InAppNotification[]> {
  const user = await getAuthenticatedUser();
  const unreadOnly = Boolean(options?.unreadOnly);
  const limit = options?.limit ?? 100;

  let query = supabase
    .from('in_app_notifications')
    .select(IN_APP_NOTIFICATIONS_SELECT)
    .eq('user_id', user.id)
    .order('scheduled_for', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (unreadOnly) {
    query = query.is('read_at', null);
  }

  const { data, error } = await query;

  if (!error) {
    return (data ?? []).map((row) => mapInAppNotification(row as never));
  }

  if (!isMissingInAppUserIdColumnError(error)) {
    throw error;
  }

  let legacyQuery = supabase
    .from('in_app_notifications')
    .select('id,account_id,title,description,is_read,read_at,created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (unreadOnly) {
    legacyQuery = legacyQuery.or('read_at.is.null,is_read.eq.false');
  }

  const { data: legacyData, error: legacyError } = await legacyQuery;
  if (legacyError) {
    throw legacyError;
  }

  return (legacyData ?? []).map((row) => mapLegacyInAppNotification(row as never, user.id));
}

export async function getUnreadInAppNotificationCount(): Promise<number> {
  const user = await getAuthenticatedUser();

  const { count, error } = await supabase
    .from('in_app_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('read_at', null);

  if (!error) {
    return count ?? 0;
  }

  if (!isMissingInAppUserIdColumnError(error)) {
    throw error;
  }

  const { count: legacyCount, error: legacyError } = await supabase
    .from('in_app_notifications')
    .select('id', { count: 'exact', head: true })
    .or('read_at.is.null,is_read.eq.false');

  if (legacyError) {
    throw legacyError;
  }

  return legacyCount ?? 0;
}

export async function markInAppNotificationRead(notificationId: string): Promise<void> {
  const user = await getAuthenticatedUser();

  const { error } = await supabase
    .from('in_app_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', user.id);

  if (!error) {
    return;
  }

  if (!isMissingInAppUserIdColumnError(error)) {
    throw error;
  }

  const { error: legacyError } = await supabase
    .from('in_app_notifications')
    .update({ read_at: new Date().toISOString(), is_read: true })
    .eq('id', notificationId);

  if (legacyError) {
    throw legacyError;
  }
}

export async function markAllInAppNotificationsRead(): Promise<number> {
  const user = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from('in_app_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null)
    .select('id');

  if (!error) {
    return (data ?? []).length;
  }

  if (!isMissingInAppUserIdColumnError(error)) {
    throw error;
  }

  const { data: legacyData, error: legacyError } = await supabase
    .from('in_app_notifications')
    .update({ read_at: new Date().toISOString(), is_read: true })
    .or('read_at.is.null,is_read.eq.false')
    .select('id');

  if (legacyError) {
    throw legacyError;
  }

  return (legacyData ?? []).length;
}

export async function runNotificationSchemaHealthCheck(): Promise<{
  userNotificationSettingsAvailable: boolean;
  inAppUserIdAvailable: boolean;
}> {
  let userNotificationSettingsAvailable = true;
  let inAppUserIdAvailable = true;

  const settingsProbe = await supabase.from('user_notification_settings').select('user_id').limit(1);
  if (settingsProbe.error && isMissingUserNotificationSettingsTable(settingsProbe.error)) {
    userNotificationSettingsAvailable = false;
  }

  const inAppProbe = await supabase.from('in_app_notifications').select('user_id').limit(1);
  if (inAppProbe.error && isMissingInAppUserIdColumnError(inAppProbe.error)) {
    inAppUserIdAvailable = false;
  }

  return {
    userNotificationSettingsAvailable,
    inAppUserIdAvailable,
  };
}
