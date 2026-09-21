-- Lotto IQ AI — Lum Tech Solutions
-- Stores only a two-letter country code on the caller's own workspace entitlement.
-- No IP address, precise location, or identity data is written by this function.

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

  UPDATE public.workspace_entitlements e
     SET country_code = v_country_code,
         updated_at = now()
    FROM public.workspaces w
   WHERE e.workspace_id = w.id
     AND w.owner_id = v_user_id;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.record_my_country_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_my_country_code(text) TO authenticated;
