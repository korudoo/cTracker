-- Update status transition functions to handle overdue pending items.
-- Rule:
-- - pending cheque/withdrawal with due_date <= local today -> deducted
-- - pending deposit with due_date <= local today -> cleared (UI label: Deposited)

begin;

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
    and due_date <= local_today;

  get diagnostics updated_cheques_withdrawals = row_count;

  update public.transactions
  set status = 'cleared'
  where
    user_id = auth.uid()
    and type = 'deposit'
    and status = 'pending'
    and due_date <= local_today;

  get diagnostics updated_deposits = row_count;

  return jsonb_build_object(
    'local_date', local_today,
    'updated_cheques_withdrawals', updated_cheques_withdrawals,
    'updated_deposits', updated_deposits
  );
end;
$$;

create or replace function public.run_midnight_status_transition_kathmandu(
  p_target_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_date date := coalesce(p_target_date, (now() at time zone 'Asia/Kathmandu')::date);
  updated_outflows integer := 0;
  updated_deposits integer := 0;
begin
  update public.transactions
  set status = 'deducted'
  where
    type in ('cheque', 'withdrawal')
    and status = 'pending'
    and due_date <= target_date;

  get diagnostics updated_outflows = row_count;

  update public.transactions
  set status = 'cleared'
  where
    type = 'deposit'
    and status = 'pending'
    and due_date <= target_date;

  get diagnostics updated_deposits = row_count;

  return jsonb_build_object(
    'timezone', 'Asia/Kathmandu',
    'target_date', target_date,
    'updated_outflows', updated_outflows,
    'updated_deposits', updated_deposits
  );
end;
$$;

revoke all on function public.run_midnight_status_transition_kathmandu(date) from public;
grant execute on function public.run_midnight_status_transition_kathmandu(date) to service_role;
grant execute on function public.process_due_status_transitions(text) to authenticated;

commit;

