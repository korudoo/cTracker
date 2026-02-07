-- 004_transaction_fields_for_rhf.sql
-- Adds fields needed by typed transaction forms.

begin;

alter table if exists public.transactions
  add column if not exists payee text;

alter table if exists public.transactions
  add column if not exists reference_number text;

alter table if exists public.transactions
  add column if not exists created_date date default current_date;

-- Backfill created_date where missing
update public.transactions
set created_date = coalesce(created_date, due_date, current_date)
where created_date is null;

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
