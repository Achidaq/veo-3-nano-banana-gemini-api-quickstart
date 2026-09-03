alter table public.credit_ledger drop constraint if exists credit_ledger_amount_check;
alter table public.credit_ledger
  add constraint credit_ledger_amount_check
  check (amount <> 0 or entry_type = 'generation_capture');

create or replace function public.grant_credits(
  p_user_id uuid,
  p_amount integer,
  p_idempotency_key text,
  p_entry_type text,
  p_payment_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table(available integer, reserved integer)
language plpgsql
security invoker
set search_path = public
as $$
declare
  inserted_id uuid;
begin
  if p_amount <= 0 then
    raise exception 'credit grant must be positive';
  end if;

  if p_entry_type not in ('subscription_grant','purchase_grant','refund','admin_adjustment') then
    raise exception 'invalid credit grant entry type';
  end if;

  insert into public.credit_ledger(user_id, payment_id, entry_type, amount, idempotency_key, metadata)
  values (p_user_id, p_payment_id, p_entry_type, p_amount, p_idempotency_key, p_metadata)
  on conflict (idempotency_key) do nothing
  returning id into inserted_id;

  insert into public.credit_balances(user_id, available, reserved)
  values (p_user_id, 0, 0)
  on conflict (user_id) do nothing;

  if inserted_id is not null then
    update public.credit_balances
    set available = available + p_amount,
        updated_at = now()
    where user_id = p_user_id;
  end if;

  return query
  select cb.available, cb.reserved
  from public.credit_balances cb
  where cb.user_id = p_user_id;
end;
$$;

create or replace function public.reserve_generation_credits(
  p_user_id uuid,
  p_generation_id uuid,
  p_amount integer,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns table(available integer, reserved integer)
language plpgsql
security invoker
set search_path = public
as $$
declare
  inserted_id uuid;
  current_available integer;
begin
  if p_amount <= 0 then
    raise exception 'reservation amount must be positive';
  end if;

  insert into public.credit_balances(user_id, available, reserved)
  values (p_user_id, 0, 0)
  on conflict (user_id) do nothing;

  select cb.available into current_available
  from public.credit_balances cb
  where cb.user_id = p_user_id
  for update;

  insert into public.credit_ledger(user_id, generation_id, entry_type, amount, idempotency_key, metadata)
  values (p_user_id, p_generation_id, 'generation_reserve', -p_amount, p_idempotency_key, p_metadata)
  on conflict (idempotency_key) do nothing
  returning id into inserted_id;

  if inserted_id is not null then
    if current_available < p_amount then
      raise exception 'insufficient credits';
    end if;

    update public.credit_balances
    set available = available - p_amount,
        reserved = reserved + p_amount,
        updated_at = now()
    where user_id = p_user_id;
  end if;

  return query
  select cb.available, cb.reserved
  from public.credit_balances cb
  where cb.user_id = p_user_id;
end;
$$;

create or replace function public.capture_generation_credits(
  p_user_id uuid,
  p_generation_id uuid,
  p_amount integer,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns table(available integer, reserved integer)
language plpgsql
security invoker
set search_path = public
as $$
declare
  inserted_id uuid;
  current_reserved integer;
begin
  if p_amount <= 0 then
    raise exception 'capture amount must be positive';
  end if;

  select cb.reserved into current_reserved
  from public.credit_balances cb
  where cb.user_id = p_user_id
  for update;

  if current_reserved is null then
    raise exception 'credit balance not found';
  end if;

  insert into public.credit_ledger(user_id, generation_id, entry_type, amount, idempotency_key, metadata)
  values (p_user_id, p_generation_id, 'generation_capture', 0, p_idempotency_key, p_metadata)
  on conflict (idempotency_key) do nothing
  returning id into inserted_id;

  if inserted_id is not null then
    if current_reserved < p_amount then
      raise exception 'reserved credits too low';
    end if;

    update public.credit_balances
    set reserved = reserved - p_amount,
        updated_at = now()
    where user_id = p_user_id;
  end if;

  return query
  select cb.available, cb.reserved
  from public.credit_balances cb
  where cb.user_id = p_user_id;
end;
$$;

create or replace function public.release_generation_credits(
  p_user_id uuid,
  p_generation_id uuid,
  p_amount integer,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns table(available integer, reserved integer)
language plpgsql
security invoker
set search_path = public
as $$
declare
  inserted_id uuid;
  current_reserved integer;
begin
  if p_amount <= 0 then
    raise exception 'release amount must be positive';
  end if;

  select cb.reserved into current_reserved
  from public.credit_balances cb
  where cb.user_id = p_user_id
  for update;

  if current_reserved is null then
    raise exception 'credit balance not found';
  end if;

  insert into public.credit_ledger(user_id, generation_id, entry_type, amount, idempotency_key, metadata)
  values (p_user_id, p_generation_id, 'generation_release', p_amount, p_idempotency_key, p_metadata)
  on conflict (idempotency_key) do nothing
  returning id into inserted_id;

  if inserted_id is not null then
    if current_reserved < p_amount then
      raise exception 'reserved credits too low';
    end if;

    update public.credit_balances
    set available = available + p_amount,
        reserved = reserved - p_amount,
        updated_at = now()
    where user_id = p_user_id;
  end if;

  return query
  select cb.available, cb.reserved
  from public.credit_balances cb
  where cb.user_id = p_user_id;
end;
$$;

revoke all on function public.grant_credits(uuid, integer, text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.reserve_generation_credits(uuid, uuid, integer, text, jsonb) from public, anon, authenticated;
revoke all on function public.capture_generation_credits(uuid, uuid, integer, text, jsonb) from public, anon, authenticated;
revoke all on function public.release_generation_credits(uuid, uuid, integer, text, jsonb) from public, anon, authenticated;

grant execute on function public.grant_credits(uuid, integer, text, text, uuid, jsonb) to service_role;
grant execute on function public.reserve_generation_credits(uuid, uuid, integer, text, jsonb) to service_role;
grant execute on function public.capture_generation_credits(uuid, uuid, integer, text, jsonb) to service_role;
grant execute on function public.release_generation_credits(uuid, uuid, integer, text, jsonb) to service_role;
