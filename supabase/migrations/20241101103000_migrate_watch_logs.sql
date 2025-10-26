-- Migration: Migrate legacy watch data to normalized schema and archive KV store
-- 1. Analyse remaining dependencies on kv_store_0f597298 and watch_logs
-- 2. Move historical watch data into ad_watch_logs/ad_watch_counts
-- 3. Archive legacy kv_store and watch_logs structures
-- 4. Rebuild compatibility function for legacy callers
-- 5. Expose analytics view for dashboards

-- -----------------------------------------------------------------------------
-- Dependency analysis (raises NOTICE entries during migration)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  dep RECORD;
  v_kv regclass := to_regclass('public.kv_store_0f597298');
  v_watch regclass := to_regclass('public.watch_logs');
BEGIN
  IF v_kv IS NOT NULL THEN
    RAISE NOTICE 'Functions referencing kv_store_0f597298:';
    FOR dep IN
      SELECT DISTINCT p.proname
      FROM pg_proc p
      JOIN pg_depend d ON d.objid = p.oid
      WHERE d.classid = 'pg_proc'::regclass
        AND d.refobjid = v_kv
      ORDER BY p.proname
    LOOP
      RAISE NOTICE ' - %', dep.proname;
    END LOOP;
  ELSE
    RAISE NOTICE 'kv_store_0f597298 not found.';
  END IF;

  IF v_watch IS NOT NULL THEN
    RAISE NOTICE 'Triggers on watch_logs:';
    FOR dep IN
      SELECT tgname
      FROM pg_trigger
      WHERE tgrelid = v_watch
        AND NOT tgisinternal
      ORDER BY tgname
    LOOP
      RAISE NOTICE ' - %', dep.tgname;
    END LOOP;
  ELSE
    RAISE NOTICE 'watch_logs table not found.';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    RAISE NOTICE 'Cron jobs touching kv_store or watch_logs:';
    FOR dep IN
      SELECT jobname
      FROM cron.job
      WHERE command ILIKE '%kv_store_0f597298%'
         OR command ILIKE '%watch_logs%'
      ORDER BY jobname
    LOOP
      RAISE NOTICE ' - %', dep.jobname;
    END LOOP;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- Migrate historical watch logs into the relational table
-- -----------------------------------------------------------------------------
INSERT INTO public.ad_watch_logs (id, user_id, ad_id, reward, base_reward, multiplier, country_code, created_at)
SELECT
  gen_random_uuid(),
  wl.user_id,
  COALESCE(NULLIF(wl.ad_id, ''), 'unknown'),
  wl.reward,
  wl.base_reward,
  wl.multiplier::numeric(6,2),
  wl.country_code,
  wl.created_at
FROM public.watch_logs AS wl
LEFT JOIN public.ad_watch_logs AS existing
  ON existing.user_id = wl.user_id
 AND existing.created_at = wl.created_at
 AND existing.ad_id = COALESCE(NULLIF(wl.ad_id, ''), 'unknown')
WHERE existing.id IS NULL;

-- Rebuild daily counters from ad_watch_logs to ensure consistency
DELETE FROM public.ad_watch_counts;
INSERT INTO public.ad_watch_counts (user_id, watch_date, count)
SELECT
  user_id,
  (created_at AT TIME ZONE 'UTC')::date AS watch_date,
  COUNT(*)::integer AS count
FROM public.ad_watch_logs
GROUP BY user_id, (created_at AT TIME ZONE 'UTC')::date;

-- -----------------------------------------------------------------------------
-- Archive legacy watch_logs table and related trigger function
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS watch_logs_after_insert_track_session ON public.watch_logs;
DROP FUNCTION IF EXISTS public.watch_logs_track_session();
ALTER TABLE IF EXISTS public.watch_logs RENAME TO watch_logs_archive;
COMMENT ON TABLE public.watch_logs_archive IS 'Archived source table from KV-based implementation. Data migrated to ad_watch_logs.';

-- -----------------------------------------------------------------------------
-- Archive KV store table and disable triggers
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS kv_store_0f597298_set_updated_at ON public.kv_store_0f597298;
ALTER TABLE IF EXISTS public.kv_store_0f597298 RENAME TO kv_store_0f597298_archive;
COMMENT ON TABLE public.kv_store_0f597298_archive IS 'Archived KV storage. Retained read-only for historical reference.';

