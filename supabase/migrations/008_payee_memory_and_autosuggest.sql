-- Payee memory + autosuggest support.
-- Stores payees per account and provides an upsert helper for usage tracking.

begin;

create table if not exists public.payees (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  name text not null,
  name_normalized text not null,
  usage_count integer not null default 1,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payees_name_not_empty check (length(btrim(name)) > 0),
  constraint payees_name_normalized_not_empty check (length(btrim(name_normalized)) > 0),
  constraint payees_account_name_normalized_unique unique (account_id, name_normalized)
);

drop trigger if exists trg_payees_set_updated_at on public.payees;
create trigger trg_payees_set_updated_at
before update on public.payees
for each row
execute function public.set_updated_at();

create index if not exists idx_payees_account_name_normalized
  on public.payees (account_id, name_normalized);

create index if not exists idx_payees_account_last_used_at
  on public.payees (account_id, last_used_at desc);

alter table public.payees enable row level security;

drop policy if exists payees_select_own on public.payees;
create policy payees_select_own
  on public.payees
  for select
  using (
    exists (
      select 1
      from public.accounts a
      where a.id = payees.account_id
        and a.user_id = auth.uid()
    )
  );

drop policy if exists payees_insert_own on public.payees;
create policy payees_insert_own
  on public.payees
  for insert
  with check (
    exists (
      select 1
      from public.accounts a
      where a.id = payees.account_id
        and a.user_id = auth.uid()
    )
  );

drop policy if exists payees_update_own on public.payees;
create policy payees_update_own
  on public.payees
  for update
  using (
    exists (
      select 1
      from public.accounts a
      where a.id = payees.account_id
        and a.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.accounts a
      where a.id = payees.account_id
        and a.user_id = auth.uid()
    )
  );

drop policy if exists payees_delete_own on public.payees;
create policy payees_delete_own
  on public.payees
  for delete
  using (
    exists (
      select 1
      from public.accounts a
      where a.id = payees.account_id
        and a.user_id = auth.uid()
    )
  );

create or replace function public.upsert_payee_memory(
  p_account_id uuid,
  p_name text,
  p_name_normalized text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  clean_name text := btrim(coalesce(p_name, ''));
  clean_normalized text := btrim(coalesce(p_name_normalized, ''));
begin
  if clean_name = '' or clean_normalized = '' then
    return;
  end if;

  insert into public.payees (
    account_id,
    name,
    name_normalized,
    usage_count,
    last_used_at
  )
  values (
    p_account_id,
    clean_name,
    clean_normalized,
    1,
    now()
  )
  on conflict (account_id, name_normalized)
  do update
  set
    name = excluded.name,
    usage_count = payees.usage_count + 1,
    last_used_at = now(),
    updated_at = now();
end;
$$;

revoke all on function public.upsert_payee_memory(uuid, text, text) from public;
grant execute on function public.upsert_payee_memory(uuid, text, text) to authenticated;

commit;
