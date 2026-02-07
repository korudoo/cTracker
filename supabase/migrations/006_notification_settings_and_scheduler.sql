-- Notification settings + in-app notifications scheduler.
-- This migration adds:
-- 1) user-level notification settings
-- 2) in_app_notifications fields requested by product spec
-- 3) duplicate-safe daily scheduler function

begin;

create table if not exists public.user_notification_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  enable_cheque boolean not null default true,
  enable_deposit boolean not null default true,
  enable_withdrawal boolean not null default true,
  timing_1week boolean not null default false,
  timing_3days boolean not null default true,
  timing_1day boolean not null default true,
  timing_day_of boolean not null default true,
  quiet_hours_enabled boolean not null default false,
  quiet_hours_start time not null default '22:00',
  quiet_hours_end time not null default '07:00',
  delivery_time time not null default '09:00',
  timezone text not null default 'Asia/Kathmandu',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_user_notification_settings_set_updated_at on public.user_notification_settings;
create trigger trg_user_notification_settings_set_updated_at
before update on public.user_notification_settings
for each row
execute function public.set_updated_at();

alter table public.user_notification_settings enable row level security;

drop policy if exists user_notification_settings_select_own on public.user_notification_settings;
create policy user_notification_settings_select_own
  on public.user_notification_settings
  for select
  using (user_id = auth.uid());

drop policy if exists user_notification_settings_insert_own on public.user_notification_settings;
create policy user_notification_settings_insert_own
  on public.user_notification_settings
  for insert
  with check (user_id = auth.uid());

drop policy if exists user_notification_settings_update_own on public.user_notification_settings;
create policy user_notification_settings_update_own
  on public.user_notification_settings
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists user_notification_settings_delete_own on public.user_notification_settings;
create policy user_notification_settings_delete_own
  on public.user_notification_settings
  for delete
  using (user_id = auth.uid());

-- Ensure in_app_notifications has required columns from spec
alter table if exists public.in_app_notifications
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table if exists public.in_app_notifications
  add column if not exists transaction_id uuid references public.transactions (id) on delete cascade;

alter table if exists public.in_app_notifications
  add column if not exists type text;

alter table if exists public.in_app_notifications
  add column if not exists scheduled_for timestamptz;

alter table if exists public.in_app_notifications
  add column if not exists body text;

-- Backfill for legacy rows
update public.in_app_notifications n
set user_id = a.user_id
from public.accounts a
where n.account_id = a.id
  and n.user_id is null;

update public.in_app_notifications
set scheduled_for = coalesce(scheduled_for, created_at, now())
where scheduled_for is null;

update public.in_app_notifications
set body = coalesce(body, description, title)
where body is null;

update public.in_app_notifications
set type = coalesce(type, 'manual')
where type is null;

alter table public.in_app_notifications
  alter column user_id set not null;

alter table public.in_app_notifications
  alter column scheduled_for set not null;

alter table public.in_app_notifications
  alter column body set not null;

alter table public.in_app_notifications
  alter column type set not null;

alter table public.in_app_notifications
  alter column type set default 'manual';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'in_app_notifications_type_check'
      and conrelid = 'public.in_app_notifications'::regclass
  ) then
    alter table public.in_app_notifications
      add constraint in_app_notifications_type_check
      check (type in ('week_before', 'three_days_before', 'one_day_before', 'day_of', 'manual'));
  end if;
end $$;

-- Duplicate prevention:
-- same user + transaction + reminder type + scheduled_for should only be created once
create unique index if not exists ux_in_app_notifications_dedup
  on public.in_app_notifications (user_id, transaction_id, type, scheduled_for);

create index if not exists idx_in_app_notifications_user_unread
  on public.in_app_notifications (user_id, read_at, scheduled_for desc);

create index if not exists idx_in_app_notifications_user_created
  on public.in_app_notifications (user_id, created_at desc);

-- Switch in_app_notifications RLS to direct user ownership
drop policy if exists in_app_notifications_select_own on public.in_app_notifications;
create policy in_app_notifications_select_own
  on public.in_app_notifications
  for select
  using (user_id = auth.uid());

drop policy if exists in_app_notifications_insert_own on public.in_app_notifications;
create policy in_app_notifications_insert_own
  on public.in_app_notifications
  for insert
  with check (user_id = auth.uid());

drop policy if exists in_app_notifications_update_own on public.in_app_notifications;
create policy in_app_notifications_update_own
  on public.in_app_notifications
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists in_app_notifications_delete_own on public.in_app_notifications;
create policy in_app_notifications_delete_own
  on public.in_app_notifications
  for delete
  using (user_id = auth.uid());

create or replace function public.resolve_notification_delivery_time(
  p_delivery_time time,
  p_quiet_enabled boolean,
  p_quiet_start time,
  p_quiet_end time
)
returns time
language plpgsql
immutable
as $$
declare
  in_quiet boolean := false;
