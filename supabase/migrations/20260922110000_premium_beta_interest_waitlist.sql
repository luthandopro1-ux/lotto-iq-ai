-- Premium beta-interest waitlist. The row is intentionally keyed to the authenticated
-- user/workspace and never exposes another person's contact data to clients.
CREATE TABLE IF NOT EXISTS public.premium_beta_interest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz,
  UNIQUE (user_id),
  UNIQUE (workspace_id)
);

ALTER TABLE public.premium_beta_interest ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.premium_beta_interest FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.premium_beta_interest TO authenticated;
DROP POLICY IF EXISTS premium_beta_interest_self ON public.premium_beta_interest;
CREATE POLICY premium_beta_interest_self ON public.premium_beta_interest
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.register_premium_beta_interest()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_id uuid;
  v_created_at timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT id INTO v_workspace_id FROM public.workspaces WHERE owner_id = v_user_id;
  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Complete account setup before joining the Premium waitlist' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.premium_beta_interest (user_id, workspace_id)
  VALUES (v_user_id, v_workspace_id)
  ON CONFLICT (user_id) DO UPDATE SET workspace_id = EXCLUDED.workspace_id
  RETURNING id, created_at INTO v_id, v_created_at;

  RETURN jsonb_build_object('registered', true, 'id', v_id, 'created_at', v_created_at);
END;
$$;

REVOKE ALL ON FUNCTION public.register_premium_beta_interest() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_premium_beta_interest() TO authenticated;
