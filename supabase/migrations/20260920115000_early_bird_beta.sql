-- Lotto IQ AI Early Bird Beta — Lum Tech Solutions
-- One globally configured 30-day beta window; maximum 1,000 registered workspaces.
-- Beta grants Premium-equivalent product access without charging users.

CREATE TABLE IF NOT EXISTS public.beta_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  label text NOT NULL DEFAULT '100% Early Bird Beta',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  max_workspaces integer NOT NULL DEFAULT 1000 CHECK (max_workspaces > 0),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT beta_config_window_valid CHECK (ends_at > starts_at)
);

INSERT INTO public.beta_config (id, label, starts_at, ends_at, max_workspaces, enabled)
VALUES (true, '100% Early Bird Beta', now(), now() + interval '30 days', 1000, true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.workspace_entitlements
  ADD COLUMN IF NOT EXISTS beta_access boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS beta_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS beta_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS beta_position integer;

CREATE UNIQUE INDEX IF NOT EXISTS workspace_entitlements_beta_position_idx
  ON public.workspace_entitlements (beta_position)
  WHERE beta_position IS NOT NULL;

ALTER TABLE public.beta_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.beta_config FROM anon, authenticated;
GRANT SELECT ON public.beta_config TO anon, authenticated;
GRANT ALL ON public.beta_config TO service_role;
DROP POLICY IF EXISTS beta_config_public_read ON public.beta_config;
CREATE POLICY beta_config_public_read ON public.beta_config FOR SELECT TO anon, authenticated USING (enabled = true);

-- The RPC is intentionally the only mutation path for beta allocation.
CREATE OR REPLACE FUNCTION public.claim_beta_access(p_workspace_id uuid)
RETURNS TABLE (granted boolean, position integer, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg public.beta_config%ROWTYPE;
  existing_position integer;
  next_position integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = p_workspace_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Workspace ownership could not be verified';
  END IF;

  SELECT * INTO cfg FROM public.beta_config WHERE id = true FOR UPDATE;
  IF NOT FOUND OR NOT cfg.enabled OR now() < cfg.starts_at OR now() >= cfg.ends_at THEN
    RETURN QUERY SELECT false, NULL::integer, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT e.beta_position INTO existing_position
  FROM public.workspace_entitlements e
  WHERE e.workspace_id = p_workspace_id;

  IF existing_position IS NOT NULL THEN
    RETURN QUERY SELECT true, existing_position, cfg.ends_at;
    RETURN;
  END IF;

  SELECT COALESCE(MAX(e.beta_position), 0) + 1 INTO next_position
  FROM public.workspace_entitlements e
  WHERE e.beta_position IS NOT NULL;

  IF next_position > cfg.max_workspaces THEN
    RETURN QUERY SELECT false, NULL::integer, NULL::timestamptz;
    RETURN;
  END IF;

  UPDATE public.workspace_entitlements
  SET beta_access = true,
      beta_claimed_at = now(),
      beta_expires_at = cfg.ends_at,
      beta_position = next_position,
      updated_at = now()
  WHERE workspace_id = p_workspace_id;

  RETURN QUERY SELECT true, next_position, cfg.ends_at;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_beta_access(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_beta_access(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_beta_status()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT jsonb_build_object(
    'enabled', c.enabled AND now() >= c.starts_at AND now() < c.ends_at,
    'label', c.label,
    'starts_at', c.starts_at,
    'ends_at', c.ends_at,
    'max_workspaces', c.max_workspaces,
    'registered_workspaces', (SELECT count(*) FROM public.workspace_entitlements e WHERE e.beta_position IS NOT NULL)
  )
  FROM public.beta_config c
  WHERE c.id = true;
$$;

REVOKE ALL ON FUNCTION public.get_beta_status() FROM public;
GRANT EXECUTE ON FUNCTION public.get_beta_status() TO anon, authenticated;
