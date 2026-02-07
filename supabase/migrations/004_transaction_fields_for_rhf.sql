-- 004_transaction_fields_for_rhf.sql
-- Adds fields needed by typed transaction forms.

begin;

alter table if exists public.transactions
  add column if not exists payee text;

alter table if exists public.transactions
  add column if not exists reference_number text;

alter table if exists public.transactions
  add column if not exists created_date date default current_date;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'transactions_payee_rule'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transactions_payee_rule
      check (
        (type = 'cheque' and payee is not null and length(btrim(payee)) > 0)
        or
        (type <> 'cheque')
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'transactions_description_rule'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transactions_description_rule
      check (
        (type = 'cheque')
        or
        (description is not null and length(btrim(description)) > 0)
      );
  end if;
end $$;

-- Backfill created_date where missing
update public.transactions
set created_date = coalesce(created_date, due_date, current_date)
where created_date is null;

alter table public.transactions
  alter column created_date set not null;

-- For existing cheque rows, copy description to payee when payee is empty
update public.transactions
set payee = description
where type = 'cheque'
  and (payee is null or length(btrim(payee)) = 0)
  and description is not null;

create index if not exists idx_transactions_payee on public.transactions (payee);
create index if not exists idx_transactions_reference_number on public.transactions (reference_number);
create index if not exists idx_transactions_created_date on public.transactions (created_date);

commit;
