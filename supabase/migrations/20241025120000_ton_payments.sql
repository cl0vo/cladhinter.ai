-- Migration: TON payments pipeline
set check_function_bodies = off;

create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists public.ton_payment_events (
  id bigserial primary key,
  order_id uuid not null references public.app_orders(id) on delete cascade,
  wallet text not null,
  amount numeric(12,4) not null,
  boc text not null,
  status text not null default 'received',
  received_at timestamptz not null default timezone('utc', now())
);

create index if not exists ton_payment_events_order_idx
  on public.ton_payment_events(order_id);

alter table public.app_orders
  add column if not exists merchant_wallet text,
  add column if not exists paid_at timestamptz,
  add column if not exists tx_lt numeric(39,0),
  add column if not exists validated_at timestamptz,
  add column if not exists verification_error text,
  add column if not exists verification_attempts integer not null default 0,
  add column if not exists last_payment_check timestamptz;

do $$
declare
  v_wallet text;
begin
  select value into v_wallet
  from public.app_settings
  where key = 'ton_merchant_address';

  update public.app_orders
  set merchant_wallet = coalesce(merchant_wallet, v_wallet)
  where merchant_wallet is null;
end;
$$;

create or replace function public.app_create_order(
  p_user_id text,
  p_boost_level integer,
  p_wallet_address text default null,
  p_country_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.app_users;
  v_boost_name text;
  v_cost numeric;
  v_duration integer;
  v_order_id uuid := gen_random_uuid();
  v_payload text;
  v_merchant text;
begin
  if p_boost_level is null or p_boost_level < 1 or p_boost_level > 4 then
    raise exception using message = 'INVALID_BOOST_LEVEL';
  end if;

  v_user := public.app_ensure_user(p_user_id, p_wallet_address, p_country_code);

  v_boost_name := public.app_boost_name(p_boost_level);
  v_cost := public.app_boost_cost_ton(p_boost_level);
  v_duration := public.app_boost_duration_days(p_boost_level);
  v_payload := encode(format('boost_%s_%s_%s', p_boost_level, v_user.id, extract(epoch from timezone(''utc'', now()))::bigint)::bytea, 'base64');

  select value into v_merchant
  from public.app_settings
  where key = 'ton_merchant_address';

  if v_merchant is null then
    v_merchant := 'UQDw8GgIlOX7SqLJKkpIB2JaOlU5n0g2qGifwtneUb1VMnVt';
  end if;

  insert into public.app_orders (id, user_id, boost_level, ton_amount, status, payload, merchant_wallet)
  values (v_order_id, v_user.id, p_boost_level, v_cost, 'pending', v_payload, v_merchant);

  return jsonb_build_object(
    'order_id', v_order_id,
    'address', v_merchant,
    'amount', v_cost,
    'payload', v_payload,
    'boost_name', v_boost_name,
    'duration_days', v_duration
  );
end;
$$;

create or replace function public.app_register_ton_payment(
  p_order_id uuid,
  p_wallet text,
  p_amount numeric,
  p_boc text,
  p_status text default 'received'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.app_orders;
  v_expected_wallet text;
  v_now timestamptz := timezone('utc', now());
begin
  if p_order_id is null then
    raise exception using message = 'ORDER_ID_REQUIRED';
  end if;

  select * into v_order
  from public.app_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception using message = 'ORDER_NOT_FOUND';
  end if;

  if v_order.status not in ('pending', 'pending_verification', 'awaiting_webhook', 'failed') then
    raise exception using message = 'ORDER_NOT_ACCEPTING_PAYMENTS';
  end if;

  v_expected_wallet := coalesce(v_order.merchant_wallet,
    (select value from public.app_settings where key = 'ton_merchant_address'));

  if public.app_normalize_text(v_expected_wallet) <> public.app_normalize_text(p_wallet) then
    raise exception using message = 'PAYMENT_WALLET_MISMATCH';
  end if;

  if v_order.ton_amount <> p_amount then
    raise exception using message = 'PAYMENT_AMOUNT_MISMATCH';
  end if;

  insert into public.ton_payment_events (order_id, wallet, amount, boc, status, received_at)
  values (p_order_id, p_wallet, p_amount, p_boc, coalesce(nullif(p_status, ''), 'received'), v_now);

  update public.app_orders
  set status = 'pending_verification',
      verification_error = null,
      verification_attempts = 0,
      validated_at = null,
      last_payment_check = v_now
  where id = p_order_id;

  return jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'status', 'pending_verification'
  );
end;
$$;

create or replace function public.app_confirm_order(
  p_user_id text,
  p_order_id uuid,
  p_tx_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.app_orders;
  v_user public.app_users;
  v_multiplier numeric;
  v_duration integer;
  v_now timestamptz := timezone('utc', now());
  v_expires timestamptz;
  v_final_hash text;
begin
  select * into v_order
  from public.app_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception using message = 'ORDER_NOT_FOUND';
  end if;

  if v_order.user_id <> p_user_id then
    raise exception using message = 'ORDER_FORBIDDEN';
  end if;

  if v_order.status = 'pending' then
    raise exception using message = 'ORDER_PENDING_PAYMENT';
  elsif v_order.status = 'pending_verification' then
    raise exception using message = 'ORDER_AWAITING_VALIDATION';
  elsif v_order.status = 'failed' then
    raise exception using message = 'ORDER_FAILED';
  elsif v_order.status = 'paid' then
    raise exception using message = 'ORDER_ALREADY_PROCESSED';
  end if;

  if v_order.status <> 'awaiting_webhook' then
    raise exception using message = 'ORDER_INVALID_STATUS';
  end if;

  if v_order.tx_hash is null then
    raise exception using message = 'ORDER_NOT_VALIDATED';
  end if;

  if p_tx_hash is not null and public.app_normalize_text(p_tx_hash) <> public.app_normalize_text(v_order.tx_hash) then
    raise exception using message = 'TX_HASH_MISMATCH';
  end if;

  v_final_hash := v_order.tx_hash;

  select * into v_user
  from public.app_users
  where id = p_user_id
  for update;

  if not found then
    raise exception using message = 'USER_NOT_FOUND';
  end if;

  v_user.boost_level := v_order.boost_level;
  v_duration := public.app_boost_duration_days(v_order.boost_level);

  if v_duration > 0 then
    v_expires := v_now + (v_duration || ' days')::interval;
  else
    v_expires := null;
  end if;

  update public.app_users
  set boost_level = v_user.boost_level,
      boost_expires_at = v_expires
  where id = v_user.id
  returning * into v_user;

  v_multiplier := public.app_boost_multiplier(v_user.boost_level);

  update public.app_orders
  set status = 'paid',
      paid_at = coalesce(v_order.paid_at, v_now),
      validated_at = coalesce(v_order.validated_at, v_now),
      tx_hash = v_final_hash,
      verification_error = null
  where id = p_order_id
  returning * into v_order;

  return jsonb_build_object(
    'success', true,
    'boost_level', v_user.boost_level,
    'boost_expires_at', v_user.boost_expires_at,
    'multiplier', v_multiplier,
    'tx_hash', v_order.tx_hash
  );
end;
$$;

create or replace function public.app_validate_ton_payments(p_limit integer default 10)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event record;
  v_response pg_net.http_response;
  v_payload jsonb;
  v_url text;
  v_now timestamptz := timezone('utc', now());
  v_processed integer := 0;
  v_hash text;
  v_lt numeric(39,0);
  v_included boolean;
  v_order public.app_orders;
  v_headers jsonb := '[{"Content-Type": "application/json"}]'::jsonb;
begin
  select value into v_url
  from public.app_settings
  where key = 'ton_validator_url';

  if v_url is null then
    v_url := 'https://tonapi.io/v1/transactions/parse';
  end if;

  for v_event in (
    select e.*, o.user_id
    from public.ton_payment_events e
    join public.app_orders o on o.id = e.order_id
    where o.status = 'pending_verification'
    order by e.received_at
    limit p_limit
  ) loop
    begin
      v_response := pg_net.http_post(
        url := v_url,
        headers := v_headers,
        body := jsonb_build_object('boc', v_event.boc)::text
      );
    exception
      when others then
        update public.app_orders
        set verification_attempts = verification_attempts + 1,
            verification_error = 'NETWORK_ERROR',
            last_payment_check = v_now
        where id = v_event.order_id;
        continue;
    end;

    update public.app_orders
    set verification_attempts = verification_attempts + 1,
        last_payment_check = v_now
    where id = v_event.order_id
    returning * into v_order;

    if v_response.status_code <> 200 then
      update public.ton_payment_events
      set status = 'error'
      where id = v_event.id;

      update public.app_orders
      set verification_error = coalesce(v_response.body, 'HTTP_ERROR')
      where id = v_event.order_id;
      continue;
    end if;

    begin
      v_payload := v_response.body::jsonb;
    exception
      when others then
        v_payload := jsonb_build_object('raw', v_response.body);
    end;

    v_hash := coalesce(
      v_payload #>> '{transaction,hash}',
      v_payload #>> '{result,hash}',
      v_payload->>'tx_hash',
      v_payload->>'hash'
    );

    v_lt := null;

    begin
      v_lt := nullif(v_payload #>> '{transaction,lt}', '')::numeric;
    exception
      when others then
        v_lt := null;
    end;

    if v_lt is null then
      begin
        v_lt := nullif(v_payload #>> '{result,lt}', '')::numeric;
      exception
        when others then
          v_lt := null;
      end;
    end if;

    if v_lt is null then
      begin
        v_lt := nullif(v_payload->>'tx_lt', '')::numeric;
      exception
        when others then
          v_lt := null;
      end;
    end if;

    v_included := false;

    if v_payload ? 'included' then
      v_included := lower(coalesce(v_payload->>'included', '')) in ('true', 't', '1', 'yes');
    elsif v_payload ? 'ok' then
      v_included := lower(coalesce(v_payload->>'ok', '')) in ('true', 't', '1', 'yes');
    elsif v_payload ? 'success' then
      v_included := lower(coalesce(v_payload->>'success', '')) in ('true', 't', '1', 'yes');
    end if;

    if v_included or (v_hash is not null and v_lt is not null) then
      update public.ton_payment_events
      set status = 'confirmed'
      where id = v_event.id;

      update public.app_orders
      set status = 'awaiting_webhook',
          paid_at = coalesce(v_order.paid_at, v_now),
          validated_at = v_now,
          tx_hash = coalesce(v_hash, v_order.tx_hash),
          tx_lt = coalesce(v_lt, v_order.tx_lt),
          verification_error = null
      where id = v_event.order_id
      returning * into v_order;

      perform public.app_confirm_order(v_order.user_id, v_order.id, null);

      v_processed := v_processed + 1;
    else
      update public.ton_payment_events
      set status = 'waiting'
      where id = v_event.id;

      update public.app_orders
      set verification_error = 'NOT_CONFIRMED'
      where id = v_event.order_id;
    end if;
  end loop;

  return v_processed;
end;
$$;

create or replace function public.app_retry_ton_payment(
  p_user_id text,
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.app_orders;
  v_now timestamptz := timezone('utc', now());
begin
  select * into v_order
  from public.app_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception using message = 'ORDER_NOT_FOUND';
  end if;

  if v_order.user_id <> p_user_id then
    raise exception using message = 'ORDER_FORBIDDEN';
  end if;

  update public.app_orders
  set status = 'pending_verification',
      verification_error = null,
      verification_attempts = 0,
      validated_at = null,
      last_payment_check = v_now
  where id = p_order_id
  returning * into v_order;

  perform public.app_validate_ton_payments(1);

  select * into v_order
  from public.app_orders
  where id = p_order_id;

  return jsonb_build_object(
    'success', true,
    'status', v_order.status,
    'verification_attempts', v_order.verification_attempts,
    'last_payment_check', v_order.last_payment_check
  );
end;
$$;

create or replace function public.app_get_payment_status(
  p_user_id text,
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.app_orders;
  v_event public.ton_payment_events;
  v_result jsonb;
begin
  select * into v_order
  from public.app_orders
  where id = p_order_id;

  if not found then
    raise exception using message = 'ORDER_NOT_FOUND';
  end if;

  if v_order.user_id <> p_user_id then
    raise exception using message = 'ORDER_FORBIDDEN';
  end if;

  select * into v_event
  from public.ton_payment_events
  where order_id = p_order_id
  order by received_at desc
  limit 1;

  v_result := jsonb_build_object(
    'order_id', v_order.id,
    'status', v_order.status,
    'paid_at', v_order.paid_at,
    'tx_hash', v_order.tx_hash,
    'tx_lt', case when v_order.tx_lt is not null then v_order.tx_lt::text else null end,
    'verification_attempts', v_order.verification_attempts,
    'verification_error', v_order.verification_error,
    'last_payment_check', v_order.last_payment_check
  );

  if v_event is not null then
    v_result := v_result || jsonb_build_object(
      'last_event', jsonb_build_object(
        'id', v_event.id,
        'status', v_event.status,
        'received_at', v_event.received_at,
        'wallet', v_event.wallet,
        'amount', v_event.amount
      )
    );
  end if;

  return v_result;
end;
$$;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'ton_payment_validator') then
    return;
  end if;

  perform cron.schedule('ton_payment_validator', '*/2 * * * *', $$select public.app_validate_ton_payments(5);$$);
exception
  when others then
    null;
end;
$$;

grant select, insert on public.ton_payment_events to anon, authenticated;

grant execute on function
  public.app_register_ton_payment(uuid, text, numeric, text, text),
  public.app_validate_ton_payments(integer),
  public.app_retry_ton_payment(text, uuid),
  public.app_get_payment_status(text, uuid)
  to anon, authenticated;

grant execute on function
  public.app_register_ton_payment(uuid, text, numeric, text, text),
  public.app_validate_ton_payments(integer),
  public.app_retry_ton_payment(text, uuid),
  public.app_get_payment_status(text, uuid)
  to service_role;
