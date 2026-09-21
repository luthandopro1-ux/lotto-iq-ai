-- Lotto IQ AI — Lum Tech Solutions
-- Country metadata capture and aggregate country analytics
--
-- Only a validated ISO 3166-1 alpha-2 code is stored.
-- No IP address, precise location, name, email, or browsing trail is stored.

ALTER TABLE public.workspace_entitlements
  ADD COLUMN IF NOT EXISTS country_code text;

CREATE INDEX IF NOT EXISTS workspace_entitlements_country_idx
  ON public.workspace_entitlements (country_code);

CREATE OR REPLACE FUNCTION public.record_my_country_code(p_country_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_country_code text := upper(trim(p_country_code));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF v_country_code !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'Country code must be ISO 3166-1 alpha-2' USING ERRCODE = '22023';
  END IF;

  UPDATE public.workspace_entitlements AS e
  SET country_code = v_country_code,
      updated_at = now()
  FROM public.workspaces AS w
  WHERE e.workspace_id = w.id
    AND w.owner_id = v_user_id;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.record_my_country_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_my_country_code(text) TO authenticated;

-- Administrator-only aggregate query example.
-- Execute through a protected administrator server function, not a public client.
-- It returns country totals only and does not expose workspace or user identity.
CREATE OR REPLACE FUNCTION public.get_country_analytics()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT jsonb_build_object(
    'total_workspaces', count(*)::integer,
    'unknown_country_workspaces', count(*) FILTER (WHERE country_code IS NULL OR country_code = '')::integer,
    'countries', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'country_code', country_code,
          'workspaces', workspace_count,
          'active_premium', active_premium
        )
        ORDER BY workspace_count DESC, country_code
      ) FILTER (WHERE country_code IS NOT NULL AND country_code <> ''),
      '[]'::jsonb
    )
  )
  FROM (
    SELECT
      country_code,
      count(*)::integer AS workspace_count,
      count(*) FILTER (WHERE plan_code = 'premium' AND status = 'active')::integer AS active_premium
    FROM public.workspace_entitlements
    GROUP BY country_code
  ) AS grouped;
$$;

-- Keep the analytics RPC inaccessible to public client roles. The application
-- administrator server function may call it with the approved server context.
REVOKE ALL ON FUNCTION public.get_country_analytics() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_country_analytics() TO service_role;

-- Post-deployment checks:
-- SELECT public.record_my_country_code('ZA'); -- authenticated test client only
-- SELECT public.get_country_analytics();       -- protected administrator context only
