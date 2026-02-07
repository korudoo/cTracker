-- 003_account_balance_columns.sql
-- Adds opening/current balance columns used by onboarding and later adjustments.

begin;

alter table if exists public.accounts
  add column if not exists opening_balance numeric(14, 2) not null default 0;

alter table if exists public.accounts
  add column if not exists current_balance numeric(14, 2) not null default 0;

update public.accounts
set current_balance = opening_balance
where current_balance is null;

alter table if exists public.balance_adjustments
  add column if not exists reason text;

commit;
