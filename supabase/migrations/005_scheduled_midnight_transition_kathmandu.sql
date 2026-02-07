-- Daily automated status transition for Asia/Kathmandu midnight.
-- Idempotent by design: only transitions rows currently in pending state.

begin;

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
    and due_date = target_date;

  get diagnostics updated_outflows = row_count;

  update public.transactions
  set status = 'cleared'
  where
    type = 'deposit'
    and status = 'pending'
    and due_date = target_date;

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

commit;
