-- Early-bird Premium promo: first 1,000 workspaces to claim get Premium
-- at no cost, so real clients can test the software before billing
-- exists. This is an honest direct entitlement grant, not a discount
-- applied through a payment provider -- there is no billing provider
-- connected yet (see premium.tsx's "Checkout pending provider" state),
-- so a 100%-off "discount" and a direct grant are the same thing in
-- practice. Framed that way in the UI too, not as a real checkout.
--
-- Capped and race-safe the same way bootstrap_personal_account() is:
-- a transaction advisory lock serializes claims so concurrent requests
-- near the 1,000th slot can't both succeed.

-- Public-safe: returns only aggregate counts, never any workspace or
-- user identity, so it's fine to show to anonymous visitors on a
-- pricing/landing page as well as signed-in clients.
CREATE OR REPLACE FUNCTION public.get_early_bird_status()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT jsonb_build_object(
    'limit', 1000,
    'claimed', (SELECT count(*) FROM public.workspace_entitlements WHERE source = 'early_bird_promo'),
    'remaining', GREATEST(0, 1000 - (SELECT count(*) FROM public.workspace_entitlements WHERE source = 'early_bird_promo'))
  );
$$;

REVOKE ALL ON FUNCTION public.get_early_bird_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_early_bird_status() TO anon, authenticated;

-- Grants Premium to the caller's own workspace if a slot remains and
-- they haven't already claimed one. Idempotent: calling it again after
-- a successful claim just returns already_claimed = true, no error.
CREATE OR REPLACE FUNCTION public.claim_early_bird_premium()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_claimed_count int;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT w.id INTO v_workspace_id
    FROM public.workspaces w
   WHERE w.owner_id = v_user_id;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Complete account setup before claiming Premium' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.workspace_entitlements
    WHERE workspace_id = v_workspace_id AND source = 'early_bird_promo'
  ) THEN
    RETURN jsonb_build_object('already_claimed', true, 'claimed', true);
  END IF;

  -- Serialize claims so two requests near the 1,000th slot can't both
  -- pass the count check before either writes.
  PERFORM pg_advisory_xact_lock(hashtext('early_bird_premium_claim'));

  SELECT count(*) INTO v_claimed_count
    FROM public.workspace_entitlements
   WHERE source = 'early_bird_promo';

  IF v_claimed_count >= 1000 THEN
    RAISE EXCEPTION 'Early-bird Premium is fully claimed' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.workspace_entitlements
     SET plan_code = 'premium',
         status = 'active',
         source = 'early_bird_promo',
         updated_at = now()
   WHERE workspace_id = v_workspace_id;

  RETURN jsonb_build_object('already_claimed', false, 'claimed', true);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_early_bird_premium() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_early_bird_premium() FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_early_bird_premium() TO authenticated;
