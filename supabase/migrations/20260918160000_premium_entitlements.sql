-- Lotto IQ Premium entitlement foundation
-- Developer: Lum Tech Solutions
-- This stores server-controlled membership state only. No payment provider is enabled here.

CREATE TABLE IF NOT EXISTS public.workspace_entitlements (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  plan_code text NOT NULL DEFAULT 'free' CHECK (plan_code IN ('free', 'premium')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'expired')),
  source text NOT NULL DEFAULT 'system' CHECK (source IN ('system', 'manual', 'stripe', 'google_play', 'apple_app_store')),
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  feature_limits jsonb NOT NULL DEFAULT '{"saved_strategies": 3, "backtest_days": 90, "history_depth": 200}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workspace_entitlements ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.workspace_entitlements TO authenticated;
GRANT ALL ON public.workspace_entitlements TO service_role;

DROP POLICY IF EXISTS workspace_entitlements_read_member ON public.workspace_entitlements;
CREATE POLICY workspace_entitlements_read_member ON public.workspace_entitlements FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members m
    WHERE m.workspace_id = workspace_entitlements.workspace_id AND m.user_id = (select auth.uid())
  )
);

DROP TRIGGER IF EXISTS workspace_entitlements_touch_updated_at ON public.workspace_entitlements;
CREATE TRIGGER workspace_entitlements_touch_updated_at BEFORE UPDATE ON public.workspace_entitlements FOR EACH ROW EXECUTE FUNCTION public.touch_account_updated_at();
