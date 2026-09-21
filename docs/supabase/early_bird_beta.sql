-- Lotto IQ AI — Lum Tech Solutions
-- Early Bird Beta deployment SQL
--
-- Prerequisites:
--   public.workspace_entitlements already exists.
--   public.workspaces already exists and has owner_id.
--   Supabase Auth is enabled.
--
-- This script is safe to run after the prerequisite tables exist. It keeps
-- registration Free and makes Early Bird Premium an explicit claim.

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
  ADD COLUMN IF NOT EXISTS early_bird_expires_at timestamptz;

-- Required because the original entitlement migration predates Early Bird.
ALTER TABLE public.workspace_entitlements
  DROP CONSTRAINT IF EXISTS workspace_entitlements_source_check;

ALTER TABLE public.workspace_entitlements
  ADD CONSTRAINT workspace_entitlements_source_check
  CHECK (source IN ('system', 'manual', 'early_bird_promo', 'stripe', 'google_play', 'apple_app_store'));

ALTER TABLE public.beta_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.beta_config FROM anon, authenticated;
GRANT SELECT ON public.beta_config TO anon, authenticated;
GRANT ALL ON public.beta_config TO service_role;

DROP POLICY IF EXISTS beta_config_public_read ON public.beta_config;
CREATE POLICY beta_config_public_read
  ON public.beta_config
  FOR SELECT
  TO anon, authenticated
  USING (enabled = true);

CREATE OR REPLACE FUNCTION public.get_early_bird_status()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT jsonb_build_object(
    'limit', c.max_workspaces,
    'claimed', (SELECT count(*) FROM public.workspace_entitlements WHERE source = 'early_bird_promo'),
    'remaining', GREATEST(0, c.max_workspaces - (SELECT count(*) FROM public.workspace_entitlements WHERE source = 'early_bird_promo')),
    'enabled', c.enabled AND now() >= c.starts_at AND now() < c.ends_at,
    'label', c.label,
    'ends_at', c.ends_at
  )
  FROM public.beta_config c
  WHERE c.id = true;
$$;

REVOKE ALL ON FUNCTION public.get_early_bird_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_early_bird_status() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_early_bird_premium()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_config public.beta_config%ROWTYPE;
  v_claimed_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_config
  FROM public.beta_config
  WHERE id = true
  FOR UPDATE;

  IF NOT FOUND OR NOT v_config.enabled OR now() < v_config.starts_at OR now() >= v_config.ends_at THEN
    RAISE EXCEPTION 'Early Bird Beta is not currently active' USING ERRCODE = 'P0003';
  END IF;

  SELECT w.id INTO v_workspace_id
  FROM public.workspaces AS w
  WHERE w.owner_id = v_user_id;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Complete account setup before claiming Premium' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.workspace_entitlements
    WHERE workspace_id = v_workspace_id
      AND source = 'early_bird_promo'
  ) THEN
    RETURN jsonb_build_object(
      'already_claimed', true,
      'claimed', true,
      'expires_at', v_config.ends_at
    );
  END IF;

  SELECT count(*) INTO v_claimed_count
  FROM public.workspace_entitlements
  WHERE source = 'early_bird_promo';

  IF v_claimed_count >= v_config.max_workspaces THEN
    RAISE EXCEPTION 'Early Bird Premium is fully claimed' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.workspace_entitlements
  SET plan_code = 'premium',
      status = 'active',
      source = 'early_bird_promo',
      early_bird_expires_at = v_config.ends_at,
      current_period_start = now(),
      current_period_end = v_config.ends_at,
      updated_at = now()
  WHERE workspace_id = v_workspace_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace entitlement was not found' USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object(
    'already_claimed', false,
    'claimed', true,
    'expires_at', v_config.ends_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_early_bird_premium() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_early_bird_premium() TO authenticated;

-- Post-deployment check:
-- SELECT * FROM public.get_early_bird_status();
