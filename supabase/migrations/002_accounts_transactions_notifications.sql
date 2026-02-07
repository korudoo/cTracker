-- 002_accounts_transactions_notifications.sql
-- Paste this entire file into Supabase SQL Editor.

begin;

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================
-- Tables
-- =========================================================

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  bank_name text,
  account_number text,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  type text not null,
  status text not null default 'pending',
  amount numeric(14, 2) not null check (amount > 0),
  cheque_number text,
  description text,
  due_date date not null,
  created_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_type_check
    check (type in ('cheque', 'deposit', 'withdrawal')),
  constraint transactions_status_check
    check (status in ('pending', 'deducted', 'cleared')),
  constraint transactions_cheque_number_rule
    check (
      (type = 'cheque' and cheque_number is not null and length(btrim(cheque_number)) > 0)
      or
      (type <> 'cheque' and cheque_number is null)
    )
);

create table if not exists public.balance_adjustments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  adjustment_date date not null default current_date,
  created_date date not null default current_date,
  amount numeric(14, 2) not null check (amount <> 0),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_settings (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references public.accounts (id) on delete cascade,
  email_enabled boolean not null default true,
  push_enabled boolean not null default false,
  in_app_enabled boolean not null default true,
  daily_summary_enabled boolean not null default false,
  daily_summary_time time,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  channel text not null check (channel in ('email', 'push', 'in_app')),
  event_type text not null,
  status text not null check (status in ('queued', 'sent', 'failed', 'skipped')),
  message text,
  description text,
  payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  created_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.in_app_notifications (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  title text not null,
  description text not null,
  is_read boolean not null default false,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- Updated-at triggers
-- =========================================================

drop trigger if exists trg_accounts_set_updated_at on public.accounts;
create trigger trg_accounts_set_updated_at
before update on public.accounts
for each row
execute function public.set_updated_at();

drop trigger if exists trg_transactions_set_updated_at on public.transactions;
create trigger trg_transactions_set_updated_at
before update on public.transactions
for each row
execute function public.set_updated_at();

drop trigger if exists trg_balance_adjustments_set_updated_at on public.balance_adjustments;
create trigger trg_balance_adjustments_set_updated_at
before update on public.balance_adjustments
for each row
execute function public.set_updated_at();

drop trigger if exists trg_notification_settings_set_updated_at on public.notification_settings;
create trigger trg_notification_settings_set_updated_at
before update on public.notification_settings
for each row
execute function public.set_updated_at();

drop trigger if exists trg_notification_logs_set_updated_at on public.notification_logs;
create trigger trg_notification_logs_set_updated_at
before update on public.notification_logs
for each row
execute function public.set_updated_at();

drop trigger if exists trg_in_app_notifications_set_updated_at on public.in_app_notifications;
create trigger trg_in_app_notifications_set_updated_at
before update on public.in_app_notifications
for each row
execute function public.set_updated_at();

-- =========================================================
-- Required constraints/indexes
-- =========================================================

-- Unique cheque number per account when type = cheque
create unique index if not exists ux_transactions_cheque_number_per_account
  on public.transactions (account_id, cheque_number)
  where type = 'cheque' and cheque_number is not null and length(btrim(cheque_number)) > 0;

-- Helpful filter indexes
create index if not exists idx_transactions_account_id on public.transactions (account_id);
create index if not exists idx_transactions_due_date on public.transactions (due_date);
create index if not exists idx_transactions_type on public.transactions (type);
create index if not exists idx_transactions_status on public.transactions (status);
create index if not exists idx_transactions_amount on public.transactions (amount);
create index if not exists idx_transactions_cheque_number on public.transactions (cheque_number);
create index if not exists idx_transactions_description_trgm on public.transactions using gin (description gin_trgm_ops);

create index if not exists idx_balance_adjustments_account_id on public.balance_adjustments (account_id);
create index if not exists idx_balance_adjustments_adjustment_date on public.balance_adjustments (adjustment_date);

create index if not exists idx_notification_logs_account_id_created_at
  on public.notification_logs (account_id, created_at desc);
create index if not exists idx_in_app_notifications_account_read_created
  on public.in_app_notifications (account_id, is_read, created_at desc);

-- =========================================================
-- RLS
-- =========================================================

alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.balance_adjustments enable row level security;
alter table public.notification_settings enable row level security;
alter table public.notification_logs enable row level security;
alter table public.in_app_notifications enable row level security;

-- accounts: direct ownership

drop policy if exists accounts_select_own on public.accounts;
create policy accounts_select_own
  on public.accounts
  for select
  using (user_id = auth.uid());

drop policy if exists accounts_insert_own on public.accounts;
create policy accounts_insert_own
  on public.accounts
  for insert
  with check (user_id = auth.uid());

drop policy if exists accounts_update_own on public.accounts;
create policy accounts_update_own
  on public.accounts
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists accounts_delete_own on public.accounts;
create policy accounts_delete_own
  on public.accounts
  for delete
  using (user_id = auth.uid());

-- transactions: ownership via account

drop policy if exists transactions_select_own on public.transactions;
create policy transactions_select_own
  on public.transactions
  for select
  using (
    exists (
      select 1
      from public.accounts a
      where a.id = transactions.account_id
        and a.user_id = auth.uid()
    )
  );

drop policy if exists transactions_insert_own on public.transactions;
create policy transactions_insert_own
  on public.transactions
  for insert
  with check (
    exists (
      select 1
      from public.accounts a
      where a.id = transactions.account_id
        and a.user_id = auth.uid()
    )
  );

drop policy if exists transactions_update_own on public.transactions;
create policy transactions_update_own
  on public.transactions
  for update
  using (
    exists (
      select 1
      from public.accounts a
      where a.id = transactions.account_id
        and a.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.accounts a
      where a.id = transactions.account_id
        and a.user_id = auth.uid()
    )
  );

drop policy if exists transactions_delete_own on public.transactions;
create policy transactions_delete_own
  on public.transactions
  for delete
  using (
    exists (
      select 1
      from public.accounts a
      where a.id = transactions.account_id
        and a.user_id = auth.uid()
    )
  );

-- balance_adjustments: ownership via account

drop policy if exists balance_adjustments_select_own on public.balance_adjustments;
create policy balance_adjustments_select_own
  on public.balance_adjustments
  for select
  using (
    exists (
      select 1
      from public.accounts a
      where a.id = balance_adjustments.account_id
        and a.user_id = auth.uid()
    )
  );

drop policy if exists balance_adjustments_insert_own on public.balance_adjustments;
create policy balance_adjustments_insert_own
  on public.balance_adjustments
  for insert
  with check (
    exists (
      select 1
      from public.accounts a
      where a.id = balance_adjustments.account_id
        and a.user_id = auth.uid()
    )
  );

drop policy if exists balance_adjustments_update_own on public.balance_adjustments;
create policy balance_adjustments_update_own
  on public.balance_adjustments
  for update
  using (
    exists (
      select 1
      from public.accounts a
      where a.id = balance_adjustments.account_id
        and a.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.accounts a
      where a.id = balance_adjustments.account_id
        and a.user_id = auth.uid()
    )
  );

drop policy if exists balance_adjustments_delete_own on public.balance_adjustments;
create policy balance_adjustments_delete_own
  on public.balance_adjustments
  for delete
  using (
    exists (
      select 1
      from public.accounts a
      where a.id = balance_adjustments.account_id
        and a.user_id = auth.uid()
    )
  );

-- notification_settings: ownership via account

drop policy if exists notification_settings_select_own on public.notification_settings;
create policy notification_settings_select_own
  on public.notification_settings
  for select
  using (
    exists (
      select 1
      from public.accounts a
      where a.id = notification_settings.account_id
        and a.user_id = auth.uid()
    )
  );

drop policy if exists notification_settings_insert_own on public.notification_settings;
create policy notification_settings_insert_own
  on public.notification_settings
  for insert
  with check (
    exists (
      select 1
      from public.accounts a
      where a.id = notification_settings.account_id
        and a.user_id = auth.uid()
    )
  );

drop policy if exists notification_settings_update_own on public.notification_settings;
create policy notification_settings_update_own
  on public.notification_settings
  for update
  using (
    exists (
      select 1
      from public.accounts a
      where a.id = notification_settings.account_id
        and a.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.accounts a
      where a.id = notification_settings.account_id
        and a.user_id = auth.uid()
    )
  );

drop policy if exists notification_settings_delete_own on public.notification_settings;
create policy notification_settings_delete_own
  on public.notification_settings
  for delete
  using (
    exists (
      select 1
      from public.accounts a
      where a.id = notification_settings.account_id
        and a.user_id = auth.uid()
    )
  );

-- notification_logs: ownership via account

drop policy if exists notification_logs_select_own on public.notification_logs;
create policy notification_logs_select_own
  on public.notification_logs
  for select
  using (
    exists (
      select 1
      from public.accounts a
      where a.id = notification_logs.account_id
        and a.user_id = auth.uid()
    )
  );

drop policy if exists notification_logs_insert_own on public.notification_logs;
create policy notification_logs_insert_own
  on public.notification_logs
  for insert
  with check (
    exists (
      select 1
      from public.accounts a
      where a.id = notification_logs.account_id
        and a.user_id = auth.uid()
    )
  );

drop policy if exists notification_logs_update_own on public.notification_logs;
create policy notification_logs_update_own
  on public.notification_logs
  for update
  using (
    exists (
      select 1
      from public.accounts a
      where a.id = notification_logs.account_id
        and a.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.accounts a
      where a.id = notification_logs.account_id
        and a.user_id = auth.uid()
    )
  );

drop policy if exists notification_logs_delete_own on public.notification_logs;
create policy notification_logs_delete_own
  on public.notification_logs
  for delete
  using (
    exists (
      select 1
      from public.accounts a
      where a.id = notification_logs.account_id
        and a.user_id = auth.uid()
    )
  );

-- in_app_notifications: ownership via account

drop policy if exists in_app_notifications_select_own on public.in_app_notifications;
create policy in_app_notifications_select_own
  on public.in_app_notifications
  for select
  using (
    exists (
      select 1
      from public.accounts a
      where a.id = in_app_notifications.account_id
        and a.user_id = auth.uid()
    )
  );

drop policy if exists in_app_notifications_insert_own on public.in_app_notifications;
create policy in_app_notifications_insert_own
  on public.in_app_notifications
  for insert
  with check (
    exists (
      select 1
      from public.accounts a
      where a.id = in_app_notifications.account_id
        and a.user_id = auth.uid()
    )
  );

drop policy if exists in_app_notifications_update_own on public.in_app_notifications;
create policy in_app_notifications_update_own
  on public.in_app_notifications
  for update
  using (
    exists (
      select 1
      from public.accounts a
      where a.id = in_app_notifications.account_id
        and a.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.accounts a
      where a.id = in_app_notifications.account_id
        and a.user_id = auth.uid()
    )
  );

drop policy if exists in_app_notifications_delete_own on public.in_app_notifications;
create policy in_app_notifications_delete_own
  on public.in_app_notifications
  for delete
  using (
    exists (
      select 1
      from public.accounts a
      where a.id = in_app_notifications.account_id
        and a.user_id = auth.uid()
    )
  );

commit;