begin
  if not p_quiet_enabled then
    return p_delivery_time;
  end if;

  -- quiet window in same day, e.g. 13:00-17:00
  if p_quiet_start < p_quiet_end then
    in_quiet := p_delivery_time >= p_quiet_start and p_delivery_time < p_quiet_end;
  -- quiet window across midnight, e.g. 22:00-07:00
  elsif p_quiet_start > p_quiet_end then
    in_quiet := p_delivery_time >= p_quiet_start or p_delivery_time < p_quiet_end;
  end if;

  if in_quiet then
    return p_quiet_end;
  end if;

  return p_delivery_time;
end;
$$;

create or replace function public.schedule_in_app_notifications_for_kathmandu(
  p_target_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_date date := coalesce(p_target_date, (now() at time zone 'Asia/Kathmandu')::date);
  inserted_count integer := 0;
begin
  with candidate_reminders as (
    select
      a.user_id,
      t.account_id,
      t.id as transaction_id,
      t.type as transaction_kind,
      t.amount,
      t.due_date,
      r.reminder_type,
      r.notify_date,
      coalesce(s.enable_cheque, true) as enable_cheque,
      coalesce(s.enable_deposit, true) as enable_deposit,
      coalesce(s.enable_withdrawal, true) as enable_withdrawal,
      coalesce(s.timing_1week, false) as timing_1week,
      coalesce(s.timing_3days, true) as timing_3days,
      coalesce(s.timing_1day, true) as timing_1day,
      coalesce(s.timing_day_of, true) as timing_day_of,
      coalesce(s.quiet_hours_enabled, false) as quiet_hours_enabled,
      coalesce(s.quiet_hours_start, '22:00'::time) as quiet_hours_start,
      coalesce(s.quiet_hours_end, '07:00'::time) as quiet_hours_end,
      coalesce(s.delivery_time, '09:00'::time) as delivery_time,
      coalesce(s.timezone, 'Asia/Kathmandu') as timezone
    from public.transactions t
    join public.accounts a
      on a.id = t.account_id
    left join public.user_notification_settings s
      on s.user_id = a.user_id
    cross join lateral (
      values
        ('week_before'::text, t.due_date - 7),
        ('three_days_before'::text, t.due_date - 3),
        ('one_day_before'::text, t.due_date - 1),
        ('day_of'::text, t.due_date)
    ) as r(reminder_type, notify_date)
    where
      t.due_date >= target_date
      and t.status <> 'cleared'
      and r.notify_date = target_date
  ),
  filtered as (
    select *
    from candidate_reminders c
    where
      (
        (c.transaction_kind = 'cheque' and c.enable_cheque)
        or
        (c.transaction_kind = 'deposit' and c.enable_deposit)
        or
        (c.transaction_kind = 'withdrawal' and c.enable_withdrawal)
      )
      and (
        (c.reminder_type = 'week_before' and c.timing_1week)
        or
        (c.reminder_type = 'three_days_before' and c.timing_3days)
        or
        (c.reminder_type = 'one_day_before' and c.timing_1day)
        or
        (c.reminder_type = 'day_of' and c.timing_day_of)
      )
  )
  insert into public.in_app_notifications (
    user_id,
    account_id,
    transaction_id,
    type,
    scheduled_for,
    title,
    description,
    body
  )
  select
    f.user_id,
    f.account_id,
    f.transaction_id,
    f.reminder_type,
    (
      (
        f.notify_date::text
        || ' '
        || public.resolve_notification_delivery_time(
          f.delivery_time,
          f.quiet_hours_enabled,
          f.quiet_hours_start,
          f.quiet_hours_end
        )::text
      )::timestamp
      at time zone f.timezone
    ) as scheduled_for,
    case f.transaction_kind
      when 'cheque' then 'Cheque Reminder'
      when 'deposit' then 'Deposit Reminder'
      else 'Withdrawal Reminder'
    end as title,
    format(
      '%s due on %s. Amount: %s (%s).',
      initcap(f.transaction_kind),
      f.due_date::text,
      to_char(f.amount, 'FM9999999990.00'),
      replace(f.reminder_type, '_', ' ')
    ) as description,
    format(
      '%s due on %s. Amount: %s (%s).',
      initcap(f.transaction_kind),
      f.due_date::text,
      to_char(f.amount, 'FM9999999990.00'),
      replace(f.reminder_type, '_', ' ')
    ) as body
  from filtered f
  on conflict (user_id, transaction_id, type, scheduled_for) do nothing;

  get diagnostics inserted_count = row_count;

  return jsonb_build_object(
    'target_date', target_date,
    'timezone', 'Asia/Kathmandu',
    'inserted_notifications', inserted_count
  );
end;
$$;

revoke all on function public.schedule_in_app_notifications_for_kathmandu(date) from public;
grant execute on function public.schedule_in_app_notifications_for_kathmandu(date) to service_role;

commit;