-- -----------------------------------------------------------------------------
-- Replace legacy RPC helper with normalized implementation
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.increment_user_energy_and_watch_count(
  user_key text,
  energy_delta integer,
  last_watch_at timestamptz,
  watch_count_key text,
  watch_increment integer,
  daily_limit integer,
  watch_ad_id text,
  watch_base_reward integer,
  watch_multiplier numeric,
  watch_country_code text
);

CREATE OR REPLACE FUNCTION public.increment_user_energy_and_watch_count(
  user_key text,
  energy_delta integer,
  last_watch_at timestamptz,
  watch_count_key text,
  watch_increment integer,
  daily_limit integer,
  watch_ad_id text,
  watch_base_reward integer,
  watch_multiplier numeric,
  watch_country_code text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id text := split_part(user_key, ':', 2);
  v_effective_at timestamptz := COALESCE(last_watch_at, timezone('utc', now()));
  v_country text := NULLIF(watch_country_code, '');
  v_ad_id text := COALESCE(NULLIF(watch_ad_id, ''), 'unknown');
  v_watch_date date;
  v_existing_count integer := 0;
  v_increment integer := COALESCE(watch_increment, 0);
  v_new_count integer := 0;
  v_user public.app_users;
  v_multiplier numeric(6,2) := COALESCE(watch_multiplier, 1)::numeric(6,2);
  v_base_reward integer := COALESCE(watch_base_reward, energy_delta);
BEGIN
  IF v_user_id IS NULL OR length(trim(v_user_id)) = 0 THEN
    RAISE EXCEPTION USING MESSAGE = 'USER_NOT_FOUND', ERRCODE = 'P0002';
  END IF;

  v_user := public.app_ensure_user(v_user_id, NULL, v_country);

  BEGIN
    IF watch_count_key IS NOT NULL THEN
      v_watch_date := to_date(split_part(watch_count_key, ':', 3), 'YYYY-MM-DD');
    END IF;
  EXCEPTION
    WHEN others THEN
      v_watch_date := NULL;
  END;

  IF v_watch_date IS NULL THEN
    v_watch_date := (v_effective_at AT TIME ZONE 'UTC')::date;
  END IF;

  SELECT count
  INTO v_existing_count
  FROM public.ad_watch_counts
  WHERE user_id = v_user_id
    AND watch_date = v_watch_date;

  v_existing_count := COALESCE(v_existing_count, 0);
  v_new_count := v_existing_count + v_increment;

  IF daily_limit IS NOT NULL AND v_new_count > daily_limit THEN
    RAISE EXCEPTION USING MESSAGE = 'DAILY_LIMIT_EXCEEDED', ERRCODE = 'P0001';
  END IF;

  UPDATE public.app_users
  SET energy = energy + energy_delta,
      last_watch_at = v_effective_at,
      country_code = COALESCE(v_country, public.app_users.country_code)
  WHERE id = v_user_id
  RETURNING * INTO v_user;

  INSERT INTO public.ad_watch_counts (user_id, watch_date, count)
  VALUES (v_user_id, v_watch_date, v_new_count)
  ON CONFLICT (user_id, watch_date)
  DO UPDATE SET count = EXCLUDED.count
  RETURNING count INTO v_new_count;

  INSERT INTO public.ad_watch_logs (id, user_id, ad_id, reward, base_reward, multiplier, country_code, created_at)
  VALUES (
    gen_random_uuid(),
    v_user_id,
    v_ad_id,
    energy_delta,
    v_base_reward,
    v_multiplier,
    COALESCE(v_country, v_user.country_code),
    v_effective_at
  );

  PERFORM public.track_user_session(v_user_id, v_effective_at, COALESCE(v_country, v_user.country_code));

  RETURN jsonb_build_object(
    'user', to_jsonb(v_user),
    'watch_count', v_new_count
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- Analytics view for dashboards and frontend
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.ad_watch_daily_analytics AS
SELECT
  l.user_id,
  (l.created_at AT TIME ZONE 'UTC')::date AS watch_date,
  u.country_code,
  COUNT(*)::integer AS watch_count,
  SUM(l.reward)::integer AS total_reward,
  SUM(l.base_reward)::integer AS total_base_reward,
  AVG(l.multiplier)::numeric(6,3) AS avg_multiplier,
  MIN(l.created_at) AS first_watch_at,
  MAX(l.created_at) AS last_watch_at
FROM public.ad_watch_logs AS l
LEFT JOIN public.app_users AS u ON u.id = l.user_id
GROUP BY l.user_id, (l.created_at AT TIME ZONE 'UTC')::date, u.country_code;

GRANT SELECT ON public.ad_watch_daily_analytics TO anon, authenticated;
