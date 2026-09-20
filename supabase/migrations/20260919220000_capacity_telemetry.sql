-- Capacity telemetry for Lum Tech Solutions.
-- This stores minute-level aggregates only; it does not store names, emails, IP addresses, or page-level event trails.
CREATE TABLE IF NOT EXISTS public.capacity_telemetry_minute (
  bucket_start timestamptz PRIMARY KEY,
  heartbeat_count integer NOT NULL DEFAULT 0,
  sampled_heartbeat_count integer NOT NULL DEFAULT 0,
  request_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  latency_ms_total bigint NOT NULL DEFAULT 0,
  latency_ms_max integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.capacity_telemetry_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  active_user_soft_limit integer NOT NULL DEFAULT 10000 CHECK (active_user_soft_limit BETWEEN 100 AND 100000000),
  alert_percent integer NOT NULL DEFAULT 80 CHECK (alert_percent BETWEEN 1 AND 99),
  critical_percent integer NOT NULL DEFAULT 95 CHECK (critical_percent BETWEEN 2 AND 100),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.capacity_telemetry_config (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.capacity_telemetry_minute ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capacity_telemetry_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.capacity_telemetry_minute FROM anon, authenticated;
REVOKE ALL ON public.capacity_telemetry_config FROM anon, authenticated;
GRANT ALL ON public.capacity_telemetry_minute TO service_role;
GRANT ALL ON public.capacity_telemetry_config TO service_role;

CREATE OR REPLACE FUNCTION public.record_capacity_heartbeat(
  p_bucket_start timestamptz,
  p_latency_ms integer DEFAULT 0,
  p_sampled boolean DEFAULT false,
  p_error boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_bucket_start IS NULL OR p_bucket_start < now() - interval '2 hours' OR p_bucket_start > now() + interval '2 minutes' THEN
    RAISE EXCEPTION 'invalid telemetry bucket';
  END IF;
  INSERT INTO public.capacity_telemetry_minute (
    bucket_start, heartbeat_count, sampled_heartbeat_count, request_count, error_count, latency_ms_total, latency_ms_max
  ) VALUES (
    date_trunc('minute', p_bucket_start), 1, CASE WHEN p_sampled THEN 1 ELSE 0 END, 1,
    CASE WHEN p_error THEN 1 ELSE 0 END, greatest(0, least(coalesce(p_latency_ms, 0), 30000)), greatest(0, least(coalesce(p_latency_ms, 0), 30000))
  )
  ON CONFLICT (bucket_start) DO UPDATE SET
    heartbeat_count = capacity_telemetry_minute.heartbeat_count + 1,
    sampled_heartbeat_count = capacity_telemetry_minute.sampled_heartbeat_count + CASE WHEN p_sampled THEN 1 ELSE 0 END,
    request_count = capacity_telemetry_minute.request_count + 1,
    error_count = capacity_telemetry_minute.error_count + CASE WHEN p_error THEN 1 ELSE 0 END,
    latency_ms_total = capacity_telemetry_minute.latency_ms_total + greatest(0, least(coalesce(p_latency_ms, 0), 30000)),
    latency_ms_max = greatest(capacity_telemetry_minute.latency_ms_max, greatest(0, least(coalesce(p_latency_ms, 0), 30000))),
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_capacity_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config jsonb;
  v_current jsonb;
  v_hourly jsonb;
  v_busy jsonb;
  v_limit integer;
  v_alert integer;
  v_critical integer;
BEGIN
  IF NOT public.is_administrator() THEN RAISE EXCEPTION 'administrator access required'; END IF;
  SELECT jsonb_build_object(
    'active_user_soft_limit', active_user_soft_limit,
    'alert_percent', alert_percent,
    'critical_percent', critical_percent
  ), active_user_soft_limit, alert_percent, critical_percent
  INTO v_config, v_limit, v_alert, v_critical
  FROM public.capacity_telemetry_config WHERE id = true;

  SELECT jsonb_build_object(
    'bucket_start', coalesce(bucket_start, date_trunc('minute', now())),
    'active_users_estimate', coalesce(heartbeat_count, 0),
    'requests', coalesce(request_count, 0),
    'errors', coalesce(error_count, 0),
    'average_latency_ms', CASE WHEN coalesce(request_count, 0) = 0 THEN 0 ELSE round(latency_ms_total::numeric / request_count, 1) END,
    'max_latency_ms', coalesce(latency_ms_max, 0),
    'capacity_percent', CASE WHEN v_limit = 0 THEN 0 ELSE round((coalesce(heartbeat_count, 0)::numeric / v_limit) * 100, 1) END,
    'alert_level', CASE
      WHEN coalesce(heartbeat_count, 0) >= v_limit * v_critical / 100 THEN 'critical'
      WHEN coalesce(heartbeat_count, 0) >= v_limit * v_alert / 100 THEN 'warning'
      ELSE 'normal'
    END
  ) INTO v_current
  FROM public.capacity_telemetry_minute
  WHERE bucket_start = date_trunc('minute', now());

  SELECT coalesce(jsonb_agg(to_jsonb(h) ORDER BY h.hour_start), '[]'::jsonb) INTO v_hourly
  FROM (
    SELECT date_trunc('hour', bucket_start) AS hour_start,
      max(heartbeat_count) AS peak_active_users_estimate,
      sum(request_count)::integer AS requests,
      sum(error_count)::integer AS errors,
      round(sum(latency_ms_total)::numeric / nullif(sum(request_count), 0), 1) AS average_latency_ms
    FROM public.capacity_telemetry_minute
    WHERE bucket_start >= now() - interval '24 hours'
    GROUP BY 1
  ) h;

  SELECT coalesce(jsonb_agg(to_jsonb(b) ORDER BY b.peak_active_users_estimate DESC), '[]'::jsonb) INTO v_busy
  FROM (
    SELECT extract(hour FROM date_trunc('hour', bucket_start))::integer AS hour_of_day,
      max(heartbeat_count) AS peak_active_users_estimate,
      sum(request_count)::integer AS requests
    FROM public.capacity_telemetry_minute
    WHERE bucket_start >= now() - interval '7 days'
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 6
  ) b;

  RETURN jsonb_build_object('config', v_config, 'current', coalesce(v_current, '{}'::jsonb), 'hourly', v_hourly, 'busy_periods', v_busy);
END;
$$;

REVOKE ALL ON FUNCTION public.record_capacity_heartbeat(timestamptz, integer, boolean, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.record_capacity_heartbeat(timestamptz, integer, boolean, boolean) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.get_capacity_metrics() FROM public;
GRANT EXECUTE ON FUNCTION public.get_capacity_metrics() TO authenticated;

-- Keep the telemetry table bounded. Run this from the existing database scheduler once per day.
CREATE OR REPLACE FUNCTION public.prune_capacity_telemetry()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.capacity_telemetry_minute WHERE bucket_start < now() - interval '35 days';
$$;
GRANT EXECUTE ON FUNCTION public.prune_capacity_telemetry() TO service_role;
