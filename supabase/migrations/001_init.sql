-- Cheque Tracker core schema + security

create extension if not exists pgcrypto;

create type public.transaction_type as enum ('deposit', 'cheque', 'withdrawal');
create type public.transaction_status as enum ('pending', 'deducted', 'cleared');
create type public.calendar_mode as enum ('AD', 'BS');

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  opening_balance numeric(14, 2) not null default 0,
  notifications_enabled boolean not null default false,
  timezone text not null default 'UTC',
  calendar_preference public.calendar_mode not null default 'AD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete restrict,
  type public.transaction_type not null,
  amount numeric(14, 2) not null check (amount > 0),
  status public.transaction_status not null default 'pending',
  due_date date not null,
  cheque_number text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cheque_number_required_for_cheques check (
    (
      type = 'cheque'
      and cheque_number is not null
      and length(trim(cheque_number)) > 0
    )
    or
    (
      type <> 'cheque'
      and cheque_number is null
    )
  )
);

create unique index if not exists unique_default_account_per_user
  on public.accounts (user_id)
  where is_default = true;

create unique index if not exists unique_cheque_number_per_account
  on public.transactions (account_id, cheque_number)
  where type = 'cheque' and cheque_number is not null;

create index if not exists idx_transactions_user_due_date on public.transactions (user_id, due_date);
create index if not exists idx_transactions_user_status on public.transactions (user_id, status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create trigger set_transactions_updated_at
before update on public.transactions
for each row
execute function public.set_updated_at();

create or replace function public.ensure_transaction_account_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.accounts a
    where a.id = new.account_id and a.user_id = new.user_id
  ) then
    raise exception 'account_id does not belong to this user';
  end if;

  return new;
end;
$$;

create trigger check_transaction_account_owner
before insert or update on public.transactions
for each row
execute function public.ensure_transaction_account_owner();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, timezone, calendar_preference)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'timezone', 'UTC'),
    'AD'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    timezone = coalesce(public.profiles.timezone, excluded.timezone);

  if not exists (
    select 1
    from public.accounts a
    where a.user_id = new.id and a.is_default = true
  ) then
    insert into public.accounts (user_id, name, is_default)
    values (new.id, 'Primary Account', true);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- Transition rule:
-- at local midnight, pending cheques/withdrawals due today -> deducted
-- at local midnight, pending deposits due today -> cleared
create or replace function public.process_due_status_transitions(p_timezone text default null)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_timezone text;
  local_today date;
  updated_cheques_withdrawals integer := 0;
  updated_deposits integer := 0;
begin
  target_timezone := coalesce(
    nullif(p_timezone, ''),
    (select timezone from public.profiles where id = auth.uid()),
    'UTC'
  );

  local_today := (now() at time zone target_timezone)::date;

  update public.transactions
  set status = 'deducted'
  where
    user_id = auth.uid()
    and type in ('cheque', 'withdrawal')
    and status = 'pending'
    and due_date = local_today;

  get diagnostics updated_cheques_withdrawals = row_count;

  update public.transactions
  set status = 'cleared'
  where
    user_id = auth.uid()
    and type = 'deposit'
    and status = 'pending'
    and due_date = local_today;

  get diagnostics updated_deposits = row_count;

  return jsonb_build_object(
    'local_date', local_today,
    'updated_cheques_withdrawals', updated_cheques_withdrawals,
    'updated_deposits', updated_deposits
  );
end;
$$;

grant execute on function public.process_due_status_transitions(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;

create policy "profiles_select_own"
  on public.profiles
  for select
  using (id = auth.uid());

create policy "profiles_insert_own"
  on public.profiles
  for insert
  with check (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "accounts_select_own"
  on public.accounts
  for select
  using (user_id = auth.uid());

create policy "accounts_insert_own"
  on public.accounts
  for insert
  with check (user_id = auth.uid());

create policy "accounts_update_own"
  on public.accounts
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "accounts_delete_own"
  on public.accounts
  for delete
  using (user_id = auth.uid());

create policy "transactions_select_own"
  on public.transactions
  for select
  using (user_id = auth.uid());

create policy "transactions_insert_own"
  on public.transactions
  for insert
  with check (user_id = auth.uid());

create policy "transactions_update_own"
  on public.transactions
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "transactions_delete_own"
  on public.transactions
  for delete
  using (user_id = auth.uid());
