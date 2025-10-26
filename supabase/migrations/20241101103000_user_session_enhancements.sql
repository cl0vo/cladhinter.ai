-- Migration: Enhance session tracking and analytics

-- Remove duplicate sessions within the same hour bucket to allow unique index
with duplicates as (
  select id
  from (
    select id,
           row_number() over (
             partition by user_id, date_trunc('hour', created_at)
             order by last_activity_at desc, created_at desc, id desc
           ) as rn
    from public.user_sessions
  ) ranked
  where rn > 1
)
delete from public.user_sessions s
using duplicates d
where s.id = d.id;

-- Ensure consistent buckets for conflict handling
create unique index if not exists user_sessions_user_hour_uniq
  on public.user_sessions (user_id, date_trunc('hour', created_at));

create or replace function public.app_touch_session(
  p_user_id text,
  p_activity_at timestamptz default timezone('utc', now()),
  p_country_code text default null
)
returns public.user_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activity_at timestamptz := coalesce(p_activity_at, timezone('utc', now()));
  v_country text := public.app_normalize_text(p_country_code);
  v_session public.user_sessions;
begin
  if p_user_id is null or length(trim(p_user_id)) = 0 then
    raise exception using message = 'USER_ID_REQUIRED';
  end if;

  insert into public.user_sessions (user_id, country_code, created_at, last_activity_at)
  values (p_user_id, v_country, v_activity_at, v_activity_at)
  on conflict on constraint user_sessions_user_hour_uniq
  do update
    set last_activity_at = greatest(public.user_sessions.last_activity_at, excluded.last_activity_at),
        country_code = case
          when excluded.country_code is null then public.user_sessions.country_code
          when public.user_sessions.country_code is null then excluded.country_code
          when excluded.country_code <> public.user_sessions.country_code then excluded.country_code
          else public.user_sessions.country_code
        end,
        created_at = least(public.user_sessions.created_at, excluded.created_at)
  returning * into v_session;

  return v_session;
end;
$$;

create or replace function public.track_user_session(
  p_user_id text,
  p_activity_at timestamptz default timezone('utc', now()),
  p_country_code text default null
)
returns boolean
language plpgsql
as $$
begin
  perform public.app_touch_session(p_user_id, p_activity_at, p_country_code);
  return true;
end;
$$;

create or replace function public.app_ensure_user(
  p_user_id text,
  p_wallet_address text default null,
  p_country_code text default null
)
returns public.app_users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_user public.app_users;
  v_wallet text := public.app_normalize_text(p_wallet_address);
  v_country text := coalesce(public.app_normalize_text(p_country_code), 'ZZ');
begin
  if p_user_id is null or length(trim(p_user_id)) = 0 then
    raise exception using message = 'USER_ID_REQUIRED';
  end if;

  select * into v_user
  from public.app_users
  where id = p_user_id
  for update;

  if not found then
    insert into public.app_users (id, wallet_address, country_code)
    values (p_user_id, v_wallet, v_country)
    returning * into v_user;
  else
    if v_wallet is not null then
      v_user.wallet_address := v_wallet;
    end if;
    if v_country is not null then
      v_user.country_code := v_country;
    end if;
    if v_user.boost_expires_at is not null and v_user.boost_expires_at < v_now then
      v_user.boost_level := 0;
      v_user.boost_expires_at := null;
    end if;
    update public.app_users
    set wallet_address = v_user.wallet_address,
        country_code = v_user.country_code,
        boost_level = v_user.boost_level,
        boost_expires_at = v_user.boost_expires_at,
        last_watch_at = v_user.last_watch_at
    where id = v_user.id
    returning * into v_user;
  end if;

  perform public.app_touch_session(v_user.id, v_now, v_user.country_code);

  return v_user;
end;
$$;

create or replace function public.app_orders_touch_session()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_activity timestamptz;
begin
  if tg_op = 'INSERT' then
    v_activity := coalesce(new.created_at, timezone('utc', now()));
  else
    v_activity := timezone('utc', now());
  end if;

  perform public.app_touch_session(new.user_id, v_activity, null);
  return new;
end;
$$;

create or replace function public.ad_watch_logs_touch_session()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.app_touch_session(new.user_id, coalesce(new.created_at, timezone('utc', now())), new.country_code);
  return new;
end;
$$;

drop trigger if exists app_orders_touch_session_trg on public.app_orders;
create trigger app_orders_touch_session_trg
after insert or update on public.app_orders
for each row
execute function public.app_orders_touch_session();

drop trigger if exists ad_watch_logs_touch_session_trg on public.ad_watch_logs;
create trigger ad_watch_logs_touch_session_trg
after insert or update on public.ad_watch_logs
for each row
execute function public.ad_watch_logs_touch_session();

create or replace view public.user_recent_activity as
with events as (
  select
    o.user_id,
    'order'::text as event_type,
    o.id::text as event_id,
    o.created_at as event_at,
    o.status,
    o.ton_amount,
    o.boost_level,
    null::text as ad_id,
    null::integer as reward,
    null::integer as base_reward,
    null::numeric as multiplier,
    null::text as event_country,
    o.payload,
    o.tx_hash
  from public.app_orders o
  union all
  select
    w.user_id,
    'ad_watch'::text as event_type,
    w.id::text as event_id,
    w.created_at as event_at,
    null::text as status,
    null::numeric as ton_amount,
    null::integer as boost_level,
    w.ad_id,
    w.reward,
    w.base_reward,
    w.multiplier,
    w.country_code as event_country,
    null::text as payload,
    null::text as tx_hash
  from public.ad_watch_logs w
)
select
  e.user_id,
  e.event_type,
  e.event_id,
  e.event_at,
  e.status,
  e.ton_amount,
  e.boost_level,
  e.ad_id,
  e.reward,
  e.base_reward,
  e.multiplier,
  e.event_country,
  e.payload,
  e.tx_hash,
  s.id as session_id,
  s.created_at as session_created_at,
  s.last_activity_at as session_last_activity_at,
  s.country_code as session_country_code
from events e
left join lateral (
  select s.*
  from public.user_sessions s
  where s.user_id = e.user_id
    and s.created_at <= e.event_at
    and s.last_activity_at >= e.event_at
  order by s.last_activity_at desc
  limit 1
) s on true;
